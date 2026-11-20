import { ArrowRight, BadgeCheck, Building2, MapPin, ShieldAlert, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { AccommodationProvider } from "@/lib/providers";

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "LM";
  if (parts.length === 1) return (parts[0] || "").slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] || "";
  const last = parts[parts.length - 1]?.[0] || "";
  return (first + last).toUpperCase() || "LM";
}

interface ProviderCardProps {
  provider: AccommodationProvider;
  activeListingsCount: number;
  operatingAreas?: string[];
  onViewListings?: () => void;
}

export function ProviderCard({
  provider: p,
  activeListingsCount,
  operatingAreas,
  onViewListings,
}: ProviderCardProps) {
  const isAgent = p.providerType === "agent";
  const displayArea =
    p.operatingArea ||
    (operatingAreas && operatingAreas.length > 0
      ? operatingAreas.join(", ")
      : p.school
      ? `${p.school} Campus Area`
      : "Near Campus");

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-card transition-all duration-300 hover:border-primary/40 hover:shadow-lift">
      <div>
        {/* Top Header: Avatar & Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-border/60 shadow-xs">
              {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={p.fullName} />}
              <AvatarFallback className="bg-primary/10 font-bold text-primary text-xs">
                {getInitials(p.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base leading-snug group-hover:text-primary transition-colors">
                {p.fullName}
              </h3>
              <p className="text-xs font-medium text-muted-foreground">
                {isAgent ? "Independent Agent" : "Property Landlord"}
              </p>
            </div>
          </div>

          {/* Verification Badge */}
          {p.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary shadow-xs shrink-0">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs shrink-0">
              <ShieldAlert className="h-3 w-3" />
              Unverified
            </span>
          )}
        </div>

        {/* Agency / Business Name */}
        {p.businessName && (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-clay" />
            <span className="truncate">{p.businessName}</span>
          </div>
        )}

        {/* Operating Area & Campus */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-leaf" />
          <span>{displayArea}</span>
          {p.school && (
            <span className="rounded-md border border-border/60 bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-foreground">
              {p.school}
            </span>
          )}
        </div>

        {/* Bio */}
        {p.bio && (
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {p.bio}
          </p>
        )}
      </div>

      {/* Footer: Listed Properties & Action Button */}
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-xs font-medium text-muted-foreground">
          {activeListingsCount > 0 ? (
            <span className="text-foreground font-semibold">
              {activeListingsCount} {activeListingsCount === 1 ? "Space Listed" : "Spaces Listed"}
            </span>
          ) : (
            "No spaces currently listed"
          )}
        </span>

        {activeListingsCount > 0 && onViewListings ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onViewListings}
            className="h-8 gap-1 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary px-2.5"
          >
            <span>View spaces</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">Contact via spaces</span>
        )}
      </div>
    </article>
  );
}

