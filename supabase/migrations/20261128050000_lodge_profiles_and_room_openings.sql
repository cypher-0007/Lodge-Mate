CREATE TABLE IF NOT EXISTS public.lodge_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  school text NOT NULL DEFAULT 'MOUAU',
  area text NOT NULL,
  distance text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  front_photo_url text NOT NULL,
  compound_photo_url text NOT NULL,
  lobby_photo_url text NOT NULL,
  ownership_proof_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lodge_profiles_owner_created_idx
  ON public.lodge_profiles(owner_id, created_at DESC);

ALTER TABLE public.lodge_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.lodge_profiles TO authenticated;
GRANT SELECT ON public.lodge_profiles TO anon;
GRANT ALL ON public.lodge_profiles TO service_role;

DROP POLICY IF EXISTS lodge_profiles_read_public_or_owner ON public.lodge_profiles;
CREATE POLICY lodge_profiles_read_public_or_owner ON public.lodge_profiles
  FOR SELECT USING (
    status = 'approved'
    OR auth.uid() = owner_id
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS lodge_profiles_insert_provider ON public.lodge_profiles;
CREATE POLICY lodge_profiles_insert_provider ON public.lodge_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        public.has_role(auth.uid(), 'landlord')
        AND status = 'pending'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.verified = true
        )
      )
    )
  );

DROP POLICY IF EXISTS lodge_profiles_update_owner_pending ON public.lodge_profiles;
CREATE POLICY lodge_profiles_update_owner_pending ON public.lodge_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id AND status IN ('pending', 'rejected'))
  WITH CHECK (auth.uid() = owner_id AND status IN ('pending', 'rejected'));

DROP POLICY IF EXISTS lodge_profiles_update_admin ON public.lodge_profiles;
CREATE POLICY lodge_profiles_update_admin ON public.lodge_profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS lodge_profile_id uuid REFERENCES public.lodge_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_location text,
  ADD COLUMN IF NOT EXISTS room_image_urls text[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS listings_read_public ON public.listings;
CREATE POLICY listings_read_public ON public.listings
  FOR SELECT USING (
    status = 'approved'
    AND (
      lodge_profile_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.lodge_profiles lp
        WHERE lp.id = lodge_profile_id AND lp.status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS listings_insert_own ON public.listings;
CREATE POLICY listings_insert_own ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        status = 'pending' AND verified = false
        AND (
          public.has_role(auth.uid(), 'landlord')
          AND lodge_profile_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.lodge_profiles lp
            WHERE lp.id = lodge_profile_id AND lp.owner_id = auth.uid()
          )
          AND (
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.verified = true)
            OR EXISTS (SELECT 1 FROM public.provider_verification_requests r WHERE r.user_id = auth.uid() AND r.status = 'approved')
          )
          OR (
            public.has_role(auth.uid(), 'student')
            AND kind IN ('Bedspace', 'Takeover')
            AND lodge_profile_id IS NULL
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS listings_mark_taken_own ON public.listings;
CREATE POLICY listings_mark_taken_own ON public.listings
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id
    AND (
      (status = 'pending' AND verified = false)
      OR (status = 'approved' AND verified = true)
    )
  )
  WITH CHECK (auth.uid() = owner_id AND status = 'removed');

-- Keep the existing owner-edit policy from rejecting the same update when a
-- host changes an approved listing to removed (taken/off market).
DROP POLICY IF EXISTS listings_update_own ON public.listings;
CREATE POLICY listings_update_own ON public.listings
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (status = 'pending' AND verified = false)
      OR status = 'removed'
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_listing_lodge_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lodge_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lodge_profiles lp
    WHERE lp.id = NEW.lodge_profile_id AND lp.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'The selected lodge profile must belong to the listing owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_listing_lodge_owner ON public.listings;
CREATE TRIGGER trg_enforce_listing_lodge_owner
  BEFORE INSERT OR UPDATE OF lodge_profile_id, owner_id ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_listing_lodge_owner();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lodge-room-videos',
  'lodge-room-videos',
  true,
  52428800,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime'];

DROP POLICY IF EXISTS lodge_room_videos_public_read ON storage.objects;
CREATE POLICY lodge_room_videos_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'lodge-room-videos');

DROP POLICY IF EXISTS lodge_room_videos_upload_own ON storage.objects;
CREATE POLICY lodge_room_videos_upload_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lodge-room-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

