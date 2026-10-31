import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — LodgeMate" },
      {
        name: "description",
        content:
          "Verify listings, manage roles, review inspections and act on reports across the LodgeMate marketplace.",
      },
      { property: "og:title", content: "Admin Console — LodgeMate" },
      { property: "og:description", content: "Moderate listings, users and reports on LodgeMate." },
    ],
  }),
  component: AdminConsole,
});

function AdminConsole() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const listings = useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
    enabled: isAdmin,
  });

  const inspections = useQuery({
    queryKey: ["admin-inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, preferred_date, status, note, listings(title, area)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, reason, status, created_at, listings(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const run = async (promise: PromiseLike<{ error: { message: string } | null }>, keys: string[]) => {
    const { error } = await promise;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Updated");
    keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  };

  const setStatus = (id: string, status: "approved" | "rejected" | "removed" | "pending") =>
    run(
      supabase
        .from("listings")
        .update({ status, verified: status === "approved" })
        .eq("id", id),
      ["admin-listings", "approved-listings"],
    );

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (has) {
      await run(supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role), ["admin-users"]);
    } else {
      await run(supabase.from("user_roles").insert({ user_id: userId, role }), ["admin-users"]);
    }
  };

  const setBanned = (userId: string, banned: boolean) =>
    run(supabase.from("profiles").update({ banned }).eq("id", userId), ["admin-users"]);

  if (loading) {
    return (
      <DashboardShell title="Admin console" subtitle="Checking your permissions…">
        <Panel title="Loading">
          <p className="text-sm text-muted-foreground">One moment…</p>
        </Panel>
      </DashboardShell>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardShell title="Admin console" subtitle="Restricted area.">
        <Panel title="You don't have admin access">
          <p className="text-sm text-muted-foreground">
            Only LodgeMate administrators can moderate listings, users and reports.
          </p>
        </Panel>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Admin console"
      subtitle="Verify listings, manage roles and accounts, review inspections and act on reports."
    >
      <div className="space-y-6">
        <Panel title="Listings" description="Approve to publish and mark verified, or take a listing down.">
          {listings.data && listings.data.length > 0 ? (
            <ul className="space-y-3">
              {listings.data.map((l) => (
                <li key={l.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{l.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {l.kind} · {l.school} · {l.area} · ₦{l.price.toLocaleString()} {l.period}
                      </p>
                    </div>
                    <StatusPill status={l.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setStatus(l.id, "approved")}>
                      Approve & verify
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "rejected")}>
                      Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(l.id, "removed")}>
                      Take down
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No listings submitted yet.</p>
          )}
        </Panel>

        <Panel title="Users & roles" description="Grant landlord or admin access, or suspend an account.">
          {users.data && users.data.length > 0 ? (
            <ul className="space-y-3">
              {users.data.map((u) => (
                <li key={u.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{u.full_name ?? "Unnamed user"}</p>
                      <p className="text-sm text-muted-foreground">
                        {u.phone ?? "no phone"} · {u.roles.join(", ") || "no role"}
                      </p>
                    </div>
                    {u.banned && <StatusPill status="rejected" />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["student", "landlord", "admin"] as AppRole[]).map((role) => {
                      const has = u.roles.includes(role);
                      return (
                        <Button
                          key={role}
                          size="sm"
                          variant={has ? "default" : "outline"}
                          onClick={() => toggleRole(u.id, role, has)}
                        >
                          {has ? `Remove ${role}` : `Make ${role}`}
                        </Button>
                      );
                    })}
                    <Button size="sm" variant="ghost" onClick={() => setBanned(u.id, !u.banned)}>
                      {u.banned ? "Unban account" : "Ban account"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Inspection requests" description="Every booking across the platform.">
            {inspections.data && inspections.data.length > 0 ? (
              <ul className="space-y-3">
                {inspections.data.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-4">
                    <div>
                      <p className="font-medium">{i.listings?.title ?? "Listing"}</p>
                      <p className="text-sm text-muted-foreground">
                        {i.listings?.area} · {i.preferred_date ?? "flexible"}
                      </p>
                    </div>
                    <StatusPill status={i.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No inspection requests yet.</p>
            )}
          </Panel>

          <Panel title="Reports" description="Scam, duplicate and complaint reports from users.">
            {reports.data && reports.data.length > 0 ? (
              <ul className="space-y-3">
                {reports.data.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{r.listings?.title ?? "Listing removed"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                    {r.status === "open" && (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() =>
                          run(supabase.from("reports").update({ status: "resolved" }).eq("id", r.id), [
                            "admin-reports",
                          ])
                        }
                      >
                        Mark resolved
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
