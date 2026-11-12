import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Compass,
  GraduationCap,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — LodgeMate | Safer Student Accommodation" },
      {
        name: "description",
        content:
          "Learn why LodgeMate was founded, how we connect students with verified landlords and agents near MOUAU and ABSU, and our mission for safer campus housing.",
      },
      { property: "og:title", content: "About Us — LodgeMate | Safer Student Accommodation" },
      {
        property: "og:description",
        content:
          "Transparent, verified student housing discovery for MOUAU (Umudike) and ABSU (Uturu).",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AboutPage,
});

const campusHubs = [
  {
    school: "MOUAU (Umudike)",
    fullName: "Michael Okpara University of Agriculture, Umudike",
    areas: ["Ishiagu Gate", "Umudike Main", "Western Gate", "Umuahia Road"],
    description:
      "Covering off-campus student accommodation settlements across Umudike, with verified checks on borehole water and electricity feeder lines.",
  },
  {
    school: "ABSU (Uturu)",
    fullName: "Abia State University, Uturu",
    areas: ["Uturu Main Road", "Hilltop / Main Gate", "Marist Junction", "Campus Environs"],
    description:
      "Mapping safe student lodges, shared apartments, and executive self-contained units with physical verification near campus gates.",
  },
];

const pillars = [
  {
    icon: CalendarCheck,
    title: "Inspect before you pay",
    desc: "We strictly advise and structure our platform so that no student pays rent, agreement fees, or booking charges until they have stood inside the room and verified it in person.",
  },
  {
    icon: BadgeCheck,
    title: "Physical on-site verification",
    desc: "Our campus representatives physically visit student compounds, confirm vacancy, match caretakers to listings, and photograph real conditions before granting verification status.",
  },
  {
    icon: HeartHandshake,
    title: "Fair collaboration with hosts",
    desc: "We bridge students directly with legitimate property caretakers and verified independent agents who agree to transparent terms and zero pre-inspection fees.",
  },
  {
    icon: ShieldCheck,
    title: "Community accountability",
    desc: "Every listing can be reported directly by students. Misleading information, fake contacts, or repeated host misconduct leads to immediate listing removal.",
  },
];

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#032b21] via-[#043327] to-[#064e3b] py-16 text-white sm:py-24">
          <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-leaf/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-warning/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />

          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-6">
            <Badge className="border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-warning" />
              About LodgeMate
            </Badge>

            <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl">
              Safer, transparent student housing near your campus.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              LodgeMate was built to solve the frustration, uncertainty, and financial risks
              students face every semester when searching for off-campus rooms.
            </p>
          </div>
        </section>

        {/* The Problem & Our Mission */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Why We Exist
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                The accommodation hunt shouldn't be a gamble.
              </h2>
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                <p>
                  Every academic session, thousands of students at Nigerian universities travel to
                  campus without confirmed accommodation. They spend exhausting days walking under
                  the sun, dealing with unvetted agents, paying non-refundable "registration" or
                  "viewing" fees, and frequently falling prey to phantom listings or misrepresented
                  conditions.
                </p>
                <p>
                  LodgeMate was created as a reliable digital marketplace that centralises genuine
                  student accommodation listings, displays clear pricing, and connects students
                  directly with legitimate property owners and verified independent representatives.
                </p>
                <p>
                  Our goal is simple: to make discovering, comparing, and inspecting student rooms
                  as transparent, safe, and stress-free as possible.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-card sm:p-8">
              <h3 className="font-display text-lg font-bold text-foreground">
                What Sets LodgeMate Apart
              </h3>
              <ul className="mt-5 space-y-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf" />
                  <span className="text-foreground">
                    <strong>Zero browsing or inspection fees:</strong> Students browse and request
                    physical viewings completely free of charge.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf" />
                  <span className="text-foreground">
                    <strong>Direct contact with hosts:</strong> No third-party middlemen obscuring
                    compound location or rental terms.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf" />
                  <span className="text-foreground">
                    <strong>Diverse room types:</strong> From executive self-contained lodges to
                    affordable bedspaces and student-to-student tenancy takeovers.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf" />
                  <span className="text-foreground">
                    <strong>Transparent verification:</strong> Verified lodges have been physically
                    inspected on-site by a campus representative.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Focus on MOUAU & ABSU */}
        <section className="border-y border-border/70 bg-muted/40 py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-5">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Local Focus
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Built from the ground up for MOUAU &amp; ABSU
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Rather than spreading thin across dozens of cities, we began with dedicated focus
                on the unique off-campus communities of Abia State.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {campusHubs.map((hub) => (
                <div
                  key={hub.school}
                  className="rounded-2xl border border-border/80 bg-card p-6 shadow-card transition-all hover:border-primary/40 sm:p-7"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-foreground">
                        {hub.school}
                      </h3>
                      <p className="text-xs text-muted-foreground">{hub.fullName}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {hub.description}
                  </p>

                  <div className="mt-5 border-t border-border/60 pt-4">
                    <span className="text-xs font-semibold text-foreground">Key areas covered:</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {hub.areas.map((a) => (
                        <span
                          key={a}
                          className="rounded-md border border-border/70 bg-secondary/60 px-2.5 py-1 text-xs text-secondary-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Our Core Standards */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Our Principles
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Standards that guide every listing
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              We operate on core safety and transparency rules designed to protect both tenants and
              genuine accommodation providers.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-card transition-all hover:shadow-lift"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="border-t border-border/70 bg-secondary/50 py-14 sm:py-16">
          <div className="mx-auto max-w-4xl px-5 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Ready to find or list your next room?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Join students and accommodation providers currently searching and listing on
              LodgeMate.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="rounded-xl px-7 text-sm font-semibold" asChild>
                <Link to="/browse">
                  Browse Lodges
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl px-7 text-sm font-semibold"
                asChild
              >
                <Link to="/list-a-space">List a Space</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

