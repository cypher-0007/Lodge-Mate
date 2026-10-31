import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/host")({
  head: () => ({
    meta: [
      { title: "Host Panel — Manage Your Lodges | LodgeMate" },
      {
        name: "description",
        content:
          "Landlords and agents: post rooms, track verification status and confirm student inspection requests.",
      },
      { property: "og:title", content: "Host Panel — Manage Your Lodges | LodgeMate" },
      {
        property: "og:description",
        content: "Post rooms and confirm inspections with students near MOUAU and ABSU.",
      },
    ],
  }),
  component: HostPanel,
});

const empty = {
  title: "",
  kind: "Full lodge",
  school: "MOUAU",
  area: "",
  distance: "",
  price: "",
  period: "per year",
  description: "",
  amenities: "",
};

function HostPanel() {
  const { user, isHost } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const listings = useQuery({
    queryKey: ["host-listings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const requests = useQuery({
    queryKey: ["host-inspections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, preferred_date, note, status, student_id, listings!inner(title, owner_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.filter((i) => i.listings?.owner_id === user!.id);
    },
    enabled: !!user,
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("listings").insert({
      owner_id: user.id,
      title: form.title,
      kind: form.kind,
      school: form.school,
      area: form.area,
      distance: form.distance,
      price: Number(form.price) || 0,
      period: form.period,
      description: form.description,
      amenities: form.amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listing submitted", { description: "It goes live once an admin approves it." });
    setForm(empty);
    void qc.invalidateQueries({ queryKey: ["host-listings"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["host-listings"] });
  };

  const setRequestStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("inspections").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["host-inspections"] });
  };

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  if (!isHost) {
    return (
      <DashboardShell
        title="Host panel"
        subtitle="This area is for landlords and agents."
      >
        <Panel title="You're signed in as a student">
          <p className="text-sm text-muted-foreground">
            Ask the LodgeMate team to upgrade your account to a landlord/agent to post rooms.
          </p>
        </Panel>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Host panel"
      subtitle="Post rooms, watch their verification status and answer inspection requests from students."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Post a room" description="Submitted rooms are reviewed before they go live.">
          <form className="space-y-4" onSubmit={create}>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" className="mt-2" required {...field("title")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="kind">Type</Label>
                <Input id="kind" className="mt-2" placeholder="Full lodge / Bedspace / Takeover" {...field("kind")} />
              </div>
              <div>
                <Label htmlFor="school">School</Label>
                <Input id="school" className="mt-2" placeholder="MOUAU or ABSU" {...field("school")} />
              </div>
              <div>
                <Label htmlFor="area">Area</Label>
                <Input id="area" className="mt-2" {...field("area")} />
              </div>
              <div>
                <Label htmlFor="distance">Distance</Label>
                <Input id="distance" className="mt-2" placeholder="6 min walk" {...field("distance")} />
              </div>
              <div>
                <Label htmlFor="price">Price (₦)</Label>
                <Input id="price" type="number" className="mt-2" required {...field("price")} />
              </div>
              <div>
                <Label htmlFor="period">Period</Label>
                <Input id="period" className="mt-2" placeholder="per year" {...field("period")} />
              </div>
            </div>
            <div>
              <Label htmlFor="amenities">Amenities (comma separated)</Label>
              <Input id="amenities" className="mt-2" placeholder="Prepaid meter, Borehole" {...field("amenities")} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" className="mt-2" rows={4} {...field("description")} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Submitting…" : "Submit listing"}
            </Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="My listings">
            {listings.data && listings.data.length > 0 ? (
              <ul className="space-y-3">
                {listings.data.map((l) => (
                  <li key={l.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{l.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {l.school} · {l.area} · ₦{l.price.toLocaleString()} {l.period}
                        </p>
                      </div>
                      <StatusPill status={l.status} />
                    </div>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => remove(l.id)}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No listings yet.</p>
            )}
          </Panel>

          <Panel title="Inspection requests">
            {requests.data && requests.data.length > 0 ? (
              <ul className="space-y-3">
                {requests.data.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{r.listings?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.preferred_date ?? "Flexible date"}
                        </p>
                        {r.note && <p className="mt-1 text-sm text-muted-foreground">“{r.note}”</p>}
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => setRequestStatus(r.id, "confirmed")}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRequestStatus(r.id, "declined")}>
                        Decline
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No inspection requests yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
