ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS available_rooms integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ownership_proof_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_available_rooms_positive'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_available_rooms_positive CHECK (available_rooms > 0);
  END IF;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lodge-ownership-proofs',
  'lodge-ownership-proofs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lodge_ownership_proofs_upload_own" ON storage.objects;
CREATE POLICY "lodge_ownership_proofs_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lodge-ownership-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
  );

DROP POLICY IF EXISTS "lodge_ownership_proofs_read_own_or_admin" ON storage.objects;
CREATE POLICY "lodge_ownership_proofs_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lodge-ownership-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
