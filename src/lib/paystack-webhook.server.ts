/**
 * Paystack webhook verification and processing for LodgeMate.
 *
 * This module handles the server-side verification of Paystack webhook
 * deliveries. It is the recovery mechanism for the browser callback: if
 * the browser's onSuccess callback fires but the subsequent server
 * verification call fails (network error, page close, timeout), Paystack
 * will retry the webhook until it receives a 200 OK.
 *
 * Security model:
 *   1. HMAC-SHA512 signature verified with timing-safe comparison BEFORE any
 *      business logic runs. Invalid signatures are rejected immediately.
 *   2. Only "charge.success" events trigger further processing.
 *   3. The transaction reference extracted from the webhook payload is
 *      independently re-verified directly with Paystack's API — the payload
 *      alone is never trusted to grant access.
 *   4. All pass issuance goes through the existing
 *      verifyAndIssueBetaAccessPass() function which uses the atomic
 *      confirm_beta_pending_payment() SQL function (FOR UPDATE row lock).
 *      Duplicate webhook deliveries therefore cannot create duplicate passes.
 *
 * PAYSTACK_SECRET_KEY is used both as:
 *   - The HMAC signature key (Paystack signs webhooks with the same key)
 *   - The Bearer token for Paystack's /transaction/verify/ API
 *
 * No separate PAYSTACK_WEBHOOK_SECRET is needed — Paystack uses the account
 * secret key for both signing and verification.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { verifyAndIssueBetaAccessPass } from "@/lib/payment-verification.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WebhookHandlerResult =
  | { status: "ok"; message: string }
  | { status: "skip"; reason: string }
  | { status: "error"; reason: string };

/**
 * Minimum shape of a Paystack webhook payload we care about.
 * We only process "charge.success" events.
 */
interface PaystackChargeSuccessPayload {
  event: "charge.success";
  data: {
    reference: string;
    status: string;
    amount: number; // in Kobo
    currency: string;
    customer: {
      email: string;
      id?: number;
    };
    metadata?: Record<string, unknown>;
  };
}

interface PaystackWebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

// ─── Signature verification ───────────────────────────────────────────────────

/**
 * Verifies the x-paystack-signature header using HMAC-SHA512.
 *
 * Paystack signs the raw request body with the account secret key using
 * HMAC-SHA512 and sends the hex digest as the x-paystack-signature header.
 *
 * Uses Node.js timingSafeEqual() to prevent timing-based side-channel attacks.
 *
 * @returns true if the signature is valid, false otherwise.
 */
export function verifyPaystackSignature(rawBody: string, signature: string): boolean {
  const secretKey = process.env["PAYSTACK_SECRET_KEY"];
  if (!secretKey) {
    console.error("[Paystack Webhook] PAYSTACK_SECRET_KEY is not configured — cannot verify signature");
    return false;
  }

  if (!signature || typeof signature !== "string") {
    return false;
  }

  try {
    const expectedHex = createHmac("sha512", secretKey)
      .update(rawBody, "utf8")
      .digest("hex");

    // Both buffers must be the same byte length for timingSafeEqual
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const receivedBuf = Buffer.from(signature, "hex");

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ─── Payload parsing ─────────────────────────────────────────────────────────

/**
 * Safely parses and type-narrows the webhook payload.
 * Returns null if the payload is malformed or not a charge.success event.
 */
function parseChargeSuccessPayload(
  rawBody: string,
): PaystackChargeSuccessPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("event" in parsed) ||
    !("data" in parsed)
  ) {
    return null;
  }

  const payload = parsed as PaystackWebhookPayload;

  if (payload.event !== "charge.success") {
    return null;
  }

  const data = payload.data;
  if (
    typeof data !== "object" ||
    data === null ||
    typeof data["reference"] !== "string" ||
    typeof data["status"] !== "string" ||
    typeof data["amount"] !== "number" ||
    typeof data["currency"] !== "string"
  ) {
    return null;
  }

  return payload as unknown as PaystackChargeSuccessPayload;
}

// ─── User ID resolution ───────────────────────────────────────────────────────

/**
 * Looks up the user_id for a given payment reference from the pending payments
 * snapshot table. This is how the webhook finds which student owns the payment.
 *
 * We cannot trust the customer metadata in the webhook payload for user_id
 * resolution — the payload is from an external source. We always resolve from
 * our own database using the payment reference as the key.
 */
async function resolveUserIdFromReference(reference: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("beta_pending_payments")
    .select("user_id, status, expires_at")
    .eq("payment_reference", reference)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.user_id;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Processes a verified Paystack webhook delivery.
 *
 * Call this ONLY after verifyPaystackSignature() returns true.
 *
 * Idempotent: if the pending payment has already been completed (by the browser
 * callback), verifyAndIssueBetaAccessPass() returns a "already used" error and
 * this function returns status "skip" — no duplicate pass is created.
 *
 * @param rawBody The raw request body string (already signature-verified).
 * @returns WebhookHandlerResult describing the outcome.
 */
export async function handlePaystackWebhook(rawBody: string): Promise<WebhookHandlerResult> {
  // ── 1. Parse and type-narrow the payload ──────────────────────────────────
  const payload = parseChargeSuccessPayload(rawBody);

  if (!payload) {
    // Not a charge.success event — Paystack sends many event types (e.g.,
    // "transfer.success", "subscription.create"). These are not errors; we
    // simply acknowledge receipt and ignore them.
    let eventName = "unknown";
    try {
      const raw = JSON.parse(rawBody) as { event?: string };
      if (typeof raw.event === "string") eventName = raw.event;
    } catch {
      // ignore
    }
    console.info(`[Paystack Webhook] Ignoring event: ${eventName}`);
    return { status: "skip", reason: `Event '${eventName}' is not handled` };
  }

  const { reference, status, amount, currency } = payload.data;

  // ── 2. Guard: only process confirmed successful charges ───────────────────
  if (status !== "success") {
    console.info(`[Paystack Webhook] charge.success event for ref ${reference} has status '${status}' — skipping`);
    return { status: "skip", reason: `Payment status is '${status}', not 'success'` };
  }

  // ── 3. Guard: currency check ──────────────────────────────────────────────
  if (currency.toUpperCase() !== "NGN") {
    console.warn(`[Paystack Webhook] Unexpected currency ${currency} for ref ${reference}`);
    return { status: "skip", reason: `Currency '${currency}' is not NGN` };
  }

  // ── 4. Guard: amount sanity check (> 0, in Kobo) ─────────────────────────
  if (!amount || amount <= 0) {
    console.warn(`[Paystack Webhook] Zero or negative amount (${amount} Kobo) for ref ${reference}`);
    return { status: "skip", reason: "Invalid payment amount in webhook payload" };
  }

  console.info(`[Paystack Webhook] Processing charge.success for ref: ${reference} (${amount / 100} NGN)`);

  // ── 5. Resolve student user_id from our own DB (never from payload) ───────
  const userId = await resolveUserIdFromReference(reference);
  if (!userId) {
    // The reference is not in beta_pending_payments.
    // This can legitimately happen if Paystack sends a webhook for a non-Beta
    // Lodge transaction (e.g., a future feature). Log and acknowledge safely.
    console.info(`[Paystack Webhook] No pending Beta payment found for ref: ${reference} — not a Beta Lodge transaction`);
    return { status: "skip", reason: "No pending Beta Lodge payment found for this reference" };
  }

  // ── 6. Verify the transaction independently with Paystack API and issue pass
  //       verifyAndIssueBetaAccessPass:
  //       - Re-fetches the pending snapshot from DB
  //       - Verifies ownership (pending.user_id === userId)
  //       - Checks pending status (returns early if already 'completed')
  //       - Calls Paystack /transaction/verify/{reference} with PAYSTACK_SECRET_KEY
  //       - Compares amount against snapshot
  //       - Calls confirm_beta_pending_payment() SQL function (FOR UPDATE lock)
  //       - Issues the access pass via service_role
  const result = await verifyAndIssueBetaAccessPass({
    userId,
    paymentReference: reference,
    provider: "paystack",
  });

  if (!result.success) {
    const error = result.error ?? "Unknown error";

    // These are "already handled" outcomes — idempotent, not errors from
    // Paystack's perspective. Return 200 so Paystack stops retrying.
    if (
      error.includes("already been used") ||
      error.includes("already issued") ||
      error.includes("status 'completed'")
    ) {
      console.info(`[Paystack Webhook] Pass already issued for ref: ${reference} — ${error}`);
      return { status: "skip", reason: "Access pass already issued for this payment" };
    }

    // Expired checkout — the student took too long. No recovery possible.
    if (error.includes("expired")) {
      console.warn(`[Paystack Webhook] Checkout session expired for ref: ${reference}`);
      return { status: "skip", reason: "Checkout session has expired" };
    }

    // Genuine processing failure — log it. Paystack will retry.
    console.error(`[Paystack Webhook] Failed to issue pass for ref: ${reference} — ${error}`);
    return { status: "error", reason: error };
  }

  console.info(`[Paystack Webhook] ✓ Beta Access Pass issued for ref: ${reference}`);
  return { status: "ok", message: `Beta Access Pass issued successfully for reference ${reference}` };
}
