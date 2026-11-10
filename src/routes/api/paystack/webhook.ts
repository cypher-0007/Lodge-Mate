/**
 * Paystack webhook endpoint: POST /api/paystack/webhook
 *
 * This is a TanStack Start server route that receives Paystack webhook
 * deliveries. It is a pure server-side HTTP handler — it has no React
 * component and renders nothing in the browser.
 *
 * HOW TO REGISTER THIS WEBHOOK IN PAYSTACK:
 *   1. Go to https://dashboard.paystack.com/#/settings/developers
 *   2. Under "API Keys & Webhooks", set the Webhook URL to:
 *        https://<your-domain>/api/paystack/webhook
 *   3. No separate webhook secret is required — Paystack signs webhooks
 *        with the same PAYSTACK_SECRET_KEY already in your environment.
 *   4. For local testing use ngrok (or similar) to expose localhost:
 *        ngrok http 3000
 *      Then set the webhook URL to:
 *        https://<ngrok-subdomain>.ngrok-free.app/api/paystack/webhook
 *
 * SECURITY:
 *   Every request is verified by HMAC-SHA512 signature (x-paystack-signature
 *   header) BEFORE any business logic runs. Requests without a valid signature
 *   are rejected with 401. Only then is the transaction independently re-verified
 *   with Paystack's /transaction/verify/ API.
 *
 * IDEMPOTENCY:
 *   If the browser callback already issued the access pass, Paystack may still
 *   fire the webhook. The underlying confirm_beta_pending_payment() SQL function
 *   uses a FOR UPDATE row lock and checks the pending record status, so a
 *   duplicate delivery cannot create a second pass.
 *
 * HTTP RESPONSES:
 *   200 OK        — Processed (or intentionally skipped). Paystack stops retrying.
 *   401           — Invalid or missing signature. Never retry until signature is fixed.
 *   405           — Method not allowed (GET, PUT, etc.)
 *   500           — Temporary processing failure. Paystack will retry.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  handlePaystackWebhook,
  verifyPaystackSignature,
} from "@/lib/paystack-webhook.server";

export const Route = createFileRoute("/api/paystack/webhook")({
  // No React component — this URL only handles server-side HTTP requests.
  // If someone navigates here in a browser they get a blank page; that is fine.
  component: () => null,

  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── 1. Read the raw body BEFORE anything else ────────────────────────
        // The body stream can only be consumed once. We read it as text so we
        // can verify the HMAC signature over the exact bytes Paystack sent —
        // any re-serialisation would invalidate the signature.
        let rawBody: string;
        try {
          rawBody = await request.text();
        } catch {
          return new Response(
            JSON.stringify({ error: "Failed to read request body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── 2. Verify HMAC-SHA512 signature ─────────────────────────────────
        // Reject BEFORE any business logic. Timing-safe comparison.
        const signature = request.headers.get("x-paystack-signature") ?? "";

        if (!verifyPaystackSignature(rawBody, signature)) {
          console.warn("[Paystack Webhook] Invalid signature — request rejected");
          return new Response(
            JSON.stringify({ error: "Invalid webhook signature" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── 3. Process the verified webhook ─────────────────────────────────
        let result: Awaited<ReturnType<typeof handlePaystackWebhook>>;
        try {
          result = await handlePaystackWebhook(rawBody);
        } catch (err) {
          // Unexpected exception — log safely (no rawBody, no payment data)
          console.error(
            "[Paystack Webhook] Unhandled exception during processing:",
            err instanceof Error ? err.message : "Unknown error",
          );
          // Return 500 so Paystack retries. The handler is idempotent.
          return new Response(
            JSON.stringify({ error: "Internal server error — will retry" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── 4. Map result to HTTP response ───────────────────────────────────
        // "ok" and "skip" both return 200 — Paystack should stop retrying.
        // "error" returns 500 — Paystack will retry (the handler is idempotent).
        if (result.status === "error") {
          return new Response(
            JSON.stringify({ received: true, status: "error", detail: result.reason }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ received: true, status: result.status }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },

      // ── Reject all other HTTP methods ──────────────────────────────────────
      GET: async () =>
        new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { "Content-Type": "application/json", Allow: "POST" } },
        ),
    },
  },
});

