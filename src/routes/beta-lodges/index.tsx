import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, BadgeCheck, Lock, RefreshCw, Sparkles, Video } from "lucide-react";

import { BetaLodgeCard, BetaLodgeCardSkeleton } from "@/components/beta-lodge-card";
import { BetaAccessBanner } from "@/components/beta-access-banner";
import { BetaCheckoutButton } from "@/components/beta-checkout-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  demoBetaLodges,
  formatBetaDuration,
  formatBetaPrice,
  isLocalBetaDevPreview,
  useBetaLodgesConfig,
  useBetaLodgesPreview,
  useUserBetaAccess,
  useUserBetaPass,
} from "@/lib/beta-lodges";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export const Route = createFileRoute("/beta-lodges/")({
  head: () => ({
    meta: [
      { title: "Beta Lodges — LodgeMate" },
      {
        name: "description",
        content:
          "Verified premium student lodges near MOUAU and ABSU with direct provider contact, private video walkthroughs and inspection reports.",
      },
      { property: "og:title", content: "Beta Lodges — LodgeMate" },
      {
        property: "og:description",
        content:
          "Premium student lodges with verified inspection notes, provider contact and video walkthroughs.",
      },
    ],
  }),
  component: BetaLodgesPage,
});

function BetaLodgesPage() {
  const { user, isStudent } = useAuth();
  const isLive = isSupabaseConfigured();

  const configQuery = useBetaLodgesConfig();
  const previewQuery = useBetaLodgesPreview();
  const accessQuery = useUserBetaAccess(user?.id);
  const passQuery = useUserBetaPass(user?.id);

  const config = configQuery.data;
  const hasAccess = accessQuery.data ?? false;
  const pass = passQuery.data;

  // Dev preview: use demo data ONLY when running locally without a configured Supabase backend.
  // In production builds, this is strictly guaranteed to return an empty array if DB is empty.
  const isDevPreview = isLocalBetaDevPreview();
  const lodges = isLive ? (previewQuery.data ?? []) : (isDevPreview ? demoBetaLodges : []);
  const isLoading = isLive && previewQuery.isLoading;

  const perks = [
    {
      icon: <Lock className="h-5 w-5" />,
      label: "Direct provider contact",
      desc: "Phone number revealed for every Beta Lodge after access.",
    },
    {
      icon: <Video className="h-5 w-5" />,
      label: "Private video walkthroughs",
      desc: "Watch a full tour of the lodge before booking an inspection.",
    },
    {
      icon: <BadgeCheck className="h-5 w-5" />,
      label: "Verified inspection notes",
      desc: "LodgeMate team notes from physical on-site inspections.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-[#032b21] via-[#043327] to-[#064e3b] py-16 sm:py-20">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-warning/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          {/* Beta badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs font-semibold uppercase tracking-widest text-warning">
              Beta Programme
            </span>
          </div>

          <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            Beta Lodges
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70 sm:text-lg">
            Premium verified lodges with direct landlord contact, private video walkthroughs and
            on-site inspection notes — before anyone else gets them.
          </p>

          {config && !hasAccess && (
            <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/60">
              <span className="font-semibold text-warning">
                {formatBetaPrice(config.access_fee_ngn)}
              </span>
              <span>·</span>
              <span>{formatBetaDuration(config.access_duration_days)} access</span>
              <span>·</span>
              <span>All Beta Lodges included</span>
            </div>
          )}

          {hasAccess && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-white">
              <BadgeCheck className="h-4 w-4 text-primary" />
              You have an active Beta Access Pass
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Access banner */}
        <div className="mb-8">
          <BetaAccessBanner
            isLive={isLive}
            isAuthenticated={!!user}
            hasAccess={hasAccess}
            pass={pass ?? null}
            config={config ?? null}
            isLoading={accessQuery.isLoading || configQuery.isLoading}
          />
        </div>

        {/* What you get section */}
        {!hasAccess && (
          <section className="mb-10 rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-foreground">
              What's included in Beta Access
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {perks.map((p) => (
                <div
                  key={p.label}
                  className="flex gap-3 rounded-xl border border-border/50 bg-secondary/30 p-4"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    {p.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Checkout CTA */}
            <div
              id="get-access"
              className="mt-6 flex flex-col gap-3 border-t border-border/50 pt-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                {config ? (
                  <>
                    <p className="font-display text-2xl font-bold text-foreground">
                      {formatBetaPrice(config.access_fee_ngn)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatBetaDuration(config.access_duration_days)} · One-time payment
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading pricing…</p>
                )}
              </div>

              {config && (
                <div className="flex flex-col gap-2 sm:items-end">
                  {user && isStudent ? (
                    <BetaCheckoutButton config={config} className="sm:w-auto" />
                  ) : user && !isStudent ? (
                    <p className="text-sm text-muted-foreground">
                      Beta access is for students only.
                    </p>
                  ) : (
                    <Button asChild className="bg-warning text-warning-foreground hover:bg-warning/90">
                      <Link to="/auth">
                        Sign in to get access
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <p className="text-center text-xs text-muted-foreground">
                    Secure payment via Paystack · NGN only
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Listings grid */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-foreground">
              Available Beta Lodges
              {!isLoading && lodges.length > 0 && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({lodges.length})
                </span>
              )}
            </h2>
            {!isLive && (
              <span className="rounded-full border border-orange-300 bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                DEMO DATA
              </span>
            )}
          </div>

          {/* Error state */}
          {isLive && previewQuery.isError && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 py-14 text-center">
              <AlertCircle className="h-10 w-10 text-destructive/50" />
              <div>
                <p className="font-semibold text-foreground">Could not load Beta Lodges</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {previewQuery.error instanceof Error
                    ? previewQuery.error.message
                    : "An unexpected error occurred."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void previewQuery.refetch()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <BetaLodgeCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !previewQuery.isError && lodges.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
              <span className="text-5xl opacity-30">✦</span>
              <div>
                <p className="font-semibold text-foreground">No Beta Lodges yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Beta Lodges are added as our team inspects and approves properties. Check back
                  soon.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/browse">Browse regular listings</Link>
              </Button>
            </div>
          )}

          {/* Listings grid */}
          {!isLoading && lodges.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {lodges.map((lodge) => (
                <BetaLodgeCard
                  key={lodge.id}
                  lodge={lodge}
                  hasAccess={isLive ? hasAccess : lodge.id !== "demo-beta-3"}
                  isDemo={isDevPreview}
                />
              ))}
            </div>
          )}
        </section>

        {/* FAQ nudge */}
        <section className="mt-12 rounded-2xl border border-border/50 bg-muted/30 p-6 text-center">
          <p className="text-sm font-medium text-foreground">Questions about Beta Lodges?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Our team has physically inspected each Beta Lodge before it appears here.
          </p>
          <Button variant="ghost" size="sm" className="mt-3 text-xs" asChild>
            <Link to="/how-it-works">How it works →</Link>
          </Button>
        </section>
      </div>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </div>
  );
}
