import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, MessageCircle, Phone, ToggleLeft, ToggleRight, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import {
  ImageFileItem,
  ListingImageUpload,
  uploadListingPhotos,
} from "@/components/listing-image-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadOwnershipProof } from "@/lib/ownership-proof";

export const Route = createFileRoute("/_authenticated/host")({
  head: () => ({
    meta: [
      { title: "Host Panel — Manage Your Lodges | LodgeMate" },
      {
        name: "description",
        content:
          "Landlords and agents: post rooms, track verification status and confirm student inspection requests.",
      },
      { property: "og:title", content: "Host Panel — Manage Your Lodges | LodgeMate" },
      {
        property: "og:description",
        content: "Post rooms and confirm inspections with students near MOUAU and ABSU.",
      },
    ],
  }),
  beforeLoad: ({ context }) => {
    // Prevent students from accessing landlord/agent host tools
    if (!context.isHost) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: HostPanel,
});

const emptyForm = {
  title: "",
  kind: "Full lodge",
  school: "MOUAU",
  area: "",
  distance: "",
  price: "",
  period: "per year",
  description: "",
  amenities: "",
  availableRooms: "1",
};

type FormState = typeof emptyForm;

/** Minimal typed shape for a row returned by the host-listings query. */
type HostListing = {
  id: string;
  title: string;
  kind: string;
  school: string;
  area: string;
  distance: string | null;
  price: number;
  period: string;
  description: string | null;
  amenities: string[] | null;
  image_url: string | null;
  status: string;
  verified: boolean;
  created_at: string;
  available_rooms: number;
  ownership_proof_path: string | null;
};

function HostPanel() {
  const { user, isHost, providerType, profile } = useAuth();
  const qc = useQueryClient();

  // ── Create form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(emptyForm);
  const [createImages, setCreateImages] = useState<ImageFileItem[]>([]);
  const [ownershipProofFile, setOwnershipProofFile] = useState<File | null>(null);
  const [editOwnershipProofFile, setEditOwnershipProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Edit dialog state ──────────────────────────────────────────────────────
  const [editingListing, setEditingListing] = useState<HostListing | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editImages, setEditImages] = useState<ImageFileItem[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const listings = useQuery({
    queryKey: ["host-listings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const requests = useQuery({
    queryKey: ["host-inspections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, preferred_date, note, status, student_id, listings!inner(title, owner_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const hostInspections = data.filter((i) => i.listings?.owner_id === user!.id);

      // Fetch student contact details for these inspections
      const studentIds = Array.from(
        new Set(hostInspections.map((i) => i.student_id).filter(Boolean)),
      );

      let profileMap: Record<string, { full_name: string | null; phone: string | null }> = {};
      if (studentIds.length > 0) {
        try {
          const { data: studentProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", studentIds);
          if (studentProfiles) {
            profileMap = studentProfiles.reduce(
              (acc, p) => {
                acc[p.id] = { full_name: p.full_name, phone: p.phone };
                return acc;
              },
              {} as Record<string, { full_name: string | null; phone: string | null }>,
            );
          }
        } catch (err) {
          console.warn("Notice loading student profiles for inspections:", err);
        }
      }

      return hostInspections.map((i) => ({
        ...i,
        student: profileMap[i.student_id] ?? null,
      }));
    },
    enabled: !!user,
  });

  // ── Create listing ─────────────────────────────────────────────────────────
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);

    let image_url: string | null = null;

    // Upload primary photo if provided
    if (createImages.length > 0) {
      const { primaryUrl, error: uploadErr } = await uploadListingPhotos(createImages, user.id);
      if (uploadErr) {
        toast.warning("Photo upload failed", {
          description: `The listing will be saved without a photo. Reason: ${uploadErr}`,
        });
      } else {
        image_url = primaryUrl;
      }
    }

    let ownership_proof_path: string | null = null;
    if (providerType === "landlord") {
      if (!ownershipProofFile) {
        setBusy(false);
        toast.error("Ownership proof required", { description: "Upload proof for this specific lodge before submitting." });
        return;
      }
      try {
        ownership_proof_path = await uploadOwnershipProof(ownershipProofFile, user.id);
      } catch (err) {
        setBusy(false);
        toast.error("Could not upload ownership proof", { description: err instanceof Error ? err.message : "Try again." });
        return;
      }
    }

    const { error } = await supabase.from("listings").insert({
      owner_id: user.id,
      title: form.title,
      kind: form.kind,
      school: form.school,
      area: form.area,
      distance: form.distance,
      price: Number(form.price) || 0,
      available_rooms: Number(form.availableRooms) || 1,
      ownership_proof_path,
      period: form.period,
      description: form.description,
      amenities: form.amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      status: "pending",
      verified: false,
      ...(image_url ? { image_url } : {}),
    });

    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listing submitted", { description: "It goes live once an admin approves it." });
    setForm(emptyForm);
    setCreateImages([]);
    setOwnershipProofFile(null);
    void qc.invalidateQueries({ queryKey: ["host-listings"] });
  };

  // ── Open Edit dialog ───────────────────────────────────────────────────────
  const openEdit = (l: HostListing) => {
    setEditOwnershipProofFile(null);
    setEditingListing(l);
    setEditForm({
      title: l.title ?? "",
      kind: l.kind ?? "Full lodge",
      school: l.school ?? "MOUAU",
      area: l.area ?? "",
      distance: l.distance ?? "",
      price: l.price != null ? String(l.price) : "",
      period: l.period ?? "per year",
      description: l.description ?? "",
      amenities: Array.isArray(l.amenities) ? l.amenities.join(", ") : "",
      availableRooms: String(l.available_rooms ?? 1),
    });
    // Seed existing image if present
    if (l.image_url) {
      setEditImages([
        {
          id: "existing-primary",
          previewUrl: l.image_url,
          isExisting: true,
        },
      ]);
    } else {
      setEditImages([]);
    }
    setIsEditOpen(true);
  };

  // ── Save edit ──────────────────────────────────────────────────────────────
  const handleUpdateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing || !user) return;
    setEditBusy(true);

    let image_url: string | null = editingListing.image_url ?? null;
    let ownership_proof_path = editingListing.ownership_proof_path;

    if (providerType === "landlord" && (!ownership_proof_path || editOwnershipProofFile)) {
      if (!editOwnershipProofFile) {
        setEditBusy(false);
        toast.error("Ownership proof required", { description: "Upload proof for this lodge before saving." });
        return;
      }
      try {
        ownership_proof_path = await uploadOwnershipProof(editOwnershipProofFile, user.id);
      } catch (err) {
        setEditBusy(false);
        toast.error("Could not upload ownership proof", { description: err instanceof Error ? err.message : "Try again." });
        return;
      }
    }

    // Upload new photo if the user selected one
    const hasNewFiles = editImages.some((img) => !img.isExisting);
    if (hasNewFiles) {
      const { primaryUrl, error: uploadErr } = await uploadListingPhotos(editImages, user.id);
      if (uploadErr) {
        toast.warning("Photo upload failed", {
          description: `Listing saved without updating the photo. Reason: ${uploadErr}`,
        });
      } else if (primaryUrl) {
        image_url = primaryUrl;
      }
    } else if (editImages.length === 0) {
      // User removed all photos
      image_url = null;
    }

    // RLS update policy: owner can only update when status='pending' AND verified=false.
    // We always set both to re-trigger moderation on edit.
    const { error } = await supabase
      .from("listings")
      .update({
        title: editForm.title,
        kind: editForm.kind,
        school: editForm.school,
        area: editForm.area,
        distance: editForm.distance,
        price: Number(editForm.price) || 0,
        available_rooms: Number(editForm.availableRooms) || 1,
        ownership_proof_path,
        period: editForm.period,
        description: editForm.description,
        amenities: editForm.amenities
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        image_url,
        // Moderation safeguard: edited listings require re-approval
        status: "pending",
        verified: false,
      })
      .eq("id", editingListing.id)
      .eq("owner_id", user.id); // belt-and-braces ownership check

    setEditBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listing updated", {
      description: "Your changes have been saved and sent for re-approval.",
    });
    setIsEditOpen(false);
    setEditingListing(null);
    void qc.invalidateQueries({ queryKey: ["host-listings"] });
  };

  // ── Availability toggle ────────────────────────────────────────────────────
  // The DB has no dedicated is_available column. We use status:
  //   'removed'  → taken / off market (hidden from Browse)
  //   'pending'  → available again (goes back to moderation queue)
  // Listings that are 'approved' and need to be hidden are set to 'removed'.
  const toggleAvailability = async (l: HostListing) => {
    const isTaken = l.status === "removed";

    if (isTaken) {
      // Mark as available again → put back through approval pipeline
      const { error } = await supabase
        .from("listings")
        .update({ status: "pending", verified: false })
        .eq("id", l.id)
        .eq("owner_id", user!.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Listing marked as available", {
        description: "It will appear in Browse once a campus rep re-approves it.",
      });
    } else {
      // Hide from Browse (taken / off market)
      const { error } = await supabase
        .from("listings")
        .update({ status: "removed" })
        .eq("id", l.id)
        .eq("owner_id", user!.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Listing marked as taken / off market", {
        description: "It is now hidden from Browse. You can mark it available again any time.",
      });
    }
    void qc.invalidateQueries({ queryKey: ["host-listings"] });
  };

  // ── Delete listing ─────────────────────────────────────────────────────────
  const remove = async (id: string) => {
    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("owner_id", user!.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Listing removed");
      void qc.invalidateQueries({ queryKey: ["host-listings"] });
    }
  };

  const setRequestStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("inspections").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["host-inspections"] });
  };

  // Helper to build field props for the create form
  const createField = (k: keyof FormState) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  // Helper to build field props for the edit form
  const editField = (k: keyof FormState) => ({
    value: editForm[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditForm((f) => ({ ...f, [k]: e.target.value })),
  });

  // ── Role-aware header strings ──────────────────────────────────────────────
  const roleLabel =
    providerType === "agent" ? "Independent Agent · Housing Representative" : "Landlord · Property Owner";
  const panelSubtitle =
    providerType === "agent"
      ? "Manage your client properties, track verification and confirm inspection requests."
      : "Post rooms, watch their verification status and answer inspection requests from students.";

  if (!isHost) {
    return (
      <DashboardShell title="Host panel" subtitle="This area is for landlords and agents.">
        <Panel title="You're signed in as a student">
          <p className="text-sm text-muted-foreground">
            Ask the LodgeMate team to upgrade your account to a landlord/agent to post rooms.
          </p>
        </Panel>
      </DashboardShell>
    );
  }

  if (!profile?.verified) {
    return (
      <DashboardShell
        title="Host panel"
        subtitle="Verify your provider identity before submitting lodge listings."
        badge={providerType === "agent" ? "Independent Agent" : "Landlord"}
      >
        <Panel title="Provider verification required" description="Complete email and phone checks, upload your ID, a selfie, and property authorization, then pay the ₦3,500 review fee.">
          <p className="text-sm text-muted-foreground">
            LodgeMate reviews applications manually. Your provider badge activates only after approval.
          </p>
          <Button asChild className="mt-4">
            <Link to="/verify-provider">Start provider verification</Link>
          </Button>
        </Panel>
      </DashboardShell>
    );
  }

  return (
    <>
      <DashboardShell
        title="Host panel"
        subtitle={panelSubtitle}
        badge={roleLabel}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Post a room ─────────────────────────────────────────────── */}
          <Panel title="Add a lodge listing" description="Create a listing for each lodge you manage, set how many rooms are available, and submit proof for each property.">
            <form className="space-y-4" onSubmit={create}>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" className="mt-2" required {...createField("title")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="kind">Type</Label>
                  <select
                    id="kind"
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    {...createField("kind")}
                  >
                    <option value="Full lodge">Rooms / units in a lodge</option>
                    <option>Bedspace</option>
                    <option>Takeover</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="school">School</Label>
                  <select
                    id="school"
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    {...createField("school")}
                  >
                    <option value="MOUAU">MOUAU (Umudike)</option>
                    <option value="ABSU">ABSU (Uturu)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="area">Area</Label>
                  <Input id="area" className="mt-2" placeholder="Ishiagu, Umudike…" {...createField("area")} />
                </div>
                <div>
                  <Label htmlFor="distance">Distance</Label>
                  <Input id="distance" className="mt-2" placeholder="6 min walk" {...createField("distance")} />
                </div>
                <div>
                  <Label htmlFor="price">Price (₦)</Label>
                  <Input id="price" type="number" className="mt-2" required {...createField("price")} />
                </div>
                <div>
                  <Label htmlFor="period">Period</Label>
                  <Input id="period" className="mt-2" placeholder="per year" {...createField("period")} />
                </div>
                <div>
                  <Label htmlFor="availableRooms">Rooms available in this lodge</Label>
                  <Input id="availableRooms" className="mt-2" type="number" min={1} step={1} required {...createField("availableRooms")} />
                </div>
              </div>
              {providerType === "landlord" && (
                <div>
                  <Label htmlFor="ownership-proof">Proof of ownership for this lodge</Label>
                  <Input id="ownership-proof" className="mt-2" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={(event) => setOwnershipProofFile(event.target.files?.[0] ?? null)} />
                  <p className="mt-1 text-xs text-muted-foreground">Private to you and LodgeMate reviewers. Upload proof for each lodge you list (max 10 MB).</p>
                </div>
              )}
              <div>
                <Label htmlFor="amenities">Amenities (comma separated)</Label>
                <Input
                  id="amenities"
                  className="mt-2"
                  placeholder="Prepaid meter, Borehole, Fenced"
                  {...createField("amenities")}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" className="mt-2" rows={4} {...createField("description")} />
              </div>

              {/* Photo upload */}
              <div>
                <Label className="mb-2 block">Photos (optional)</Label>
                <ListingImageUpload images={createImages} onChange={setCreateImages} maxFiles={5} />
              </div>

              <Button type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit listing"}
              </Button>
            </form>
          </Panel>

          <div className="space-y-6">
            {/* ── My listings ───────────────────────────────────────────── */}
            <Panel title="My listings">
              {listings.isLoading && (
                <p className="text-sm text-muted-foreground">Loading listings…</p>
              )}
              {listings.isError && (
                <p className="text-sm text-destructive">Failed to load listings.</p>
              )}
              {listings.data && listings.data.length > 0 ? (
                <ul className="space-y-3">
                  {listings.data.map((l) => {
                    const isTaken = l.status === "removed";
                    return (
                      <li key={l.id} className="rounded-xl border border-border bg-card p-4">
                        {/* Thumbnail + details row */}
                        <div className="flex items-start gap-3">
                          {l.image_url ? (
                            <img
                              src={l.image_url}
                              alt={l.title}
                              className="h-14 w-20 flex-shrink-0 rounded-lg object-cover border border-border/60"
                            />
                          ) : (
                            <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-muted border border-border/60 text-muted-foreground text-xs">
                              No photo
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-sm">{l.title}</p>
                                <p className="text-xs text-muted-foreground">{l.available_rooms} {l.available_rooms === 1 ? "room" : "rooms"} available · {l.ownership_proof_path ? "ownership proof submitted" : "no lodge proof on file"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {l.school} · {l.area} · ₦{l.price.toLocaleString()} {l.period}
                                </p>
                              </div>
                              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                                <StatusPill status={l.status} />
                                {isTaken && (
                                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                    Taken
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                          {/* Edit */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 px-2.5 text-xs"
                            onClick={() => openEdit(l as unknown as HostListing)}
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>

                          {/* Availability toggle */}
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 gap-1.5 px-2.5 text-xs ${
                              isTaken
                                ? "border-primary/40 text-primary hover:bg-primary/10"
                                : "border-orange-400/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            }`}
                            onClick={() => toggleAvailability(l as unknown as HostListing)}
                          >
                            {isTaken ? (
                              <>
                                <ToggleLeft className="h-3 w-3" />
                                Mark Available
                              </>
                            ) : (
                              <>
                                <ToggleRight className="h-3 w-3" />
                                Mark Taken
                              </>
                            )}
                          </Button>

                          {/* Delete */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              if (window.confirm("Delete this listing? This cannot be undone.")) {
                                void remove(l.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                !listings.isLoading && (
                  <p className="text-sm text-muted-foreground">No listings yet.</p>
                )
              )}
            </Panel>

            {/* ── Inspection requests ────────────────────────────────────── */}
            <Panel title="Inspection requests">
              {requests.data && requests.data.length > 0 ? (
                <ul className="space-y-3">
                  {requests.data.map((r) => (
                    <li key={r.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{r.listings?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {r.preferred_date ?? "Flexible date"}
                          </p>
                          {r.note && <p className="mt-1 text-sm text-muted-foreground">"{r.note}"</p>}
                        </div>
                        <StatusPill status={r.status} />
                      </div>

                      {/* Student Contact Information */}
                      <div className="mt-3 rounded-lg bg-muted/50 p-2.5 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <User className="h-3.5 w-3.5 text-primary" />
                          <span>Student: {r.student?.full_name || "LodgeMate Student"}</span>
                        </div>
                        {r.student?.phone ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <a
                              href={`tel:${r.student.phone}`}
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Phone className="h-3 w-3" /> Call {r.student.phone}
                            </a>
                            <a
                              href={`https://wa.me/${r.student.phone.replace(/\D/g, "").startsWith("0") ? `234${r.student.phone.replace(/\D/g, "").slice(1)}` : r.student.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${r.student.full_name || "there"}, I am contacting you regarding your inspection request for ${r.listings?.title || "the lodge"} on LodgeMate.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                            >
                              <MessageCircle className="h-3 w-3 text-emerald-600" /> WhatsApp
                            </a>
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground italic">
                            Phone number not provided by student.
                          </p>
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => setRequestStatus(r.id, "confirmed")}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRequestStatus(r.id, "declined")}>
                          Decline
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No inspection requests yet.</p>
              )}
            </Panel>
          </div>
        </div>
      </DashboardShell>

      {/* ── Edit Listing Dialog ──────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit listing</DialogTitle>
            <DialogDescription>
              Changes will be saved and sent for re-approval before going live.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateListing} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" className="mt-2" required {...editField("title")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-kind">Type</Label>
                <select
                  id="edit-kind"
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...editField("kind")}
                >
                  <option>Full lodge</option>
                  <option>Bedspace</option>
                  <option>Takeover</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-available-rooms">Rooms available in this lodge</Label>
                <Input id="edit-available-rooms" className="mt-2" type="number" min={1} step={1} required {...editField("availableRooms")} />
              </div>
              <div>
                <Label htmlFor="edit-school">School</Label>
                <select
                  id="edit-school"
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...editField("school")}
                >
                  <option value="MOUAU">MOUAU (Umudike)</option>
                  <option value="ABSU">ABSU (Uturu)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-area">Area</Label>
                <Input id="edit-area" className="mt-2" placeholder="Ishiagu, Umudike…" {...editField("area")} />
              </div>
              <div>
                <Label htmlFor="edit-distance">Distance</Label>
                <Input id="edit-distance" className="mt-2" placeholder="6 min walk" {...editField("distance")} />
              </div>
              <div>
                <Label htmlFor="edit-price">Price (₦)</Label>
                <Input id="edit-price" type="number" className="mt-2" required {...editField("price")} />
              </div>
              <div>
                <Label htmlFor="edit-period">Period</Label>
                <Input id="edit-period" className="mt-2" placeholder="per year" {...editField("period")} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-amenities">Amenities (comma separated)</Label>
              <Input
                id="edit-amenities"
                className="mt-2"
                placeholder="Prepaid meter, Borehole, Fenced"
                {...editField("amenities")}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" className="mt-2" rows={4} {...editField("description")} />
            </div>

            {providerType === "landlord" && (
              <div>
                <Label htmlFor="edit-ownership-proof">{editingListing?.ownership_proof_path ? "Replace lodge ownership proof (optional)" : "Proof of ownership for this lodge"}</Label>
                <Input id="edit-ownership-proof" className="mt-2" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required={!editingListing?.ownership_proof_path} onChange={(event) => setEditOwnershipProofFile(event.target.files?.[0] ?? null)} />
              </div>
            )}

            {/* Photo upload */}
            <div>
              <Label className="mb-2 block">Photos</Label>
              <ListingImageUpload images={editImages} onChange={setEditImages} maxFiles={5} />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                The first photo is used as the cover. Remove all photos to clear the existing one.
              </p>
            </div>

            {/* Moderation note */}
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning-foreground">
              Edited listings are re-submitted for campus rep approval before going live again.
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editBusy}>
                {editBusy ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
