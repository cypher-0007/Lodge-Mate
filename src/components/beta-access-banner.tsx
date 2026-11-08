import { Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, Clock, Lock, Sparkles } from "lucide-react";

import type { BetaAccessPass, BetaLodgesConfig } from "@/lib/beta-lodges";
import { formatBetaDuration, formatBetaPrice } from "@/lib/beta-lodges";
import { Button } from "@/components/ui/button";

interface BetaAccessBannerProps {
  /** Whether Supabase is connected (false = demo mode) */
  isLive: boolean;
  /** Whether the current user is authenticated */
  isAuthenticated: boolean;
  /** Whether the user has a valid access pass */
  hasAccess: boolean;
  /** The user's active access pass, if any */
  pass?: BetaAccessPass | null | undefined;
  /** Beta Lodges configuration (price, duration, etc.) */
  config?: BetaLodgesConfig | null | undefined;
  /** Loading state */
  isLoading?: boolean;
}

export function BetaAccessBanner({
  isLive,
  isAuthenticated,
  hasAccess,
  pass,
  config,
  isLoading,
}: BetaAccessBannerProps) {
  // --- DEMO MODE ---
  if (!isLive) {
    return (
      <div className="rounded-2xl border border-orange-300/60 bg-orange-50 px-5 py-4 dark:border-orange-700/40 dark:bg-orange-950/20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                Demo Mode — Beta Lodges Preview
              </p>
              <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">
                Connect Supabase to enable real listings, pricing and payments.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-orange-300 bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-700">
            Demo
          </span>
        </div>
      </div>
    );
  }

  // --- LOADING ---
  if (isLoading) {
    return (
      <div className="h-20 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
    );
  }

  // --- HAS VALID ACCESS ---
  if (hasAccess && pass) {
    const expiresDate = new Date(pass.expires_at);
    const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const expiresStr = expiresDate.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <BadgeCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Beta Access Pass Active
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                Expires {expiresStr}
                {daysLeft <= 7 && (
                  <span className="ml-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                    {daysLeft}d left
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs" asChild>
            <Link to="/beta-lodges">Browse all Beta Lodges</Link>
          </Button>
        </div>
      </div>
    );
  }

  // --- ACCESS FREE (admin toggled off paid access) ---
  if (hasAccess && !pass) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <BadgeCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Beta Lodges Free Access</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Beta Lodges are currently available free of charge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- NOT AUTHENTICATED ---
  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning/5 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-foreground">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Sign in to unlock Beta Lodges
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {config
                  ? `Get provider contact, videos & inspection notes from ${formatBetaPrice(config.access_fee_ngn)} for ${formatBetaDuration(config.access_duration_days)}.`
                  : "Direct contact, video walkthroughs and verified inspection notes."}
              </p>
            </div>
          </div>
          <Button size="sm" className="shrink-0" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED BUT NO PASS ---
  return (
    <div className="rounded-2xl border border-warning/30 bg-gradient-to-r from-warning/5 to-primary/5 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-foreground">
            <Lock className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Unlock full Beta Lodges access
            </p>
            {config ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatBetaPrice(config.access_fee_ngn)} · {formatBetaDuration(config.access_duration_days)} · Provider contact + video walkthroughs
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Direct contact, video walkthroughs and verified inspection reports.
              </p>
            )}
          </div>
        </div>
        <Button size="sm" className="shrink-0 bg-warning text-warning-foreground hover:bg-warning/90" asChild>
          <Link to="/beta-lodges" hash="get-access">
            Get access pass
          </Link>
        </Button>
      </div>
    </div>
  );
}
