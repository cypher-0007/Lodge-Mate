import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarCheck,
  ChevronDown,
  Flag,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  Zap,
} from "lucide-react";

import heroImage from "@/assets/hero-lodge.jpg";
import listingLodgeImage from "@/assets/listing-lodge.jpg";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isLocalDevPreview, useListingsQuery } from "@/lib/listings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LodgeMate — Student Housing Near MOUAU & ABSU" },
      {
        name: "description",
        content:
          "Find verified lodges, bedspaces and tenancy takeovers near MOUAU and ABSU. Compare prices, book inspections, rent safely.",
      },
      { property: "og:title", content: "LodgeMate — Student Housing Near MOUAU & ABSU" },
      {
        property: "og:description",
        content: "Verified student lodges, bedspaces and takeovers in one searchable marketplace.",
      },
    ],
  }),
  component: Index,
});

const filters = [
  { label: "School", value: "MOUAU" },
  { label: "Area", value: "Ishiagu / Umudike" },
  { label: "Room type", value: "Self-contained" },
  { label: "Price", value: "₦150k – ₦300k" },
];

const trustPoints = [
  {
    icon: BadgeCheck,
    title: "Verified before it's featured",
    body: "Our campus reps physically visit lodges and confirm the landlord or agent before a verification badge is issued.",
  },
  {
    icon: CalendarCheck,
    title: "Inspect before you pay",
    body: "Schedule an inspection slot inside the app. No transfer, no deposit, no agent fee until you've stood in the room.",
  },
  {
    icon: Flag,
    title: "Reports go to real humans",
    body: "Reviews, reports and disputes are moderated by the LodgeMate team, and repeat offenders lose their listing rights.",
  },
];

const listingTypes = [
  {
    icon: Building2,
    label: "Full lodges",
    body: "Self-cons, apartments and hostels posted by landlords and agents.",
  },
  {
    icon: BedDouble,
    label: "Bedspaces",
    body: "Students filling a space in a shared room, priced per session.",
  },
  {
    icon: Users,
    label: "Takeovers",
    body: "Transfer the months left on your tenancy to another student.",
  },
];

function Index() {
  const { data: liveListings = [], isLoading } = useListingsQuery();
  const featuredListings = liveListings.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {isLocalDevPreview() && (
        <div className="border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-center text-xs text-warning-foreground">
          <span className="font-semibold">Local Development Preview Mode:</span> Displaying sample student accommodations for MOUAU and ABSU. Connect Supabase in <code>.env</code> to stream live database records.
        </div>
      )}

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <img
            src={heroImage}
            alt="Students walking past a student lodge near campus"
            width={1600}
            height={1104}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-canopy opacity-90" />
          <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-20 md:pb-20 md:pt-28">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge className="bg-leaf text-leaf-foreground hover:bg-leaf">
                MOUAU · ABSU · 1,400+ rooms tracked
              </Badge>
              <Link
                to="/beta-lodges"
                className="inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/20 px-3 py-1 text-xs font-semibold text-warning-foreground backdrop-blur-sm transition-all hover:bg-warning/30 hover:scale-[1.02]"
              >
                <Sparkles className="h-3 w-3 text-warning" />
                <span>Beta Lodges with Direct Landlord Contacts</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] text-primary-foreground md:text-6xl">
              Find a room near campus without the guesswork.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/80 md:text-lg">
              Lodges, bedspaces and takeovers in one place — with prices you can compare,
              landlords you can check, and inspections you book before money moves.
            </p>

            {/* Search bar */}
            <div className="mt-9 rounded-2xl bg-card p-3 shadow-lift">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex flex-1 items-center gap-2 rounded-xl bg-muted px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    placeholder="Search area, lodge name or landmark"
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                  {filters.slice(0, 2).map((f) => (
                    <button
                      key={f.label}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      <span className="text-muted-foreground">{f.label}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
                <Button size="lg" className="md:px-7" asChild>
                  <Link to="/browse">Search</Link>
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 px-1">
                {filters.map((f) => (
                  <span
                    key={f.label}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    {f.label}: {f.value}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Listing types */}
        <section id="types" className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {listingTypes.map((t) => (
              <div
                key={t.label}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <t.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{t.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Listing grid */}
        <section id="browse" className="mx-auto max-w-6xl px-5 pb-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">Fresh near campus</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Updated as students and agents post. Unverified listings are flagged, never hidden.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/browse">View all listings</Link>
            </Button>
          </div>

          <div className="mt-8">
            {isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : featuredListings.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featuredListings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card p-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No verified spaces listed yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check back soon as new student accommodations near MOUAU and ABSU are published.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/browse">Browse all</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/list-a-space">List a space</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Beta Lodges Feature Section */}
        <section className="relative overflow-hidden border-y border-border/80 bg-gradient-to-br from-[#032b21] via-[#043b2e] to-[#064e3b] text-white">
          {/* Ambient lighting glows */}
          <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-warning/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />

          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              {/* Left Column: Copy & Value Proposition */}
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-warning">
                  <Sparkles className="h-3.5 w-3.5 text-warning" />
                  <span>VIP Student Access · Beta Lodges</span>
                </div>

                <h2 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  Skip the middlemen. Get direct landlord numbers &amp; video walkthroughs.
                </h2>

                <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
                  Tired of blind agent fees and fake WhatsApp pictures? LodgeMate Beta gives students
                  direct verified provider phone numbers, 360° video walkthroughs, and physical
                  field-inspection reports before making any commitment.
                </p>

                {/* 3 Value Pillars */}
                <div className="mt-8 grid gap-3.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/20 text-warning">
                      <Phone className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white">Direct Phone Call</h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/70">
                      Reach the verified landlord or primary caretaker directly.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/20 text-warning">
                      <Video className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white">Video Walkthroughs</h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/70">
                      Tour the compound, bathroom and room layout before visiting.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/20 text-warning">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white">Inspection Notes</h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/70">
                      Field rep reports on water, light, security and environment.
                    </p>
                  </div>
                </div>

                {/* Action CTA */}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button
                    size="lg"
                    className="h-12 bg-warning px-7 font-semibold text-warning-foreground shadow-lg transition-transform hover:scale-[1.02] hover:bg-warning/90"
                    asChild
                  >
                    <Link to="/beta-lodges">
                      Explore Beta Lodges
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 border-white/20 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 hover:text-white"
                    asChild
                  >
                    <Link to="/how-it-works">How Beta Access Works</Link>
                  </Button>
                </div>
              </div>

              {/* Right Column: Visual Accommodation Card Showcase */}
              <div className="relative lg:col-span-5">
                <div className="relative mx-auto max-w-sm sm:max-w-md lg:max-w-none">
                  {/* Decorative ambient blur */}
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-warning/40 to-primary/40 opacity-40 blur-xl" />

                  {/* Main Visual Card */}
                  <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-2 shadow-2xl backdrop-blur-md">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                      <img
                        src={listingLodgeImage}
                        alt="Beta student lodge near campus"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Card Overlays */}
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-warning px-2.5 py-1 text-xs font-extrabold text-warning-foreground shadow-sm">
                        <Sparkles className="h-3 w-3" /> Beta Verified
                      </span>

                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        <Video className="h-3 w-3 text-warning" /> 4K Tour Included
                      </span>

                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-xs font-medium text-white/80">MOUAU · Umuahia Road</p>
                        <p className="text-lg font-bold text-white">Executive Self-Contain</p>
                        <div className="mt-2 flex items-center justify-between border-t border-white/20 pt-2">
                          <span className="font-mono text-sm font-bold text-warning">
                            ₦180,000<span className="text-xs font-normal text-white/70">/year</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                            <Phone className="h-3 w-3 text-warning" /> Direct Provider
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary overlapping floating preview pill */}
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white/90 backdrop-blur-md">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-medium">Direct Provider Access</span>
                      </div>
                      <span className="font-semibold text-warning">No Agent Commission</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="border-y border-border bg-warm">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">
                Built for a market that runs on trust.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Word-of-mouth and WhatsApp groups gave you no way to compare prices or confirm a
                landlord exists. LodgeMate keeps the hustle, adds the safeguards.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/browse">Browse verified lodges</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/list-a-space">Post a bedspace</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              {trustPoints.map((p) => (
                <div
                  key={p.title}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-card"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay text-clay-foreground">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {p.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Flow */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold md:text-3xl">From search to keys</h2>
            <Button variant="ghost" asChild>
              <Link to="/how-it-works">How we verify →</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {[
              { icon: Search, step: "01", t: "Filter", d: "School, area, price, room type." },
              { icon: MessageCircle, step: "02", t: "Message", d: "Chat the landlord or student directly." },
              { icon: CalendarCheck, step: "03", t: "Inspect", d: "Pick a slot and see the room." },
              { icon: Zap, step: "04", t: "Move in", d: "Then pay, and review afterwards." },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-primary" />
                  <span className="font-display text-sm font-bold text-muted-foreground">
                    {s.step}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
