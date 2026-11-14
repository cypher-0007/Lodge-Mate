import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Phone, User as UserIcon, Building2, MapPin, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserBetaAccess, useUserBetaPass } from "@/lib/beta-lodges";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Student Profile & Settings — LodgeMate" },
      {
        name: "description",
        content: "Manage your student account, phone number, campus affiliation and accommodation preferences on LodgeMate.",
      },
    ],
  }),
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { user, profile, isStudent, refresh } = useAuth();
  const isLive = isSupabaseConfigured();

  const accessQuery = useUserBetaAccess(user?.id);
  const passQuery = useUserBetaPass(user?.id);

  // Read metadata from user or profile
  const meta: Record<string, string | undefined> = (user?.user_metadata as Record<string, string | undefined>) ?? {};

  const [fullName, setFullName] = useState(profile?.full_name ?? meta["full_name"] ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? meta["phone"] ?? "");
  const [school, setSchool] = useState<string>(profile?.school ?? meta["school"] ?? "MOUAU");
  const [department, setDepartment] = useState<string>(meta["department"] ?? "");
  const [level, setLevel] = useState<string>(meta["level"] ?? "200L");

  // Preferences
  const [preferredKind, setPreferredKind] = useState<string>(meta["preferred_kind"] ?? "Full lodge");
  const [budgetMin, setBudgetMin] = useState<string>(meta["budget_min"] ?? "");
  const [budgetMax, setBudgetMax] = useState<string>(meta["budget_max"] ?? "");
  const [preferredArea, setPreferredArea] = useState<string>(meta["preferred_area"] ?? "");
  const [notes, setNotes] = useState<string>(meta["notes"] ?? "");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.school) setSchool(profile.school);
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid Nigerian phone number (at least 10 digits).");
      return;
    }

    setIsSaving(true);
    try {
      if (isLive) {
        // 1. Update Supabase public.profiles table
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: fullName.trim(),
            phone: phone.trim(),
            school,
          })
          .eq("id", user.id);

        if (profileError) {
          console.warn("Could not update profiles table directly:", profileError.message);
        }

        // 2. Update auth user metadata so student preferences persist across sessions
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            school,
            department: department.trim(),
            level,
            preferred_kind: preferredKind,
            budget_min: budgetMin,
            budget_max: budgetMax,
            preferred_area: preferredArea.trim(),
            notes: notes.trim(),
          },
        });

        if (authError) throw authError;

        await refresh();
      }

      toast.success("Profile and preferences saved successfully!", {
        description: "Your host communication and search preferences have been updated.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasBetaAccess = !isLive || (accessQuery.data ?? false);

  return (
    <DashboardShell
      title="Profile & Settings"
      subtitle="Manage your personal details, campus affiliation and accommodation preferences."
    >
      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Personal Details & Preferences */}
        <div className="space-y-6 lg:col-span-2">
          {/* Personal Information Panel */}
          <Panel
            title="Personal & Campus Information"
            description="Verified hosts and campus inspectors coordinate with you using these details."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                  Email Address (Account ID)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="mt-1.5 bg-muted/50 text-muted-foreground cursor-not-allowed text-xs sm:text-sm"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used for sign-in and security notifications. Cannot be modified directly.
                </p>
              </div>

              <div>
                <Label htmlFor="fullName" className="text-xs font-semibold">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Chinedu Okafor"
                    className="pl-9 text-xs sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone" className="text-xs font-semibold">
                  Phone Number (WhatsApp) <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0801 234 5678"
                    className="pl-9 text-xs sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="school" className="text-xs font-semibold">
                  Primary Campus / University
                </Label>
                <Select value={school} onValueChange={(val) => setSchool(val)}>
                  <SelectTrigger id="school" className="mt-1.5 text-xs sm:text-sm">
                    <SelectValue placeholder="Select campus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MOUAU">MOUAU — Umudike (Michael Okpara University)</SelectItem>
                    <SelectItem value="ABSU">ABSU — Uturu (Abia State University)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="level" className="text-xs font-semibold">
                  Academic Level
                </Label>
                <Select value={level} onValueChange={(val) => setLevel(val)}>
                  <SelectTrigger id="level" className="mt-1.5 text-xs sm:text-sm">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100L">100 Level (Fresher)</SelectItem>
                    <SelectItem value="200L">200 Level</SelectItem>
                    <SelectItem value="300L">300 Level</SelectItem>
                    <SelectItem value="400L">400 Level</SelectItem>
                    <SelectItem value="500L">500 Level (Final Year)</SelectItem>
                    <SelectItem value="Postgraduate">Postgraduate / Masters</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="department" className="text-xs font-semibold">
                  Department / Course of Study
                </Label>
                <div className="relative mt-1.5">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science, Agribusiness, Law"
                    className="pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </Panel>

          {/* Accommodation Preferences Panel */}
          <Panel
            title="Accommodation Preferences"
            description="Help hosts understand what you are searching for when you request inspections."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prefKind" className="text-xs font-semibold">
                  Preferred Room Type
                </Label>
                <Select value={preferredKind} onValueChange={(val) => setPreferredKind(val)}>
                  <SelectTrigger id="prefKind" className="mt-1.5 text-xs sm:text-sm">
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full lodge">Full Self-Contained Unit</SelectItem>
                    <SelectItem value="Single Room">Single Room / Shared Facilities</SelectItem>
                    <SelectItem value="Flat">Multi-Bedroom Flat</SelectItem>
                    <SelectItem value="Bedspace">Shared Bedspace</SelectItem>
                    <SelectItem value="Any">Open to Any Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prefArea" className="text-xs font-semibold">
                  Target Campus Area / Location
                </Label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="prefArea"
                    value={preferredArea}
                    onChange={(e) => setPreferredArea(e.target.value)}
                    placeholder={school === "ABSU" ? "e.g. Main Gate, Marist, Okigwe Road" : "e.g. Umungasi, Inside Campus, Gate, Ikkwuano"}
                    className="pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="budgetMin" className="text-xs font-semibold">
                  Min Budget (₦ / year)
                </Label>
                <Input
                  id="budgetMin"
                  type="number"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="e.g. 120,000"
                  className="mt-1.5 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="budgetMax" className="text-xs font-semibold">
                  Max Budget (₦ / year)
                </Label>
                <Input
                  id="budgetMax"
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="e.g. 250,000"
                  className="mt-1.5 text-xs sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="notes" className="text-xs font-semibold">
                  Roommate or Living Preferences (Optional)
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Quiet environment preferred, steady borehole water, prepaid meter needed."
                  className="mt-1.5 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={isSaving} className="rounded-xl px-6 text-xs sm:text-sm font-semibold">
                {isSaving ? "Saving changes…" : "Save Profile & Preferences"}
              </Button>
            </div>
          </Panel>
        </div>

        {/* Right Column: Account Status & Safety Info */}
        <div className="space-y-6">
          <Panel title="Account Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-xs text-muted-foreground">Account Role</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <GraduationCap className="h-3.5 w-3.5" /> Student Account
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-xs text-muted-foreground">Authentication</span>
                <span className="text-xs font-medium text-foreground flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified Email
                </span>
              </div>

              <div className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Beta Lodges Pass</span>
                  {hasBetaAccess ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="h-3 w-3" /> Active Pass
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Free Account
                    </span>
                  )}
                </div>
                {hasBetaAccess && passQuery.data?.expires_at && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Valid until {new Date(passQuery.data.expires_at).toLocaleDateString()}
                  </p>
                )}
                {!hasBetaAccess && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Upgrade to access landlord direct phone numbers and video walkthroughs.
                  </p>
                )}
              </div>

              <div className="pt-1">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                    <ShieldCheck className="h-4 w-4" /> Student Protection
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    Always arrange physical on-site inspections through LodgeMate. Never transfer rent or reservation fees before visiting the room and confirming the caretaker.
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </form>
    </DashboardShell>
  );
}
