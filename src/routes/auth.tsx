import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Create an Account — LodgeMate" },
      {
        name: "description",
        content:
          "Sign in to LodgeMate to save lodges, message hosts and book inspections near MOUAU and ABSU.",
      },
      { property: "og:title", content: "Sign In or Create an Account — LodgeMate" },
      {
        property: "og:description",
        content: "Save lodges, message hosts and book inspections on LodgeMate.",
      },
    ],
  }),
  component: Auth,
});

type Role = "student" | "landlord";

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("student");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const supabaseConfigured = isSupabaseConfigured();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const afterAuth = () => navigate({ to: "/dashboard" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      toast.error("Account access is not configured yet. Add your Supabase values to .env.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: form.name, phone: form.phone, role },
          },
        });
        if (error) throw error;
        toast.success("Account created", { description: "Welcome to LodgeMate." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
      }
      afterAuth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!supabaseConfigured) {
      toast.error("Account access is not configured yet. Add your Supabase values to .env.");
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    afterAuth();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-warm px-5 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-lift">
          <h1 className="font-display text-2xl font-bold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to message hosts and track inspections."
              : "Students, landlords and agents all start here."}
          </p>

          {!supabaseConfigured && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground"
            >
              You can browse listings now. Sign-in and account creation will work after this app is
              connected to a Supabase project.
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <>
                <div>
                  <Label>I am a…</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(
                      [
                        { v: "student", label: "Student" },
                        { v: "landlord", label: "Landlord / Agent" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setRole(o.v)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          role === o.v
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" className="mt-2" value={form.name} onChange={set("name")} required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" className="mt-2" value={form.phone} onChange={set("phone")} />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="mt-2"
                placeholder="you@example.com"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="mt-2"
                placeholder="••••••••"
                value={form.password}
                onChange={set("password")}
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={busy || !supabaseConfigured}
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={google}
            disabled={!supabaseConfigured}
          >
            Continue with Google
          </Button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to LodgeMate?" : "Already have an account?"}{" "}
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <p className="mt-6 border-t border-border pt-5 text-center text-xs text-muted-foreground">
            Just browsing?{" "}
            <Link to="/browse" className="text-primary hover:underline">
              See listings without an account
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
