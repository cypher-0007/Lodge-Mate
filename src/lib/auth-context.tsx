import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "landlord" | "admin";

export type ProviderType = "landlord" | "agent";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  school: string | null;
  provider_type: ProviderType | null;
  banned: boolean;
  avatar_url?: string | null;
  business_name?: string | null;
  operating_area?: string | null;
  bio?: string | null;
  verified?: boolean;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isHost: boolean;
  isStudent: boolean;
  isLandlord: boolean;
  providerType: ProviderType | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseConfigured = isSupabaseConfigured();

  const load = async (user: User | null | undefined) => {
    if (!user) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const userId = user.id;

    // Check if there was a pending OAuth signup role stored before redirect
    if (typeof window !== "undefined") {
      const pendingRole = window.localStorage.getItem("lodgemate_pending_role");
      const pendingProvider = window.localStorage.getItem("lodgemate_pending_provider") as ProviderType | null;
      if (pendingRole) {
        try {
          await supabase.rpc("sync_user_signup_role", {
            _role: pendingRole,
            _provider_type: pendingProvider ?? null,
          });
        } catch {
          // ignore if rpc is not yet available
        } finally {
          window.localStorage.removeItem("lodgemate_pending_role");
          window.localStorage.removeItem("lodgemate_pending_provider");
        }
      }
    }

    // Email signups that required confirmation may not have had a session
    // when the signup form first ran. Reconcile the intended provider role
    // from the confirmed user's metadata on their next authenticated load.
    const metadata = user.user_metadata ?? {};
    const metadataProvider = metadata.provider_type;
    const metadataRole = metadata.role;
    const intendedRole =
      metadataRole === "landlord" || metadataProvider === "agent" || metadataProvider === "landlord"
        ? "landlord"
        : metadataRole === "student"
          ? "student"
          : null;

    if (intendedRole) {
      const { error } = await supabase.rpc("sync_user_signup_role", {
        _role: intendedRole,
        _provider_type:
          intendedRole === "landlord" && (metadataProvider === "agent" || metadataProvider === "landlord")
            ? metadataProvider
            : null,
      });
      if (error) console.warn("Could not sync signup role:", error.message);
    }

    let profileData: Profile | null = null;
    try {
      const { data: fullProfile, error: fullProfileErr } = await supabase
        .from("profiles")
        .select("id, full_name, phone, school, provider_type, banned, avatar_url, business_name, operating_area, bio, verified")
        .eq("id", userId)
        .maybeSingle();

      if (!fullProfileErr && fullProfile) {
        profileData = fullProfile as unknown as Profile;
      } else if (fullProfileErr) {
        // Fallback to core columns if extended profile columns are not yet provisioned remotely
        const { data: baseProfile } = await supabase
          .from("profiles")
          .select("id, full_name, phone, school, provider_type, banned")
          .eq("id", userId)
          .maybeSingle();
        profileData = (baseProfile as Profile) ?? null;
      }
    } catch (err) {
      console.warn("Failed to retrieve profile data:", err);
    }

    // An approved provider application is authoritative even if the profile
    // verified flag was not synchronized by an older admin review path.
    try {
      const { data: approvedRequest, error: verificationError } = await (supabase as any)
        .from("provider_verification_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();
      if (!verificationError && approvedRequest && profileData) {
        profileData = { ...profileData, verified: true };
      }
    } catch (err) {
      console.warn("Failed to retrieve provider verification status:", err);
    }

    let userRoles: AppRole[] = [];
    try {
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      userRoles = ((r ?? []) as { role: AppRole }[]).map((row) => row.role);
    } catch (err) {
      console.warn("Failed to retrieve user roles:", err);
    }

    setProfile(profileData);
    setRoles(userRoles);
  };

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      void load(next?.user);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session?.user);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  const value = useMemo<AuthValue>(() => {
    const isAdmin = roles.includes("admin");
    const isHost = roles.includes("landlord") || isAdmin;
    const isStudent = roles.includes("student") || (!roles.includes("landlord") && !isAdmin);
    const providerType = profile?.provider_type ?? (isHost ? "landlord" : null);

    return {
      user: session?.user ?? null,
      session,
      profile,
      roles,
      loading,
      isAdmin,
      isHost,
      isStudent,
      isLandlord: roles.includes("landlord"),
      providerType,
      refresh: async () => {
        await load(session?.user);
      },
      signOut: async () => {
        if (supabaseConfigured) await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setRoles([]);
      },
    };
  }, [session, profile, roles, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
