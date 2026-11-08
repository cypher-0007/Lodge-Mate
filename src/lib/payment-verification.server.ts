/**
 * Server-side payment verification module for LodgeMate.
 * 
 * Provides provider-independent verification (Paystack and Flutterwave)
 * ensuring no client-side payment reference or amount can ever be spoofed.
 *
 * Payment lifecycle:
 *   1. initiateBetaCheckout()     — snapshots current config → creates beta_pending_payments row
 *   2. verifyAndIssueBetaAccessPass() — verifies with gateway → confirms pending → issues pass
 *
 * The verification step compares against the SNAPSHOT in beta_pending_payments,
 * never against the live beta_lodges_config. This prevents race conditions when
 * the administrator changes pricing while a student is completing checkout.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PaymentProvider = "paystack" | "flutterwave";

export type VerifiedPaymentResult = {
  success: boolean;
  reference: string;
  amountNgn: number;
  currency: string;
  provider: PaymentProvider;
  customerEmail?: string;
  error?: string;
};

/**
 * Verifies transaction with Paystack using server secret key.
 */
async function verifyPaystack(reference: string): Promise<VerifiedPaymentResult> {
  const secretKey = process.env["PAYSTACK_SECRET_KEY"];
  if (!secretKey) {
    return {
      success: false,
      reference,
      amountNgn: 0,
      currency: "NGN",
      provider: "paystack",
      error: "Paystack secret key is not configured on the server",
    };
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    const body = await response.json();

    if (!response.ok || !body.status || body.data?.status !== "success") {
      return {
        success: false,
        reference,
        amountNgn: 0,
        currency: "NGN",
        provider: "paystack",
        error: body.message || "Paystack transaction verification failed",
      };
    }

    // Validate transaction currency is Nigerian Naira (NGN)
    const currency = (body.data.currency || "NGN").toUpperCase();
    if (currency !== "NGN") {
      return {
        success: false,
        reference,
        amountNgn: 0,
        currency,
        provider: "paystack",
        error: `Transaction currency is ${currency}. Only NGN payments are accepted.`,
      };
    }

    // Paystack returns amount in Kobo (1 NGN = 100 Kobo)
    const amountKobo = Number(body.data.amount) || 0;
    const amountNgn = Math.round(amountKobo / 100);

    return {
      success: true,
      reference: body.data.reference || reference,
      amountNgn,
      currency: "NGN",
      provider: "paystack",
      customerEmail: body.data.customer?.email,
    };
  } catch (err) {
    return {
      success: false,
      reference,
      amountNgn: 0,
      currency: "NGN",
      provider: "paystack",
      error: err instanceof Error ? err.message : "Network error verifying with Paystack",
    };
  }
}

/**
 * Verifies transaction with Flutterwave using server secret key.
 */
async function verifyFlutterwave(reference: string): Promise<VerifiedPaymentResult> {
  const secretKey = process.env["FLUTTERWAVE_SECRET_KEY"];
  if (!secretKey) {
    return {
      success: false,
      reference,
      amountNgn: 0,
      currency: "NGN",
      provider: "flutterwave",
      error: "Flutterwave secret key is not configured on the server",
    };
  }

  try {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const body = await response.json();

    if (!response.ok || body.status !== "success" || body.data?.status !== "successful") {
      return {
        success: false,
        reference,
        amountNgn: 0,
        currency: "NGN",
        provider: "flutterwave",
        error: body.message || "Flutterwave transaction verification failed",
      };
    }

    // Validate transaction currency is Nigerian Naira (NGN)
    const currency = (body.data.currency || "NGN").toUpperCase();
    if (currency !== "NGN") {
      return {
        success: false,
        reference,
        amountNgn: 0,
        currency,
        provider: "flutterwave",
        error: `Transaction currency is ${currency}. Only NGN payments are accepted.`,
      };
    }

    // Flutterwave returns amount in full currency units (NGN)
    const amountNgn = Math.round(Number(body.data.amount) || 0);

    return {
      success: true,
      reference: body.data.tx_ref || reference,
      amountNgn,
      currency: "NGN",
      provider: "flutterwave",
      customerEmail: body.data.customer?.email,
    };
  } catch (err) {
    return {
      success: false,
      reference,
      amountNgn: 0,
      currency: "NGN",
      provider: "flutterwave",
      error: err instanceof Error ? err.message : "Network error verifying with Flutterwave",
    };
  }
}

/**
 * Provider-independent payment verification dispatcher.
 */
export async function verifyTransactionWithProvider(
  reference: string,
  provider: PaymentProvider = "paystack",
): Promise<VerifiedPaymentResult> {
  if (provider === "flutterwave") {
    return verifyFlutterwave(reference);
  }
  return verifyPaystack(reference);
}

/**
 * Initiates a Beta Lodges checkout session.
 *
 * Fetches the current dynamic configuration from the backend and creates a
 * pending payment record that snapshots the fee, currency and duration at the
 * moment the student clicks "Pay". The payment gateway should be initialised
 * using the snapshot amount returned here.
 *
 * During subsequent verification the snapshot — not the live config — is used
 * to validate the transaction, so admin price changes after this point do not
 * affect already-initiated checkouts.
 */
export async function initiateBetaCheckout({
  userId,
  paymentReference,
  provider = "paystack",
}: {
  userId: string;
  paymentReference: string;
  provider?: PaymentProvider;
}) {
  if (!userId || !paymentReference) {
    return { success: false as const, error: "Missing required user ID or payment reference" };
  }

  // Verify student account exists and is not banned
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, banned")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false as const, error: "Student account not found" };
  }
  if (profile.banned) {
    return { success: false as const, error: "This student account is suspended and cannot purchase access." };
  }

  // Delegate to the SECURITY DEFINER SQL function which atomically:
  // - reads the current config
  // - checks for reference uniqueness
  // - inserts the pending record with the snapshot
  const { data: pending, error: rpcError } = await supabaseAdmin.rpc("initiate_beta_checkout", {
    _user_id: userId,
    _payment_ref: paymentReference,
    _provider: provider,
  });

  if (rpcError || !pending) {
    return { success: false as const, error: rpcError?.message ?? "Failed to initiate checkout session" };
  }

  return {
    success: true as const,
    pending,
    // Return the snapshot amounts so the client can initialise the payment gateway
    snapshotFeeNgn: pending.snapshot_fee_ngn,
    snapshotDurationDays: pending.snapshot_duration_days,
    snapshotCurrency: pending.snapshot_currency,
  };
}

/**
 * Securely verifies payment with the gateway and issues a Beta Lodges access pass.
 *
 * Enforces:
 * 1. Retrieval of the pending payment record (snapshot created at checkout initiation).
 * 2. Ownership check: the verifying user must be the student who initiated checkout.
 * 3. Pending record status check: must still be 'pending' and not expired.
 * 4. Verification directly with Paystack or Flutterwave.
 * 5. Amount check against the SNAPSHOT fee (not the live backend configuration).
 * 6. Atomic confirmation via confirm_beta_pending_payment() SQL function which:
 *    - Locks the pending record (prevents concurrent duplicate verification).
 *    - Re-validates amount, status and expiry inside the transaction.
 *    - Marks pending record as 'completed'.
 *    - Inserts the access pass using snapshot amounts.
 * 7. Uses admin service role for all database writes (students cannot self-insert).
 */
export async function verifyAndIssueBetaAccessPass({
  userId,
  paymentReference,
  provider = "paystack",
}: {
  userId: string;
  paymentReference: string;
  provider?: PaymentProvider;
}) {
  if (!userId || !paymentReference) {
    return { success: false, error: "Missing required user ID or payment reference" };
  }

  // 1. Verify student account status
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, banned")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Student account not found" };
  }
  if (profile.banned) {
    return { success: false, error: "This student account is suspended and cannot purchase access." };
  }

  // 2. Retrieve the pending payment snapshot created at checkout initiation
  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("beta_pending_payments")
    .select("id, user_id, payment_reference, payment_provider, snapshot_fee_ngn, snapshot_duration_days, snapshot_currency, status, expires_at")
    .eq("payment_reference", paymentReference)
    .maybeSingle();

  if (pendingError || !pending) {
    return {
      success: false,
      error: "No checkout session found for this payment reference. Please restart checkout.",
    };
  }

  // 3. Ownership check
  if (pending.user_id !== userId) {
    return { success: false, error: "Payment reference does not belong to this user." };
  }

  // 4. Check the pending record is still actionable
  if (pending.status === "completed") {
    return { success: false, error: "This payment reference has already been used to issue an access pass." };
  }
  if (pending.status === "expired" || new Date(pending.expires_at) < new Date()) {
    return { success: false, error: "Checkout session has expired. Please start a new checkout." };
  }
  if (pending.status !== "pending") {
    return { success: false, error: `Checkout session is in status '${pending.status}' and cannot be completed.` };
  }

  // 5. Verify transaction directly with the payment provider API
  const verified = await verifyTransactionWithProvider(paymentReference, provider);
  if (!verified.success) {
    // Mark pending as failed so the student knows to try again
    await supabaseAdmin
      .from("beta_pending_payments")
      .update({ status: "failed" })
      .eq("id", pending.id);
    return { success: false, error: verified.error || "Payment verification failed with provider" };
  }

  // 6. Pre-check amount against snapshot before entering the DB function
  //    (the DB function also validates, this is an early-exit optimisation)
  if (verified.amountNgn < pending.snapshot_fee_ngn) {
    await supabaseAdmin
      .from("beta_pending_payments")
      .update({ status: "failed" })
      .eq("id", pending.id);
    return {
      success: false,
      error: `Payment amount (₦${verified.amountNgn}) is less than the checkout price (₦${pending.snapshot_fee_ngn})`,
    };
  }

  // 7. Atomically confirm the pending record and issue the access pass.
  //    The SQL function re-validates everything inside a transaction with a row lock
  //    to prevent duplicate passes from concurrent requests.
  const { data: newPass, error: confirmError } = await supabaseAdmin.rpc(
    "confirm_beta_pending_payment",
    {
      _payment_ref: paymentReference,
      _verified_amount_ngn: verified.amountNgn,
      _user_id: userId,
    },
  );

  if (confirmError || !newPass) {
    return { success: false, error: confirmError?.message || "Failed to issue access pass record" };
  }

  return {
    success: true,
    pass: newPass,
  };
}

