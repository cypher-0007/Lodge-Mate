import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Clock3, Inbox, RefreshCw } from "lucide-react";

import { DashboardShell, Panel, StatusPill } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useUserNotifications } from "@/lib/user-notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — LodgeMate" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, isHost } = useAuth();
  const { notifications, unreadCount, unreadIds, markAllAsRead, isLoading, error } = useUserNotifications(
    user?.id,
    isHost,
  );

  return (
    <DashboardShell
      title="Notifications"
      subtitle="Keep up with inspection requests and listing reviews from your LodgeMate account."
    >
      <Panel title="Recent updates" description="Your latest accommodation and inspection activity.">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You’re all caught up"}
          </p>
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading updates…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            Notifications could not be loaded. Please refresh and try again.
          </div>
        ) : notifications.length > 0 ? (
          <ul className="space-y-3">
            {notifications.map((item) => {
              const unread = unreadIds.has(item.id);
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className={`flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/50 ${unread ? "border-primary/30 bg-primary/[0.035]" : "border-border bg-card"}`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {item.id.startsWith("inspection:") ? <Clock3 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        {item.title}
                        <StatusPill status={item.status} />
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </span>
                    {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
            <Inbox className="mx-auto h-9 w-9 text-muted-foreground/60" />
            <p className="mt-3 font-medium text-foreground">No updates yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Inspection activity and listing review updates will appear here.
            </p>
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}
