import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileCheck2, Loader2, LockKeyhole, ShieldCheck, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  createProviderVerificationCheckoutServerFn,
  verifyProviderVerificationPaymentServerFn,
} from "@/lib/provider-verification-server-fn";

export const Route = createFileRoute("/_authenticated/verify-provider")({
  head: () => ({
    meta: [
      { title: "Provider Verification — LodgeMate" },
      { name: "description", content: "Submit your LodgeMate landlord or agent profile for verification." },
    ],
  }),
  component: ProviderVerificationPage,
});

type EvidenceKind = "id" | "selfie" | "property";
type EvidenceFiles = Record<EvidenceKind, File | null>;

function loadPaystack(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as Window & { PaystackPop?: unknown };
    if (w.PaystackPop) return resolve();
    const existing = document.getElementById("paystack-inline-js");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Paystack.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "paystack-inline-js";
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Paystack."));
    document.head.appendChild(script);
  });
}

function ProviderVerificationPage() {
  const { user, profile, providerType } = useAuth();
  const queryClient = useQueryClient();
  const [evidence, setEvidence] = useState<EvidenceFiles>({ id: null, selfie: null, property: null });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const requestQuery = useQuery({
    queryKey: ["provider-verification-request", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("provider_verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const request = requestQuery.data;
  const accountProvider = providerType === "agent" ? "agent" : providerType === "landlord" ? "landlord" : null;
  const emailVerified = Boolean(user?.email_confirmed_at);
  const sendEmailConfirmation = async () => {
    if (!user?.email) return;
    setIsSendingEmail(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: window.location.origin },
    });
    setIsSendingEmail(false);
    if (error) toast.error(error.message);
    else toast.success("Confirmation email sent", { description: "Open the link, then return here and refresh." });
  };


  const uploadEvidence = async (requestId: string, kind: EvidenceKind, file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${user!.id}/${requestId}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("provider-verification")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`${kind === "id" ? "ID" : kind === "selfie" ? "Selfie" : "Property proof"}: ${error.message}`);
    return path;
  };

  const submitForReview = async () => {
    if (!user || !accountProvider) {
      toast.error("Choose a landlord or agent account before applying.");
      return;
    }
    if (!emailVerified) {
      toast.error("Verify your email before continuing.");
      return;
    }
    const isResuming = request?.status === "awaiting_payment";
    if (!isResuming && (!evidence.id || !evidence.selfie || !evidence.property)) {
      toast.error("Upload your ID, a clear selfie, and property ownership or authorization proof.");
      return;
    }

    const publicKey = import.meta.env["VITE_PAYSTACK_PUBLIC_KEY"] as string | undefined;
    if (!publicKey) {
      setPaymentError("Add VITE_PAYSTACK_PUBLIC_KEY to the local/deployment environment before checkout.");
      return;
    }

    setIsPaying(true);
    setPaymentError(null);
    try {
      await loadPaystack();
      const requestId = isResuming ? request.id : crypto.randomUUID();
      const paths = isResuming
        ? {
            idDocumentPath: request.id_document_path,
            selfiePath: request.selfie_path,
            propertyProofPath: request.property_proof_path,
          }
        : {
            idDocumentPath: await uploadEvidence(requestId, "id", evidence.id!),
            selfiePath: await uploadEvidence(requestId, "selfie", evidence.selfie!),
            propertyProofPath: await uploadEvidence(requestId, "property", evidence.property!),
          };
      const paymentReference = `PV-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const checkout = await createProviderVerificationCheckoutServerFn({
        data: { requestId, paymentReference, providerType: accountProvider, files: paths },
      });
      if (!checkout.success) throw new Error(checkout.error);
      await queryClient.invalidateQueries({ queryKey: ["provider-verification-request", user.id] });

      const paystack = (window as Window & {
        PaystackPop?: { setup: (options: Record<string, unknown>) => { openIframe: () => void } };
      }).PaystackPop;
      if (!paystack) throw new Error("Paystack did not initialize. Refresh and try again.");

      const handler = paystack.setup({
        key: publicKey,
        email: user.email ?? "",
        amount: checkout.amountKobo,
        currency: checkout.currency,
        ref: paymentReference,
        metadata: {
          custom_fields: [
            { display_name: "Application", variable_name: "application", value: "LodgeMate Provider Verification" },
          ],
        },
        onSuccess: async () => {
          const verified = await verifyProviderVerificationPaymentServerFn({ data: { paymentReference } });
          setIsPaying(false);
          if (!verified.success) {
            setPaymentError(verified.error);
            toast.error("Payment needs attention", { description: verified.error });
            return;
          }
          await queryClient.invalidateQueries({ queryKey: ["provider-verification-request", user.id] });
          toast.success("Application submitted", { description: "LodgeMate will manually review your documents." });
        },
        onClose: () => setIsPaying(false),
      });
      handler.openIframe();
    } catch (error) {
      setIsPaying(false);
      const message = error instanceof Error ? error.message : "Could not start verification checkout.";
      setPaymentError(message);
      toast.error(message);
    }
  };

  if (!accountProvider) {
    return (
      <DashboardShell title="Provider verification" subtitle="For LodgeMate landlords and agents.">
        <Panel title="Landlord or agent account required">
          <p className="text-sm text-muted-foreground">Switch your account type to Landlord / Agent before applying for provider verification.</p>
          <Button asChild className="mt-4"><Link to="/auth" search={{ mode: "signup" }}>Create a landlord or agent account</Link></Button>
        </Panel>
      </DashboardShell>
    );
  }

  if (profile?.verified || request?.status === "approved") {
    return (
      <DashboardShell title="Provider verified" subtitle="Your LodgeMate provider identity has been approved.">
        <Panel title="Verified provider" description="You can now submit accommodation listings for review.">
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Verified {accountProvider === "agent" ? "agent" : "landlord"}</div>
          <Button asChild className="mt-4"><Link to="/host">Open Host panel</Link></Button>
        </Panel>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Get your provider badge"
      subtitle="Confirm your email and submit documents for manual review."
      badge={accountProvider === "agent" ? "Independent Agent" : "Landlord"}
    >
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          {request?.status === "in_review" ? (
            <Panel title="Application under review" description="Your documents and payment are received. A LodgeMate reviewer will check your details.">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600" /><StatusPill status="in_review" /></div>
              <p className="mt-3 text-sm text-muted-foreground">Submitted {request.submitted_at ? new Date(request.submitted_at).toLocaleString() : "recently"}. You can close this page and check back later.</p>
            </Panel>
          ) : request?.status === "rejected" ? (
            <Panel title="Previous application not approved" description={request.review_note || "Update your evidence and submit a new application."}>
              <StatusPill status="rejected" />
            </Panel>
          ) : null}

          {request?.status !== "in_review" && request?.status !== "approved" && (
            <>
              <Panel title="1. Confirm your email" description="Confirm your email address on your LodgeMate account before applying.">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Email · {user?.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{emailVerified ? "Confirmed on your account" : "Needs confirmation"}</p>
                    </div>
                    {emailVerified ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Button variant="outline" onClick={() => void sendEmailConfirmation()} disabled={isSendingEmail}>{isSendingEmail ? "Sending…" : "Resend confirmation"}</Button>}
                  </div>
                </div>
              </Panel>

              <Panel title="2. Upload verification evidence" description="Documents are private and visible only to you and LodgeMate administrators during review.">
                <div className="space-y-4">
                  <EvidenceInput label="Valid government-issued ID" help="Upload a clear image or PDF of your ID." value={evidence.id} onChange={(file) => setEvidence((current) => ({ ...current, id: file }))} />
                  <EvidenceInput label="Facial verification selfie" help="Upload a recent clear selfie. A reviewer will compare it with your ID; automated face matching is not enabled yet." value={evidence.selfie} onChange={(file) => setEvidence((current) => ({ ...current, selfie: file }))} imageOnly />
                  <EvidenceInput label={accountProvider === "agent" ? "Property owner authorization" : "Proof of property ownership or management"} help={accountProvider === "agent" ? "Upload an owner mandate, management agreement, or authorization letter." : "Upload a document that connects you to the lodge or property."} value={evidence.property} onChange={(file) => setEvidence((current) => ({ ...current, property: file }))} />
                </div>
              </Panel>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold">Privacy and manual review</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Your ID, selfie, and property evidence are stored in a private bucket. LodgeMate staff review them manually. Do not upload unrelated or sensitive documents.</p>
                  </div>
                </div>
              </div>

              <Button className="w-full" disabled={isPaying || !emailVerified} onClick={() => void submitForReview()}>
                {isPaying ? <><Loader2 className="h-4 w-4 animate-spin" /> Waiting for Paystack…</> : request?.status === "awaiting_payment" ? "Resume ₦3,500 verification payment" : "Submit and pay ₦3,500"}
              </Button>
              {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
            </>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Verification steps">
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${emailVerified ? "text-emerald-600" : "text-muted-foreground"}`} /> Confirm email.</li>
              <li className="flex gap-2"><UploadCloud className="mt-0.5 h-4 w-4" /> Upload ID, selfie, and property proof.</li>
              <li className="flex gap-2"><FileCheck2 className="mt-0.5 h-4 w-4" /> Pay ₦3,500 through Paystack.</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4" /> LodgeMate manually reviews your application.</li>
            </ol>
            {request?.status === "awaiting_payment" && <p className="mt-4 text-xs text-muted-foreground">Your evidence is saved. Resume payment to submit it for review.</p>}
          </Panel>
          <Panel title="What happens next?">
            <p className="text-sm leading-relaxed text-muted-foreground">A successful payment submits your documents for review; it does not automatically grant a badge. Once approved, your verified provider badge is activated and you can submit lodge listings.</p>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}

function EvidenceInput({
  label,
  help,
  value,
  onChange,
  imageOnly = false,
}: {
  label: string;
  help: string;
  value: File | null;
  onChange: (file: File | null) => void;
  imageOnly?: boolean;
}) {
  const accept = imageOnly ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          if (file && file.size > 15 * 1024 * 1024) {
            toast.error("File is too large", { description: "Each document must be 15 MB or less." });
            event.currentTarget.value = "";
            return;
          }
          onChange(file);
        }}
      />
      <p className="text-xs text-muted-foreground">{help} {imageOnly ? "JPG, PNG, WebP." : "JPG, PNG, WebP, or PDF."} Max 15 MB.</p>
      {value && <p className="text-xs text-primary">Selected: {value.name}</p>}
    </div>
  );
}
