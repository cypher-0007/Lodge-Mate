import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { BetaPassStatus } from "@/components/beta-pass-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSavedListingsQuery, useToggleSaveListing } from "@/lib/saved-listings";
import { useBetaLodgesConfig, useUserBetaAccess, useUserBetaPass } from "@/lib/beta-lodges";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — LodgeMate" },
      {
        name: "description",
        content: "Track your inspection requests and find verified student rooms near MOUAU and ABSU.",
      },
      { property: "og:title", content: "My Dashboard — LodgeMate" },
      { property: "og:description", content: "Your saved inspections and available student rooms." },
    ],
  }),
  beforeLoad: ({ context }) => {
    // If user is exclusively a landlord/agent, redirect them to the host panel
    if (context.isHost && !context.roles.includes("student") && !context.isAdmin) {
      throw redirect({ to: "/host" });
    }
  },
  component: StudentDashboard,
});

function StudentDashboard() {
  const { user, profile, isStudent } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const isLive = isSupabaseConfigured();

  const { data: savedListings = [], isLoading: isLoadingSaved } = useSavedListingsQuery();
  const toggleSave = useToggleSaveListing();

  // Beta Lodges pass status
  const configQuery = useBetaLodgesConfig();
  const accessQuery = useUserBetaAccess(user?.id);
  const passQuery = useUserBetaPass(user?.id);

  const listings = useQuery({
    queryKey: ["approved-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, kind, school, area, distance, price, period, verified")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mine = useQuery({
    queryKey: ["my-inspections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, preferred_date, note, status, created_at, listings(title, area)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const request = async () => {
    if (!selected || !user) return;
    const { error } = await supabase.from("inspections").insert({
      listing_id: selected,
      student_id: user.id,
      preferred_date: date || null,
      note: note || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Inspection requested", { description: "The host will confirm a time." });
    setSelected(null);
    setDate("");
    setNote("");
    void qc.invalidateQueries({ queryKey: ["my-inspections"] });
  };

  const report = async (listingId: string) => {
    const reason = window.prompt("What's wrong with this listing?");
    if (!reason || !user) return;
    const { error } = await supabase
      .from("reports")
      .insert({ listing_id: listingId, reporter_id: user.id, reason });
    if (error) toast.error(error.message);
    else toast.success("Report sent to the LodgeMate team");
  };

  return (
    <DashboardShell
      title={`Hi ${profile?.full_name?.split(" ")[0] ?? "there"}`}
      subtitle="Request inspections on verified rooms, then track every request in one place. Never pay before you inspect."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Available rooms" description="Only listings approved by the LodgeMate team.">
          {listings.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading rooms…</p>
          ) : listings.data && listings.data.length > 0 ? (
            <ul className="space-y-3">
              {listings.data.map((l) => (
                <li key={l.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{l.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {l.kind} · {l.school} · {l.area} {l.distance && `· ${l.distance}`}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        ₦{l.price.toLocaleString()}{" "}
                        <span className="font-normal text-muted-foreground">{l.period}</span>
                      </p>
                    </div>
                    {l.verified && <StatusPill status="approved" />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setSelected(l.id)}>
                      Request inspection
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => report(l.id)}>
                      Report
                    </Button>
                  </div>
                  {selected === l.id && (
                    <div className="mt-4 space-y-3 rounded-lg bg-muted/40 p-4">
                      <div>
                        <Label htmlFor="date">Preferred date</Label>
                        <Input
                          id="date"
                          type="date"
                          className="mt-2"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="note">Note to host</Label>
                        <Textarea
                          id="note"
                          className="mt-2"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="I can come any afternoon this week."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={request}>
                          Send request
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No approved listings yet — check back soon or browse the featured lodges.
            </p>
          )}
        </Panel>

        <Panel title="My inspection requests" description="Status updates from hosts appear here.">
          {mine.data && mine.data.length > 0 ? (
            <ul className="space-y-3">
              {mine.data.map((i) => (
                <li
                  key={i.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="font-medium">{i.listings?.title ?? "Listing"}</p>
                    <p className="text-sm text-muted-foreground">
                      {i.listings?.area} · {i.preferred_date ?? "flexible date"}
                    </p>
                    {i.note && <p className="mt-1 text-sm text-muted-foreground">“{i.note}”</p>}
                  </div>
                  <StatusPill status={i.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You haven't requested any inspections yet.</p>
          )}
        </Panel>

        {/* Beta Lodges Access Pass Panel */}
        <Panel
          title="Beta Lodges"
          description="Premium lodges with direct provider contact and video walkthroughs."
        >
          <BetaPassStatus
            hasAccess={!isLive || (accessQuery.data ?? false)}
            pass={passQuery.data ?? null}
            config={configQuery.data ?? null}
            isLoading={accessQuery.isLoading || configQuery.isLoading}
            isAuthenticated={!!user}
            isLive={isLive}
          />
        </Panel>

        <Panel
          title="Saved Lodges"
          description="Rooms you bookmarked for later comparison."
          className="lg:col-span-2"
        >
          {isLoadingSaved ? (
            <p className="text-sm text-muted-foreground">Loading saved lodges…</p>
          ) : savedListings.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedListings.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-col justify-between rounded-xl border border-border p-4 bg-card"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-snug">{l.title}</p>
                      <button
                        type="button"
                        onClick={() => toggleSave.mutate({ listingId: l.id, currentlySaved: true })}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        title="Remove bookmark"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.school} · {l.area} · {l.kind}
                    </p>
                    <p className="mt-2 text-sm font-bold text-primary">
                      {l.price} <span className="text-xs font-normal text-muted-foreground">/{l.period}</span>
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2 pt-2 border-t border-border/70">
                    <Button size="sm" variant="outline" className="text-xs h-7 flex-1" asChild>
                      <Link to="/listings/$id" params={{ id: l.id }}>
                        View details
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7 flex-1"
                      onClick={() => setSelected(l.id)}
                    >
                      Inspect
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              You haven't saved any lodges yet. Click the heart icon on any listing to save it here.
            </p>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}
