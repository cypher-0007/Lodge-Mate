-- Ensure approved provider applications grant listing access, even when an
-- earlier admin path failed to synchronize profiles.verified.
UPDATE public.profiles p
SET verified = true
WHERE EXISTS (
  SELECT 1
  FROM public.provider_verification_requests r
  WHERE r.user_id = p.id AND r.status = 'approved'
);

DROP POLICY IF EXISTS listings_insert_own ON public.listings;
CREATE POLICY listings_insert_own ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        status = 'pending'
        AND verified = false
        AND public.has_role(auth.uid(), 'landlord')
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.verified = true
          )
          OR EXISTS (
            SELECT 1 FROM public.provider_verification_requests r
            WHERE r.user_id = auth.uid() AND r.status = 'approved'
          )
        )
      )
      OR (
        status = 'pending'
        AND verified = false
        AND public.has_role(auth.uid(), 'student')
        AND kind IN ('Bedspace', 'Takeover')
      )
    )
  );
