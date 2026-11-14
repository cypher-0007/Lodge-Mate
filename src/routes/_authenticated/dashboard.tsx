import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { BetaPassStatus } from "@/components/beta-pass-status";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSavedListingsQuery, useToggleSaveListing } from "@/lib/saved-listings";
import { useBetaLodgesConfig, useUserBetaAccess, useUserBetaPass } from "@/lib/beta-lodges";

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
    // If user is exclusively a landlord/agent, redirect them to the host panel
    if (context.isHost && !context.roles.includes("student") && !context.isAdmin) {
      throw redirect({ to: "/host" });
    }
  },
  component: StudentDashboard,
});

type InspectionFilter = "all" | "confirmed" | "pending" | "declined";

const TIME_SLOTS = [
  { value: "morning", label: "Morning (9:00 AM – 12:00 PM)" },
  { value: "afternoon", label: "Afternoon (12:00 PM – 3:00 PM)" },
  { value: "evening", label: "Late Afternoon / Evening (3:00 PM – 6:00 PM)" },
  { value: "flexible", label: "Flexible (Any time host is available)" },
];

function StudentDashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

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
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
        .select("id, title, kind, school, area, distance, price, period, verified")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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
        reason: reportReason.trim(),
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
            ) : listings.data && listings.data.length > 0 ? (
              <ul className="space-y-3">
                {listings.data.map((l) => (
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
                No approved listings yet — check back soon or browse the featured lodges.
              </p>
            )}
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
              <Textarea
                id="dashboardReportReason"
                className="mt-1.5 text-xs"
                rows={4}
                placeholder="e.g. Unreachable landlord, incorrect pricing, room already occupied, or safety concern."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReportListing(null);
                  setReportReason("");
                }}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmittingReport || !reportReason.trim()}
                className="rounded-xl text-xs font-semibold"
              >
                {isSubmittingReport ? "Submitting…" : "Submit Report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
