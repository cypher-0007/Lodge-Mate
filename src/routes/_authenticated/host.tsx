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
import { uploadPublicListingMedia, uploadRoomVideo } from "@/lib/listing-media";

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

const emptyLodgeForm = { name: "", school: "MOUAU", area: "", distance: "", description: "" };

type FormState = typeof emptyForm;

type LodgeProfile = {
  id: string;
  owner_id: string;
  name: string;
  school: string;
  area: string;
  distance: string;
  description: string;
  front_photo_url: string;
  compound_photo_url: string;
  lobby_photo_url: string;
  ownership_proof_path: string;
  status: string;
};

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
  lodge_profile_id: string | null;
  room_location: string | null;
  room_image_urls: string[] | null;
  video_url: string | null;
};

function HostPanel() {
  const { user, isHost, providerType, profile } = useAuth();
  const qc = useQueryClient();

  // ── Create form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lodgeForm, setLodgeForm] = useState(emptyLodgeForm);
  const [lodgePhotos, setLodgePhotos] = useState<{ front: File | null; compound: File | null; lobby: File | null }>({ front: null, compound: null, lobby: null });
  const [lodgeProof, setLodgeProof] = useState<File | null>(null);
  const [selectedLodgeId, setSelectedLodgeId] = useState("");
  const [roomPhotos, setRoomPhotos] = useState<File[]>([]);
  const [roomPhotoInputVersion, setRoomPhotoInputVersion] = useState(0);
  const [lodgePhotoInputVersion, setLodgePhotoInputVersion] = useState(0);
  const [roomLocation, setRoomLocation] = useState("Upstairs");
  const [roomLocationOther, setRoomLocationOther] = useState("");
  const [roomVideoUrl, setRoomVideoUrl] = useState("");
  const [roomVideoFile, setRoomVideoFile] = useState<File | null>(null);
  const [roomVideoInputVersion, setRoomVideoInputVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  // ── Edit dialog state ──────────────────────────────────────────────────────
  const [editingListing, setEditingListing] = useState<HostListing | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editImages, setEditImages] = useState<ImageFileItem[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const lodgeProfiles = useQuery<LodgeProfile[]>({
    queryKey: ["host-lodge-profiles", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lodge_profiles").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LodgeProfile[];
    },
    enabled: !!user,
  });

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

  const createLodgeProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!lodgePhotos.front || !lodgePhotos.compound || !lodgePhotos.lobby || !lodgeProof) {
      toast.error("Complete the lodge profile photos and ownership proof first.");
      return;
    }
    setBusy(true);
    try {
      const [front, compound, lobby] = await Promise.all([
        uploadPublicListingMedia([lodgePhotos.front], user.id, "lodges"),
        uploadPublicListingMedia([lodgePhotos.compound], user.id, "lodges"),
        uploadPublicListingMedia([lodgePhotos.lobby], user.id, "lodges"),
      ]);
      const proofPath = await uploadOwnershipProof(lodgeProof, user.id);
      const { data, error } = await (supabase as any).from("lodge_profiles").insert({
        owner_id: user.id,
        ...lodgeForm,
        front_photo_url: front[0],
        compound_photo_url: compound[0],
        lobby_photo_url: lobby[0],
        ownership_proof_path: proofPath,
        status: "pending",
      }).select("id").single();
      if (error) throw error;
      toast.success("Lodge profile submitted", { description: "A reviewer will check the property profile and ownership proof." });
      setLodgeForm(emptyLodgeForm);
      setLodgePhotos({ front: null, compound: null, lobby: null });
      setLodgeProof(null);
      setLodgePhotoInputVersion((value) => value + 1);
      if (data?.id) setSelectedLodgeId(data.id);
      void qc.invalidateQueries({ queryKey: ["host-lodge-profiles", user.id] });
    } catch (err) {
      toast.error("Could not submit lodge profile", { description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  // ── Create a room opening under a reusable lodge profile ───────────────────
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const lodge = lodgeProfiles.data?.find((item) => item.id === selectedLodgeId);
    if (!lodge) {
      toast.error("Choose one of your lodge profiles first.");
      return;
    }
    if (roomPhotos.length === 0 || roomPhotos.length > 5) {
      toast.error("Add between one and five photos of the available room.");
      return;
    }
    if (roomLocation === "Other" && !roomLocationOther.trim()) {
      toast.error("Enter where the room is located in the lodge.");
      return;
    }
    if (roomVideoFile && roomVideoUrl.trim()) {
      toast.error("Choose a video upload or a video link, not both.");
      return;
    }
    setBusy(true);
    try {
      const roomImageUrls = await uploadPublicListingMedia(roomPhotos, user.id, "rooms");
      const uploadedVideoUrl = roomVideoFile ? await uploadRoomVideo(roomVideoFile, user.id) : null;
      const { error } = await supabase.from("listings").insert({
        owner_id: user.id,
        lodge_profile_id: lodge.id,
        title: form.title.trim(),
        kind: form.kind,
        school: lodge.school,
        area: lodge.area,
        distance: lodge.distance,
        price: Number(form.price) || 0,
        available_rooms: 1,
        room_location: roomLocation === "Other" ? roomLocationOther.trim() : roomLocation,
        room_image_urls: roomImageUrls,
        video_url: uploadedVideoUrl || roomVideoUrl.trim() || null,
        period: form.period,
        description: form.description,
        amenities: form.amenities.split(",").map((a) => a.trim()).filter(Boolean),
        image_url: roomImageUrls[0] ?? null,
        status: "pending",
        verified: false,
      });
      if (error) throw error;
      toast.success("Room opening submitted", { description: "It will appear under this lodge after moderation." });
      setForm(emptyForm);
      setRoomPhotos([]);
      setRoomPhotoInputVersion((value) => value + 1);
      setRoomVideoUrl("");
      setRoomVideoFile(null);
      setRoomVideoInputVersion((value) => value + 1);
      setRoomLocation("Upstairs");
      setRoomLocationOther("");
      void qc.invalidateQueries({ queryKey: ["host-listings", user.id] });
    } catch (err) {
      toast.error("Could not submit room opening", { description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  // ── Open Edit dialog ───────────────────────────────────────────────────────
  const openEdit = (l: HostListing) => {
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
          <Panel title="Create a lodge profile" description="Add this property once. Its front, compound, lobby photos and ownership proof stay with the lodge profile.">
            <form className="space-y-4" onSubmit={createLodgeProfile}>
              <div>
                <Label htmlFor="lodge-name">Lodge name</Label>
                <Input id="lodge-name" className="mt-2" placeholder="GoodNews Lodge" value={lodgeForm.name} onChange={(e) => setLodgeForm({ ...lodgeForm, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="lodge-school">Nearest school</Label>
                  <select id="lodge-school" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={lodgeForm.school} onChange={(e) => setLodgeForm({ ...lodgeForm, school: e.target.value })}>
                    <option value="MOUAU">MOUAU (Umudike)</option><option value="ABSU">ABSU (Uturu)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="lodge-area">Area / landmark</Label>
                  <Input id="lodge-area" className="mt-2" value={lodgeForm.area} onChange={(e) => setLodgeForm({ ...lodgeForm, area: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label htmlFor="lodge-distance">Distance from campus</Label>
                <Input id="lodge-distance" className="mt-2" placeholder="6 min walk" value={lodgeForm.distance} onChange={(e) => setLodgeForm({ ...lodgeForm, distance: e.target.value })} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {([['front', 'Front of lodge'], ['compound', 'Compound'], ['lobby', 'Lobby']] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`lodge-${key}`}>{label} photo</Label>
                    <Input key={lodgePhotoInputVersion} id={`lodge-${key}`} className="mt-2 px-2 py-2 text-xs" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setLodgePhotos({ ...lodgePhotos, [key]: e.target.files?.[0] ?? null })} />
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="lodge-proof">{providerType === "agent" ? "Ownership or management authorization for this lodge" : "Ownership proof for this lodge"}</Label>
                <Input key={`proof-${lodgePhotoInputVersion}`} id="lodge-proof" className="mt-2" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={(e) => setLodgeProof(e.target.files?.[0] ?? null)} />
                <p className="mt-1 text-xs text-muted-foreground">Submitted once per lodge profile for private review.</p>
              </div>
              <div>
                <Label htmlFor="lodge-description">About the property</Label>
                <Textarea id="lodge-description" className="mt-2" rows={3} value={lodgeForm.description} onChange={(e) => setLodgeForm({ ...lodgeForm, description: e.target.value })} />
              </div>
              <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit lodge profile"}</Button>
            </form>
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="font-semibold">Your lodge profiles</h3>
              {lodgeProfiles.data?.length ? <ul className="mt-3 space-y-2">{lodgeProfiles.data.map((lodge) => (
                <li key={lodge.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3"><img src={lodge.front_photo_url} alt="" className="h-12 w-14 rounded-md object-cover" /><div><p className="text-sm font-medium">{lodge.name}</p><p className="text-xs text-muted-foreground">{lodge.school} · {lodge.area}</p></div></div>
                  <StatusPill status={lodge.status} />
                </li>
              ))}</ul> : <p className="mt-2 text-sm text-muted-foreground">Add a lodge profile before posting an opening.</p>}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Post an available room" description="Choose a lodge profile, then describe the specific opening. Ownership proof is already attached to the lodge profile.">
              <form className="space-y-4" onSubmit={create}>
                <div>
                  <Label htmlFor="opening-lodge">Lodge profile</Label>
                  <select id="opening-lodge" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedLodgeId} onChange={(e) => setSelectedLodgeId(e.target.value)} required>
                    <option value="">Choose a lodge</option>
                    {lodgeProfiles.data?.map((lodge) => <option key={lodge.id} value={lodge.id}>{lodge.name} · {lodge.area} ({lodge.status})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="opening-title">Room / unit title</Label><Input id="opening-title" className="mt-2" placeholder="Self-contained room" required {...createField("title")} /></div>
                  <div><Label htmlFor="opening-kind">Space type</Label><select id="opening-kind" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...createField("kind")}><option value="Full lodge">Room / unit</option><option value="Bedspace">Bedspace</option></select></div>
                  <div><Label htmlFor="room-location">Location in lodge</Label><select id="room-location" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={roomLocation} onChange={(e) => setRoomLocation(e.target.value)}><option>Upstairs</option><option>Downstairs</option><option>Ground floor</option><option>Annex</option><option>Other</option></select></div>
                  <div><Label htmlFor="opening-price">Price (₦)</Label><Input id="opening-price" className="mt-2" type="number" min={1} required {...createField("price")} /></div>
                  <div><Label htmlFor="opening-period">Price period</Label><Input id="opening-period" className="mt-2" placeholder="per year" required {...createField("period")} /></div>
                </div>
                {roomLocation === "Other" && <div><Label htmlFor="room-location-other">Describe the room location</Label><Input id="room-location-other" className="mt-2" placeholder="e.g. Rear block, second floor" value={roomLocationOther} onChange={(e) => setRoomLocationOther(e.target.value)} required /></div>}
                <div><Label htmlFor="opening-description">Room details</Label><Textarea id="opening-description" className="mt-2" rows={4} placeholder="Describe the room, facilities and what is included." required {...createField("description")} /></div>
                <div><Label htmlFor="opening-amenities">Room amenities (comma separated)</Label><Input id="opening-amenities" className="mt-2" placeholder="Private bathroom, wardrobe, prepaid meter" {...createField("amenities")} /></div>
                <div><Label htmlFor="room-photos">Room photos</Label><Input key={roomPhotoInputVersion} id="room-photos" className="mt-2" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(e) => setRoomPhotos(Array.from(e.target.files ?? []))} /><p className="mt-1 text-xs text-muted-foreground">Add up to five photos of this opening (5 MB max each).</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label htmlFor="room-video-file">Upload room video (optional)</Label><Input key={roomVideoInputVersion} id="room-video-file" className="mt-2 px-2 py-2 text-xs" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setRoomVideoFile(e.target.files?.[0] ?? null)} /><p className="mt-1 text-xs text-muted-foreground">MP4, WebM or MOV · max 50 MB</p></div>
                  <div><Label htmlFor="room-video">Or paste a video link</Label><Input id="room-video" className="mt-2" type="url" placeholder="https://…" value={roomVideoUrl} onChange={(e) => setRoomVideoUrl(e.target.value)} /></div>
                </div>
                <Button type="submit" disabled={busy || !lodgeProfiles.data?.length}>{busy ? "Submitting…" : "Submit room opening"}</Button>
              </form>
            </Panel>
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
                    const lodge = lodgeProfiles.data?.find((item) => item.id === l.lodge_profile_id);
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
                                <p className="text-xs font-medium text-primary">{lodge?.name ?? "Legacy listing"}{l.room_location ? ` · ${l.room_location}` : ""}</p>
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
