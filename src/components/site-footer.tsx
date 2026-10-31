import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-9 md:flex-row md:items-center md:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-canopy text-primary-foreground">
            <MapPin className="h-3.5 w-3.5" />
          </span>
          <span className="font-display font-bold">LodgeMate</span>
        </Link>
        <p className="text-sm text-muted-foreground">
          Student housing for MOUAU &amp; ABSU. Inspect before you pay.
        </p>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link to="/browse" className="hover:text-foreground">
            Browse
          </Link>
          <Link to="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link to="/list-a-space" className="hover:text-foreground">
            List a space
          </Link>
          <Link to="/safety" className="hover:text-foreground">
            Safety
          </Link>
          <Link to="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link to="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link to="/auth" className="hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
