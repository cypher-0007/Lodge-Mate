import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarCheck,
  Flag,
  MapPin,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getListing } from "@/lib/listings";

export const Route = createFileRoute("/listings/$id")({
  loader: ({ params }) => {
    const listing = getListing(params.id);
    if (!listing) throw notFound();
    return { listing };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Listing unavailable — LodgeMate" }, { name: "robots", content: "noindex" }],
      };
    }
    const { listing } = loaderData;
    const description = `${listing.kind} near ${listing.school} · ${listing.price} ${listing.period}. ${listing.description.slice(0, 90)}`;
    return {
      meta: [
        { title: `${listing.title} — LodgeMate` },
        { name: "description", content: description },
        { property: "og:title", content: `${listing.title} — LodgeMate` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ListingDetail,
});

function ListingDetail() {
  const { listing: l } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-5 pt-8">
          <Link to="/browse" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to browse
          </Link>
        </div>

        <section className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-border shadow-card">
              <img
                src={l.image}
                alt={l.title}
                width={1024}
                height={768}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {l.kind}
              </span>
              {l.verified ? (
                <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified by campus rep
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-warning px-3 py-1 text-xs font-semibold text-warning-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" /> Not yet verified
                </span>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">{l.title}</h1>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {l.area} · {l.school} · {l.distance}
            </p>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{l.description}</p>

            <h2 className="mt-8 text-lg font-semibold">What's included</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {l.amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {a}
                </span>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-warm p-5">
              <h2 className="text-base font-semibold">Before you pay</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Never transfer rent, agent fees or a "reservation" before your inspection. Meet at
                the lodge, confirm the room, then pay in person or on record.
              </p>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <p className="font-display text-3xl font-bold text-primary">{l.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{l.period}</p>

              <div className="mt-5 space-y-2">
                <Button className="w-full" size="lg">
                  <CalendarCheck className="mr-2 h-4 w-4" /> Book an inspection
                </Button>
                <Button variant="outline" className="w-full" size="lg">
                  <MessageCircle className="mr-2 h-4 w-4" /> Message host
                </Button>
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <p className="text-sm font-semibold">{l.host.name}</p>
                <p className="text-xs text-muted-foreground">
                  {l.host.role} · {l.host.since}
                </p>
              </div>

              <button className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                <Flag className="h-3.5 w-3.5" /> Report this listing
              </button>
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
