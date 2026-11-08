import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server function: initiate a Beta Lodges checkout session.
 *
 * Creates a pending payment record that snapshots the current fee, duration
 * and currency. The client must use the returned snapshot amounts to initialise
 * the payment gateway — not any locally cached or hardcoded values.
 */
export const initiateBetaCheckoutServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { paymentReference: string; provider?: "paystack" | "flutterwave" }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { initiateBetaCheckout } = await import("./payment-verification.server");
    return initiateBetaCheckout({
      userId,
      paymentReference: data.paymentReference,
      provider: data.provider ?? "paystack",
    });
  });

/**
 * Server function: verify a completed payment and issue the access pass.
 *
 * Verifies the transaction directly with the payment gateway and confirms
 * the pending payment record. The access pass is issued using the snapshot
 * amounts recorded at checkout initiation — not the live configuration.
 */
export const verifyBetaPaymentServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { paymentReference: string; provider?: "paystack" | "flutterwave" }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { verifyAndIssueBetaAccessPass } = await import("./payment-verification.server");
    return verifyAndIssueBetaAccessPass({
      userId,
      paymentReference: data.paymentReference,
      provider: data.provider ?? "paystack",
    });
  });

