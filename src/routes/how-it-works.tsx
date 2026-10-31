import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarCheck,
  Flag,
  MessageCircle,
  Search,
  Zap,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How LodgeMate Verifies Lodges — Inspect Before You Pay" },
      {
        name: "description",
        content:
          "How LodgeMate works: search, message the host, book an inspection, then pay. Learn how campus reps verify lodges near MOUAU and ABSU.",
      },
      { property: "og:title", content: "How LodgeMate Verifies Lodges" },
      {
        property: "og:description",
        content: "Search, inspect, then pay — with campus reps verifying every badged listing.",
      },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  { icon: Search, step: "01", t: "Filter", d: "Narrow by school, area, price and room type until the shortlist is real." },
  { icon: MessageCircle, step: "02", t: "Message", d: "Chat the landlord, agent or student host inside LodgeMate — no number swapping." },
  { icon: CalendarCheck, step: "03", t: "Inspect", d: "Pick an inspection slot and stand in the room before any money moves." },
  { icon: Zap, step: "04", t: "Move in", d: "Pay on record, collect keys, then leave a review for the next student." },
];

const verification = [
  {
    icon: BadgeCheck,
    title: "Physical visit",
    body: "A campus rep visits the lodge, photographs the actual rooms and confirms the address matches the listing.",
  },
  {
    icon: Flag,
    title: "Identity check",
    body: "Landlords and agents show ownership or agency proof. Student hosts verify with a school ID and matric number.",
  },
  {
    icon: Zap,
    title: "Ongoing review",
    body: "Badges expire each session. Reports, disputes and stale prices pull a listing back into review.",
  },
];

function HowItWorks() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-canopy">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <h1 className="max-w-2xl text-3xl font-bold leading-tight text-primary-foreground md:text-5xl">
              Inspect before you pay. Every single time.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-primary-foreground/80 md:text-base">
              LodgeMate exists because rent scams around MOUAU and ABSU thrive on urgency. Here's
              exactly how we slow that down.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-bold md:text-3xl">The four steps</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.step} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-primary" />
                  <span className="font-display text-sm font-bold text-muted-foreground">
                    {s.step}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-warm">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-bold md:text-3xl">What a verified badge means</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {verification.map((v) => (
                <div key={v.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-clay text-clay-foreground">
                    <v.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{v.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card md:p-10">
            <h2 className="text-2xl font-bold">Ready to look?</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Start with verified lodges near your school, or post the space you're leaving behind.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/browse">Browse listings</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/list-a-space">List a space</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
