import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { transformDatabaseListing, type Listing } from "@/lib/listings";

/**
 * Fetches the IDs of listings saved by the currently authenticated student.
 */
export async function fetchSavedListingIds(studentId?: string): Promise<string[]> {
  if (!isSupabaseConfigured() || !studentId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("saved_listings")
      .select("listing_id")
      .eq("student_id", studentId);

    if (error || !data) {
      return [];
    }

    return data.map((row) => row.listing_id);
  } catch {
    return [];
  }
}

/**
 * Fetches full listing records bookmarked by the currently authenticated student.
 */
export async function fetchSavedListings(studentId?: string): Promise<Listing[]> {
  if (!isSupabaseConfigured() || !studentId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("saved_listings")
      .select(`
        listing_id,
        created_at,
        listings:listing_id (
          *,
          profiles:owner_id(full_name, provider_type, created_at)
        )
      `)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    const validListings: Listing[] = [];
    for (const item of data) {
      if (item.listings) {
        validListings.push(transformDatabaseListing(item.listings as any));
      }
    }
    return validListings;
  } catch {
    return [];
  }
}

/**
 * Hook to retrieve the list of saved listing IDs for the active user.
 */
export function useSavedListingIds() {
  const { user, isStudent } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["saved-listing-ids", userId],
    queryFn: () => fetchSavedListingIds(userId),
    enabled: Boolean(userId && isStudent),
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Hook to retrieve all saved listings for the student's dashboard.
 */
export function useSavedListingsQuery() {
  const { user, isStudent } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["saved-listings-full", userId],
    queryFn: () => fetchSavedListings(userId),
    enabled: Boolean(userId && isStudent),
    staleTime: 1000 * 60 * 3,
  });
}

/**
 * Hook to toggle saving/unsaving a listing with optimistic updates.
 */
export function useToggleSaveListing() {
  const { user, isStudent } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listingId,
      currentlySaved,
    }: {
      listingId: string;
      currentlySaved: boolean;
    }) => {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured.");
      }
      if (!user) {
        throw new Error("Please sign in as a student to save lodges.");
      }
      if (!isStudent) {
        throw new Error("Only student accounts can save listings.");
      }

      if (currentlySaved) {
        const { error } = await supabase
          .from("saved_listings")
          .delete()
          .eq("student_id", user.id)
          .eq("listing_id", listingId);

        if (error) throw error;
        return { action: "removed", listingId };
      } else {
        const { error } = await supabase.from("saved_listings").insert({
          student_id: user.id,
          listing_id: listingId,
        });

        if (error) throw error;
        return { action: "saved", listingId };
      }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["saved-listing-ids", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["saved-listings-full", user?.id] });

      if (result.action === "saved") {
        toast.success("Lodge saved", {
          description: "Saved to your dashboard bookmarks for quick review.",
        });
      } else {
        toast.info("Lodge removed from saved list");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update saved listing");
    },
  });
}

