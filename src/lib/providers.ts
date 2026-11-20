import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type ProviderType = "landlord" | "agent";

export type AccommodationProvider = {
  id: string;
  fullName: string;
  providerType: ProviderType;
  businessName?: string | null | undefined;
  operatingArea?: string | null | undefined;
  bio?: string | null | undefined;
  school?: string | null | undefined;
  verified: boolean;
  avatarUrl?: string | null | undefined;
  createdAt?: string | null | undefined;
};

/**
 * Sample accommodation providers for local development preview mode only.
 * Strictly used when Supabase is not connected in local development.
 */
export const mockProviders: AccommodationProvider[] = [
  {
    id: "mock-provider-1",
    fullName: "Mr. Emeka Okonkwo",
    providerType: "landlord",
    businessName: "PalmView Lodges & Suites",
    operatingArea: "Ishiagu Gate, MOUAU",
    school: "MOUAU",
    bio: "Host and property caretaker since 2023. Dedicated to safe and reliable student accommodation near MOUAU campus.",
    verified: true,
    avatarUrl: null,
    createdAt: "2023-01-15T00:00:00Z",
  },
  {
    id: "mock-provider-2",
    fullName: "Bright Homes Agency",
    providerType: "agent",
    businessName: "Bright Homes Student Housing Agency",
    operatingArea: "Uturu Main Road, ABSU",
    school: "ABSU",
    bio: "Registered housing representative for student hostels and lodges across Uturu. Over 40 verified listings hosted.",
    verified: true,
    avatarUrl: null,
    createdAt: "2022-08-10T00:00:00Z",
  },
  {
    id: "mock-provider-3",
    fullName: "Chief Nwosu",
    providerType: "landlord",
    businessName: "Hilltop Executive Properties",
    operatingArea: "Hilltop / ABSU Main Gate",
    school: "ABSU",
    bio: "Private landlord managing executive self-contained student units with on-site security and steady borehole water.",
    verified: true,
    avatarUrl: null,
    createdAt: "2022-03-20T00:00:00Z",
  },
  {
    id: "mock-provider-4",
    fullName: "Chiamaka N.",
    providerType: "agent",
    businessName: "Campus Link Accommodations",
    operatingArea: "Zik's Flat, Uturu",
    school: "ABSU",
    bio: "Independent student housing liaison helping undergraduate students find verified flatshares and bedspaces.",
    verified: false,
    avatarUrl: null,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "mock-provider-5",
    fullName: "Ifeanyi Alvan",
    providerType: "agent",
    businessName: "Umudike Student Realty",
    operatingArea: "Umudike / Western Gate",
    school: "MOUAU",
    bio: "Facilitating tenancy takeovers, self-con lodges and bedspaces directly with campus landlords.",
    verified: false,
    avatarUrl: null,
    createdAt: "2024-05-12T00:00:00Z",
  },
];

type DatabaseProviderRow = {
  id: string;
  full_name: string | null;
  provider_type: string | null;
  business_name?: string | null;
  operating_area?: string | null;
  bio?: string | null;
  school?: string | null;
  verified?: boolean | null;
  avatar_url?: string | null;
  created_at?: string;
};

/**
 * Fetches all accommodation providers (landlords and independent agents) from Supabase.
 * - In production: strictly queries Supabase; never shows mock data.
 * - In local development: safely falls back to sample providers only when Supabase is unconfigured.
 * - Privacy: Never requests or exposes private phone numbers or emails.
 */
export async function fetchProviders(): Promise<AccommodationProvider[]> {
  if (isSupabaseConfigured()) {
    try {
      // 1. Primary query with extended public discovery columns
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, provider_type, business_name, operating_area, bio, verified, avatar_url, school, created_at")
        .in("provider_type", ["landlord", "agent"])
        .eq("banned", false)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback to core columns if extended profile columns (business_name, operating_area, verified)
        // are not yet provisioned on the remote database.
        console.warn("Notice: Querying providers with baseline profile columns:", error.message);
        const { data: baseData, error: baseError } = await supabase
          .from("profiles")
          .select("id, full_name, provider_type, school, created_at")
          .in("provider_type", ["landlord", "agent"])
          .eq("banned", false)
          .order("created_at", { ascending: false });

        if (baseError) {
          console.error("Failed to fetch baseline providers:", baseError);
          throw new Error(baseError.message || "Failed to load accommodation providers.");
        }

        if (!baseData || baseData.length === 0) return [];

        return (baseData as unknown as DatabaseProviderRow[]).map((row) => ({
          id: row.id,
          fullName: row.full_name?.trim() || (row.provider_type === "agent" ? "Independent Agent" : "Landlord"),
          providerType: (row.provider_type === "agent" ? "agent" : "landlord") as ProviderType,
          businessName: null,
          operatingArea: null,
          bio: null,
          school: row.school || null,
          verified: false,
          avatarUrl: null,
          createdAt: row.created_at ?? null,
        }));
      }

      if (!data || data.length === 0) return [];

      return (data as unknown as DatabaseProviderRow[]).map((row) => ({
        id: row.id,
        fullName: row.full_name?.trim() || (row.provider_type === "agent" ? "Independent Agent" : "Landlord"),
        providerType: (row.provider_type === "agent" ? "agent" : "landlord") as ProviderType,
        businessName: row.business_name?.trim() || null,
        operatingArea: row.operating_area?.trim() || null,
        bio: row.bio?.trim() || null,
        school: row.school || null,
        verified: Boolean(row.verified),
        avatarUrl: row.avatar_url || null,
        createdAt: row.created_at ?? null,
      }));
    } catch (err) {
      console.error("Database query failed in fetchProviders:", err);
      // In production, strictly throw error and never fabricate data
      if (!import.meta.env.DEV) {
        throw err;
      }
    }
  }

  // Safe local-only development preview mode when Supabase credentials are not connected
  if (import.meta.env.DEV) {
    return mockProviders;
  }

  return [];
}

/**
 * React Query hook for fetching registered accommodation providers.
 */
export function useProvidersQuery() {
  const isLocalDev = Boolean(import.meta.env.DEV && !isSupabaseConfigured());
  return useQuery({
    queryKey: ["live-providers"],
    queryFn: fetchProviders,
    initialData: isLocalDev ? mockProviders : undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

