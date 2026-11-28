import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Clock3, ExternalLink, RefreshCw } from "lucide-react";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useUserInspectionsQuery } from "@/lib/user-notifications";

export const Route = createFileRoute("/_authenticated/inspections")({
  head: () => ({ meta: [{ title: "Upcoming Inspections — LodgeMate" }] }),
  component: UpcomingInspectionsPage,
});

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readableDate(date: string | null) {
  if (!date) return "Date to be arranged";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getTimeWindow(note: string | null) {
  return note?.match(/Time window:\s*([^\r\n]+)/i)?.[1] ?? null;
}

function UpcomingInspectionsPage() {
  const { user, isHost } = useAuth();
  const query = useUserInspectionsQuery(user?.id);
  const today = localDateKey();
  const upcoming = (query.data ?? [])
    .filter((item) => {
      const belongsToUser = isHost
        ? item.listings?.owner_id === user?.id
        : item.student_id === user?.id;
      const isOpen = item.status === "pending" || item.status === "confirmed";
      const isFuture = !item.preferred_date || item.preferred_date >= today;
      return belongsToUser && isOpen && isFuture;
    })
    .sort((a, b) => {
      if (!a.preferred_date) return 1;
      if (!b.preferred_date) return -1;
      return a.preferred_date.localeCompare(b.preferred_date);
    });

  return (
    <DashboardShell
      title="Upcoming inspections"
      subtitle={isHost
        ? "See student visit requests for your listings and the dates they have requested."
        : "Keep your planned lodge visits and host responses in one place."}
    >
      <Panel
        title={`${upcoming.length} upcoming ${upcoming.length === 1 ? "inspection" : "inspections"}`}
        description="Pending requests and confirmed visits with today’s or a future date."
      >
        {query.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading inspections…
          </div>
        ) : query.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            Inspections could not be loaded. Please refresh and try again.
          </div>
        ) : upcoming.length > 0 ? (
          <ul className="space-y-3">
            {upcoming.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{item.listings?.title ?? "Accommodation"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.listings?.area ?? "Location to be confirmed"}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> {readableDate(item.preferred_date)}
                  </span>
                  {getTimeWindow(item.note) && (
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" /> {getTimeWindow(item.note)}
                    </span>
                  )}
                </div>
                {item.note && item.note.replace(/Time window:\s*[^\r\n]+\s*/i, "").replace(/^Note:\s*/i, "").trim() && (
                  <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {item.note.replace(/Time window:\s*[^\r\n]+\s*/i, "").replace(/^Note:\s*/i, "").trim()}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.listings?.id && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/listings/$id" params={{ id: item.listings.id }}>
                        View accommodation <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                  {isHost && item.status === "pending" && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/host">Respond in Host Panel</Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
            <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/60" />
            <p className="mt-3 font-medium text-foreground">No upcoming inspections</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isHost
                ? "New visit requests from students will appear here."
                : "When you request or confirm a visit, you’ll see it here."}
            </p>
            {!isHost && (
              <Button className="mt-4" asChild>
                <Link to="/browse">Browse accommodation</Link>
              </Button>
            )}
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}
