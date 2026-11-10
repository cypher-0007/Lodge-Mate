import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type PaymentProvider = "paystack" | "flutterwave";

export type BetaLodgesConfig = {
  id: string;
  access_fee_ngn: number;
  access_duration_days: number;
  is_paid_access_enabled: boolean;
  currency: string;
  title: string;
  description: string;
  updated_at: string;
};

export type BetaAccessPass = {
  id: string;
  user_id: string;
  payment_reference: string;
  payment_provider: string;
  amount_paid: number;
  currency: string;
  duration_days: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
};

/**
 * Public preview representation of a Beta Lodge.
 * Does NOT expose provider phone number, private video URLs, or internal quality notes.
 */
export type BetaLodgePreview = {
  id: string;
  title: string;
  school: string;
  area: string;
  distance: string;
  price: number;
  period: string;
  image_url: string | null;
  description: string;
  amenities: string[];
  verified: boolean;
  is_beta: boolean;
  beta_status: "none" | "pending" | "approved" | "rejected";
  created_at: string;
};

/**
 * Complete Beta Lodge details unlocked only with active Beta Access Pass or provider ownership.
 */
export type BetaLodgeFullDetails = BetaLodgePreview & {
  owner_id: string;
  video_url: string | null;
  provider_phone: string | null;
  inspection_notes: string | null;
};

/**
 * Pending payment record created when a student initiates checkout.
 * Contains the configuration snapshot that will be used for payment verification.
 */
export type BetaPendingPayment = {
  id: string;
  user_id: string;
  payment_reference: string;
  payment_provider: string;
  snapshot_fee_ngn: number;
  snapshot_duration_days: number;
  snapshot_currency: string;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

/**
 * Provisional fallback configuration used if database connection is offline or during SSR before hydration.
 * ₦1,500 and 30 days are provisional defaults; the production system always fetches live values dynamically from the Supabase backend.
 */
export const FALLBACK_BETA_CONFIG: BetaLodgesConfig = {
  id: "default",
  access_fee_ngn: 1500, // Provisional default
  access_duration_days: 30, // Provisional default
  is_paid_access_enabled: true,
  currency: "NGN",
  title: "Beta Lodges Access Pass",
  description:
    "Direct contact, video walkthroughs, and verified inspection reports for premium student lodges.",
  updated_at: new Date().toISOString(),
};

/**
 * Fetches the active Beta Lodges dynamic configuration from Supabase.
 */
export async function fetchBetaLodgesConfig(): Promise<BetaLodgesConfig> {
  if (!isSupabaseConfigured()) {
    return FALLBACK_BETA_CONFIG;
  }

  try {
    const { data, error } = await supabase
      .from("beta_lodges_config")
      .select("id, access_fee_ngn, access_duration_days, is_paid_access_enabled, currency, title, description, updated_at")
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) {
      return FALLBACK_BETA_CONFIG;
    }

    return data as BetaLodgesConfig;
  } catch {
    return FALLBACK_BETA_CONFIG;
  }
}

/**
 * React Query hook to fetch and subscribe to dynamic Beta Lodges pricing & configuration.
 */
export function useBetaLodgesConfig() {
  return useQuery({
    queryKey: ["beta-lodges-config"],
    queryFn: fetchBetaLodgesConfig,
    placeholderData: FALLBACK_BETA_CONFIG,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Checks if a specific user has active Beta Lodges access.
 * Returns true if paid access is globally turned off or if user has an active, unexpired pass.
 */
export async function checkUserBetaAccess(userId?: string | null): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  // 1. Fetch config to check if paid access is enabled
  const config = await fetchBetaLodgesConfig();
  if (!config.is_paid_access_enabled) {
    return true; // Free access when paid access is toggled off
  }

  if (!userId) {
    return false;
  }

  try {
    // 2. Query valid pass for this user
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("beta_access_passes")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .gt("expires_at", nowIso)
      .limit(1);

    if (error || !data || data.length === 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * React Query hook to check current user's Beta Lodges access status.
 */
export function useUserBetaAccess(userId?: string | null) {
  return useQuery({
    queryKey: ["user-beta-access", userId],
    queryFn: () => checkUserBetaAccess(userId),
    enabled: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetches the user's most recently issued active access pass (for display purposes).
 */
export async function fetchUserBetaPass(userId?: string | null): Promise<BetaAccessPass | null> {
  if (!userId || !isSupabaseConfigured()) return null;
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("beta_access_passes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as BetaAccessPass;
  } catch {
    return null;
  }
}

/**
 * React Query hook to get the user's active access pass details.
 */
export function useUserBetaPass(userId?: string | null) {
  return useQuery({
    queryKey: ["beta-access-pass", userId],
    queryFn: () => fetchUserBetaPass(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Whether the application is running in local development mode without a configured Supabase backend.
 * Guaranteed to return false in any production build.
 */
export function isLocalBetaDevPreview(): boolean {
  return Boolean(import.meta.env.DEV && !isSupabaseConfigured());
}

/**
 * Demo Beta Lodge previews for local development (no Supabase connection).
 * Strictly gated by isLocalBetaDevPreview(); never shown in production.
 */
export const demoBetaLodges: BetaLodgePreview[] = [
  {
    id: "demo-beta-1",
    title: "Premium Self-Contain — Umuahia Road",
    school: "MOUAU",
    area: "Umuahia Road",
    distance: "5 min walk",
    price: 180000,
    period: "year",
    image_url: null,
    description: "Spacious self-contained lodge with private bathroom, 24/7 water supply and direct provider contact after access purchase.",
    amenities: ["Private bathroom", "24/7 water", "Security gate", "Video walkthrough"],
    verified: true,
    is_beta: true,
    beta_status: "approved",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-beta-2",
    title: "2-Room Apartment — Umudike Axis",
    school: "MOUAU",
    area: "Umudike Axis",
    distance: "8 min walk",
    price: 250000,
    period: "year",
    image_url: null,
    description: "Spacious 2-room apartment with dedicated living area. Provider's contact and private video walkthrough available with Beta access pass.",
    amenities: ["Living room", "Borehole water", "NEPA connection", "Inspection notes"],
    verified: true,
    is_beta: true,
    beta_status: "approved",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-beta-3",
    title: "Shared Lodge — ABSU Gate Area",
    school: "ABSU",
    area: "Gate Area",
    distance: "3 min walk",
    price: 95000,
    period: "year",
    image_url: null,
    description: "Well-maintained shared lodge near ABSU main gate with strong landlord reputation. Direct contact number and 360° video tour available.",
    amenities: ["Shared kitchen", "Water tank", "Genset backup", "Video tour"],
    verified: false,
    is_beta: true,
    beta_status: "approved",
    created_at: new Date().toISOString(),
  },
];

/**
 * Fetches public preview teasers for Beta Lodges.
 * Safe for unauthenticated students and users without an active pass.
 */
export async function fetchBetaLodgesPreview(): Promise<BetaLodgePreview[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("beta_lodges_preview")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as BetaLodgePreview[];
  } catch {
    return [];
  }
}

/**
 * React Query hook for Beta Lodges public previews.
 */
export function useBetaLodgesPreview() {
  return useQuery({
    queryKey: ["beta-lodges-preview"],
    queryFn: fetchBetaLodgesPreview,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Securely fetches complete Beta Lodge details including provider phone, private video, and notes.
 * Enforces PostgreSQL database-level permission check via get_beta_lodge_details RPC.
 * If unauthorized, the database raises an exception and no protected fields are leaked.
 */
export async function fetchBetaLodgeFullDetails(listingId: string): Promise<{
  data: BetaLodgeFullDetails | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error("Supabase is not configured") };
  }

  try {
    const { data, error } = await supabase.rpc("get_beta_lodge_details", {
      _listing_id: listingId,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const listing = Array.isArray(data) ? data[0] : data;
    return { data: listing as BetaLodgeFullDetails, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Failed to load listing details"),
    };
  }
}

/**
 * Step 1 of the payment lifecycle: initiates a secure checkout session.
 *
 * Calls the backend to snapshot the current Beta Lodges configuration and
 * register a pending payment record for this payment reference.
 *
 * The returned `snapshotFeeNgn` MUST be used to initialise the payment gateway
 * (e.g. Paystack popup or redirect). Do NOT use locally-cached config values
 * for the payment amount — always use the value returned here.
 */
export async function initiateCheckout({
  paymentReference,
  provider = "paystack",
}: {
  paymentReference: string;
  provider?: PaymentProvider;
}): Promise<{
  success: boolean;
  pending?: BetaPendingPayment;
  snapshotFeeNgn?: number;
  snapshotDurationDays?: number;
  snapshotCurrency?: string;
  error?: string;
}> {
  try {
    const { initiateBetaCheckoutServerFn } = await import("@/lib/payment-server-fn");
    const result = await initiateBetaCheckoutServerFn({
      data: { paymentReference, provider },
    });
    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to initiate checkout session",
    };
  }
}

/**
 * Step 2 of the payment lifecycle: verifies payment reference on the backend
 * with Paystack/Flutterwave and issues the access pass.
 *
 * The backend compares the actual transaction amount against the SNAPSHOT
 * recorded during `initiateCheckout()` — not the live configuration. This
 * ensures admin price changes after checkout initiation do not affect the student.
 *
 * Never executes a client-side database insert.
 */
export async function verifyAndActivateBetaPass({
  paymentReference,
  provider = "paystack",
}: {
  paymentReference: string;
  provider?: PaymentProvider;
}): Promise<{ success: boolean; pass?: BetaAccessPass; error?: string }> {
  try {
    const { verifyBetaPaymentServerFn } = await import("@/lib/payment-server-fn");
    const result = await verifyBetaPaymentServerFn({
      data: { paymentReference, provider },
    });
    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Payment verification request failed",
    };
  }
}

/**
 * Format dynamic Naira price.
 */
export function formatBetaPrice(amount: number, currency = "NGN"): string {
  const prefix = currency === "NGN" ? "₦" : `${currency} `;
  return `${prefix}${amount.toLocaleString("en-NG")}`;
}

/**
 * Format access duration in human-readable terms.
 */
export function formatBetaDuration(days: number): string {
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? "1 month (30 days)" : `${months} months (${days} days)`;
  }
  return `${days} days`;
}

/**
 * Converts dynamic Naira fee to Kobo (for Paystack / payment provider integration).
 * 1 NGN = 100 Kobo.
 */
export function getFeeInKobo(feeNgn: number): number {
  return Math.round(feeNgn * 100);
}
