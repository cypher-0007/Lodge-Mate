import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { isAdmin, isHost, profile } = useAuth();

  const tabs = [
    { to: "/dashboard", label: "My dashboard", show: true },
    { to: "/host", label: "Host panel", show: isHost },
    { to: "/admin", label: "Admin", show: isAdmin },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border bg-warm">
          <div className="mx-auto max-w-6xl px-5 py-9">
            <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
            {profile?.banned && (
              <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Your account has been suspended. Contact support to appeal.
              </p>
            )}
            <nav className="mt-6 flex flex-wrap gap-2">
              {tabs
                .filter((t) => t.show)
                .map((t) => (
                  <Link
                    key={t.to}
                    to={t.to}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    activeProps={{
                      className:
                        "rounded-full border border-primary bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground",
                    }}
                  >
                    {t.label}
                  </Link>
                ))}
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 py-10">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    approved: "bg-primary/10 text-primary border-primary/30",
    pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    rejected: "bg-destructive/10 text-destructive border-destructive/30",
    removed: "bg-muted text-muted-foreground border-border",
    open: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    resolved: "bg-primary/10 text-primary border-primary/30",
    confirmed: "bg-primary/10 text-primary border-primary/30",
    declined: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        tone[status] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      {status}
    </span>
  );
}
