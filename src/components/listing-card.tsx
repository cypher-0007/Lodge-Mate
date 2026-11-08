import { Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronRight, Heart, MapPin, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { Listing } from "@/lib/listings";
import { useSavedListingIds, useToggleSaveListing } from "@/lib/saved-listings";

export function ListingCard({ listing: l }: { listing: Listing }) {
  const { user, isStudent } = useAuth();
  const { data: savedIds = [] } = useSavedListingIds();
  const toggleSave = useToggleSaveListing();

  const isSaved = savedIds.includes(l.id);

  const handleToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSave.mutate({ listingId: l.id, currentlySaved: isSaved });
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card transition-all duration-300 hover:border-primary/40 hover:shadow-lift">
      <Link to="/listings/$id" params={{ id: l.id }} className="relative block overflow-hidden">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={l.image}
            alt={l.title}
            loading="lazy"
            width={1024}
            height={768}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-60" />

          {/* Accommodation Type Badge */}
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-border/40 bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
            {l.kind}
          </span>

          {/* Action Row on Top Right: Verified Badge & Bookmark Button */}
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {l.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/95 px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm backdrop-blur-sm">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/95 px-2.5 py-1 text-xs font-semibold text-warning-foreground shadow-sm backdrop-blur-sm">
                <ShieldAlert className="h-3.5 w-3.5" /> Unverified
              </span>
            )}

            {/* Student Save / Bookmark Heart Button */}
            {(!user || isStudent) && (
              <button
                type="button"
                onClick={handleToggleSave}
                disabled={toggleSave.isPending}
                aria-label={isSaved ? "Remove from saved lodges" : "Save this lodge"}
                title={isSaved ? "Saved" : "Save lodge"}
                className={`flex h-7 w-7 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-transform active:scale-90 ${
                  isSaved
                    ? "bg-destructive text-white"
                    : "bg-background/90 text-foreground hover:bg-background hover:text-destructive"
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`} />
              </button>
            )}
          </div>

          {/* Distance overlay pill */}
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <MapPin className="h-3 w-3 text-leaf" />
            {l.distance}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span>{l.school}</span>
            <span>•</span>
            <span>{l.area}</span>
          </div>

          <h3 className="mt-1 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            <Link to="/listings/$id" params={{ id: l.id }}>
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
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
          <div>
            <span className="font-display text-lg font-bold text-foreground sm:text-xl">
              {l.price}
            </span>
            <span className="ml-1 text-xs font-normal text-muted-foreground">/{l.period}</span>
          </div>

          <Link
            to="/listings/$id"
            params={{ id: l.id }}
            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground"
          >
            Inspect
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Skeleton placeholder while real Supabase listings are loading.
 */
export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card p-0 shadow-card animate-pulse">
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
