-- ==============================================================================
-- Migration: Student Saved Listings (Favorites / Bookmarks)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_listings_student 
  ON public.saved_listings(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_listings_listing 
  ON public.saved_listings(listing_id);

ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

-- Security Hardening:
-- Only authenticated users can interact with saved_listings.
-- Students can only read and delete their own saved listings.
-- Students (or admins) can insert their own saved listings.
REVOKE ALL ON public.saved_listings FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.saved_listings TO authenticated;
GRANT ALL ON public.saved_listings TO service_role;

DROP POLICY IF EXISTS "saved_listings_read_own" ON public.saved_listings;
CREATE POLICY "saved_listings_read_own" ON public.saved_listings
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "saved_listings_insert_own" ON public.saved_listings;
CREATE POLICY "saved_listings_insert_own" ON public.saved_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND (public.has_role(auth.uid(), 'student') OR public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "saved_listings_delete_own" ON public.saved_listings;
CREATE POLICY "saved_listings_delete_own" ON public.saved_listings
  FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

