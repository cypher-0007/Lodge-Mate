import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarCheck,
  ChevronDown,
  Flag,
  MessageCircle,
  Search,
  Users,
  Zap,
} from "lucide-react";

import heroImage from "@/assets/hero-lodge.jpg";
import { ListingCard } from "@/components/listing-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listings } from "@/lib/listings";

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
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

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
            <Badge className="bg-leaf text-leaf-foreground hover:bg-leaf">
              MOUAU · ABSU · 1,400+ rooms tracked
            </Badge>
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

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
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
