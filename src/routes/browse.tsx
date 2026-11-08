import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  FilterX,
  Home,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isLocalDevPreview, useListingsQuery } from "@/lib/listings";

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse Student Lodges & Bedspaces — LodgeMate" },
      {
        name: "description",
        content:
          "Filter verified lodges, bedspaces and tenancy takeovers near MOUAU and ABSU by school, room type and price.",
      },
      { property: "og:title", content: "Browse Student Lodges & Bedspaces — LodgeMate" },
      {
        property: "og:description",
        content: "Compare student rooms near MOUAU and ABSU by school, type and price.",
      },
    ],
  }),
  component: Browse,
});

const schools = [
  { id: "All", label: "All Campuses", short: "All" },
  { id: "MOUAU", label: "MOUAU (Umudike)", short: "MOUAU" },
  { id: "ABSU", label: "ABSU (Uturu)", short: "ABSU" },
] as const;

const kinds = [
  { id: "All", label: "All Types" },
  { id: "Full lodge", label: "Full Lodge" },
  { id: "Bedspace", label: "Bedspace" },
  { id: "Takeover", label: "Takeover" },
] as const;

function Browse() {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState<"All" | "MOUAU" | "ABSU">("All");
  const [kind, setKind] = useState<"All" | "Full lodge" | "Bedspace" | "Takeover">("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const { data: listingsData = [], isLoading, isError, refetch } = useListingsQuery();

  const hasActiveFilters = Boolean(
    query.trim() || school !== "All" || kind !== "All" || verifiedOnly,
  );

  const clearAllFilters = () => {
    setQuery("");
    setSchool("All");
    setKind("All");
    setVerifiedOnly(false);
  };

  const results = useMemo(
    () =>
      listingsData.filter((l) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          l.title.toLowerCase().includes(q) ||
          l.area.toLowerCase().includes(q) ||
          l.school.toLowerCase().includes(q) ||
          l.amenities.some((a) => a.toLowerCase().includes(q));
        return (
          matchesQuery &&
          (school === "All" || l.school === school) &&
          (kind === "All" || l.kind === kind) &&
          (!verifiedOnly || l.verified)
        );
      }),
    [listingsData, query, school, kind, verifiedOnly],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      {isLocalDevPreview() && (
        <div className="border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-center text-xs text-warning-foreground">
          <span className="font-semibold">Local Development Preview Mode:</span> Displaying 6 verified student sample accommodations across MOUAU and ABSU. Connect Supabase in <code>.env</code> to stream live database records.
        </div>
      )}
      <main className="flex-1">
        {/* Top Hero / Search Banner */}
        <section className="relative border-b border-border/80 bg-warm/80">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>MOUAU &amp; ABSU Student Marketplace</span>
              </div>

              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Find your next student space
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Discover verified lodges, shared bedspaces, and tenancy takeovers around campus.
                Inspected listings are clearly marked for your safety.
              </p>
            </div>

            {/* Filter & Search Card */}
            <div className="mt-8 rounded-2xl border border-border/80 bg-card p-3 shadow-card sm:p-4">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                {/* Search input with icon and clear button */}
                <div className="relative flex flex-1 items-center rounded-xl border border-border/60 bg-muted/50 px-3 transition-colors focus-within:border-primary/50 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by area, lodge name, campus or amenity..."
                    className="h-10 border-0 bg-transparent pr-8 shadow-none focus-visible:ring-0 text-sm"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Clear search"
                      aria-label="Clear search input"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Verified Only Toggle Button */}
                <Button
                  variant={verifiedOnly ? "default" : "outline"}
                  onClick={() => setVerifiedOnly((v) => !v)}
                  className={`h-10 shrink-0 gap-2 rounded-xl text-xs font-semibold transition-all ${
                    verifiedOnly
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border-border/70 hover:bg-muted"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Verified only</span>
                  {verifiedOnly && <Check className="h-3.5 w-3.5 ml-0.5" />}
                </Button>
              </div>

              {/* Filter Pills row */}
              <div className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Campus / School pills */}
                  <span className="mr-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-leaf" />
                    Campus:
                  </span>
                  {schools.map((s) => {
                    const active = school === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSchool(s.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                          active
                            ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                            : "border border-border/50 bg-secondary/60 text-secondary-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {s.short}
                      </button>
                    );
                  })}

                  <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />

                  {/* Accommodation Kind pills */}
                  <span className="mr-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-clay" />
                    Type:
                  </span>
                  {kinds.map((k) => {
                    const active = kind === k.id;
                    return (
                      <button
                        key={k.id}
                        onClick={() => setKind(k.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                          active
                            ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                            : "border border-border/50 bg-secondary/60 text-secondary-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {k.label}
                      </button>
                    );
                  })}
                </div>

                {/* Reset button if any filter active */}
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive self-start sm:self-auto"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset filters</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Results section */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {/* Beta Lodges Contextual Callout */}
          <div className="mb-8 rounded-2xl border border-warning/40 bg-gradient-to-r from-warning/10 via-background to-primary/5 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      Looking for direct landlord numbers &amp; video walkthroughs?
                    </p>
                    <span className="rounded-full border border-warning/50 bg-warning/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-warning-foreground">
                      Beta
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Beta Lodges give students verified landlord phone numbers, 360° video tours, and physical inspection notes.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-warning font-semibold text-warning-foreground hover:bg-warning/90 gap-1.5 text-xs h-9 px-4"
                asChild
              >
                <Link to="/beta-lodges">
                  Explore Beta Lodges
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Status bar: Result counts & active tags */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {results.length} {results.length === 1 ? "Space Available" : "Spaces Available"}
              </h2>
              {hasActiveFilters && (
                <span className="text-xs text-muted-foreground">
                  (filtered from {listingsData.length} total)
                </span>
              )}
            </div>

            {/* Active filter badges */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                {query.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                    Keyword: &ldquo;{query.trim()}&rdquo;
                    <button onClick={() => setQuery("")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {school !== "All" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                    Campus: {school}
                    <button onClick={() => setSchool("All")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {kind !== "All" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                    Type: {kind}
                    <button onClick={() => setKind("All")} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {verifiedOnly && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                    Verified only
                    <button onClick={() => setVerifiedOnly(false)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Listings Grid, Loading, Error, or Empty State */}
          {isLoading ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center sm:p-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Unable to load listings right now
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground sm:text-sm">
                There was a problem communicating with the accommodation database. Please try again.
              </p>
              <div className="mt-5 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  className="gap-2 rounded-xl text-xs font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            </div>
          ) : results.length === 0 ? (
            listingsData.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-border/90 bg-card p-10 text-center sm:p-14">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Home className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  No verified spaces listed yet
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                  There are currently no approved student spaces published near MOUAU or ABSU.
                  Landlords and agents submit new spaces for campus verification daily.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <Button variant="outline" onClick={() => refetch()} className="gap-2 rounded-xl text-xs">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                  <Button asChild className="rounded-xl text-xs">
                    <Link to="/list-a-space">List a space</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-border/90 bg-card p-10 text-center sm:p-14">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <FilterX className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  No accommodation matching your filters
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                  We couldn&apos;t find any spaces that match your current search terms or campus filters. Try
                  broadening your criteria.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={clearAllFilters} className="gap-2 rounded-xl text-xs">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear all filters
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
