import { Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, ExternalLink } from "lucide-react";

import type { BetaAccessPass, BetaLodgesConfig } from "@/lib/beta-lodges";
import { formatBetaDuration, formatBetaPrice } from "@/lib/beta-lodges";
import { BetaCheckoutButton } from "@/components/beta-checkout-button";
import { Button } from "@/components/ui/button";

interface BetaPassStatusProps {
  hasAccess: boolean;
  pass?: BetaAccessPass | null | undefined;
  config?: BetaLodgesConfig | null | undefined;
  isLoading?: boolean;
  isAuthenticated: boolean;
  isLive: boolean;
}

/**
 * Compact Beta Access Pass status panel for the student dashboard.
 */
export function BetaPassStatus({
  hasAccess,
  pass,
  config,
  isLoading,
  isAuthenticated,
  isLive,
}: BetaPassStatusProps) {
  if (!isLive) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-700/40 dark:bg-orange-950/20">
        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
          Beta Lodges — Demo Mode
        </p>
        <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
          Connect Supabase to enable Beta Lodges access and payments.
        </p>
        <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" asChild>
          <Link to="/beta-lodges">Preview Beta Lodges</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted/40" />;
  }

  if (hasAccess && pass) {
    const expiresDate = new Date(pass.expires_at);
    const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const expiresStr = expiresDate.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <BadgeCheck className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Beta Access Active</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                Expires {expiresStr}
              </p>
              {daysLeft <= 7 && (
                <span className="mt-1 inline-block rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                  {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" className="mt-3 h-7 w-full text-xs gap-1.5" asChild>
          <Link to="/beta-lodges">
            Browse Beta Lodges
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    );
  }

  if (hasAccess && !pass) {
    // Free access period
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground">Beta Lodges Free Access</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Beta Lodges are currently available free of charge.
        </p>
        <Button size="sm" variant="outline" className="mt-3 h-7 w-full text-xs gap-1.5" asChild>
          <Link to="/beta-lodges">Browse Beta Lodges</Link>
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
        <p className="text-sm font-semibold text-foreground">Beta Lodges</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign in to unlock provider contact, video walkthroughs and inspection reports.
        </p>
        <Button size="sm" className="mt-3 h-7 w-full text-xs" asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  // Authenticated but no pass
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <p className="text-sm font-semibold text-foreground">Beta Lodges Access Pass</p>
      {config ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatBetaPrice(config.access_fee_ngn)} · {formatBetaDuration(config.access_duration_days)}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Provider contact, video walkthroughs & inspection notes.
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Unlock direct provider contact, private video walkthroughs and verified inspection notes.
      </p>
      {config ? (
        <div className="mt-3">
          <BetaCheckoutButton config={config} className="h-7 w-full text-xs" />
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3 h-7 w-full text-xs" asChild>
          <Link to="/beta-lodges">Learn more</Link>
        </Button>
      )}
    </div>
  );
}
