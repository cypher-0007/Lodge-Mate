import { Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin, ShieldAlert } from "lucide-react";

import type { Listing } from "@/lib/listings";

export function ListingCard({ listing: l }: { listing: Listing }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift">
      <Link to="/listings/$id" params={{ id: l.id }} className="block">
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={l.image}
            alt={l.title}
            loading="lazy"
            width={1024}
            height={768}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <span className="absolute left-3 top-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground">
            {l.kind}
          </span>
          {l.verified ? (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </span>
          ) : (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-warning-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> Unverified
            </span>
          )}
        </div>
      </Link>
      <div className="p-4">
        <h3 className="text-base font-semibold leading-snug">
          <Link to="/listings/$id" params={{ id: l.id }} className="hover:text-primary">
            {l.title}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {l.school} · {l.distance}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {l.amenities.slice(0, 3).map((a) => (
            <span
              key={a}
              className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {a}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
          <p className="font-display text-lg font-bold text-primary">
            {l.price}
            <span className="ml-1 text-xs font-medium text-muted-foreground">{l.period}</span>
          </p>
          <Link
            to="/listings/$id"
            params={{ id: l.id }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Inspect
          </Link>
        </div>
      </div>
    </article>
  );
}
