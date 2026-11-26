-- Provider identity verification, private evidence storage, and review workflow.
-- The application fee is fixed at NGN 3,500 in the server-side checkout code.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.provider_verification_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('landlord', 'agent')),
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment', 'in_review', 'approved', 'rejected')),
  id_document_path text NOT NULL,
  selfie_path text NOT NULL,
  property_proof_path text NOT NULL,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_verification_one_active_per_user
  ON public.provider_verification_requests (user_id)
  WHERE status IN ('awaiting_payment', 'in_review', 'approved');

CREATE INDEX IF NOT EXISTS provider_verification_review_queue
  ON public.provider_verification_requests (status, submitted_at DESC);

ALTER TABLE public.provider_verification_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.provider_verification_requests TO authenticated;
GRANT ALL ON public.provider_verification_requests TO service_role;

DROP POLICY IF EXISTS provider_verification_read_own ON public.provider_verification_requests;
CREATE POLICY provider_verification_read_own
  ON public.provider_verification_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.provider_verification_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.provider_verification_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_reference text NOT NULL UNIQUE,
  amount_ngn integer NOT NULL CHECK (amount_ngn = 3500),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS provider_verification_payments_user
  ON public.provider_verification_payments (user_id, created_at DESC);

ALTER TABLE public.provider_verification_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.provider_verification_payments TO authenticated;
GRANT ALL ON public.provider_verification_payments TO service_role;

DROP POLICY IF EXISTS provider_verification_payments_read_own ON public.provider_verification_payments;
CREATE POLICY provider_verification_payments_read_own
  ON public.provider_verification_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Identity evidence is private. Applicants may write only under their own UUID folder;
-- only the applicant and LodgeMate admins can read the files.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-verification',
  'provider-verification',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS provider_verification_files_read ON storage.objects;
CREATE POLICY provider_verification_files_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS provider_verification_files_insert ON storage.objects;
CREATE POLICY provider_verification_files_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'provider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS provider_verification_files_update ON storage.objects;
CREATE POLICY provider_verification_files_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'provider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS provider_verification_files_delete ON storage.objects;
CREATE POLICY provider_verification_files_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.prevent_provider_self_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified IS DISTINCT FROM OLD.verified
     AND auth.uid() = OLD.id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only LodgeMate administrators can change provider verification status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_provider_self_verification ON public.profiles;
CREATE TRIGGER prevent_provider_self_verification
  BEFORE UPDATE OF verified ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_provider_self_verification();

CREATE OR REPLACE FUNCTION public.complete_provider_verification_payment(
  _payment_reference text,
  _verified_amount_ngn integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_row public.provider_verification_payments%ROWTYPE;
BEGIN
  SELECT * INTO payment_row
  FROM public.provider_verification_payments
  WHERE payment_reference = _payment_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider verification payment not found';
  END IF;

  IF payment_row.amount_ngn <> _verified_amount_ngn OR _verified_amount_ngn <> 3500 THEN
    RAISE EXCEPTION 'Provider verification payment amount does not match';
  END IF;

  IF payment_row.status = 'paid' THEN
    RETURN payment_row.request_id;
  END IF;

  IF payment_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Provider verification payment is not pending';
  END IF;

  UPDATE public.provider_verification_payments
  SET status = 'paid', paid_at = now()
  WHERE id = payment_row.id;

  UPDATE public.provider_verification_requests
  SET status = 'in_review', submitted_at = now(), updated_at = now()
  WHERE id = payment_row.request_id AND status = 'awaiting_payment';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider verification request is not awaiting payment';
  END IF;

  RETURN payment_row.request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_provider_verification_payment(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_provider_verification_payment(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.review_provider_verification(
  _request_id uuid,
  _approve boolean,
  _review_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only LodgeMate administrators can review provider verification';
  END IF;

  SELECT user_id INTO target_user_id
  FROM public.provider_verification_requests
  WHERE id = _request_id AND status = 'in_review'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider verification request is not awaiting review';
  END IF;

  UPDATE public.provider_verification_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      review_note = NULLIF(trim(_review_note), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = _request_id;

  UPDATE public.profiles
  SET verified = _approve
  WHERE id = target_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.review_provider_verification(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_provider_verification(uuid, boolean, text) TO authenticated;

-- Enforce provider verification at the database boundary as well as in the UI.
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
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.verified = true
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
