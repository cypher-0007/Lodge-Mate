import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Phone,
  MessageCircle,
  Clock,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Flag,
  ExternalLink,
  Edit2,
  ToggleLeft,
  ToggleRight,
  PlusCircle,
  BedDouble,
  Users,
  User,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { BetaPassStatus } from "@/components/beta-pass-status";
import {
  ListingImageUpload,
  uploadListingPhotos,
  type ImageFileItem,
} from "@/components/listing-image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSavedListingsQuery, useToggleSaveListing } from "@/lib/saved-listings";
import { useBetaLodgesConfig, useUserBetaAccess, useUserBetaPass } from "@/lib/beta-lodges";
import { getFallbackImage } from "@/lib/listings";
import { REPORT_REASONS } from "@/lib/moderation";
import { consumeMessageIntent, getOrCreateConversation, getSafeReturnUrl } from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — LodgeMate" },
      {
        name: "description",
        content: "Track your inspection requests and find verified student rooms near MOUAU and ABSU.",
      },
      { property: "og:title", content: "My Dashboard — LodgeMate" },
      { property: "og:description", content: "Your saved inspections and available student rooms." },
    ],
  }),
  beforeLoad: ({ context }) => {
    // A landlord/agent account should land in the host panel even if an older
    // student role row still exists from a previous signup attempt.
    if (context.roles.includes("landlord") && !context.isAdmin) {
      throw redirect({ to: "/host" });
    }
  },
  component: StudentDashboard,
});

type InspectionFilter = "all" | "confirmed" | "pending" | "declined";

type SharedSpaceListing = {
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
};

const emptyEditForm = {
  title: "",
  kind: "Bedspace",
  school: "MOUAU",
  area: "",
  distance: "",
  price: "",
  period: "per year",
  description: "",
  amenities: "",
};

const TIME_SLOTS = [
  { value: "morning", label: "Morning (9:00 AM – 12:00 PM)" },
  { value: "afternoon", label: "Afternoon (12:00 PM – 3:00 PM)" },
  { value: "evening", label: "Late Afternoon / Evening (3:00 PM – 6:00 PM)" },
  { value: "flexible", label: "Flexible (Any time host is available)" },
];

function StudentDashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Restore pending return destination (e.g. after Google OAuth or inspection redirect)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingReturn = window.localStorage.getItem("lodgemate_pending_return_to");
    if (pendingReturn) {
      window.localStorage.removeItem("lodgemate_pending_return_to");
      const safe = getSafeReturnUrl(pendingReturn);
      if (safe && safe !== "/dashboard") {
        navigate({ to: safe });
        return;
      }
    }

    const intent = consumeMessageIntent();
    if (intent && intent.returnTo) {
      const safe = getSafeReturnUrl(intent.returnTo);
      if (safe && safe !== "/dashboard") {
        navigate({ to: safe });
      }
    }
  }, [navigate]);

  // Inspection Request States
  const [selected, setSelected] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("afternoon");
  const [note, setNote] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Inspection Filter State
  const [inspectionFilter, setInspectionFilter] = useState<InspectionFilter>("all");

  // Reporting Modal States
  const [reportListing, setReportListing] = useState<{ id: string; title: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Shared Spaces Management States (Edit & Delete)
  const [editingSpace, setEditingSpace] = useState<SharedSpaceListing | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editImages, setEditImages] = useState<ImageFileItem[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const [spaceToDelete, setSpaceToDelete] = useState<SharedSpaceListing | null>(null);
  const [isDeletingSpace, setIsDeletingSpace] = useState(false);

  const isLive = isSupabaseConfigured();

  const { data: savedListings = [], isLoading: isLoadingSaved } = useSavedListingsQuery();
  const toggleSave = useToggleSaveListing();

  // Beta Lodges pass status
  const configQuery = useBetaLodgesConfig();
  const accessQuery = useUserBetaAccess(user?.id);
  const passQuery = useUserBetaPass(user?.id);

  const listings = useQuery({
    queryKey: ["approved-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, kind, school, area, distance, price, period, verified, owner_id")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Query shared spaces (bedspaces and takeovers) owned by this student
  const mySharedSpaces = useQuery({
    queryKey: ["my-shared-spaces", user?.id],
    queryFn: async (): Promise<SharedSpaceListing[]> => {
      if (!user) return [];
      if (!isLive) {
        return [
          {
            id: "demo-shared-space-1",
            title: "Bedspace in 2-Man Self-Con, Ishiagu Gate",
            kind: "Bedspace",
            school: "MOUAU",
            area: "Ishiagu",
            distance: "5 min walk",
            price: 90000,
            period: "per session",
            description: "Looking for an easy-going 200L/300L student to share rent. Steady water, prepaid meter.",
            amenities: ["Prepaid meter", "Water borehole", "Tiled floor"],
            image_url: null,
            status: "approved",
            verified: true,
            created_at: new Date().toISOString(),
          },
        ];
      }
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", user.id)
        .in("kind", ["Bedspace", "Takeover"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SharedSpaceListing[];
    },
    enabled: !!user,
  });

  // Query incoming inspection requests for shared spaces owned by this student
  const sharedSpacesInspections = useQuery({
    queryKey: ["my-shared-spaces-inspections", user?.id],
    queryFn: async () => {
      if (!user) return [];
      if (!isLive) {
        return [
          {
            id: "demo-shared-insp-1",
            preferred_date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
            note: "Time window: Afternoon (12:00 PM – 3:00 PM)\nNote: Hello! Would love to come see the room after lectures.",
            status: "pending",
            student_id: "demo-student-inquirer",
            created_at: new Date().toISOString(),
            listings: {
              id: "demo-shared-space-1",
              title: "Bedspace in 2-Man Self-Con, Ishiagu Gate",
              kind: "Bedspace",
              owner_id: user.id,
            },
            student: {
              full_name: "Chukwudi Eze",
              phone: "08031234567",
            },
          },
        ];
      }

      const { data, error } = await supabase
        .from("inspections")
        .select(`
          id,
          preferred_date,
          note,
          status,
          student_id,
          created_at,
          listings!inner(id, title, kind, owner_id)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mySpacesInspections = (data ?? []).filter(
        (i: any) =>
          i.listings?.owner_id === user.id &&
          (i.listings?.kind === "Bedspace" || i.listings?.kind === "Takeover"),
      );

      const studentIds = Array.from(
        new Set(mySpacesInspections.map((i: any) => i.student_id).filter(Boolean)),
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
          console.warn("Notice loading student profiles for shared spaces inspections:", err);
        }
      }

      return mySpacesInspections.map((i: any) => ({
        ...i,
        student: profileMap[i.student_id] ?? null,
      }));
    },
    enabled: !!user,
  });

  const mine = useQuery({
    queryKey: ["my-inspections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(`
          id,
          preferred_date,
          note,
          status,
          created_at,
          listings (
            id,
            title,
            area,
            school,
            price,
            period,
            owner_id,
            profiles:owner_id (
              full_name,
              phone,
              provider_type
            )
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        preferred_date: string | null;
        note: string | null;
        status: string;
        created_at: string;
        listings: {
          id: string;
          title: string;
          area: string;
          school: string;
          price: number;
          period: string;
          owner_id: string;
          profiles: {
            full_name: string | null;
            phone: string | null;
            provider_type: string | null;
          } | null;
        } | null;
      }>;
    },
    enabled: !!user,
  });

  // Handle Inspection Request with structured time slot
  const request = async () => {
    if (!selected || !user) return;
    if (!date) {
      toast.error("Please pick a preferred date for your inspection.");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const slotLabel = TIME_SLOTS.find((s) => s.value === timeSlot)?.label ?? timeSlot;
      const combinedNote = note.trim()
        ? `Time window: ${slotLabel}\nNote: ${note.trim()}`
        : `Time window: ${slotLabel}`;

      const { error } = await supabase.from("inspections").insert({
        listing_id: selected,
        student_id: user.id,
        preferred_date: date || null,
        note: combinedNote,
      });

      if (error) throw error;

      toast.success("Inspection requested!", {
        description: "The host will review your requested date and time window.",
      });
      setSelected(null);
      setDate("");
      setTimeSlot("afternoon");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["my-inspections"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request inspection.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Handle Report Submission with accessible Modal Dialog
  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportListing || !user || !reportReason.trim()) return;

    setIsSubmittingReport(true);
    try {
      const { error } = await supabase.from("reports").insert({
        listing_id: reportListing.id,
        reporter_id: user.id,
        reason: `${reportReason}${reportDetails.trim() ? ` — ${reportDetails.trim()}` : ""}`,
      });

      if (error) throw error;

      toast.success("Report submitted to LodgeMate team", {
        description: "Our moderation team will review this accommodation.",
      });
      setReportListing(null);
      setReportReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // ── Shared Spaces Actions & Handlers ─────────────────────────────────────
  const editField = (k: keyof typeof editForm) => ({
    value: editForm[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const openEditSpace = (space: SharedSpaceListing) => {
    setEditingSpace(space);
    setEditForm({
      title: space.title ?? "",
      kind: space.kind ?? "Bedspace",
      school: space.school ?? "MOUAU",
      area: space.area ?? "",
      distance: space.distance ?? "",
      price: space.price != null ? String(space.price) : "",
      period: space.period ?? "per year",
      description: space.description ?? "",
      amenities: Array.isArray(space.amenities) ? space.amenities.join(", ") : "",
    });
    if (space.image_url) {
      setEditImages([
        {
          id: "existing-primary",
          previewUrl: space.image_url,
          isExisting: true,
        },
      ]);
    } else {
      setEditImages([]);
    }
    setIsEditOpen(true);
  };

  const handleUpdateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpace || !user) return;
    setEditBusy(true);

    let image_url: string | null = editingSpace.image_url ?? null;

    const hasNewFiles = editImages.some((img) => !img.isExisting);
    if (hasNewFiles) {
      const { primaryUrl, error: uploadErr } = await uploadListingPhotos(editImages, user.id);
      if (uploadErr) {
        toast.warning("Photo upload failed", {
          description: `Space saved without updating photo. Reason: ${uploadErr}`,
        });
      } else if (primaryUrl) {
        image_url = primaryUrl;
      }
    } else if (editImages.length === 0) {
      image_url = null;
    }

    if (!isLive) {
      toast.success("Shared space updated (demo mode)", {
        description: "Changes saved and marked for moderation review.",
      });
      setEditBusy(false);
      setIsEditOpen(false);
      setEditingSpace(null);
      return;
    }

    const { error } = await supabase
      .from("listings")
      .update({
        title: editForm.title.trim(),
        kind: editForm.kind,
        school: editForm.school,
        area: editForm.area.trim(),
        distance: editForm.distance.trim(),
        price: Number(editForm.price) || 0,
        period: editForm.period.trim(),
        description: editForm.description.trim(),
        amenities: editForm.amenities
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        image_url,
        status: "pending",
        verified: false,
      })
      .eq("id", editingSpace.id)
      .eq("owner_id", user.id);

    setEditBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Shared space updated!", {
      description: "Your space was saved and sent for campus representative review.",
    });
    setIsEditOpen(false);
    setEditingSpace(null);
    void qc.invalidateQueries({ queryKey: ["my-shared-spaces"] });
    void qc.invalidateQueries({ queryKey: ["approved-listings"] });
  };

  const toggleSpaceAvailability = async (space: SharedSpaceListing) => {
    if (!user) return;
    const isTaken = space.status === "removed";

    if (!isLive) {
      toast.success(
        isTaken ? "Space marked as available (demo)" : "Space marked as taken / off market (demo)",
      );
      return;
    }

    if (isTaken) {
      const { error } = await supabase
        .from("listings")
        .update({ status: "pending", verified: false })
        .eq("id", space.id)
        .eq("owner_id", user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Space marked as available", {
        description: "It will appear in Browse once re-approved.",
      });
    } else {
      const { error } = await supabase
        .from("listings")
        .update({ status: "removed" })
        .eq("id", space.id)
        .eq("owner_id", user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Space marked as taken / off market", {
        description: "It is now hidden from Browse. You can mark it available again any time.",
      });
    }
    void qc.invalidateQueries({ queryKey: ["my-shared-spaces"] });
    void qc.invalidateQueries({ queryKey: ["approved-listings"] });
  };

  const handleDeleteSpace = async (id: string) => {
    if (!user) return;
    setIsDeletingSpace(true);

    if (!isLive) {
      toast.success("Shared space removed (demo mode)");
      setIsDeletingSpace(false);
      setSpaceToDelete(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw error;
      toast.success("Shared space removed");
      setSpaceToDelete(null);
      void qc.invalidateQueries({ queryKey: ["my-shared-spaces"] });
      void qc.invalidateQueries({ queryKey: ["my-shared-spaces-inspections"] });
      void qc.invalidateQueries({ queryKey: ["approved-listings"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove space");
    } finally {
      setIsDeletingSpace(false);
    }
  };

  const setIncomingInspectionStatus = async (id: string, status: "confirmed" | "declined") => {
    if (!isLive) {
      toast.success(
        status === "confirmed"
          ? "Inspection confirmed (demo mode)"
          : "Inspection declined (demo mode)",
      );
      return;
    }

    try {
      const { error } = await supabase
        .from("inspections")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast.success(
        status === "confirmed"
          ? "Inspection confirmed! The student can now coordinate their visit."
          : "Inspection declined.",
      );
      void qc.invalidateQueries({ queryKey: ["my-shared-spaces-inspections"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update inspection status");
    }
  };

  const handleChatWithStudent = async (studentId: string, listingId: string, studentName?: string) => {
    try {
      const convId = await getOrCreateConversation(studentId, listingId);
      navigate({
        to: "/messages",
        search: { conversation_id: convId },
      });
    } catch (err: any) {
      toast.error(err?.message || "Unable to open conversation right now.");
    }
  };

  // Calculate Confirmed Inspections for Notification Banner
  const allInspections = mine.data ?? [];
  const confirmedInspections = allInspections.filter((i) => i.status === "confirmed");
  const pendingInspections = allInspections.filter((i) => i.status === "pending");

  const filteredInspections = allInspections.filter((i) => {
    if (inspectionFilter === "all") return true;
    return i.status === inspectionFilter;
  });

  return (
    <DashboardShell
      title={`Hi ${profile?.full_name?.split(" ")[0] ?? "there"}`}
      subtitle="Request physical inspections on verified rooms and track every booking in one place. Never pay before you inspect."
    >
      <div className="space-y-6">
        {/* Dynamic Notification Banner for Confirmed Inspections */}
        {confirmedInspections.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-sm sm:text-base">
                  {confirmedInspections.length === 1
                    ? "Great news! 1 inspection request has been confirmed."
                    : `Great news! ${confirmedInspections.length} inspection requests have been confirmed.`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  The host approved your inspection visit. Contact information is unlocked below so you can coordinate arrival.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 rounded-xl border-emerald-600/30 bg-background text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              onClick={() => setInspectionFilter("confirmed")}
            >
              View Confirmed Hosts
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Available Rooms Panel */}
          <Panel title="Available rooms" description="Only listings approved by the LodgeMate team.">
            {listings.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading rooms…</p>
            ) : (() => {
              const otherAvailableListings = (listings.data ?? []).filter(
                (l: any) => !user || l.owner_id !== user.id
              );
              return otherAvailableListings.length > 0 ? (
                <ul className="space-y-3">
                  {otherAvailableListings.map((l: any) => (
                    <li key={l.id} className="rounded-xl border border-border p-4 bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{l.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {l.kind} · {l.school} · {l.area} {l.distance && `· ${l.distance}`}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-primary">
                            ₦{l.price.toLocaleString()}{" "}
                            <span className="font-normal text-muted-foreground">{l.period}</span>
                          </p>
                        </div>
                        {l.verified && <StatusPill status="approved" />}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setSelected(l.id)}>
                          Request inspection
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReportListing({ id: l.id, title: l.title })}
                        >
                          Report
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/listings/$id" params={{ id: l.id }}>
                            View details
                          </Link>
                        </Button>
                      </div>

                      {/* Inspection Scheduling Card */}
                      {selected === l.id && (
                        <div className="mt-4 space-y-3 rounded-xl border border-primary/20 bg-muted/50 p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                            <CalendarCheck className="h-4 w-4" /> Pick Date & Time Window
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="date" className="text-xs font-medium">
                                Preferred Date <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="date"
                                type="date"
                                min={new Date().toISOString().split("T")[0]}
                                className="mt-1.5 text-xs sm:text-sm bg-background"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                              />
                            </div>

                            <div>
                              <Label htmlFor="timeSlot" className="text-xs font-medium">
                                Time Window
                              </Label>
                              <Select value={timeSlot} onValueChange={setTimeSlot}>
                                <SelectTrigger id="timeSlot" className="mt-1.5 text-xs sm:text-sm bg-background">
                                  <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_SLOTS.map((s) => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="note" className="text-xs font-medium">
                              Note to host (Optional)
                            </Label>
                            <Textarea
                              id="note"
                              className="mt-1.5 text-xs bg-background"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="e.g. Free after lectures around 2pm, coming with a course mate."
                              rows={2}
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={request} disabled={isSubmittingRequest}>
                              {isSubmittingRequest ? "Sending…" : "Send request"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelected(null);
                                setDate("");
                                setNote("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No approved listings from other hosts yet — check back soon or browse the featured lodges.
                </p>
              );
            })()}
          </Panel>

          {/* My Inspection Requests Panel */}
          <Panel
            title="My inspection requests"
            description="Status updates and host contact numbers appear here."
          >
            {/* Filter Pills */}
            {allInspections.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5 border-b border-border/70 pb-3">
                <button
                  type="button"
                  onClick={() => setInspectionFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    inspectionFilter === "all"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  All ({allInspections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInspectionFilter("confirmed")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    inspectionFilter === "confirmed"
                      ? "bg-emerald-600 text-white font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Confirmed ({confirmedInspections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInspectionFilter("pending")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    inspectionFilter === "pending"
                      ? "bg-amber-600 text-white font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Pending ({pendingInspections.length})
                </button>
              </div>
            )}

            {filteredInspections.length > 0 ? (
              <ul className="space-y-3">
                {filteredInspections.map((i) => {
                  const hostProfile = i.listings?.profiles;
                  const hostPhone = hostProfile?.phone;
                  const hostName = hostProfile?.full_name || "Verified Host";
                  const cleanPhone = hostPhone ? hostPhone.replace(/\D/g, "") : "";
                  const waNumber = cleanPhone.startsWith("0") ? `234${cleanPhone.slice(1)}` : cleanPhone;

                  return (
                    <li
                      key={i.id}
                      className="rounded-xl border border-border p-4 bg-card space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground leading-snug">
                            {i.listings?.title ?? "Listing"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {i.listings?.area} · {i.preferred_date ?? "Flexible date"}
                          </p>
                          {i.note && (
                            <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-line bg-muted/40 p-2 rounded-lg">
                              {i.note}
                            </p>
                          )}
                        </div>
                        <StatusPill status={i.status} />
                      </div>

                      {/* Unlocked Host Contact Info on Confirmation */}
                      {i.status === "confirmed" && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-100">
                          <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" /> Confirmed by Host
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Host: <strong className="text-foreground">{hostName}</strong>
                            {hostProfile?.provider_type && ` (${hostProfile.provider_type === "agent" ? "Independent Agent" : "Landlord"})`}
                          </p>

                          {hostPhone ? (
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              <a
                                href={`tel:${hostPhone}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 transition-colors"
                              >
                                <Phone className="h-3.5 w-3.5" /> Call {hostPhone}
                              </a>
                              <a
                                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${hostName}, I am contacting you regarding the confirmed inspection for ${i.listings?.title || "your lodge"} on LodgeMate.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                              >
                                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp Host
                              </a>
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted-foreground italic">
                              Host phone will be updated by campus representative shortly.
                            </p>
                          )}
                        </div>
                      )}

                      {i.status === "pending" && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          <span>Awaiting host response. Phone number unlocks once confirmed.</span>
                        </div>
                      )}

                      {i.status === "declined" && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          <span>Host declined this time slot. You can request another date or explore other rooms.</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {allInspections.length === 0
                  ? "You haven't requested any inspections yet."
                  : `No ${inspectionFilter} inspections found.`}
              </p>
            )}
          </Panel>

          {/* My Shared Spaces Panel (Student Bedspaces & Tenancy Takeovers) */}
          <Panel
            title="My Shared Spaces"
            description="Manage your posted bedspaces and tenancy takeovers, toggle availability, and respond to incoming roommate inspections."
            className="lg:col-span-2"
          >
            <div className="space-y-6">
              {/* Header Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                      Student Roommate & Takeover Spaces
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {mySharedSpaces.data?.length ?? 0} posted space{(mySharedSpaces.data?.length ?? 0) === 1 ? "" : "s"} · {sharedSpacesInspections.data?.length ?? 0} incoming inspection request{(sharedSpacesInspections.data?.length ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <Button size="sm" className="h-8 gap-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-xs shrink-0 self-start sm:self-auto" asChild>
                  <Link to="/list-a-space">
                    <PlusCircle className="h-3.5 w-3.5" /> Post a Bedspace / Takeover
                  </Link>
                </Button>
              </div>

              {/* 1. Posted Shared Spaces */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5 text-primary" /> Your Active Spaces
                </h4>

                {mySharedSpaces.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading your shared spaces…</p>
                ) : mySharedSpaces.isError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Failed to load your shared spaces.</span>
                    <Button size="sm" variant="outline" className="ml-auto h-6 text-xs" onClick={() => mySharedSpaces.refetch()}>
                      Retry
                    </Button>
                  </div>
                ) : (mySharedSpaces.data?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 py-8 px-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2.5">
                      <BedDouble className="h-5 w-5" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                      You haven't posted any bedspaces or takeovers yet
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
                      Have an empty bed in your room or want someone to take over your rent? Post it on LodgeMate to connect directly with fellow students.
                    </p>
                    <Button size="sm" variant="outline" className="mt-3.5 h-8 gap-1.5 rounded-xl text-xs font-semibold" asChild>
                      <Link to="/list-a-space">
                        <PlusCircle className="h-3.5 w-3.5" /> Post a Space
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {mySharedSpaces.data!.map((space) => {
                      const isTaken = space.status === "removed";
                      const displayImg = space.image_url || getFallbackImage(space.kind);

                      return (
                        <div
                          key={space.id}
                          className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 sm:p-4 transition-shadow hover:shadow-xs"
                        >
                          <div>
                            {/* Top row: Thumbnail & Title */}
                            <div className="flex items-start gap-3">
                              <img
                                src={displayImg}
                                alt={space.title}
                                className="h-16 w-20 shrink-0 rounded-lg object-cover border border-border/60 bg-muted"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-1.5">
                                  <p className="font-semibold text-xs sm:text-sm text-foreground truncate">
                                    {space.title}
                                  </p>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <StatusPill status={space.status} />
                                  </div>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground">{space.kind}</span>
                                  <span>·</span>
                                  <span>{space.school}</span>
                                  <span>·</span>
                                  <span className="truncate">{space.area}</span>
                                  {space.distance && <span>· {space.distance}</span>}
                                </div>
                                <p className="mt-1 text-xs sm:text-sm font-bold text-primary">
                                  ₦{space.price.toLocaleString()}{" "}
                                  <span className="text-[11px] font-normal text-muted-foreground">/{space.period}</span>
                                </p>
                              </div>
                            </div>

                            {/* Status and description */}
                            <div className="mt-2.5 flex items-center gap-2">
                              {isTaken ? (
                                <span className="inline-flex items-center rounded-md bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-400">
                                  Taken / Off market
                                </span>
                              ) : space.status === "approved" ? (
                                <span className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                  Live on Browse
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                  Pending campus review
                                </span>
                              )}
                              {space.verified && (
                                <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  Verified
                                </span>
                              )}
                            </div>

                            {space.description && (
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {space.description}
                              </p>
                            )}
                          </div>

                          {/* Action Toolbar */}
                          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5">
                            {/* Edit */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2.5 text-xs font-medium"
                              onClick={() => openEditSpace(space)}
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </Button>

                            {/* Availability Toggle */}
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-7 gap-1 px-2.5 text-xs font-medium ${
                                isTaken
                                  ? "border-primary/40 text-primary hover:bg-primary/10"
                                  : "border-orange-400/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                              }`}
                              onClick={() => toggleSpaceAvailability(space)}
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

                            {/* View Listing */}
                            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" asChild>
                              <Link to="/listings/$id" params={{ id: space.id }}>
                                <ExternalLink className="h-3 w-3" />
                                View
                              </Link>
                            </Button>

                            {/* Delete */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setSpaceToDelete(space)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Incoming Inspection Requests on Your Spaces */}
              <div className="pt-2 border-t border-border/60">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary" /> Incoming Inquiries & Inspection Requests
                </h4>

                {sharedSpacesInspections.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading incoming requests…</p>
                ) : (sharedSpacesInspections.data?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl">
                    No inspection requests on your shared spaces yet. Interested roommates will appear here when they request to visit.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {sharedSpacesInspections.data!.map((req: any) => {
                      const studentName = req.student?.full_name || "LodgeMate Student";
                      const studentPhone = req.student?.phone;
                      const cleanPhone = studentPhone ? studentPhone.replace(/\D/g, "") : "";
                      const waNumber = cleanPhone.startsWith("0") ? `234${cleanPhone.slice(1)}` : cleanPhone;

                      return (
                        <li key={req.id} className="rounded-xl border border-border p-3.5 bg-card space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs sm:text-sm font-semibold text-foreground">
                                {req.listings?.title || "Your Shared Space"}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Requested visit date: <strong className="text-foreground">{req.preferred_date ?? "Flexible date"}</strong>
                              </p>
                            </div>
                            <StatusPill status={req.status} />
                          </div>

                          {req.note && (
                            <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                              {req.note}
                            </div>
                          )}

                          {/* Student Details and Contact Actions */}
                          <div className="rounded-lg bg-muted/30 p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <User className="h-3.5 w-3.5" />
                              </span>
                              <div>
                                <span className="font-semibold text-foreground">{studentName}</span>
                                <span className="text-[11px] text-muted-foreground ml-1">(Interested Student)</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Direct in-app Chat Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
                                onClick={() => handleChatWithStudent(req.student_id, req.listings?.id, studentName)}
                              >
                                <MessageCircle className="h-3 w-3" />
                                Chat with Student
                              </Button>

                              {/* Phone / WhatsApp if available */}
                              {studentPhone && (
                                <>
                                  <a
                                    href={`tel:${studentPhone}`}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 transition-colors"
                                  >
                                    <Phone className="h-3 w-3" /> Call
                                  </a>
                                  <a
                                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${studentName}, I am contacting you regarding your inspection request for ${req.listings?.title || "the shared bedspace"} on LodgeMate.`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                                  >
                                    WhatsApp
                                  </a>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Confirm / Decline Actions for Pending Requests */}
                          {req.status === "pending" && (
                            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                              <Button
                                size="sm"
                                className="h-7 px-3 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={() => setIncomingInspectionStatus(req.id, "confirmed")}
                              >
                                Confirm Inspection
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => setIncomingInspectionStatus(req.id, "declined")}
                              >
                                Decline
                              </Button>
                            </div>
                          )}

                          {req.status === "confirmed" && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium pt-1 border-t border-border/50">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>You confirmed this inspection. Coordinate arrival with the student above.</span>
                            </div>
                          )}

                          {req.status === "declined" && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                              <span>You declined this inspection request.</span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          {/* Beta Lodges Access Pass Panel */}
          <Panel
            title="Beta Lodges"
            description="Premium lodges with direct provider contact and video walkthroughs."
          >
            <BetaPassStatus
              hasAccess={!isLive || (accessQuery.data ?? false)}
              pass={passQuery.data ?? null}
              config={configQuery.data ?? null}
              isLoading={accessQuery.isLoading || configQuery.isLoading}
              isAuthenticated={!!user}
              isLive={isLive}
            />
          </Panel>

          {/* Saved Lodges */}
          <Panel
            title="Saved Lodges"
            description="Rooms you bookmarked for later comparison."
            className="lg:col-span-2"
          >
            {isLoadingSaved ? (
              <p className="text-sm text-muted-foreground">Loading saved lodges…</p>
            ) : savedListings.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedListings.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-col justify-between rounded-xl border border-border p-4 bg-card"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-snug">{l.title}</p>
                        <button
                          type="button"
                          onClick={() => toggleSave.mutate({ listingId: l.id, currentlySaved: true })}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="Remove bookmark"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {l.school} · {l.area} · {l.kind}
                      </p>
                      <p className="mt-2 text-sm font-bold text-primary">
                        {l.price} <span className="text-xs font-normal text-muted-foreground">/{l.period}</span>
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2 pt-2 border-t border-border/70">
                      <Button size="sm" variant="outline" className="text-xs h-7 flex-1" asChild>
                        <Link to="/listings/$id" params={{ id: l.id }}>
                          View details
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-7 flex-1"
                        onClick={() => setSelected(l.id)}
                      >
                        Inspect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                You haven't saved any lodges yet. Click the heart icon on any listing to save it here.
              </p>
            )}
          </Panel>
        </div>
      </div>

      {/* Accessible Report Listing Modal Dialog (Replacing window.prompt) */}
      <Dialog
        open={!!reportListing}
        onOpenChange={(open) => {
          if (!open) {
            setReportListing(null);
            setReportReason("");
            setReportDetails("");
          }
        }}
      >
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold sm:text-lg flex items-center gap-2">
              <Flag className="h-4 w-4 text-destructive" /> Report Accommodation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reporting: <strong>{reportListing?.title}</strong>. Help us maintain safe, verified student housing on LodgeMate.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitReport} className="space-y-4 py-2">
            <div>
              <Label htmlFor="dashboardReportReason" className="text-xs font-semibold">
                Reason for report <span className="text-destructive">*</span>
              </Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="dashboardReportReason" className="mt-1.5 text-xs">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}
                </SelectContent>
              </Select>
              <Label htmlFor="dashboardReportDetails" className="mt-3 block text-xs font-semibold">Additional details (optional)</Label>
              <Textarea id="dashboardReportDetails" className="mt-1.5 text-xs" rows={3} placeholder="Share any helpful details for our review." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} />
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReportListing(null);
                  setReportReason("");
                  setReportDetails("");
                }}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmittingReport || !reportReason}
                className="rounded-xl text-xs font-semibold"
              >
                {isSubmittingReport ? "Submitting…" : "Submit Report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Shared Space Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold sm:text-lg flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" /> Edit Shared Space
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update room details, price, amenities and photos. Changes are saved and sent for campus review.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateSpace} className="space-y-4 py-2">
            <div>
              <Label htmlFor="editSpaceTitle" className="text-xs font-semibold">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editSpaceTitle"
                className="mt-1.5 text-xs sm:text-sm"
                required
                {...editField("title")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="editSpaceKind" className="text-xs font-semibold">
                  Space Type
                </Label>
                <select
                  id="editSpaceKind"
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...editField("kind")}
                >
                  <option value="Bedspace">Bedspace (Shared Room)</option>
                  <option value="Takeover">Tenancy Takeover</option>
                </select>
              </div>

              <div>
                <Label htmlFor="editSpaceSchool" className="text-xs font-semibold">
                  Campus
                </Label>
                <select
                  id="editSpaceSchool"
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...editField("school")}
                >
                  <option value="MOUAU">MOUAU (Umudike)</option>
                  <option value="ABSU">ABSU (Uturu)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="editSpaceArea" className="text-xs font-semibold">
                  Area / Gate <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="editSpaceArea"
                  className="mt-1.5 text-xs sm:text-sm"
                  placeholder="e.g. Ishiagu Gate, Umudike"
                  required
                  {...editField("area")}
                />
              </div>

              <div>
                <Label htmlFor="editSpaceDistance" className="text-xs font-semibold">
                  Distance to Campus
                </Label>
                <Input
                  id="editSpaceDistance"
                  className="mt-1.5 text-xs sm:text-sm"
                  placeholder="e.g. 5 min walk"
                  {...editField("distance")}
                />
              </div>

              <div>
                <Label htmlFor="editSpacePrice" className="text-xs font-semibold">
                  Price (₦) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="editSpacePrice"
                  type="number"
                  className="mt-1.5 text-xs sm:text-sm"
                  required
                  {...editField("price")}
                />
              </div>

              <div>
                <Label htmlFor="editSpacePeriod" className="text-xs font-semibold">
                  Payment Period
                </Label>
                <Input
                  id="editSpacePeriod"
                  className="mt-1.5 text-xs sm:text-sm"
                  placeholder="per year, per session, etc."
                  {...editField("period")}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="editSpaceAmenities" className="text-xs font-semibold">
                Amenities (comma separated)
              </Label>
              <Input
                id="editSpaceAmenities"
                className="mt-1.5 text-xs sm:text-sm"
                placeholder="Prepaid meter, Borehole, Fenced, Tiled floor"
                {...editField("amenities")}
              />
            </div>

            <div>
              <Label htmlFor="editSpaceDescription" className="text-xs font-semibold">
                Description & Roommate Notes
              </Label>
              <Textarea
                id="editSpaceDescription"
                className="mt-1.5 text-xs"
                rows={3}
                placeholder="Describe the room, compound rules, and preferred roommate."
                {...editField("description")}
              />
            </div>

            {/* Photo upload */}
            <div>
              <Label className="mb-2 block text-xs font-semibold">
                Photos (Optional, up to 5)
              </Label>
              <ListingImageUpload images={editImages} onChange={setEditImages} maxFiles={5} />
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editBusy}
                className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
              >
                {editBusy ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Shared Space Alert Dialog */}
      <AlertDialog
        open={!!spaceToDelete}
        onOpenChange={(open) => !open && setSpaceToDelete(null)}
      >
        <AlertDialogContent className="max-w-md sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Remove Shared Space?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove <strong>"{spaceToDelete?.title}"</strong>? This will permanently delete the space and cancel any pending inspection requests. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2">
            <AlertDialogCancel
              disabled={isDeletingSpace}
              className="rounded-xl text-xs"
              onClick={() => setSpaceToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingSpace}
              className="rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => spaceToDelete && handleDeleteSpace(spaceToDelete.id)}
            >
              {isDeletingSpace ? "Removing…" : "Yes, Remove Space"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
