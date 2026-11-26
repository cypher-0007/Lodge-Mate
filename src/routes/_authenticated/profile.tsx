import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  GraduationCap,
  Phone,
  User as UserIcon,
  Building2,
  Briefcase,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Camera,
  Trash2,
  LogOut,
  Mail,
  AlertCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { DashboardShell, Panel } from "@/components/dashboard-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserBetaAccess, useUserBetaPass } from "@/lib/beta-lodges";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Account Profile & Settings — LodgeMate" },
      {
        name: "description",
        content: "Manage your personal profile, profile picture, account details, and preferences on LodgeMate.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, isStudent, isHost, providerType, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const isLive = isSupabaseConfigured();

  const accessQuery = useUserBetaAccess(user?.id);
  const passQuery = useUserBetaPass(user?.id);

  // Determine active account type
  const isAgent = providerType === "agent";
  const isLandlord = !isAgent && (isHost || profile?.provider_type === "landlord");
  const isStudentAccount = !isAgent && !isLandlord;

  // Metadata accessor
  const meta: Record<string, string | undefined> = (user?.user_metadata as Record<string, string | undefined>) ?? {};

  // Avatar states
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? meta["avatar_url"] ?? null
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Common fields
  const [fullName, setFullName] = useState(profile?.full_name ?? meta["full_name"] ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? meta["phone"] ?? "");
  const [school, setSchool] = useState<string>(profile?.school ?? meta["school"] ?? "MOUAU");

  // Student-specific fields (Optional academic info & accommodation preferences)
  const [department, setDepartment] = useState<string>(meta["department"] ?? "");
  const [level, setLevel] = useState<string>(meta["level"] ?? "");
  const [preferredKind, setPreferredKind] = useState<string>(meta["preferred_kind"] ?? "Full lodge");
  const [budgetMin, setBudgetMin] = useState<string>(meta["budget_min"] ?? "");
  const [budgetMax, setBudgetMax] = useState<string>(meta["budget_max"] ?? "");
  const [preferredArea, setPreferredArea] = useState<string>(meta["preferred_area"] ?? "");
  const [notes, setNotes] = useState<string>(meta["notes"] ?? "");
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // Landlord-specific fields
  const [businessName, setBusinessName] = useState<string>(
    profile?.business_name ?? meta["business_name"] ?? ""
  );
  const [operatingArea, setOperatingArea] = useState<string>(
    profile?.operating_area ?? meta["operating_area"] ?? ""
  );
  const [bio, setBio] = useState<string>(profile?.bio ?? meta["bio"] ?? "");

  // Sign out confirmation modal state
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.school) setSchool(profile.school);
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    if (profile?.business_name) setBusinessName(profile.business_name);
    if (profile?.operating_area) setOperatingArea(profile.operating_area);
    if (profile?.bio) setBio(profile.bio);
  }, [profile]);

  // Profile Picture Upload Handler
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file format", {
        description: "Please upload a JPG, PNG, or WebP image.",
      });
      return;
    }

    // Validate max size: 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File is too large", {
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    // Local preview immediately
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview);

    if (!isLive) {
      toast.success("Profile photo updated (local preview mode)");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Upload to avatars bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // If storage bucket is unmigrated remotely, notify gracefully
        console.warn("Storage upload notice:", uploadError.message);
        toast.info("Photo preview active", {
          description: "Remote storage bucket 'avatars' is not yet provisioned in production. Local preview is active.",
        });
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        const newAvatarUrl = publicUrlData.publicUrl;
        setAvatarUrl(newAvatarUrl);

        // Persist avatar URL to auth user metadata and profiles
        await supabase.auth.updateUser({
          data: { avatar_url: newAvatarUrl },
        });

        try {
          await supabase
            .from("profiles")
            .update({ avatar_url: newAvatarUrl } as any)
            .eq("id", user.id);
        } catch {
          // Non-fatal if column is pending migration
        }

        toast.success("Profile picture updated successfully!");
        await refresh();
      }
    } catch (err) {
      toast.error("Failed to upload profile picture", {
        description: err instanceof Error ? err.message : "Please try again later.",
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset input value so same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Profile Picture Remove Handler
  const handleRemoveAvatar = async () => {
    if (!user) return;
    setAvatarUrl(null);

    try {
      if (isLive) {
        await supabase.auth.updateUser({
          data: { avatar_url: null },
        });

        try {
          await supabase
            .from("profiles")
            .update({ avatar_url: null } as any)
            .eq("id", user.id);
        } catch {
          // ignore if column pending migration
        }

        await refresh();
      }
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error("Failed to remove profile picture");
    }
  };

  // Form Submit Handler
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

    // Budget validation for students
    if (isStudentAccount && budgetMin && budgetMax) {
      const min = Number(budgetMin);
      const max = Number(budgetMax);
      if (!isNaN(min) && !isNaN(max) && min > max) {
        setBudgetError("Minimum budget cannot be greater than maximum budget.");
        toast.error("Invalid budget range", {
          description: "Minimum budget cannot be greater than maximum budget.",
        });
        return;
      }
    }
    setBudgetError(null);

    setIsSaving(true);
    try {
      if (isLive) {
        // 1. Update Supabase public.profiles table (existing columns)
        const profilePayload: Record<string, any> = {
          full_name: fullName.trim(),
          phone: phone.trim(),
          school,
        };

        if (avatarUrl) profilePayload["avatar_url"] = avatarUrl;
        if (businessName) profilePayload["business_name"] = businessName.trim();
        if (operatingArea) profilePayload["operating_area"] = operatingArea.trim();
        if (bio) profilePayload["bio"] = bio.trim();

        try {
          await supabase.from("profiles").update(profilePayload as any).eq("id", user.id);
        } catch (profileErr) {
          console.warn("Notice updating profiles table:", profileErr);
        }

        // 2. Update Supabase Auth user metadata
        const metadataPayload: Record<string, any> = {
          full_name: fullName.trim(),
          phone: phone.trim(),
          school,
          avatar_url: avatarUrl,
        };

        if (isStudentAccount) {
          metadataPayload["department"] = department.trim();
          metadataPayload["level"] = level;
          metadataPayload["preferred_kind"] = preferredKind;
          metadataPayload["budget_min"] = budgetMin;
          metadataPayload["budget_max"] = budgetMax;
          metadataPayload["preferred_area"] = preferredArea.trim();
          metadataPayload["notes"] = notes.trim();
        } else {
          metadataPayload["business_name"] = businessName.trim();
          metadataPayload["operating_area"] = operatingArea.trim();
          metadataPayload["bio"] = bio.trim();
        }

        const { error: authError } = await supabase.auth.updateUser({
          data: metadataPayload,
        });

        if (authError) throw authError;

        await refresh();
      }

      toast.success("Profile saved successfully!", {
        description: "Your account details and preferences are up to date.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // Sign out confirmation handler
  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("Signed out successfully", {
        description: "You have been logged out of your LodgeMate account.",
      });
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
      setIsSignOutModalOpen(false);
    }
  };

  // Derive initials for avatar fallback
  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "LM";
    const parts = trimmed.split(" ").filter(Boolean);
    if (parts.length === 0) return "LM";
    if (parts.length === 1) {
      const first = parts[0] ?? "";
      return first.slice(0, 2).toUpperCase() || "LM";
    }
    const first = parts[0] ?? "";
    const last = parts[parts.length - 1] ?? "";
    return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "LM";
  };

  const hasBetaAccess = !isLive || (accessQuery.data ?? false);
  const isEmailVerified = Boolean(user?.email_confirmed_at);

  return (
    <DashboardShell
      title="Account Profile & Settings"
      subtitle="Manage your personal details, profile picture, account security, and role-specific preferences."
    >
      <div className="space-y-6">
        {/* Top Profile Card with Avatar Upload Interface */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Circular Avatar */}
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/20 shadow-sm">
                <AvatarImage src={avatarUrl ?? ""} alt={fullName || "User Avatar"} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-display text-xl sm:text-2xl font-bold">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>

              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white text-xs font-semibold">
                  Uploading…
                </div>
              )}
            </div>

            {/* Profile Info & Controls */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground truncate">
                    {fullName || "LodgeMate Member"}
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{user?.email}</span>
                  </p>
                </div>

                {/* Account Type Badge */}
                <div className="shrink-0 self-center sm:self-start">
                  {isAgent ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <Briefcase className="h-3.5 w-3.5" /> Independent Agent
                    </span>
                  ) : isLandlord ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <Building2 className="h-3.5 w-3.5" /> Landlord / Host
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <GraduationCap className="h-3.5 w-3.5" /> Student Account
                    </span>
                  )}
                </div>
              </div>

              {/* Photo Upload Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-3 border-t border-border/70">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleAvatarChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
                >
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                  {avatarUrl ? "Change Photo" : "Upload Photo"}
                </Button>

                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    className="h-8 gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
                <span className="text-[11px] text-muted-foreground hidden min-[480px]:inline">
                  JPG, PNG or WebP (max 5MB)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Editing Form */}
        <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* 1. STUDENT PROFILE VIEW */}
            {isStudentAccount && (
              <>
                <Panel
                  title="Important Account Information"
                  description="Your core identity and contact details used for inspection coordination."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                        Email Address (Read-only Account ID)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email ?? ""}
                        disabled
                        className="mt-1.5 bg-muted/50 text-muted-foreground cursor-not-allowed text-xs sm:text-sm"
                      />
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

                    <div className="sm:col-span-2">
                      <Label htmlFor="school" className="text-xs font-semibold">
                        Primary Campus / University <span className="text-destructive">*</span>
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
                  </div>
                </Panel>

                <Panel
                  title="Optional Academic Information"
                  description="Not compulsory. You can leave these blank if you prefer."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="department" className="text-xs font-semibold text-foreground">
                        Department / Course of Study <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
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
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Helps highlight lodges closest to your faculty lecture halls.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="level" className="text-xs font-semibold text-foreground">
                        Academic Level <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                      </Label>
                      <Select value={level || "none"} onValueChange={(val) => setLevel(val === "none" ? "" : val)}>
                        <SelectTrigger id="level" className="mt-1.5 text-xs sm:text-sm">
                          <SelectValue placeholder="Select level (Optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Prefer not to say</SelectItem>
                          <SelectItem value="100L">100 Level (Fresher)</SelectItem>
                          <SelectItem value="200L">200 Level</SelectItem>
                          <SelectItem value="300L">300 Level</SelectItem>
                          <SelectItem value="400L">400 Level</SelectItem>
                          <SelectItem value="500L">500 Level (Final Year)</SelectItem>
                          <SelectItem value="Postgraduate">Postgraduate / Masters</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Accommodation Preferences"
                  description="Optional. Inform hosts about your housing expectations when requesting inspections."
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
                        Target Campus Area / Neighborhood
                      </Label>
                      <div className="relative mt-1.5">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="prefArea"
                          value={preferredArea}
                          onChange={(e) => setPreferredArea(e.target.value)}
                          placeholder={school === "ABSU" ? "e.g. Main Gate, Marist, Okigwe Road" : "e.g. Umungasi, Inside Campus, Gate 2"}
                          className="pl-9 text-xs sm:text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="budgetMin" className="text-xs font-semibold">
                        Minimum Budget (₦ / year)
                      </Label>
                      <Input
                        id="budgetMin"
                        type="number"
                        min="0"
                        value={budgetMin}
                        onChange={(e) => {
                          setBudgetMin(e.target.value);
                          setBudgetError(null);
                        }}
                        placeholder="e.g. 100,000"
                        className="mt-1.5 text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="budgetMax" className="text-xs font-semibold">
                        Maximum Budget (₦ / year)
                      </Label>
                      <Input
                        id="budgetMax"
                        type="number"
                        min="0"
                        value={budgetMax}
                        onChange={(e) => {
                          setBudgetMax(e.target.value);
                          setBudgetError(null);
                        }}
                        placeholder="e.g. 250,000"
                        className="mt-1.5 text-xs sm:text-sm"
                      />
                    </div>

                    {budgetError && (
                      <div className="sm:col-span-2 flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{budgetError}</span>
                      </div>
                    )}

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
                      {isSaving ? "Saving changes…" : "Save Student Profile"}
                    </Button>
                  </div>
                </Panel>
              </>
            )}

            {/* 2. LANDLORD PROFILE VIEW */}
            {isLandlord && (
              <>
                <Panel
                  title="Landlord & Property Manager Information"
                  description="Your primary contact details for listing student accommodation."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                        Email Address (Read-only Account ID)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email ?? ""}
                        disabled
                        className="mt-1.5 bg-muted/50 text-muted-foreground cursor-not-allowed text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="fullName" className="text-xs font-semibold">
                        Full Name / Primary Contact <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative mt-1.5">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Elder Emmanuel Nwosu"
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
                          placeholder="0802 345 6789"
                          className="pl-9 text-xs sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="businessName" className="text-xs font-semibold">
                        Lodge / Property Name
                      </Label>
                      <div className="relative mt-1.5">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="businessName"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="e.g. Peace Villa Lodge"
                          className="pl-9 text-xs sm:text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="operatingArea" className="text-xs font-semibold">
                        Main Property Location <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative mt-1.5">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="operatingArea"
                          value={operatingArea}
                          onChange={(e) => setOperatingArea(e.target.value)}
                          placeholder="e.g. Umudike - Umungasi, 5 mins from Gate"
                          className="pl-9 text-xs sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="school" className="text-xs font-semibold">
                        Primary Campus Served <span className="text-destructive">*</span>
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

                    <div className="sm:col-span-2">
                      <Label htmlFor="bio" className="text-xs font-semibold">
                        Property Description & Caretaker Notes
                      </Label>
                      <Textarea
                        id="bio"
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="e.g. Owner of Peace Villa with 12 self-contained student units. Resident caretaker on-site. Inspections available Mon-Sat."
                        className="mt-1.5 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button type="submit" disabled={isSaving} className="rounded-xl px-6 text-xs sm:text-sm font-semibold">
                      {isSaving ? "Saving changes…" : "Save Landlord Profile"}
                    </Button>
                  </div>
                </Panel>
              </>
            )}

            {/* 3. INDEPENDENT AGENT PROFILE VIEW */}
            {isAgent && (
              <>
                <Panel
                  title="Independent Housing Agent Information"
                  description="Your real estate agency credentials and student housing operation areas."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                        Email Address (Read-only Account ID)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email ?? ""}
                        disabled
                        className="mt-1.5 bg-muted/50 text-muted-foreground cursor-not-allowed text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="fullName" className="text-xs font-semibold">
                        Agent Full Name <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative mt-1.5">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Kingsley Ibe"
                          className="pl-9 text-xs sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone" className="text-xs font-semibold">
                        Hotline / WhatsApp Number <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative mt-1.5">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0803 456 7890"
                          className="pl-9 text-xs sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="businessName" className="text-xs font-semibold">
                        Agency / Business Name <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative mt-1.5">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="businessName"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="e.g. Umudike Prime Housing Agency"
                          className="pl-9 text-xs sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="operatingArea" className="text-xs font-semibold">
                        Operating Areas <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative mt-1.5">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="operatingArea"
                          value={operatingArea}
                          onChange={(e) => setOperatingArea(e.target.value)}
                          placeholder="e.g. Umudike, Umuahia, Ikkwuano, Uturu"
                          className="pl-9 text-xs sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="school" className="text-xs font-semibold">
                        Primary Campus Focus <span className="text-destructive">*</span>
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

                    <div className="sm:col-span-2">
                      <Label htmlFor="bio" className="text-xs font-semibold">
                        Agent Introduction & Service Guarantee
                      </Label>
                      <Textarea
                        id="bio"
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="e.g. Accredited student housing consultant operating across MOUAU and ABSU campuses. We coordinate physical lodge viewings with transparent agreement fees."
                        className="mt-1.5 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button type="submit" disabled={isSaving} className="rounded-xl px-6 text-xs sm:text-sm font-semibold">
                      {isSaving ? "Saving changes…" : "Save Agent Profile"}
                    </Button>
                  </div>
                </Panel>
              </>
            )}
          </div>

          {/* Right Column: Status & Security Panels */}
          <div className="space-y-6">
            {/* Account Status Card */}
            <Panel title="Account Status & Verification">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs text-muted-foreground">Account Role</span>
                  <span className="text-xs font-semibold text-foreground">
                    {isAgent ? "Independent Agent" : isLandlord ? "Landlord / Host" : "Student"}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs text-muted-foreground">Email Status</span>
                  {isEmailVerified ? (
                    <span className="text-xs font-medium flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-xs font-medium flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" /> Confirmation Pending
                    </span>
                  )}
                </div>

                {/* Role Specific Verification Badges */}
                {isStudentAccount && (
                  <div className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Beta Lodges Pass</span>
                      {hasBetaAccess ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Active Pass
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
                  </div>
                )}

                {(isLandlord || isAgent) && (
                  <div className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Provider Trust Status</span>
                      {profile?.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Verified Provider
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Awaiting Verification
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      Verification requires confirmed email and phone, ID and selfie evidence, property proof, and manual review.
                    </p>
                    {!profile?.verified && (
                      <Button asChild size="sm" variant="outline" className="mt-3">
                        <Link to="/verify-provider">Start or check provider verification</Link>
                      </Button>
                    )}
                  </div>
                )}

                {/* Privacy & Safety Note */}
                <div className="pt-1">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                      <ShieldCheck className="h-4 w-4 shrink-0" /> Contact Privacy
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      {isStudentAccount
                        ? "Your phone number is only shared with verified property hosts when an inspection request is confirmed."
                        : "Your direct phone number is never exposed publicly to unverified visitors. It unlocks only for authenticated students with confirmed physical inspection appointments."}
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Account Session & Sign Out Card */}
            <Panel
              title="Account & Security"
              description="Manage your active authentication session."
            >
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Signing out will terminate your current session on this device.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSignOutModalOpen(true)}
                  className="w-full h-10 gap-2 rounded-xl text-xs font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out of LodgeMate
                </Button>
              </div>
            </Panel>
          </div>
        </form>
      </div>

      {/* Sign Out Confirmation Modal Dialog */}
      <AlertDialog open={isSignOutModalOpen} onOpenChange={setIsSignOutModalOpen}>
        <AlertDialogContent className="max-w-md sm:rounded-2xl">
          <AlertDialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <LogOut className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">
              Sign out of your account?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              You will be signed out of LodgeMate on this device. You will need to sign back in with your credentials to manage your dashboard, inspection requests, or accommodation listings.
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
    </DashboardShell>
  );
}
