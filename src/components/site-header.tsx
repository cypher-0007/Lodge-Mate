import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Menu, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const mainNavLinks = [
  { to: "/", label: "Home", exact: true },
  { to: "/browse", label: "Browse", exact: false },
  { to: "/beta-lodges", label: "Beta Lodges", exact: false },
  { to: "/how-it-works", label: "How it works", exact: false },
  { to: "/about", label: "About", exact: false },
  { to: "/faq", label: "FAQ", exact: false },
] as const;

export function SiteHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  // Close drawer on Escape key press
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  // Focus close button when drawer opens for accessibility
  useEffect(() => {
    if (drawerOpen) {
      closeButtonRef.current?.focus();
    }
  }, [drawerOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-5">
        {/* Brand logo */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0"
          onClick={() => setDrawerOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canopy text-primary-foreground shadow-sm">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            LodgeMate
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-4 lg:gap-6 text-sm text-muted-foreground md:flex">
          {mainNavLinks.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              className="transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            to="/list-a-space"
            className="inline-flex items-center rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 hover:border-primary/40"
            activeProps={{ className: "border-primary bg-primary/20 font-bold text-primary" }}
          >
            List a space
          </Link>
        </nav>

        {/* Header Actions (Desktop) & Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex">
            <HeaderActions onAction={() => setDrawerOpen(false)} />
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-foreground transition-colors hover:bg-muted md:hidden"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-navigation-drawer"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Subtle Semi-Transparent Dark Backdrop Overlay and Right-Side Slide-In Mobile Drawer */}
      {mounted &&
        createPortal(
          <>
            <div
              className={cn(
                "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 md:hidden",
                drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              )}
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />

            <aside
              id="mobile-navigation-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              className={cn(
                "fixed inset-y-0 right-0 z-50 flex h-full w-[80vw] max-w-[340px] flex-col bg-background shadow-2xl border-l border-border transition-transform duration-300 ease-in-out md:hidden",
                drawerOpen ? "translate-x-0" : "translate-x-full"
              )}
            >
              {/* Drawer Header with Title and Close Button */}
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-5">
                <Link
                  to="/"
                  className="flex items-center gap-2"
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-canopy text-primary-foreground shadow-xs">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-display text-base font-bold tracking-tight text-foreground">
                    LodgeMate
                  </span>
                </Link>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close navigation drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Navigation Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {/* Main Links */}
                <nav className="flex flex-col gap-1" aria-label="Mobile menu links">
                  {mainNavLinks.map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      activeOptions={{ exact: n.exact }}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        n.to === "/beta-lodges" && "text-foreground font-semibold"
                      )}
                      activeProps={{ className: "bg-muted font-semibold text-foreground" }}
                    >
                      {n.label}
                    </Link>
                  ))}

                  {/* Prominent List a space CTA in mobile drawer */}
                  <Link
                    to="/list-a-space"
                    onClick={() => setDrawerOpen(false)}
                    className="mt-2 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
                    activeProps={{ className: "border-primary bg-primary/20 font-bold" }}
                  >
                    <span>List a space</span>
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      Host
                    </span>
                  </Link>
                </nav>

                {/* Authentication Actions */}
                <div className="border-t border-border/70 pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Account
                  </div>
                  <HeaderActions onAction={() => setDrawerOpen(false)} isMobile />
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-border/60 px-5 py-3 text-center text-[11px] text-muted-foreground">
                LodgeMate · Student Housing for MOUAU & ABSU
              </div>
            </aside>
          </>,
          document.body
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
      <div className={cn("flex items-center gap-2", isMobile ? "w-full flex-col gap-2.5 pt-1" : "")}>
        <Button
          variant="outline"
          size={isMobile ? "default" : "sm"}
          className={cn(isMobile ? "w-full justify-center text-sm font-medium h-10 rounded-xl" : "")}
          asChild
          onClick={onAction}
        >
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button
          size={isMobile ? "default" : "sm"}
          className={cn(
            isMobile
              ? "w-full justify-center bg-canopy text-primary-foreground font-semibold text-sm h-10 rounded-xl shadow-xs"
              : ""
          )}
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

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/40 p-3">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[11px] text-muted-foreground">Signed in as</span>
            <span className="text-sm font-medium text-foreground truncate">
              {user.email}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-border/80 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
            {roleLabel}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-9 rounded-xl"
              asChild
              onClick={onAction}
            >
              <Link to="/admin">Admin Panel</Link>
            </Button>
          )}

          {isHost ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-9 rounded-xl"
              asChild
              onClick={onAction}
            >
              <Link to="/host">Host Panel</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-9 rounded-xl"
              asChild
              onClick={onAction}
            >
              <Link to="/dashboard">Student Dashboard</Link>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start h-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
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
