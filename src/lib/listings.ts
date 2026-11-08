import { useQuery } from "@tanstack/react-query";

import apartmentImage from "@/assets/listing-apartment.jpg";
import bedspaceImage from "@/assets/listing-bedspace.jpg";
import lodgeImage from "@/assets/listing-lodge.jpg";
import selfconImage from "@/assets/listing-selfcon.jpg";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type ListingKind = "Full lodge" | "Bedspace" | "Takeover";
export type Campus = "MOUAU" | "ABSU";

export type ListingHost = {
  name: string;
  role: string;
  since: string;
};

export type Listing = {
  id: string;
  title: string;
  kind: ListingKind;
  school: Campus;
  area: string;
  distance: string;
  price: string;
  rawPrice: number;
  period: string;
  image: string;
  verified: boolean;
  amenities: string[];
  description: string;
  host: ListingHost;
  ownerId?: string;
  isBeta?: boolean;
  createdAt?: string;
};

export const fallbackImages: Record<string, string> = {
  "Full lodge": lodgeImage,
  Bedspace: bedspaceImage,
  Takeover: apartmentImage,
  default: selfconImage,
};

export function getFallbackImage(kind?: string | null): string {
  if (!kind) return fallbackImages["default"] ?? selfconImage;
  return fallbackImages[kind] ?? fallbackImages["default"] ?? selfconImage;
}

export function formatPrice(amount: number | string): string {
  const num = typeof amount === "number" ? amount : Number(amount) || 0;
  return `₦${num.toLocaleString("en-NG")}`;
}

/**
 * High-fidelity sample student accommodations for safe local development preview.
 * Strictly used when Supabase is not connected in local development.
 */
export const mockListings: Listing[] = [
  {
    id: "palmview-selfcon",
    title: "PalmView Self-Con, Ishiagu Gate",
    kind: "Full lodge",
    school: "MOUAU",
    area: "Ishiagu",
    distance: "6 min walk",
    price: "₦280,000",
    rawPrice: 280000,
    period: "per year",
    image: selfconImage,
    verified: true,
    amenities: ["Prepaid meter", "Borehole water", "Tiled floor", "Wardrobe", "Bathroom ensuite"],
    description:
      "Newly finished self-contained room in a 12-room lodge just off Ishiagu gate. Prepaid meter, steady borehole water, private balcony and a fenced compound with a caretaker on site.",
    host: { name: "Mr. Emeka O.", role: "Landlord", since: "Host since 2023" },
  },
  {
    id: "ziks-bedspace",
    title: "Bedspace in 2-man room, Zik's Flat",
    kind: "Bedspace",
    school: "ABSU",
    area: "Uturu",
    distance: "10 min bike",
    price: "₦95,000",
    rawPrice: 95000,
    period: "per session",
    image: bedspaceImage,
    verified: true,
    amenities: ["Female only", "Fenced gate", "Study desk", "Shared kitchen", "Steady power"],
    description:
      "One bedspace open in a quiet 2-man room shared with a 300-level student. Female only, study desks included, clean shared kitchen, and rent covers the full academic session.",
    host: { name: "Chiamaka N.", role: "Student Host", since: "Verified Student" },
  },
  {
    id: "umudike-takeover",
    title: "Tenancy Takeover: 1-Bedroom, 7 Months Left",
    kind: "Takeover",
    school: "MOUAU",
    area: "Umudike",
    distance: "12 min walk",
    price: "₦185,000",
    rawPrice: 185000,
    period: "remaining tenancy",
    image: apartmentImage,
    verified: false,
    amenities: ["Separate kitchen", "Water heater", "Parking space", "Balcony"],
    description:
      "Graduating and transferring the remaining 7 months on my one-bedroom apartment. Modern fittings stay, landlord has agreed to the transfer — paperwork completed at inspection.",
    host: { name: "Ifeanyi A.", role: "Current Tenant", since: "Awaiting Verification" },
  },
  {
    id: "green-court",
    title: "Green Court Lodge — 4 Rooms Available",
    kind: "Full lodge",
    school: "ABSU",
    area: "Uturu Main Road",
    distance: "4 min walk",
    price: "₦210,000",
    rawPrice: 210000,
    period: "per year",
    image: lodgeImage,
    verified: true,
    amenities: ["Gated security", "Solar backup", "Prepaid meter", "Water tank", "Waste disposal"],
    description:
      "Purpose-built student lodge on Uturu main road with 24-hour security, solar backup for lights and fans, and four rooms still open for the upcoming university session.",
    host: { name: "Bright Homes Agency", role: "Verified Agent", since: "42 listings hosted" },
  },
  {
    id: "scholar-bedspace",
    title: "Shared Room Bedspace near Western Gate",
    kind: "Bedspace",
    school: "MOUAU",
    area: "Western Gate",
    distance: "5 min walk",
    price: "₦110,000",
    rawPrice: 110000,
    period: "per session",
    image: bedspaceImage,
    verified: true,
    amenities: ["Male only", "Generator backup", "Tiled", "Borehole"],
    description:
      "Prime location directly by Western Gate. Spacious shared room with one mature roommate (400L Agriculture). Generator runs on exam schedules, private wardrobe spaces.",
    host: { name: "Kalu E.", role: "Student Host", since: "Verified Student" },
  },
  {
    id: "hilltop-selfcon",
    title: "Hilltop Executive Self-Con, ABSU Gate",
    kind: "Full lodge",
    school: "ABSU",
    area: "Hilltop / Main Gate",
    distance: "7 min walk",
    price: "₦250,000",
    rawPrice: 250000,
    period: "per year",
    image: lodgeImage,
    verified: true,
    amenities: ["Fully tiled", "Prepaid meter", "Security guard", "Constant water", "POP ceiling"],
    description:
      "Modern executive self-contained room with POP ceiling, private kitchen and bathroom, fenced perimeter with night security guard, and clean borehole water supply.",
    host: { name: "Chief Nwosu", role: "Landlord", since: "Host since 2022" },
  },
];

// Preserved for backwards compatibility with existing imports
export const listings: Listing[] = mockListings;

/**
 * Checks whether the application is running in local development preview mode
 * (i.e. local development environment with Supabase not yet configured).
 */
export function isLocalDevPreview(): boolean {
  return Boolean(import.meta.env.DEV && !isSupabaseConfigured());
}

type DatabaseListingRow = {
  id: string;
  owner_id: string;
  title: string;
  kind: string;
  school: string;
  area: string;
  distance: string;
  price: number;
  period: string;
  image_url: string | null;
  description: string;
  amenities: string[];
  verified: boolean;
  status: string;
  is_beta?: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
    provider_type: string | null;
    created_at?: string;
  } | null;
};

/**
 * Transforms a Supabase database row into the strongly typed application `Listing` model.
 */
export function transformDatabaseListing(row: DatabaseListingRow): Listing {
  const kind = (
    ["Full lodge", "Bedspace", "Takeover"].includes(row.kind) ? row.kind : "Full lodge"
  ) as ListingKind;

  const school = (row.school === "ABSU" ? "ABSU" : "MOUAU") as Campus;
  const image = row.image_url?.trim() ? row.image_url : getFallbackImage(kind);

  let hostRole = "Host";
  if (row.profiles?.provider_type === "agent") {
    hostRole = "Independent Agent";
  } else if (row.profiles?.provider_type === "landlord") {
    hostRole = "Landlord";
  } else if (kind === "Bedspace" || kind === "Takeover") {
    hostRole = "Student Host";
  } else {
    hostRole = "Property Host";
  }

  const hostName = row.profiles?.full_name?.trim() || "Verified Host";

  return {
    id: row.id,
    title: row.title,
    kind,
    school,
    area: row.area || "Campus Area",
    distance: row.distance || "Near campus",
    price: formatPrice(row.price),
    rawPrice: Number(row.price) || 0,
    period: row.period || "per year",
    image,
    verified: Boolean(row.verified),
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    description: row.description || "No description provided.",
    ownerId: row.owner_id,
    isBeta: Boolean(row.is_beta),
    createdAt: row.created_at,
    host: {
      name: hostName,
      role: hostRole,
      since: "Verified on LodgeMate",
    },
  };
}

/**
 * Fetches all approved listings.
 * - In production: strictly queries Supabase; never shows demo data.
 * - In local development: safely falls back to demo data only when Supabase is not connected.
 */
export async function fetchListings(): Promise<Listing[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from("listings")
      .select("*, profiles:owner_id(full_name, provider_type, created_at)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database query failed in fetchListings:", error);
      throw new Error(error.message || "Failed to load listings from database.");
    }

    if (!data || data.length === 0) {
      return [];
    }

    return (data as unknown as DatabaseListingRow[]).map(transformDatabaseListing);
  }

  // Safe local-only development preview mode
  if (import.meta.env.DEV) {
    return mockListings;
  }

  throw new Error("Supabase connection is not configured. Live listings cannot be retrieved.");
}

/**
 * Fetches an approved listing by its ID.
 * - In production: strictly queries Supabase; returns null if not found.
 * - In local development: checks mockListings if Supabase is unconfigured.
 */
export async function fetchListingById(id: string): Promise<Listing | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from("listings")
      .select("*, profiles:owner_id(full_name, provider_type, created_at)")
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();

    if (error) {
      console.error("Database query failed in fetchListingById:", error);
      throw new Error(error.message || "Failed to retrieve listing details.");
    }

    if (!data) {
      return null;
    }

    return transformDatabaseListing(data as unknown as DatabaseListingRow);
  }

  // Safe local-only development preview mode
  if (import.meta.env.DEV) {
    const match = mockListings.find((l) => l.id === id);
    return match ?? null;
  }

  return null;
}

/**
 * Backward compatible getListing helper
 */
export const getListing = (id: string) => mockListings.find((l) => l.id === id);

/**
 * React Query hook for fetching approved live listings.
 */
export function useListingsQuery() {
  return useQuery({
    queryKey: ["live-listings"],
    queryFn: fetchListings,
    initialData: isLocalDevPreview() ? mockListings : undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * React Query hook for fetching a single listing by ID.
 */
export function useListingQuery(id: string) {
  return useQuery({
    queryKey: ["listing-detail", id],
    queryFn: () => fetchListingById(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
}
