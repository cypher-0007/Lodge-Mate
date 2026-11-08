import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Menu, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const nav = [
  { to: "/browse", label: "Browse", isSpecial: false },
  { to: "/beta-lodges", label: "Beta Lodges", isSpecial: true },
  { to: "/how-it-works", label: "How it works", isSpecial: false },
  { to: "/list-a-space", label: "List a space", isSpecial: false },
] as const;

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-5">
        {/* Brand logo */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0"
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canopy text-primary-foreground shadow-sm">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            LodgeMate
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {nav.map((n) =>
            n.isSpecial ? (
              <Link
                key={n.to}
                to={n.to}
                className="group relative inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground font-semibold" }}
              >
                <span>{n.label}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full border border-warning/50 bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-warning-foreground transition-transform group-hover:scale-105">
                  <Sparkles className="h-2.5 w-2.5 text-warning" />
                  BETA
                </span>
              </Link>
            ) : (
              <Link
                key={n.to}
                to={n.to}
                className="transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground font-semibold" }}
              >
                {n.label}
              </Link>
            ),
          )}
        </nav>

        {/* Header Actions (Desktop) & Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex">
            <HeaderActions onAction={() => setMobileMenuOpen(false)} />
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-foreground transition-colors hover:bg-muted md:hidden"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border/80 bg-background/98 px-5 py-4 shadow-lg backdrop-blur-lg md:hidden animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-2">
            {nav.map((n) =>
              n.isSpecial ? (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-warning/15"
                  activeProps={{ className: "border-warning bg-warning/20 font-bold" }}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-warning" />
                    {n.label}
                  </span>
                  <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-warning-foreground">
                    Featured
                  </span>
                </Link>
              ) : (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  activeProps={{ className: "bg-muted font-semibold text-foreground" }}
                >
                  {n.label}
                </Link>
              ),
            )}
          </nav>

          <div className="mt-4 border-t border-border/70 pt-4">
            <HeaderActions onAction={() => setMobileMenuOpen(false)} isMobile />
          </div>
        </div>
      )}
    </header>
  );
}

function HeaderActions({
  onAction,
  isMobile = false,
}: {
  onAction?: () => void;
  isMobile?: boolean;
}) {
  const { user, isHost, isAdmin, isStudent, providerType, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleSignOut = async () => {
    onAction?.();
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!user) {
    return (
      <div className={`flex items-center gap-2 ${isMobile ? "w-full justify-between" : ""}`}>
        <Button
          variant="ghost"
          size="sm"
          className={isMobile ? "flex-1" : ""}
          asChild
          onClick={onAction}
        >
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button
          size="sm"
          className={isMobile ? "flex-1" : ""}
          asChild
          onClick={onAction}
        >
          <Link to="/auth">Get started</Link>
        </Button>
      </div>
    );
  }

  const roleLabel = isAdmin
    ? "Admin"
    : isHost
      ? providerType === "agent"
        ? "Agent"
        : "Landlord"
      : "Student";

  return (
    <div className={`flex items-center gap-2 ${isMobile ? "w-full flex-wrap justify-between" : ""}`}>
      {/* Account Type Badge */}
      <span className="inline-flex items-center rounded-full border border-border/80 bg-secondary/80 px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
        {roleLabel}
      </span>

      {isAdmin && (
        <Button variant="ghost" size="sm" asChild onClick={onAction}>
          <Link to="/admin">Admin</Link>
        </Button>
      )}

      {isHost ? (
        <Button variant="ghost" size="sm" asChild onClick={onAction}>
          <Link to="/host">Host Panel</Link>
        </Button>
      ) : (
        <Button variant="ghost" size="sm" asChild onClick={onAction}>
          <Link to="/dashboard">Dashboard</Link>
        </Button>
      )}

      <Button size="sm" variant="outline" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}
