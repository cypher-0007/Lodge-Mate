import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact LodgeMate — Campus Team for MOUAU & ABSU" },
      {
        name: "description",
        content:
          "Reach the LodgeMate campus team about a listing, a report, verification or partnership around MOUAU and ABSU.",
      },
      { property: "og:title", content: "Contact LodgeMate — Campus Team for MOUAU & ABSU" },
      {
        property: "og:description",
        content: "Questions, reports and verification requests — reach our campus team.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Contact,
});

const channels = [
  { icon: Mail, label: "Email", value: "hello@lodgemate.ng" },
  { icon: Phone, label: "WhatsApp", value: "+234 800 000 0000" },
  { icon: MapPin, label: "Campus desks", value: "Ishiagu gate, MOUAU · Uturu main road, ABSU" },
  { icon: Clock, label: "Hours", value: "Mon–Sat, 9am – 6pm WAT" },
];

function Contact() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-warm px-5 py-14">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
              Talk to the campus team
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Report a listing, ask about verification, or bring a lodge portfolio to LodgeMate.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-9 px-5 py-14 lg:grid-cols-[1fr_0.7fr]">
          <div className="rounded-2xl border border-border bg-card p-7 shadow-card">
            <h2 className="text-lg font-semibold">Send a message</h2>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Message queued", {
                  description: "Connect Lovable Cloud to deliver messages to your inbox.",
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" className="mt-2" placeholder="Your name" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="mt-2"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="topic">What is this about?</Label>
                <Select defaultValue="listing">
                  <SelectTrigger id="topic" className="mt-2">
                    <SelectValue placeholder="Choose a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="listing">A question about a listing</SelectItem>
                    <SelectItem value="report">Report a listing or host</SelectItem>
                    <SelectItem value="verification">Verification request</SelectItem>
                    <SelectItem value="partnership">Agency or partnership</SelectItem>
                    <SelectItem value="other">Something else</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  className="mt-2 min-h-32"
                  placeholder="Tell us what happened, and include the listing name if you have it."
                  required
                />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Send message
              </Button>
            </form>
          </div>

          <aside className="space-y-4">
            {channels.map((c) => (
              <div
                key={c.label}
                className="flex gap-3 rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <c.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.value}</p>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-border bg-warm p-5">
              <p className="text-sm font-semibold">Urgent scam report?</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Use WhatsApp — reports about money already sent are handled first.
              </p>
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
