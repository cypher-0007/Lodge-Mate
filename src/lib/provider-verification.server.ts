import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyTransactionWithProvider } from "@/lib/payment-verification.server";

export const PROVIDER_VERIFICATION_FEE_NGN = 3500;

export type ProviderVerificationFiles = {
  idDocumentPath: string;
  selfiePath: string;
  propertyProofPath: string;
};

function isOwnedEvidencePath(path: string, userId: string, requestId: string) {
  return path.startsWith(`${userId}/${requestId}/`) && !path.includes("..") && !path.startsWith("/");
}

export async function createProviderVerificationCheckout({
  userId,
  requestId,
  paymentReference,
  providerType,
  files,
}: {
  userId: string;
  requestId: string;
  paymentReference: string;
  providerType: "landlord" | "agent";
  files: ProviderVerificationFiles;
}) {
  if (!process.env["PAYSTACK_SECRET_KEY"]) {
    return { success: false as const, error: "Paystack server key is not configured yet." };
  }

  if (
    !isOwnedEvidencePath(files.idDocumentPath, userId, requestId) ||
    !isOwnedEvidencePath(files.selfiePath, userId, requestId) ||
    !isOwnedEvidencePath(files.propertyProofPath, userId, requestId)
  ) {
    return { success: false as const, error: "Verification evidence paths are invalid." };
  }

  const { data: authResponse, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  const authUser = authResponse.user;
  if (authError || !authUser) {
    return { success: false as const, error: "Your LodgeMate account could not be verified." };
  }
  if (!authUser.email_confirmed_at) {
    return { success: false as const, error: "Verify your email before applying for provider verification." };
  }
  const { data: profile, error: profileError } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, provider_type, banned")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false as const, error: "Provider profile not found." };
  }
  if (profile.banned) {
    return { success: false as const, error: "This account is suspended and cannot apply." };
  }
  if (profile.provider_type !== providerType) {
    return { success: false as const, error: "The selected provider type does not match your account." };
  }
  const db = supabaseAdmin as any;
  const { data: activeRequest, error: activeError } = await db
    .from("provider_verification_requests")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["awaiting_payment", "in_review", "approved"])
    .maybeSingle();

  if (activeError) return { success: false as const, error: activeError.message };
  if (activeRequest && activeRequest.id !== requestId) {
    return {
      success: false as const,
      error:
        activeRequest.status === "in_review"
          ? "Your application is already under review."
          : activeRequest.status === "approved"
            ? "This provider account is already verified."
            : "Resume payment for your existing verification application.",
    };
  }
  if (activeRequest?.status === "in_review" || activeRequest?.status === "approved") {
    return {
      success: false as const,
      error: activeRequest.status === "in_review" ? "Your application is already under review." : "This provider account is already verified.",
    };
  }

  const { error: requestError } = await db.from("provider_verification_requests").upsert(
    {
      id: requestId,
      user_id: userId,
      provider_type: providerType,
      status: "awaiting_payment",
      id_document_path: files.idDocumentPath,
      selfie_path: files.selfiePath,
      property_proof_path: files.propertyProofPath,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (requestError) return { success: false as const, error: requestError.message };

  const { error: paymentError } = await db.from("provider_verification_payments").insert({
    request_id: requestId,
    user_id: userId,
    payment_reference: paymentReference,
    amount_ngn: PROVIDER_VERIFICATION_FEE_NGN,
    currency: "NGN",
    status: "pending",
  });
  if (paymentError) return { success: false as const, error: paymentError.message };

  return {
    success: true as const,
    requestId,
    amountNgn: PROVIDER_VERIFICATION_FEE_NGN,
    amountKobo: PROVIDER_VERIFICATION_FEE_NGN * 100,
    currency: "NGN" as const,
  };
}

async function completeProviderVerificationPayment(paymentReference: string) {
  const db = supabaseAdmin as any;
  const { data: payment, error: paymentError } = await db
    .from("provider_verification_payments")
    .select("id, request_id, user_id, amount_ngn, status")
    .eq("payment_reference", paymentReference)
    .maybeSingle();

  if (paymentError) return { found: true as const, success: false as const, error: paymentError.message };
  if (!payment) return { found: false as const, success: false as const, error: "Payment reference not found." };
  if (payment.status === "paid") {
    return { found: true as const, success: true as const, requestId: payment.request_id };
  }
  if (payment.status !== "pending") {
    return { found: true as const, success: false as const, error: "This verification payment is not pending." };
  }

  const verified = await verifyTransactionWithProvider(paymentReference, "paystack");
  if (!verified.success) {
    return { found: true as const, success: false as const, error: verified.error ?? "Paystack verification failed." };
  }
  if (
    verified.amountKobo !== PROVIDER_VERIFICATION_FEE_NGN * 100 ||
    verified.amountNgn !== payment.amount_ngn ||
    verified.currency !== "NGN"
  ) {
    return { found: true as const, success: false as const, error: "The verified payment does not match the verification fee." };
  }

  const { data: request } = await db
    .from("provider_verification_requests")
    .select("user_id")
    .eq("id", payment.request_id)
    .maybeSingle();
  if (!request || request.user_id !== payment.user_id) {
    return { found: true as const, success: false as const, error: "Verification payment ownership check failed." };
  }

  const { data: authResponse } = await supabaseAdmin.auth.admin.getUserById(payment.user_id);
  if (
    verified.customerEmail &&
    authResponse.user?.email &&
    verified.customerEmail.toLowerCase() !== authResponse.user.email.toLowerCase()
  ) {
    return { found: true as const, success: false as const, error: "The payment email does not match your LodgeMate account." };
  }

  const { data: requestId, error: completeError } = await db.rpc("complete_provider_verification_payment", {
    _payment_reference: paymentReference,
    _verified_amount_ngn: verified.amountNgn,
  });
  if (completeError || !requestId) {
    return { found: true as const, success: false as const, error: completeError?.message ?? "Could not submit your paid application." };
  }
  return { found: true as const, success: true as const, requestId: requestId as string };
}

export async function verifyProviderVerificationPayment({
  userId,
  paymentReference,
}: {
  userId: string;
  paymentReference: string;
}) {
  const db = supabaseAdmin as any;
  const { data: payment, error } = await db
    .from("provider_verification_payments")
    .select("user_id")
    .eq("payment_reference", paymentReference)
    .maybeSingle();
  if (error || !payment || payment.user_id !== userId) {
    return { success: false as const, error: "Payment reference does not belong to this account." };
  }
  const result = await completeProviderVerificationPayment(paymentReference);
  return result.success
    ? { success: true as const, requestId: result.requestId }
    : { success: false as const, error: result.error };
}

export async function processProviderVerificationWebhook(paymentReference: string) {
  return completeProviderVerificationPayment(paymentReference);
}
