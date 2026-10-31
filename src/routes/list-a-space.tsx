import { createFileRoute } from "@tanstack/react-router";
import { BedDouble, Building2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/list-a-space")({
  head: () => ({
    meta: [
      { title: "List a Lodge, Bedspace or Takeover — LodgeMate" },
      {
        name: "description",
        content:
          "Post a lodge, bedspace or tenancy takeover near MOUAU or ABSU and get seen by students searching right now.",
      },
      { property: "og:title", content: "List a Lodge, Bedspace or Takeover — LodgeMate" },
      {
        property: "og:description",
        content: "Landlords, agents and students: post your space to verified student demand.",
      },
    ],
  }),
  component: ListASpace,
});

const kinds = [
  { icon: Building2, label: "Full lodge", hint: "Self-con, apartment or hostel room" },
  { icon: BedDouble, label: "Bedspace", hint: "A space in a shared room" },
  { icon: Users, label: "Takeover", hint: "Transfer months left on your tenancy" },
];

function ListASpace() {
  const [kind, setKind] = useState("Full lodge");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-warm">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h1 className="text-3xl font-bold md:text-4xl">List a space</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Takes about three minutes. A campus rep reaches out to verify before your listing gets
              a badge.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-12">
          <form
            className="space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Draft saved", {
                description: "A campus rep will contact you to verify this space.",
              });
            }}
          >
            <div>
              <Label className="text-sm font-semibold">What are you listing?</Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {kinds.map((k) => (
                  <button
                    key={k.label}
                    type="button"
                    onClick={() => setKind(k.label)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      kind === k.label
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:bg-accent/50"
                    }`}
                  >
                    <k.icon className="h-5 w-5 text-primary" />
                    <p className="mt-3 text-sm font-semibold">{k.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="title">Listing title</Label>
                <Input id="title" className="mt-2" placeholder="e.g. PalmView Self-Con, Ishiagu Gate" required />
              </div>
              <div>
                <Label htmlFor="school">Nearest school</Label>
                <Input id="school" className="mt-2" placeholder="MOUAU or ABSU" required />
              </div>
              <div>
                <Label htmlFor="area">Area / landmark</Label>
                <Input id="area" className="mt-2" placeholder="Ishiagu, Umudike, Uturu…" required />
              </div>
              <div>
                <Label htmlFor="price">Price (₦)</Label>
                <Input id="price" type="number" className="mt-2" placeholder="280000" required />
              </div>
              <div>
                <Label htmlFor="period">Period</Label>
                <Input id="period" className="mt-2" placeholder="per year / per session" required />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="amenities">Amenities</Label>
                <Input id="amenities" className="mt-2" placeholder="Prepaid meter, borehole, fenced…" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  className="mt-2 min-h-32"
                  placeholder="Describe the room, the compound, water and power situation, and who it suits."
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" className="mt-2" placeholder="Full name" required />
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" className="mt-2" placeholder="080…" required />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/60 p-5 text-sm text-muted-foreground">
              By posting you agree to host inspections and to never request payment before a student
              has seen the space.
            </div>

            <Button type="submit" size="lg">
              Submit for verification
            </Button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
