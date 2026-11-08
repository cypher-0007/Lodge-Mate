import { Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronRight, Lock, MapPin, Video } from "lucide-react";

import type { BetaLodgePreview } from "@/lib/beta-lodges";

interface BetaLodgeCardProps {
  lodge: BetaLodgePreview;
  hasAccess: boolean;
  isDemo?: boolean;
}

export function BetaLodgeCard({ lodge: l, hasAccess, isDemo }: BetaLodgeCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card transition-all duration-300 hover:border-warning/40 hover:shadow-lift">
      <Link
        to="/beta-lodges/$id"
        params={{ id: l.id }}
        className="relative block overflow-hidden"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {l.image_url ? (
            <img
              src={l.image_url}
              alt={l.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-warning/10 to-primary/10">
              <span className="text-4xl opacity-30">🏠</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-70" />

          {/* Beta badge */}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/95 px-2.5 py-1 text-xs font-bold text-warning-foreground shadow-sm backdrop-blur-sm">
            ✦ Beta
          </span>

          {/* Demo flag */}
          {/* {isDemo && (
            <span className="absolute right-3 top-3 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              DEMO
            </span>
          )} */}

          {/* Access indicator on top right when no demo flag */}
          {!isDemo && (
            <span className="absolute right-3 top-3">
              {hasAccess ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/95 px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm backdrop-blur-sm">
                  <BadgeCheck className="h-3.5 w-3.5" /> Access
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              )}
            </span>
          )}

          {/* Distance pill */}
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <MapPin className="h-3 w-3 text-warning" />
            {l.distance}
          </span>

          {/* Private video indicator */}
          {!hasAccess && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              <Video className="h-3 w-3" /> Video walkthrough
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span>{l.school}</span>
            <span>•</span>
            <span>{l.area}</span>
          </div>

          <h3 className="mt-1 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-warning">
            <Link to="/beta-lodges/$id" params={{ id: l.id }}>
              {l.title}
            </Link>
          </h3>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {l.amenities.slice(0, 3).map((a) => (
              <span
                key={a}
                className="rounded-md border border-border/50 bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
              >
                {a}
              </span>
            ))}
            {l.amenities.length > 3 && (
              <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                +{l.amenities.length - 3}
              </span>
            )}
          </div>

          {/* Locked teaser row */}
          {!hasAccess && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-warning/30 bg-warning/5 px-3 py-2">
              <Lock className="h-3.5 w-3.5 shrink-0 text-warning" />
              <span className="text-xs text-muted-foreground">
                Provider contact & video unlock with access pass
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
          <div>
            <span className="font-display text-lg font-bold text-foreground sm:text-xl">
              ₦{l.price.toLocaleString("en-NG")}
            </span>
            <span className="ml-1 text-xs font-normal text-muted-foreground">/{l.period}</span>
          </div>

          <Link
            to="/beta-lodges/$id"
            params={{ id: l.id }}
            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-warning hover:text-warning-foreground group-hover:bg-warning group-hover:text-warning-foreground"
          >
            {hasAccess ? "View details" : "Preview"}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Skeleton placeholder while beta lodges are loading.
 */
export function BetaLodgeCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card animate-pulse">
      <div className="aspect-[4/3] w-full bg-muted/80" />
      <div className="p-4 sm:p-5 space-y-3">
        <div className="h-3 w-1/3 rounded bg-muted/80" />
        <div className="h-5 w-4/5 rounded bg-muted/80" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-4 w-16 rounded bg-muted/70" />
          <div className="h-4 w-16 rounded bg-muted/70" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div className="h-6 w-24 rounded bg-muted/80" />
          <div className="h-7 w-20 rounded-lg bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

