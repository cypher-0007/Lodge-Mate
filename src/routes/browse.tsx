import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { ListingCard } from "@/components/listing-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listings } from "@/lib/listings";

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

const schools = ["All", "MOUAU", "ABSU"] as const;
const kinds = ["All", "Full lodge", "Bedspace", "Takeover"] as const;

function Browse() {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState<(typeof schools)[number]>("All");
  const [kind, setKind] = useState<(typeof kinds)[number]>("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const results = useMemo(
    () =>
      listings.filter((l) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          l.title.toLowerCase().includes(q) ||
          l.area.toLowerCase().includes(q) ||
          l.amenities.some((a) => a.toLowerCase().includes(q));
        return (
          matchesQuery &&
          (school === "All" || l.school === school) &&
          (kind === "All" || l.kind === kind) &&
          (!verifiedOnly || l.verified)
        );
      }),
    [query, school, kind, verifiedOnly],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-warm">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <h1 className="text-3xl font-bold md:text-4xl">Browse rooms near campus</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {listings.length} live spaces around MOUAU and ABSU. Unverified listings stay visible
              but clearly flagged.
            </p>

            <div className="mt-7 rounded-2xl bg-card p-3 shadow-card">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex flex-1 items-center gap-2 rounded-xl bg-muted px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search area, lodge name or amenity"
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>
                <Button
                  variant={verifiedOnly ? "default" : "outline"}
                  onClick={() => setVerifiedOnly((v) => !v)}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Verified only
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 px-1">
                {schools.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSchool(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      school === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {s === "All" ? "All schools" : s}
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                {kinds.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      kind === k
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {k === "All" ? "All types" : k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12">
          <p className="text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          {results.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="font-medium">No spaces match those filters yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try clearing the search or switching school.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
