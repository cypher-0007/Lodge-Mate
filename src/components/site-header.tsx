import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const nav = [
  { to: "/browse", label: "Browse" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/list-a-space", label: "List a space" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canopy text-primary-foreground">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">LodgeMate</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}

function HeaderActions() {
  const { user, isHost, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/auth">Get started</Link>
        </Button>
      </div>
    );
  }

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin">Admin</Link>
        </Button>
      )}
      {isHost && (
        <Button variant="ghost" size="sm" asChild>
          <Link to="/host">Host</Link>
        </Button>
      )}
      <Button variant="ghost" size="sm" asChild>
        <Link to="/dashboard">Dashboard</Link>
      </Button>
      <Button size="sm" variant="outline" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}
