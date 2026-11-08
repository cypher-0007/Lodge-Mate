import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Lock,
  MapPin,
  Phone,
  ShieldAlert,
  Video,
} from "lucide-react";

import { BetaCheckoutButton } from "@/components/beta-checkout-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  demoBetaLodges,
  fetchBetaLodgeFullDetails,
  fetchBetaLodgesPreview,
  formatBetaDuration,
  formatBetaPrice,
  isLocalBetaDevPreview,
  useBetaLodgesConfig,
  useUserBetaAccess,
  useUserBetaPass,
  type BetaLodgeFullDetails,
  type BetaLodgePreview,
} from "@/lib/beta-lodges";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/beta-lodges/$id")({
  head: () => ({
    meta: [{ title: "Beta Lodge Details — LodgeMate" }],
  }),
  component: BetaLodgeDetailPage,
  notFoundComponent: BetaLodgeNotFound,
  errorComponent: BetaLodgeError,
});

// ─── Detail fetching hook ───────────────────────────────────────────────────

function useBetaLodgeDetail(id: string, hasAccess: boolean) {
  const isLive = isSupabaseConfigured();

  return useQuery({
    queryKey: ["beta-lodge-detail", id, hasAccess],
    queryFn: async (): Promise<{ detail: BetaLodgeFullDetails | null; preview: BetaLodgePreview | null; accessDenied: boolean }> => {
      if (!isLive) {
        // Strictly development-only local preview
        if (!isLocalBetaDevPreview()) {
          throw notFound();
        }
        const demo = demoBetaLodges.find((l) => l.id === id);
        if (!demo) throw notFound();
        // In local development preview, demo-beta-3 simulates a locked state without access,
        // while demo-beta-1 and demo-beta-2 simulate full unlocked access for testing both UI states.
        if (id === "demo-beta-3") {
          return { detail: null, preview: demo, accessDenied: true };
        }
        // Cast demo to full details with fake protected fields for UI preview
        const full: BetaLodgeFullDetails = {
          ...demo,
          owner_id: "demo-owner",
          video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          provider_phone: "+234 800 DEMO 001",
          inspection_notes: "LodgeMate team visited on 1st November 2026. Property is clean, well-maintained with working plumbing and reliable water supply. Landlord is responsive and highly recommended.",
        };
        return { detail: full, preview: demo, accessDenied: false };
      }

      // Try to get full details (gated RPC)
      const { data, error } = await fetchBetaLodgeFullDetails(id);

      if (!error && data) {
        return { detail: data, preview: data, accessDenied: false };
      }

      // If access denied exception, fetch the preview teaser instead
      if (error) {
        const isAccessError =
          error.message.includes("Access pass required") ||
          error.message.includes("access_denied") ||
          error.message.includes("pass");

        if (isAccessError) {
          // Fetch the public preview
          const previews = await fetchBetaLodgesPreview();
          const preview = previews.find((p) => p.id === id) ?? null;
          return { detail: null, preview, accessDenied: true };
        }

        // Not found
        if (error.message.includes("not found") || error.message.includes("Not found")) {
          throw notFound();
        }

        throw error;
      }

      throw notFound();
    },
    retry: false,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Main component ─────────────────────────────────────────────────────────

function BetaLodgeDetailPage() {
  const { id } = Route.useParams();
  const { user, isStudent } = useAuth();
  const isLive = isSupabaseConfigured();

  const configQuery = useBetaLodgesConfig();
  const accessQuery = useUserBetaAccess(user?.id);
  const passQuery = useUserBetaPass(user?.id);

  const isDevPreview = isLocalBetaDevPreview();
  const hasAccess = isLive
    ? (accessQuery.data ?? false)
    : isDevPreview
      ? id !== "demo-beta-3"
      : false;
  const config = configQuery.data;

  const detailQuery = useBetaLodgeDetail(id, hasAccess);

  if (detailQuery.isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
          <div className="animate-pulse space-y-5">
            <div className="h-8 w-24 rounded bg-muted/80" />
            <div className="aspect-video w-full rounded-2xl bg-muted/80" />
            <div className="h-8 w-2/3 rounded bg-muted/80" />
            <div className="h-4 w-1/4 rounded bg-muted/80" />
          </div>
        </div>
      </div>
    );
  }

  if (detailQuery.isError) {
    return <BetaLodgeError error={detailQuery.error} />;
  }

  const { detail, preview, accessDenied } = detailQuery.data ?? {};
  const lodge = detail ?? preview;

  if (!lodge) {
    return <BetaLodgeNotFound />;
  }

  const isUnlocked = !!detail && !accessDenied;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        {/* Back link */}
        <Link
          to="/beta-lodges"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Beta Lodges
        </Link>

        {/* Demo badge */}
        {!isLive && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-300/60 bg-orange-50 px-4 py-2.5 dark:border-orange-700/40 dark:bg-orange-950/20">
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              DEMO
            </span>
            <p className="text-xs text-orange-700 dark:text-orange-300">
              This is demo content for local development. Connect Supabase for real listings.
            </p>
          </div>
        )}

        {/* Image */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-muted">
          {lodge.image_url ? (
            <img
              src={lodge.image_url}
              alt={lodge.title}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-warning/10 to-primary/10">
              <span className="text-7xl opacity-20">🏠</span>
            </div>
          )}
          {/* Beta ribbon */}
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/95 px-3 py-1 text-xs font-bold text-warning-foreground shadow-sm">
            ✦ Beta Lodge
          </span>
          {lodge.verified ? (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary/95 px-2.5 py-1 text-xs font-semibold text-primary-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </span>
          ) : (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-warning/95 px-2.5 py-1 text-xs font-semibold text-warning-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> Unverified
            </span>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Title & meta */}
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{lodge.school}</span>
                <span>·</span>
                <span>{lodge.area}</span>
                <span>·</span>
                <span>{lodge.distance}</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
                {lodge.title}
              </h1>
              <p className="mt-1 font-display text-xl font-bold text-primary sm:text-2xl">
                ₦{lodge.price.toLocaleString("en-NG")}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/{lodge.period}</span>
              </p>
            </div>

            {/* Description */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                About this lodge
              </h2>
              <p className="text-sm leading-relaxed text-foreground">{lodge.description}</p>
            </div>

            {/* Amenities */}
            {lodge.amenities.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Amenities
                </h2>
                <div className="flex flex-wrap gap-2">
                  {lodge.amenities.map((a) => (
                    <span
                      key={a}
                      className="rounded-lg border border-border/50 bg-secondary/50 px-3 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Video walkthrough — unlocked */}
            {isUnlocked && detail?.video_url && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Video className="h-4 w-4" /> Video Walkthrough
                </h2>
                {detail.video_url.includes("youtube.com") ||
                detail.video_url.includes("youtu.be") ||
                detail.video_url.includes("vimeo.com") ? (
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-border/50">
                    <iframe
                      src={detail.video_url}
                      title="Lodge video walkthrough"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                ) : (
                  <video
                    src={detail.video_url}
                    controls
                    className="w-full rounded-xl border border-border/50"
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            )}

            {/* Video walkthrough — locked */}
            {!isUnlocked && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/5 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
                  <Video className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Video walkthrough locked</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Purchase a Beta Access Pass to watch the full tour.
                  </p>
                </div>
              </div>
            )}

            {/* Inspection notes — unlocked */}
            {isUnlocked && detail?.inspection_notes && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <BadgeCheck className="h-4 w-4" /> LodgeMate Inspection Notes
                </h2>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm leading-relaxed text-foreground">{detail.inspection_notes}</p>
                </div>
              </div>
            )}

            {/* Inspection notes — locked */}
            {!isUnlocked && (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  LodgeMate inspection notes are available to Beta Access Pass holders.
                </p>
              </div>
            )}
          </div>

          {/* Right column — provider contact + CTA */}
          <div className="space-y-4">
            {/* Provider contact — unlocked */}
            {isUnlocked && detail?.provider_phone && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  Provider Contact
                </h3>
                <a
                  href={`tel:${detail.provider_phone}`}
                  className="block rounded-xl border border-primary/20 bg-background px-4 py-3 text-center font-mono text-lg font-bold text-primary transition-colors hover:bg-primary/5"
                >
                  {detail.provider_phone}
                </a>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Call or WhatsApp this number to arrange a viewing.
                </p>
              </div>
            )}

            {/* Provider contact — locked */}
            {!isUnlocked && (
              <div className="rounded-2xl border border-dashed border-warning/40 bg-warning/5 p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Provider Contact
                </h3>
                <div className="rounded-xl border border-border/50 bg-muted/50 px-4 py-3 text-center">
                  <span className="select-none font-mono text-lg font-bold tracking-widest text-muted-foreground/40 blur-[4px]">
                    +234 800 000 0000
                  </span>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Unlocks with Beta Access Pass
                </p>
              </div>
            )}

            {/* Access CTA card (when no access) */}
            {!isUnlocked && (
              <div className="rounded-2xl border border-warning/30 bg-gradient-to-b from-warning/5 to-background p-5">
                <p className="text-sm font-semibold text-foreground">Get Beta Access Pass</p>
                {config ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBetaPrice(config.access_fee_ngn)} · {formatBetaDuration(config.access_duration_days)} · All Beta Lodges
                  </p>
                ) : null}
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0 text-warning" />
                    Provider phone number
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Video className="h-3 w-3 shrink-0 text-warning" />
                    Private video walkthrough
                  </li>
                  <li className="flex items-center gap-1.5">
                    <BadgeCheck className="h-3 w-3 shrink-0 text-warning" />
                    Verified inspection notes
                  </li>
                </ul>

                <div className="mt-4">
                  {user && isStudent && config ? (
                    <BetaCheckoutButton config={config} className="w-full" />
                  ) : user && !isStudent ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Beta access is available for students only.
                    </p>
                  ) : (
                    <Button asChild className="w-full bg-warning text-warning-foreground hover:bg-warning/90">
                      <Link to="/auth">Sign in to get access</Link>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Pass active confirmation */}
            {isUnlocked && !isLive && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center dark:border-orange-700/40 dark:bg-orange-950/20">
                <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                  Demo Mode — all details shown
                </p>
              </div>
            )}

            {isUnlocked && isLive && passQuery.data && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <BadgeCheck className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-1 text-xs font-medium text-foreground">Beta Access Pass active</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Expires{" "}
                  {new Date(passQuery.data.expires_at).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* Back link */}
            <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
              <Link to="/beta-lodges">
                <ArrowLeft className="h-4 w-4" />
                All Beta Lodges
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </div>
  );
}

// ─── Not found component ─────────────────────────────────────────────────────

function BetaLodgeNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
        <span className="text-6xl opacity-30">✦</span>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Beta Lodge not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This lodge may have been removed or is no longer available.
          </p>
        </div>
        <Button asChild>
          <Link to="/beta-lodges">View all Beta Lodges</Link>
        </Button>
      </div>
      <SiteFooter />
    </div>
  );
}

// ─── Error component ─────────────────────────────────────────────────────────

function BetaLodgeError({ error }: { error?: unknown }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/40" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Could not load lodge details
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/beta-lodges">Back to Beta Lodges</Link>
        </Button>
      </div>
      <SiteFooter />
    </div>
  );
}

