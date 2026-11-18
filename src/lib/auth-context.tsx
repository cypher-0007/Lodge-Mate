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

  const load = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }

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
      void load(next?.user.id);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session?.user.id);
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
        await load(session?.user.id);
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
