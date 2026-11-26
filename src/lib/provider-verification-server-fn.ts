import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProviderVerificationFiles } from "@/lib/provider-verification.server";

export const createProviderVerificationCheckoutServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      requestId: string;
      paymentReference: string;
      providerType: "landlord" | "agent";
      files: ProviderVerificationFiles;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { createProviderVerificationCheckout } = await import("./provider-verification.server");
    return createProviderVerificationCheckout({ ...data, userId: context.userId });
  });

export const verifyProviderVerificationPaymentServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { paymentReference: string }) => data)
  .handler(async ({ data, context }) => {
    const { verifyProviderVerificationPayment } = await import("./provider-verification.server");
    return verifyProviderVerificationPayment({ ...data, userId: context.userId });
  });
