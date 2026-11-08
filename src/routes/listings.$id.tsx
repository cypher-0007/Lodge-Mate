import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fetchListingById, isLocalDevPreview } from "@/lib/listings";
import { useSavedListingIds, useToggleSaveListing } from "@/lib/saved-listings";

export const Route = createFileRoute("/listings/$id")({
  loader: async ({ params }) => {
    try {
      const listing = await fetchListingById(params.id);
      if (!listing) throw notFound();
      return { listing };
    } catch (err: any) {
      if (err && (err.isNotFound || err.status === 404 || err.message === "Not Found")) {
        throw notFound();
      }
      throw notFound();
    }
  },
  notFoundComponent: ListingNotFound,
  errorComponent: ListingErrorComponent,
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Listing unavailable — LodgeMate" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { listing } = loaderData;
    const description = `${listing.kind} near ${listing.school} · ${listing.price} ${listing.period}. ${listing.description.slice(0, 90)}`;
    return {
      meta: [
        { title: `${listing.title} — LodgeMate` },
        { name: "description", content: description },
        { property: "og:title", content: `${listing.title} — LodgeMate` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ListingDetail,
});

function ListingDetail() {
  const { listing: l } = Route.useLoaderData();
  const { user, isStudent } = useAuth();
  const navigate = useNavigate();

  const { data: savedIds = [] } = useSavedListingIds();
  const toggleSave = useToggleSaveListing();
  const isSaved = savedIds.includes(l.id);

  // Inspection Request Modal State
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [inspectionNote, setInspectionNote] = useState("");
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);

  // Report Modal State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const handleBookInspectionClick = () => {
    if (!user) {
      toast.info("Please sign in to request an inspection", {
        description: "Inspection requests are reserved for authenticated students.",
      });
      navigate({ to: "/auth" });
      return;
    }
    if (!isStudent) {
      toast.error("Host accounts cannot book inspections", {
        description: "Please switch to a student account to request property inspections.",
      });
      return;
    }
    setIsInspectionOpen(true);
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!isSupabaseConfigured()) {
      toast.success("Inspection requested (demo mode)", {
        description: "The host will be notified of your preferred inspection date.",
      });
      setIsInspectionOpen(false);
      return;
    }

    setIsSubmittingInspection(true);
    try {
      const { error } = await supabase.from("inspections").insert({
        listing_id: l.id,
        student_id: user.id,
        preferred_date: preferredDate || null,
        note: inspectionNote || null,
      });

      if (error) throw error;

      toast.success("Inspection requested successfully", {
        description: "The host will review your request and confirm a time slot.",
      });
      setIsInspectionOpen(false);
      setPreferredDate("");
      setInspectionNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book inspection");
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.info("Please sign in to report a listing");
      navigate({ to: "/auth" });
      return;
    }
    if (!reportReason.trim()) return;

    if (!isSupabaseConfigured()) {
      toast.success("Report submitted (demo mode)", {
        description: "Our moderation team will review this listing.",
      });
      setIsReportOpen(false);
      return;
    }

    setIsSubmittingReport(true);
    try {
      const { error } = await supabase.from("reports").insert({
        listing_id: l.id,
        reporter_id: user.id,
        reason: reportReason.trim(),
      });

      if (error) throw error;

      toast.success("Report sent to the LodgeMate team", {
        description: "Thank you for helping keep campus housing safe.",
      });
      setIsReportOpen(false);
      setReportReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      {isLocalDevPreview() && (
        <div className="border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-center text-xs text-warning-foreground">
          <span className="font-semibold">Local Development Preview:</span> Displaying sample accommodation details. Real Supabase records will stream when database credentials are added.
        </div>
      )}
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
          <Link
            to="/browse"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to all listings
          </Link>
        </div>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.35fr_0.65fr]">
          {/* Main Listing Details */}
          <div>
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-card">
              <img
                src={l.image}
                alt={l.title}
                width={1024}
                height={768}
                className="aspect-[16/10] w-full object-cover"
              />

              {/* Bookmark button on image */}
              {(!user || isStudent) && (
                <button
                  type="button"
                  onClick={() => toggleSave.mutate({ listingId: l.id, currentlySaved: isSaved })}
                  disabled={toggleSave.isPending}
                  className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-transform active:scale-90 ${
                    isSaved
                      ? "bg-destructive text-white"
                      : "bg-background/90 text-foreground hover:bg-background hover:text-destructive"
                  }`}
                  title={isSaved ? "Saved" : "Save this lodge"}
                >
                  <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/60 bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {l.kind}
              </span>
              {l.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/95 px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified by campus rep
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/95 px-3 py-1 text-xs font-semibold text-warning-foreground shadow-xs">
                  <ShieldAlert className="h-3.5 w-3.5" /> Awaiting on-site verification
                </span>
              )}
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
              {l.title}
            </h1>
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
              <MapPin className="h-4 w-4 text-leaf" /> {l.area} · {l.school} · {l.distance}
            </p>

            <div className="mt-6 border-t border-border/80 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                About this space
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground/90 sm:text-base">
                {l.description}
              </p>
            </div>

            <div className="mt-8 border-t border-border/80 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Included Amenities
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {l.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded-lg border border-border/60 bg-secondary/60 px-3 py-1.5 text-xs font-medium text-secondary-foreground"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Safety Reminder */}
            <div className="mt-8 rounded-2xl border border-border bg-warm/80 p-5">
              <h3 className="text-sm font-bold text-foreground">Before you pay</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Never transfer rent, agent commission, or reservation fees before an in-person
                inspection. Meet at the lodge, confirm the room condition, then finalize payment on
                record.
              </p>
            </div>
          </div>

          {/* Sidebar Action Card */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-card sm:p-6">
              <div>
                <span className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
                  {l.price}
                </span>
                <span className="ml-1 text-sm font-normal text-muted-foreground">/{l.period}</span>
              </div>

              <div className="mt-6 space-y-2.5">
                <Button
                  className="w-full h-11 gap-2 rounded-xl text-xs font-semibold shadow-xs"
                  size="lg"
                  onClick={handleBookInspectionClick}
                >
                  <CalendarCheck className="h-4 w-4" /> Book an inspection
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-11 gap-2 rounded-xl text-xs font-semibold"
                  size="lg"
                  onClick={() => {
                    if (!user) {
                      toast.info("Please sign in to message hosts.");
                      navigate({ to: "/auth" });
                      return;
                    }
                    toast.info("Host messaging enabled upon inspection confirmation.");
                  }}
                >
                  <MessageCircle className="h-4 w-4" /> Message host
                </Button>
              </div>

              {/* Host Information */}
              <div className="mt-6 border-t border-border/80 pt-5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Listing Provider
                </span>
                <p className="mt-1 text-sm font-semibold text-foreground">{l.host.name}</p>
                <p className="text-xs text-muted-foreground">
                  {l.host.role} · {l.host.since}
                </p>
              </div>

              {/* Report button */}
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                <Flag className="h-3.5 w-3.5" /> Report this space
              </button>
            </div>
          </aside>
        </section>
      </main>

      {/* Book Inspection Dialog */}
      <Dialog open={isInspectionOpen} onOpenChange={setIsInspectionOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold sm:text-lg">
              Request On-Site Inspection
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select your preferred day to visit <strong>{l.title}</strong>. The host will confirm
              or propose a suitable time slot.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInspectionSubmit} className="space-y-4 py-2">
            <div>
              <Label htmlFor="prefDate" className="text-xs font-semibold">
                Preferred Date
              </Label>
              <Input
                id="prefDate"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className="mt-1.5 text-sm"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="prefNote" className="text-xs font-semibold">
                Note for Host (Optional)
              </Label>
              <Textarea
                id="prefNote"
                className="mt-1.5 text-xs"
                rows={3}
                placeholder="e.g. I am free between 2pm and 5pm after lectures."
                value={inspectionNote}
                onChange={(e) => setInspectionNote(e.target.value)}
              />
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInspectionOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingInspection}
                className="rounded-xl text-xs font-semibold"
              >
                {isSubmittingInspection ? "Sending..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Report Listing Dialog */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold sm:text-lg">
              Report Listing: {l.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Help us maintain authentic student housing. What issue did you observe with this
              space?
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReportSubmit} className="space-y-4 py-2">
            <div>
              <Label htmlFor="reportReason" className="text-xs font-semibold">
                Reason for report
              </Label>
              <Textarea
                id="reportReason"
                className="mt-1.5 text-xs"
                rows={4}
                placeholder="e.g. Unreachable landlord, incorrect price, or room already taken."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReportOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmittingReport}
                className="rounded-xl text-xs font-semibold"
              >
                {isSubmittingReport ? "Submitting..." : "Send Report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}

function ListingNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Accommodation Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This student listing may have been rented, unlisted, or does not exist in our verified database.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild className="rounded-xl">
              <Link to="/browse">Browse available spaces</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ListingErrorComponent({ reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Unable to Load Accommodation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We had trouble retrieving the accommodation details. Please check your connection or try again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => reset()} className="gap-2 rounded-xl text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <Button asChild className="rounded-xl text-xs">
              <Link to="/browse">Browse spaces</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
