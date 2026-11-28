import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Bell,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useUnreadCountQuery } from "@/lib/messaging";
import { useUserNotifications } from "@/lib/user-notifications";
import { cn } from "@/lib/utils";

// Streamlined main navigation links (Home restored after logo; FAQ removed from navbar & retained in footer)
const mainNavLinks = [
  { to: "/", label: "Home", exact: true },
  { to: "/browse", label: "Browse", exact: false },
  { to: "/beta-lodges", label: "Beta Lodges", exact: false },
  { to: "/how-it-works", label: "How it works", exact: false },
  { to: "/about", label: "About", exact: false },
] as const;

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return (parts[0] || "").slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "LM";
}

export function SiteHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { user } = useAuth();

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
        {/* Brand logo - clickable, navigates home */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90"
          onClick={() => setDrawerOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canopy text-primary-foreground shadow-xs">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            LodgeMate
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-5 lg:gap-7 text-sm text-muted-foreground md:flex">
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

          {/* List a space (highlighted primary CTA in desktop navbar) */}
          <Link
            to="/list-a-space"
            className="inline-flex items-center rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 hover:border-primary/40 shadow-2xs"
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
                "fixed inset-y-0 right-0 z-50 flex h-full w-[82vw] max-w-[340px] flex-col bg-background shadow-2xl border-l border-border transition-transform duration-300 ease-in-out md:hidden",
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

                  {/* List a space CTA in mobile drawer */}
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

                {/* Authentication & User Actions */}
                <div className="border-t border-border/70 pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {user ? "Account" : "Get Started"}
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
  const { user, profile, isHost, isAdmin, isStudent, providerType, signOut } = useAuth();
  const { data: unreadCount = 0 } = useUnreadCountQuery(user?.id);
  const { unreadCount: notificationCount } = useUserNotifications(user?.id, isHost);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      onAction?.();
      await qc.cancelQueries();
      qc.clear();
      await signOut();
      toast.success("Signed out successfully", {
        description: "You have been logged out of your LodgeMate account.",
      });
      navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
      setIsSignOutModalOpen(false);
    }
  };

  // If user is unauthenticated: show Sign in & Get started buttons
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

  // Derive role label and display attributes
  const roleLabel = isAdmin
    ? "Admin"
    : isHost
      ? providerType === "agent"
        ? "Independent Agent"
        : "Landlord"
      : "Student";

  const displayName =
    profile?.full_name?.trim() ||
    user.user_metadata?.["full_name"] ||
    user.email?.split("@")[0] ||
    "User";

  const initials = getInitials(profile?.full_name, user.email);

  // Mobile Drawer Navigation Layout
  if (isMobile) {
    return (
      <>
        <div className="flex flex-col gap-3 pt-1">
          {/* User Profile Summary Card */}
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/40 p-3">
            <Avatar className="h-10 w-10 border border-border/80 shrink-0">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
              <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
              <div className="mt-1">
                <span className="inline-flex items-center rounded-full border border-border/80 bg-secondary px-2 py-0.2 text-[10px] font-semibold text-secondary-foreground">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Role-Specific Navigation Buttons */}
          <div className="flex flex-col gap-1.5">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-9 rounded-xl"
                asChild
                onClick={onAction}
              >
                <Link to="/admin">
                  <ShieldCheck className="mr-2 h-4 w-4 text-clay" />
                  Admin Panel
                </Link>
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
                <Link to="/host">
                  <Building2 className="mr-2 h-4 w-4 text-primary" />
                  Host Panel
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-9 rounded-xl"
                asChild
                onClick={onAction}
              >
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                  Student Dashboard
                </Link>
              </Button>
            )}

            {/* Messages (with live unread badge) */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-9 rounded-xl relative"
              asChild
              onClick={onAction}
            >
              <Link to="/messages">
                <MessageCircle className="mr-2 h-4 w-4" />
                Messages
                {(unreadCount ?? 0) > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-9 rounded-xl relative"
              asChild
              onClick={onAction}
            >
              <Link to="/notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
                {notificationCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-9 rounded-xl"
              asChild
              onClick={onAction}
            >
              <Link to="/inspections">
                <CalendarDays className="mr-2 h-4 w-4" />
                Upcoming inspections
              </Link>
            </Button>

            {/* Profile & Settings */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-9 rounded-xl"
              asChild
              onClick={onAction}
            >
              <Link to="/profile">
                <User className="mr-2 h-4 w-4" />
                Profile &amp; Settings
              </Link>
            </Button>

            {/* Sign out */}
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start h-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive mt-1"
              onClick={() => setIsSignOutModalOpen(true)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        {/* Sign Out Confirmation Modal Dialog */}
        <AlertDialog open={isSignOutModalOpen} onOpenChange={setIsSignOutModalOpen}>
          <AlertDialogContent className="max-w-md sm:rounded-2xl">
            <AlertDialogHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-1">
                <LogOut className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-lg font-bold">
                Sign out of your account?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                You will be signed out of LodgeMate on this device. You will need to sign back in
                with your credentials to manage your dashboard, inspection requests, or messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 flex gap-2">
              <AlertDialogCancel disabled={isSigningOut} className="rounded-xl text-xs">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSignOut}
                disabled={isSigningOut}
                className="rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isSigningOut ? "Signing out…" : "Yes, Sign Out"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Desktop Authenticated Navigation Layout
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Admin Shortcut */}
        {isAdmin && (
          <Button variant="ghost" size="sm" asChild onClick={onAction}>
            <Link to="/admin" activeProps={{ className: "bg-muted font-semibold text-foreground" }}>
              Admin
            </Link>
          </Button>
        )}

        {/* Primary Dashboard / Host Panel Shortcut */}
        {isHost ? (
          <Button variant="ghost" size="sm" asChild onClick={onAction}>
            <Link to="/host" activeProps={{ className: "bg-muted font-semibold text-foreground" }}>
              Host Panel
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild onClick={onAction}>
            <Link
              to="/dashboard"
              activeProps={{ className: "bg-muted font-semibold text-foreground" }}
            >
              Dashboard
            </Link>
          </Button>
        )}

        <Button variant="ghost" size="icon" asChild className="relative" onClick={onAction}>
          <Link
            to="/notifications"
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ""}`}
            title="Notifications"
          >
            <Bell />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
        </Button>

        <Button variant="ghost" size="icon" asChild onClick={onAction}>
          <Link to="/inspections" aria-label="Upcoming inspections" title="Upcoming inspections">
            <CalendarDays />
          </Link>
        </Button>

        {/* Visible Messages Action with live unread badge */}
        <Button
          variant="ghost"
          size="sm"
          asChild
          onClick={onAction}
          className="relative px-2.5"
        >
          <Link
            to="/messages"
            activeProps={{ className: "bg-muted font-semibold text-foreground" }}
          >
            <MessageCircle className="mr-1.5 h-4 w-4" />
            <span>Messages</span>
            {(unreadCount ?? 0) > 0 && (
              <span className="ml-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>

        {/* Compact Profile Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 p-0.5 pr-2 transition-all hover:border-primary/50 hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              aria-label="User profile and account menu"
            >
              <Avatar className="h-7 w-7 border border-border/80 shrink-0">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={displayName} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-[11px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 rounded-2xl border-border/80 p-1.5 shadow-xl bg-card"
          >
            {/* Header: User Identity & Role Badge */}
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-3 mb-1">
              <Avatar className="h-9 w-9 border border-border/70 shrink-0">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={displayName} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                <div className="mt-1.5">
                  <span className="inline-flex items-center rounded-full border border-border/80 bg-secondary/90 px-2 py-0.2 text-[10px] font-semibold text-secondary-foreground">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Links */}
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2">
              <Link to="/profile" className="flex items-center gap-2 text-xs font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Profile &amp; Settings</span>
              </Link>
            </DropdownMenuItem>

            {isHost ? (
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2">
                <Link to="/host" className="flex items-center gap-2 text-xs font-medium">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Host Panel</span>
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2">
                <Link to="/dashboard" className="flex items-center gap-2 text-xs font-medium">
                  <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Student Dashboard</span>
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="my-1 bg-border/60" />

            {/* Sign out */}
            <DropdownMenuItem
              onClick={() => setIsSignOutModalOpen(true)}
              className="rounded-lg cursor-pointer py-2 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sign Out Confirmation Modal Dialog */}
      <AlertDialog open={isSignOutModalOpen} onOpenChange={setIsSignOutModalOpen}>
        <AlertDialogContent className="max-w-md sm:rounded-2xl">
          <AlertDialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-1">
              <LogOut className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              Sign out of your account?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              You will be signed out of LodgeMate on this device. You will need to sign back in with
              your credentials to manage your dashboard, inspection requests, or messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2">
            <AlertDialogCancel disabled={isSigningOut} className="rounded-xl text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSignOut}
              disabled={isSigningOut}
              className="rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSigningOut ? "Signing out…" : "Yes, Sign Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
