import { Link, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Lodges, Bedspaces & Takeovers | LodgeMate" },
      {
        name: "description",
        content:
          "Answers on verification, inspections, bedspaces, tenancy takeovers, fees and payments for student housing near MOUAU and ABSU.",
      },
      { property: "og:title", content: "FAQ — Lodges, Bedspaces & Takeovers | LodgeMate" },
      {
        property: "og:description",
        content: "How verification, inspections, takeovers and fees work on LodgeMate.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Faq,
});

const faqs = [
  {
    q: "Does LodgeMate charge students anything?",
    a: "No. Browsing, messaging hosts and booking inspections are free for students. You pay rent and any agreement fee directly to the landlord or agent at the lodge.",
  },
  {
    q: "What does the verified badge actually mean?",
    a: "A LodgeMate campus rep physically visited the compound, confirmed the room shown exists, confirmed it was vacant at the time of the visit, and matched the host to the compound. It is not a guarantee of condition — you still inspect.",
  },
  {
    q: "How does a tenancy takeover work?",
    a: "A current tenant transfers the remaining months of their rent to you. The landlord must agree to the transfer, and the paperwork is signed at inspection. You pay only for the months left, which is why takeovers are often the cheapest option mid-session.",
  },
  {
    q: "What is a bedspace?",
    a: "A single bed in a shared room, usually 2 to 4 students. Rent is per bedspace, not per room, and listings state whether the room is male only, female only or mixed.",
  },
  {
    q: "Can I book an inspection for more than one lodge?",
    a: "Yes. Book as many as you like and see them back to back — most of our listings around Ishiagu, Umudike and Uturu are within a short walk or bike ride of each other.",
  },
  {
    q: "I am a landlord. How do I get verified?",
    a: "List your space, then a campus rep contacts you to schedule a compound visit. Verification is free; verified listings get shown first in browse results.",
  },
  {
    q: "What if a host asks for money before inspection?",
    a: "Do not pay. Report the listing from its page and we remove the host while we investigate. Legitimate hosts on LodgeMate never collect pre-inspection deposits.",
  },
];

function Faq() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-warm px-5 py-14">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
              Frequently asked questions
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Everything students, landlords and agents ask before their first LodgeMate rental.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-14">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 rounded-2xl border border-border bg-card p-7 text-center shadow-card">
            <h2 className="text-lg font-semibold">Still stuck?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Our campus team replies within a day during the session rush.
            </p>
            <Button className="mt-5" asChild>
              <Link to="/contact">Contact LodgeMate</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
