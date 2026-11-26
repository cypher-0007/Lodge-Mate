import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";

type ReviewRequest = {
  id: string;
  user_id: string;
  provider_type: "landlord" | "agent";
  status: string;
  id_document_path: string;
  selfie_path: string;
  property_proof_path: string;
  submitted_at: string | null;
  review_note: string | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

export function ProviderVerificationReviewPanel() {
  const qc = useQueryClient();
  const [signedLinks, setSignedLinks] = useState<Record<string, Record<string, string>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ["provider-verification-review-queue"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("provider_verification_requests")
        .select("id,user_id,provider_type,status,id_document_path,selfie_path,property_proof_path,submitted_at,review_note,profiles(full_name,phone)")
        .eq("status", "in_review")
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReviewRequest[];
    },
  });

  const loadEvidence = async (request: ReviewRequest) => {
    setBusyId(request.id);
    const paths = {
      "Government ID": request.id_document_path,
      Selfie: request.selfie_path,
      "Property proof": request.property_proof_path,
    };
    const result: Record<string, string> = {};
    for (const [label, path] of Object.entries(paths)) {
      const { data, error } = await supabase.storage
        .from("provider-verification")
        .createSignedUrl(path, 5 * 60);
      if (error) {
        toast.error(`Could not open ${label.toLowerCase()}`, { description: error.message });
        setBusyId(null);
        return;
      }
      result[label] = data.signedUrl;
    }
    setSignedLinks((current) => ({ ...current, [request.id]: result }));
    setBusyId(null);
  };

  const review = async (request: ReviewRequest, approve: boolean) => {
    setBusyId(request.id);
    const { error } = await (supabase as any).rpc("review_provider_verification", {
      _request_id: request.id,
      _approve: approve,
      _review_note: notes[request.id] ?? null,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "Provider verified" : "Application rejected", {
      description: approve ? "The provider badge is active and listing access is enabled." : "The provider can correct their evidence and apply again.",
    });
    await qc.invalidateQueries({ queryKey: ["provider-verification-review-queue"] });
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Provider verification</h2>
      <p className="mt-1 text-sm text-muted-foreground">Review paid landlord and agent identity applications. Approving grants the verified provider badge.</p>
      <div className="mt-5">
        {requests.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading applications…</p>
        ) : requests.error ? (
          <p className="text-sm text-destructive">Could not load verification applications: {requests.error.message}</p>
        ) : requests.data?.length ? (
          <ul className="space-y-4">
            {requests.data.map((request) => (
              <li key={request.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{request.profiles?.full_name || "Provider"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.provider_type === "agent" ? "Independent agent" : "Landlord"}
                      {request.profiles?.phone ? ` · ${request.profiles.phone}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {request.submitted_at ? new Date(request.submitted_at).toLocaleString() : "—"} · ₦3,500 paid
                    </p>
                  </div>
                  <StatusPill status={request.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === request.id} onClick={() => void loadEvidence(request)}>
                    {busyId === request.id ? "Loading…" : "View private evidence"}
                  </Button>
                  {Object.entries(signedLinks[request.id] ?? {}).map(([label, url]) => (
                    <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent">
                      {label}
                    </a>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  <Input
                    aria-label={`Review note for ${request.profiles?.full_name ?? "provider"}`}
                    value={notes[request.id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                    placeholder="Optional note for the provider"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busyId === request.id} onClick={() => void review(request, true)}>Approve provider</Button>
                    <Button size="sm" variant="destructive" disabled={busyId === request.id} onClick={() => void review(request, false)}>Reject application</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No paid verification applications are waiting for review.</p>
        )}
      </div>
    </section>
  );
}
