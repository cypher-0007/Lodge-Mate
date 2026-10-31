import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Banknote, Eye, ShieldCheck, Users } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Rent Safely — Avoid Lodge Scams | LodgeMate" },
      {
        name: "description",
        content:
          "Practical rules for renting a lodge or bedspace near MOUAU and ABSU without getting scammed: inspect first, pay on record, verify the landlord.",
      },
      { property: "og:title", content: "Rent Safely — Avoid Lodge Scams | LodgeMate" },
      {
        property: "og:description",
        content: "Inspect first, pay on record, verify the landlord. LodgeMate's safety rules.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
  component: Safety,
});

const rules = [
  {
    icon: Eye,
    title: "Inspect before you pay",
    body: "Stand in the actual room. Photos get recycled between lodges — a room you have not entered is not a room you have rented.",
  },
  {
    icon: Banknote,
    title: "No reservation fees",
    body: "\"Send ₦10k to hold it\" is the most common scam around both campuses. Rent and agreement fees are paid at the lodge, on record.",
  },
  {
    icon: Users,
    title: "Meet the landlord or caretaker",
    body: "Ask who owns the compound and confirm with a neighbour or the caretaker before any money moves.",
  },
  {
    icon: ShieldCheck,
    title: "Prefer verified listings",
    body: "A verified badge means a LodgeMate campus rep physically visited the compound and confirmed the room exists and is vacant.",
  },
];

const redFlags = [
  "Host refuses an in-person inspection or keeps rescheduling",
  "Price is far below every other lodge in the same area",
  "Pressure to pay today because \"three other students are coming\"",
  "Payment requested to a name that does not match the landlord",
  "Chats moved off-platform immediately, before you see the room",
];

function Safety() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-warm px-5 py-14">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Safety
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-5xl">
              Rent safely near MOUAU &amp; ABSU
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Most housing scams around both campuses follow the same script. Four rules stop
              almost all of them.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-14">
          <div className="grid gap-5 md:grid-cols-2">
            {rules.map((r) => (
              <article
                key={r.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-canopy text-primary-foreground">
                  <r.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{r.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-warning/40 bg-warning/10 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5 text-warning-foreground" /> Red flags
            </h2>
            <ul className="mt-4 space-y-2.5">
              {redFlags.map((f) => (
                <li key={f} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-foreground" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-7 shadow-card md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Saw something suspicious?</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Report a listing from its page, or message our campus team directly.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/contact">Contact us</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/browse">Browse verified</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
