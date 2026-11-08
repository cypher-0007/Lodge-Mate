import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BedDouble, Building2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

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
  const { user, isHost } = useAuth();
  const navigate = useNavigate();

  const [kind, setKind] = useState("Full lodge");
  const [title, setTitle] = useState("");
  const [school, setSchool] = useState("MOUAU");
  const [area, setArea] = useState("");
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState("per year");
  const [amenities, setAmenities] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.info("Please sign in or register to publish a listing", {
        description: "Your listing details will be preserved.",
      });
      navigate({ to: "/auth" });
      return;
    }

    if (!isHost && kind === "Full lodge") {
      toast.error("Landlord or Agent account required", {
        description: "Full lodges can only be listed by registered landlords or agents. Switch your account or post a bedspace/takeover.",
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      toast.success("Draft space registered (demo mode)", {
        description: "A campus representative will contact you for on-site verification.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const amenitiesList = amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const { error } = await supabase.from("listings").insert({
        owner_id: user.id,
        title: title.trim(),
        kind,
        school,
        area: area.trim(),
        price: Number(price) || 0,
        period: period.trim(),
        amenities: amenitiesList,
        description: description.trim(),
        status: "pending",
        verified: false,
      });

      if (error) throw error;

      toast.success("Space submitted for verification!", {
        description: "Our campus rep will review your submission before it goes live.",
      });

      if (isHost) {
        navigate({ to: "/host" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to list space");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <form className="space-y-8" onSubmit={handleSubmit}>
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
                <Input
                  id="title"
                  className="mt-2"
                  placeholder="e.g. PalmView Self-Con, Ishiagu Gate"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="school">Nearest school</Label>
                <select
                  id="school"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="MOUAU">MOUAU (Umudike)</option>
                  <option value="ABSU">ABSU (Uturu)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="area">Area / landmark</Label>
                <Input
                  id="area"
                  className="mt-2"
                  placeholder="Ishiagu, Umudike, Uturu…"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Price (₦)</Label>
                <Input
                  id="price"
                  type="number"
                  className="mt-2"
                  placeholder="280000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="period">Period</Label>
                <Input
                  id="period"
                  className="mt-2"
                  placeholder="per year / per session"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                <Input
                  id="amenities"
                  className="mt-2"
                  placeholder="Prepaid meter, Borehole, Fenced, Tiled…"
                  value={amenities}
                  onChange={(e) => setAmenities(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  className="mt-2 min-h-32"
                  placeholder="Describe the room, the compound, water and power situation, and who it suits."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/60 p-5 text-sm text-muted-foreground">
              By posting you agree to host physical inspections and to never request payments,
              agent fees or deposits before a student has stood inside the space.
            </div>

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Submitting space..." : "Submit for verification"}
            </Button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
