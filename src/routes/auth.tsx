import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  BadgeCheck,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Create an Account — LodgeMate" },
      {
        name: "description",
        content:
          "Sign in to LodgeMate as a student or landlord/agent to save lodges, message hosts, and manage inspections near MOUAU and ABSU.",
      },
      { property: "og:title", content: "Sign In or Create an Account — LodgeMate" },
      {
        property: "og:description",
        content: "Save lodges, message hosts and manage student rooms on LodgeMate.",
      },
    ],
  }),
  component: Auth,
});

type Role = "student" | "landlord";
type ProviderType = "landlord" | "agent";

const ROLE_STORAGE_KEY = "lodgemate_selected_role";
const PROVIDER_STORAGE_KEY = "lodgemate_selected_provider";

export function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("student");
  const [providerType, setProviderType] = useState<ProviderType>("landlord");

  // Account Type Selection Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role>("student");
  const [pendingProvider, setPendingProvider] = useState<ProviderType>("landlord");

  // Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabaseConfigured = isSupabaseConfigured();

  // Load persisted role preference on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY) as Role | null;
      const savedProvider = window.localStorage.getItem(PROVIDER_STORAGE_KEY) as ProviderType | null;
      if (savedRole === "student" || savedRole === "landlord") {
        setRole(savedRole);
      }
      if (savedProvider === "landlord" || savedProvider === "agent") {
        setProviderType(savedProvider);
      }
    }
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  // Open confirmation modal for selecting account type
  const openConfirmationModal = (targetRole: Role, targetProvider: ProviderType = "landlord") => {
    setPendingRole(targetRole);
    setPendingProvider(targetProvider);
    setIsModalOpen(true);
  };

  // Confirm account type selection from modal
  const handleConfirmRoleSelection = () => {
    setRole(pendingRole);
    setProviderType(pendingProvider);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ROLE_STORAGE_KEY, pendingRole);
      window.localStorage.setItem(PROVIDER_STORAGE_KEY, pendingProvider);
    }
    setIsModalOpen(false);

    const label =
      pendingRole === "student"
        ? "Student"
        : pendingProvider === "agent"
          ? "Independent Agent"
          : "Landlord";
    toast.success(`Account type set to ${label}`);
  };

  const handleCancelRoleSelection = () => {
    setIsModalOpen(false);
  };

  const afterAuth = () => {
    if (role === "landlord") {
      navigate({ to: "/host" });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  // Validate form before submission
  const validate = (): boolean => {
    if (!form.email || !form.email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return false;
    }

    if (form.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return false;
    }

    if (mode === "signup") {
      if (!form.name.trim()) {
        setErrorMessage("Please enter your full name.");
        return false;
      }

      if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
        setErrorMessage("Please enter a valid Nigerian phone number (at least 10 digits).");
        return false;
      }

      if (form.password !== form.confirmPassword) {
        setErrorMessage("Passwords do not match. Please check and try again.");
        return false;
      }
    }

    setErrorMessage(null);
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      toast.error("Account access is not configured yet. Add your Supabase values to .env.");
      return;
    }

    if (!validate()) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.name.trim(),
              phone: form.phone.trim(),
              role,
              provider_type: role === "landlord" ? providerType : null,
            },
          },
        });

        if (error) throw error;
        if (data.session) {
          // Sync role explicitly via backend RPC
          try {
            await supabase.rpc("sync_user_signup_role", {
              _role: role,
              _provider_type: role === "landlord" ? providerType : null,
            });
          } catch {
            // non-fatal if trigger already handled it
          }

          toast.success("Account created successfully", {
            description: `Welcome to LodgeMate as a ${
              role === "student" ? "student" : providerType === "agent" ? "independent agent" : "landlord"
            }.`,
          });
          afterAuth();
        } else {
          toast.success("Check your email", {
            description: "Use the confirmation link to finish creating your account.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });

        if (error) throw error;
        toast.success("Welcome back");
        afterAuth();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!supabaseConfigured) {
      toast.error("Account access is not configured yet. Add your Supabase values to .env.");
      return;
    }
    // Persist intended role so callback trigger can apply it
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lodgemate_pending_role", role);
      window.localStorage.setItem("lodgemate_pending_provider", providerType);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error(error.message || "Google sign-in failed");
  };

  const passwordsMatch =
    mode === "signin" || !form.confirmPassword || form.password === form.confirmPassword;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="relative flex flex-1 items-center justify-center overflow-x-hidden bg-gradient-to-br from-[#032b21] via-[#064e3b] to-[#043327] px-3.5 py-10 sm:px-6 sm:py-16">
        {/* Ambient atmospheric glows */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-leaf/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-warning/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

        <div className="relative mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 min-w-0">
          {/* Left Context Column (Visible on Desktop) */}
          <div className="hidden flex-col justify-center text-white lg:flex">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-warning" />
              <span>MOUAU &amp; ABSU Campus Housing</span>
            </div>

            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight leading-tight">
              Rent student rooms with zero guesswork.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              Direct access to verified student lodges, room takeovers, and bedspaces in Umudike and Uturu. No fake agents. No inspection fees before you arrive.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-leaf">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Inspected &amp; Campus-Verified</h4>
                  <p className="text-xs text-white/70">Rooms verified by campus reps before listing badges are granted.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-warning">
                  <BadgeCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Fair Pricing &amp; True Amenities</h4>
                  <p className="text-xs text-white/70">Accurate rent, borehole water status, and prepaid meter confirmation.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-leaf">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Built for Students &amp; Genuine Hosts</h4>
                  <p className="text-xs text-white/70">Direct physical inspection scheduling before any money changes hands.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs text-white/60">
              <ShieldCheck className="h-4 w-4 text-leaf" />
              <span>SSL Secure · Strict Tenant &amp; Landlord Verification</span>
            </div>
          </div>

          {/* Right Card Column: The Auth Card */}
          <div className="mx-auto w-full max-w-md min-w-0 rounded-2xl border border-border/80 bg-card p-5 sm:p-8 shadow-2xl box-border">
          {/* Header */}
          <div className="text-center sm:text-left">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {mode === "signin" ? "Welcome back" : "Join LodgeMate"}
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
              {mode === "signin"
                ? "Sign in to manage room bookings and inspections near MOUAU & ABSU."
                : "Create an account to discover or list student housing near campus."}
            </p>
          </div>

          {/* Persistent Account Type Indicator Banner */}
          <div className="mt-5 flex items-center justify-between rounded-xl border border-border/80 bg-secondary/50 p-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {role === "student" ? (
                  <GraduationCap className="h-5 w-5" />
                ) : providerType === "agent" ? (
                  <Briefcase className="h-5 w-5" />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Signing in as
                </span>
                <p className="text-xs font-semibold text-foreground sm:text-sm truncate">
                  {role === "student"
                    ? "Student"
                    : providerType === "agent"
                      ? "Independent Agent"
                      : "Landlord"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                openConfirmationModal(
                  role === "student" ? "landlord" : "student",
                  role === "student" ? "landlord" : "landlord",
                )
              }
              className="h-8 shrink-0 gap-1 rounded-lg text-xs font-semibold"
            >
              <RotateCcw className="h-3 w-3" />
              Switch
            </Button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mt-5 grid grid-cols-2 rounded-xl border border-border/80 bg-muted/60 p-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMessage(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "signin"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMessage(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
            </button>
          </div>

          {!supabaseConfigured && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-border bg-muted/80 px-3.5 py-2.5 text-xs text-muted-foreground"
            >
              Authentication is in demo mode. Connect Supabase in your environment to test live account
              creation.
            </div>
          )}

          {/* Error Message Box */}
          {errorMessage && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="break-words min-w-0">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form className="mt-5 space-y-4" onSubmit={submit}>
            {/* Sign-up specific fields */}
            {mode === "signup" && (
              <>
                {/* Account Category selection (Student vs Landlord/Agent) */}
                <div>
                  <Label className="text-xs font-semibold text-foreground">Select Pathway</Label>
                  <div className="mt-1.5 grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openConfirmationModal("student")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all min-w-0 ${
                        role === "student"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/80 bg-card text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      <span className="truncate">Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfirmationModal("landlord", providerType)}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all min-w-0 ${
                        role === "landlord"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/80 bg-card text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">Landlord / Agent</span>
                    </button>
                  </div>
                </div>

                {/* Sub-account type selector for Landlord / Agent */}
                {role === "landlord" && (
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                    <Label className="text-xs font-semibold text-foreground">
                      Provider Category
                    </Label>
                    <div className="mt-2 grid grid-cols-1 min-[390px]:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setProviderType("landlord");
                          if (typeof window !== "undefined") {
                            window.localStorage.setItem(PROVIDER_STORAGE_KEY, "landlord");
                          }
                        }}
                        className={`flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-all min-w-0 ${
                          providerType === "landlord"
                            ? "border-primary bg-card text-foreground shadow-xs font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-card/60"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          Landlord
                        </span>
                        <span className="mt-0.5 text-[10px] text-muted-foreground font-normal leading-tight">
                          Property Owner / Caretaker
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProviderType("agent");
                          if (typeof window !== "undefined") {
                            window.localStorage.setItem(PROVIDER_STORAGE_KEY, "agent");
                          }
                        }}
                        className={`flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-all min-w-0 ${
                          providerType === "agent"
                            ? "border-primary bg-card text-foreground shadow-xs font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-card/60"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary" />
                          Independent Agent
                        </span>
                        <span className="mt-0.5 text-[10px] text-muted-foreground font-normal leading-tight">
                          Lodge &amp; Housing Representative
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Full name */}
                <div>
                  <Label htmlFor="name" className="text-xs font-medium">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    className="mt-1.5 text-sm"
                    placeholder="e.g. Chinedu Eze"
                    value={form.name}
                    onChange={set("name")}
                    required
                  />
                </div>

                {/* Phone number */}
                <div>
                  <Label htmlFor="phone" className="text-xs font-medium">
                    Phone number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    className="mt-1.5 text-sm"
                    placeholder="e.g. 0801 234 5678"
                    value={form.phone}
                    onChange={set("phone")}
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Required for booking confirmations and on-site inspection contact.
                  </p>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-xs font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                className="mt-1.5 text-sm"
                placeholder="you@example.com"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password" className="text-xs font-medium">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="pr-10 text-sm"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (only on sign up) */}
            {mode === "signup" && (
              <div>
                <Label htmlFor="confirmPassword" className="text-xs font-medium">
                  Confirm Password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className={`pr-10 text-sm ${
                      !passwordsMatch ? "border-destructive focus-visible:ring-destructive/30" : ""
                    }`}
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {!passwordsMatch && form.confirmPassword && (
                  <p className="mt-1 text-[11px] text-destructive">Passwords do not match.</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-auto min-h-11 py-2.5 px-4 text-sm font-semibold rounded-xl whitespace-normal leading-snug"
              disabled={busy || !supabaseConfigured || (!passwordsMatch && mode === "signup")}
            >
              <span className="truncate">
                {busy ? (
                  "Please wait…"
                ) : mode === "signin" ? (
                  `Sign in as ${
                    role === "student"
                      ? "Student"
                      : providerType === "agent"
                        ? "Agent"
                        : "Landlord"
                  }`
                ) : (
                  `Create ${
                    role === "student"
                      ? "Student"
                      : providerType === "agent"
                        ? "Agent"
                        : "Landlord"
                  } Account`
                )}
              </span>
            </Button>
          </form>

          {/* Social Divider */}
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border/80" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-border/80" />
          </div>

          {/* Google OAuth Button */}
          <Button
            variant="outline"
            className="w-full h-auto min-h-11 py-2.5 px-3 gap-2 rounded-xl text-xs font-semibold hover:bg-muted/60 whitespace-normal leading-snug text-center justify-center"
            onClick={google}
            disabled={!supabaseConfigured || busy}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="truncate">
              Continue with Google ({role === "student" ? "Student" : "Landlord/Agent"})
            </span>
          </Button>

          {/* Bottom Switcher */}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New to LodgeMate?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setErrorMessage(null);
              }}
            >
              {mode === "signin" ? "Register here" : "Sign in here"}
            </button>
          </p>

          <p className="mt-5 border-t border-border/80 pt-4 text-center text-xs text-muted-foreground">
            Just exploring lodges?{" "}
            <Link to="/browse" className="font-medium text-primary hover:underline">
              Browse listings without signing in
            </Link>
          </p>
        </div>
        </div>
      </main>

      {/* Account Type Selection Confirmation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {pendingRole === "student" ? (
                <GraduationCap className="h-6 w-6" />
              ) : pendingProvider === "agent" ? (
                <Briefcase className="h-6 w-6" />
              ) : (
                <Building2 className="h-6 w-6" />
              )}
            </div>
            <DialogTitle className="mt-3 text-lg font-bold">
              Continue as{" "}
              {pendingRole === "student"
                ? "Student"
                : pendingProvider === "agent"
                  ? "Independent Agent"
                  : "Landlord"}
              ?
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {pendingRole === "student" ? (
                <>
                  Designed for undergraduate and postgraduate students at <strong>MOUAU</strong> and{" "}
                  <strong>ABSU</strong>. You will be able to search verified campus lodges, compare rates,
                  request physical inspections, and contact host caretakers directly.
                </>
              ) : pendingProvider === "agent" ? (
                <>
                  Designed for verified student housing and real estate agents operating around{" "}
                  <strong>MOUAU (Umudike)</strong> and <strong>ABSU (Uturu)</strong>. You can list multiple
                  properties, manage inspection bookings, and connect with students searching for rooms.
                </>
              ) : (
                <>
                  Designed for property owners and caretakers offering full lodges, self-contained units,
                  or shared hostels. You can publish rooms, manage availability, and schedule student
                  inspections.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Sub-selection option inside modal when landlord/agent is targeted */}
          {pendingRole === "landlord" && (
            <div className="my-2 space-y-2 rounded-xl border border-border/70 bg-muted/40 p-3">
              <span className="text-xs font-semibold text-foreground">Specify your role:</span>
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPendingProvider("landlord")}
                  className={`rounded-lg border p-2 text-left text-xs transition-all ${
                    pendingProvider === "landlord"
                      ? "border-primary bg-card font-semibold text-foreground shadow-xs"
                      : "border-border/60 text-muted-foreground hover:bg-card/70"
                  }`}
                >
                  <p className="font-medium text-foreground">Landlord</p>
                  <p className="text-[10px] text-muted-foreground">Property owner / caretaker</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPendingProvider("agent")}
                  className={`rounded-lg border p-2 text-left text-xs transition-all ${
                    pendingProvider === "agent"
                      ? "border-primary bg-card font-semibold text-foreground shadow-xs"
                      : "border-border/60 text-muted-foreground hover:bg-card/70"
                  }`}
                >
                  <p className="font-medium text-foreground">Independent Agent</p>
                  <p className="text-[10px] text-muted-foreground">Housing representative</p>
                </button>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelRoleSelection}
              className="rounded-xl text-xs"
            >
              Go Back
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRoleSelection}
              className="rounded-xl text-xs font-semibold"
            >
              Continue as{" "}
              {pendingRole === "student"
                ? "Student"
                : pendingProvider === "agent"
                  ? "Agent"
                  : "Landlord"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
