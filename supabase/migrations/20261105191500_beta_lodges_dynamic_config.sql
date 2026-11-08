-- ==============================================================================
-- Migration: Hardened Beta Lodges Dynamic Configuration, Payment Snapshots &
--            Media Security
-- ==============================================================================

-- 1. Beta nomination approval status enum
DO $$ BEGIN
  CREATE TYPE public.beta_approval_status AS ENUM ('none', 'pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Enhance listings table with Beta Lodge fields and protected details
ALTER TABLE public.listings 
  ADD COLUMN IF NOT EXISTS is_beta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_status public.beta_approval_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS provider_phone text,
  ADD COLUMN IF NOT EXISTS inspection_notes text;

-- 3. Configuration Table (Dynamic pricing, duration, and access switch)
CREATE TABLE IF NOT EXISTS public.beta_lodges_config (
  id text PRIMARY KEY CHECK (id = 'default') DEFAULT 'default',
  access_fee_ngn integer NOT NULL DEFAULT 1500 CHECK (access_fee_ngn >= 0),
  access_duration_days integer NOT NULL DEFAULT 30 CHECK (access_duration_days > 0),
  is_paid_access_enabled boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'NGN',
  title text NOT NULL DEFAULT 'Beta Lodges Access Pass',
  description text NOT NULL DEFAULT 'Direct contact, video walkthroughs, and verified inspection reports for premium student lodges.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.beta_lodges_config ENABLE ROW LEVEL SECURITY;

-- Grants for config: public can view prices, only service_role and admin can mutate
REVOKE ALL ON public.beta_lodges_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.beta_lodges_config TO anon, authenticated;
GRANT ALL ON public.beta_lodges_config TO service_role;

DROP POLICY IF EXISTS "beta_config_read_public" ON public.beta_lodges_config;
CREATE POLICY "beta_config_read_public"
  ON public.beta_lodges_config
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "beta_config_update_admin" ON public.beta_lodges_config;
CREATE POLICY "beta_config_update_admin"
  ON public.beta_lodges_config
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "beta_config_insert_admin" ON public.beta_lodges_config;
CREATE POLICY "beta_config_insert_admin"
  ON public.beta_lodges_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for config updated_at
DROP TRIGGER IF EXISTS beta_config_updated_at ON public.beta_lodges_config;
CREATE TRIGGER beta_config_updated_at
  BEFORE UPDATE ON public.beta_lodges_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial default configuration row
INSERT INTO public.beta_lodges_config (
  id,
  access_fee_ngn,
  access_duration_days,
  is_paid_access_enabled,
  currency,
  title,
  description
) VALUES (
  'default',
  1500,
  30,
  true,
  'NGN',
  'Beta Lodges Access Pass',
  'Direct contact, video walkthroughs, and verified inspection reports for premium student lodges.'
) ON CONFLICT (id) DO NOTHING;


-- 4. Access Passes Table (Strictly controlled backend issuance)
CREATE TABLE IF NOT EXISTS public.beta_access_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_reference text NOT NULL UNIQUE,
  payment_provider text NOT NULL DEFAULT 'paystack',
  amount_paid integer NOT NULL CHECK (amount_paid >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  duration_days integer NOT NULL CHECK (duration_days > 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_access_passes_user_expiry 
  ON public.beta_access_passes(user_id, expires_at, is_active);

ALTER TABLE public.beta_access_passes ENABLE ROW LEVEL SECURITY;

-- SECURITY HARDENING:
-- Students can ONLY SELECT their own passes.
-- Students CANNOT INSERT, UPDATE, or DELETE passes directly.
REVOKE ALL ON public.beta_access_passes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.beta_access_passes TO authenticated;
GRANT ALL ON public.beta_access_passes TO service_role;

DROP POLICY IF EXISTS "beta_passes_read_own" ON public.beta_access_passes;
CREATE POLICY "beta_passes_read_own"
  ON public.beta_access_passes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));


-- 5. Helper Function: Validate Beta Access
-- Returns true if paid access is globally disabled OR if user holds a valid, active pass.
-- Defaults to auth.uid() and prevents students from probing other users' access passes.
CREATE OR REPLACE FUNCTION public.has_valid_beta_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid_enabled boolean;
  has_pass boolean;
  target_id uuid;
BEGIN
  -- Determine target user (defaults to current session user)
  target_id := COALESCE(_user_id, auth.uid());

  -- 1. If paid access is disabled by admin, all users have access
  SELECT is_paid_access_enabled INTO paid_enabled
  FROM public.beta_lodges_config
  WHERE id = 'default';

  IF paid_enabled IS FALSE THEN
    RETURN true;
  END IF;

  -- 2. Unauthenticated check: If target_id is null, no access
  IF target_id IS NULL THEN
    RETURN false;
  END IF;

  -- 3. Privacy protection: If an authenticated user attempts to inspect ANOTHER user's status,
  -- only an admin is permitted to do so. Non-admins cannot probe other students' pass status.
  IF auth.uid() IS NOT NULL AND target_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;

  -- 4. Admins always have access
  IF public.has_role(target_id, 'admin') THEN
    RETURN true;
  END IF;

  -- 5. Check for active unexpired pass
  SELECT EXISTS (
    SELECT 1 FROM public.beta_access_passes
    WHERE user_id = target_id
      AND is_active = true
      AND expires_at > now()
  ) INTO has_pass;

  RETURN has_pass;
END;
$$;

REVOKE ALL ON FUNCTION public.has_valid_beta_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_valid_beta_access(uuid) TO anon, authenticated, service_role;


-- 6. Helper Function: Secure Backend Pass Issuance
-- Executed strictly by verified backend payment handler (Service Role)
CREATE OR REPLACE FUNCTION public.issue_verified_beta_pass(
  _user_id uuid,
  _payment_ref text,
  _provider text,
  _verified_amount_ngn integer
)
RETURNS public.beta_access_passes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.beta_lodges_config%ROWTYPE;
  new_pass public.beta_access_passes%ROWTYPE;
  starts_ts timestamptz := now();
  expires_ts timestamptz;
BEGIN
  -- Fetch current dynamic configuration
  SELECT * INTO cfg FROM public.beta_lodges_config WHERE id = 'default';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beta Lodges configuration not found';
  END IF;

  -- Validate amount against backend required fee
  IF _verified_amount_ngn < cfg.access_fee_ngn THEN
    RAISE EXCEPTION 'Verified amount (₦%) is less than required access fee (₦%)', _verified_amount_ngn, cfg.access_fee_ngn;
  END IF;

  -- Calculate exact expiry timestamp based on current duration days
  expires_ts := starts_ts + (cfg.access_duration_days || ' days')::interval;

  -- Insert pass record with snapshots of current price and duration
  INSERT INTO public.beta_access_passes (
    user_id,
    payment_reference,
    payment_provider,
    amount_paid,
    currency,
    duration_days,
    starts_at,
    expires_at,
    is_active
  ) VALUES (
    _user_id,
    _payment_ref,
    COALESCE(_provider, 'paystack'),
    _verified_amount_ngn,
    cfg.currency,
    cfg.access_duration_days,
    starts_ts,
    expires_ts,
    true
  )
  RETURNING * INTO new_pass;

  RETURN new_pass;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_verified_beta_pass(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_verified_beta_pass(uuid, text, text, integer) TO service_role;


-- 7. Public Preview View: Public Teasers for Beta Lodges
-- Sanitizes data: excludes provider_phone, video_url, and inspection_notes
CREATE OR REPLACE VIEW public.beta_lodges_preview AS
  SELECT 
    id,
    title,
    school,
    area,
    distance,
    price,
    period,
    image_url,
    description,
    amenities,
    verified,
    is_beta,
    beta_status,
    created_at
  FROM public.listings
  WHERE is_beta = true 
    AND beta_status = 'approved'
    AND status = 'approved';

GRANT SELECT ON public.beta_lodges_preview TO anon, authenticated;


-- 8. Secure RPC: Get Full Beta Lodge Details
-- Enforces server-side permission check before returning protected phone, video, and notes
CREATE OR REPLACE FUNCTION public.get_beta_lodge_details(_listing_id uuid)
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  title text,
  kind text,
  school text,
  area text,
  distance text,
  price integer,
  period text,
  image_url text,
  description text,
  amenities text[],
  verified boolean,
  is_beta boolean,
  beta_status public.beta_approval_status,
  video_url text,
  provider_phone text,
  inspection_notes text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_rec public.listings%ROWTYPE;
  can_access boolean := false;
BEGIN
  SELECT * INTO listing_rec FROM public.listings WHERE listings.id = _listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  -- Non-beta listings are freely accessible if approved
  IF listing_rec.is_beta IS NOT TRUE THEN
    can_access := true;
  -- If beta, verify access pass, ownership, or admin role
  ELSE
    IF auth.uid() = listing_rec.owner_id OR public.has_role(auth.uid(), 'admin') OR public.has_valid_beta_access(auth.uid()) THEN
      can_access := true;
    END IF;
  END IF;

  IF NOT can_access THEN
    RAISE EXCEPTION 'Access pass required to view full Beta Lodge details and video walkthroughs';
  END IF;

  RETURN QUERY
  SELECT 
    listing_rec.id,
    listing_rec.owner_id,
    listing_rec.title,
    listing_rec.kind,
    listing_rec.school,
    listing_rec.area,
    listing_rec.distance,
    listing_rec.price,
    listing_rec.period,
    listing_rec.image_url,
    listing_rec.description,
    listing_rec.amenities,
    listing_rec.verified,
    listing_rec.is_beta,
    listing_rec.beta_status,
    listing_rec.video_url,
    listing_rec.provider_phone,
    listing_rec.inspection_notes,
    listing_rec.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_beta_lodge_details(uuid) TO authenticated;


-- 9. Pending Payments Table: Checkout Configuration Snapshots
-- Records the exact price, currency and duration at checkout initiation.
-- Payment verification compares against THIS record, not the live config.
-- Prevents race conditions when admin changes pricing during active checkouts.
CREATE TABLE IF NOT EXISTS public.beta_pending_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_reference text NOT NULL UNIQUE,
  payment_provider text NOT NULL DEFAULT 'paystack',
  -- Configuration snapshot at time of checkout initiation
  snapshot_fee_ngn integer NOT NULL CHECK (snapshot_fee_ngn >= 0),
  snapshot_duration_days integer NOT NULL CHECK (snapshot_duration_days > 0),
  snapshot_currency text NOT NULL DEFAULT 'NGN',
  -- Lifecycle status: pending → completed | failed | expired | cancelled
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'cancelled')),
  -- Pending records expire after 2 hours to prevent stale checkout resurrection
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_pending_payments_user_status
  ON public.beta_pending_payments(user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_beta_pending_payments_reference
  ON public.beta_pending_payments(payment_reference);

ALTER TABLE public.beta_pending_payments ENABLE ROW LEVEL SECURITY;

-- Students: read own pending records only. Cannot insert, update, or delete directly.
REVOKE ALL ON public.beta_pending_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.beta_pending_payments TO authenticated;
GRANT ALL ON public.beta_pending_payments TO service_role;

DROP POLICY IF EXISTS "beta_pending_read_own" ON public.beta_pending_payments;
CREATE POLICY "beta_pending_read_own"
  ON public.beta_pending_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS beta_pending_updated_at ON public.beta_pending_payments;
CREATE TRIGGER beta_pending_updated_at
  BEFORE UPDATE ON public.beta_pending_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 10. RPC: Initiate Beta Checkout (service_role only)
-- Snapshots the current config, generates a pending payment record and returns it.
-- Called by the server-side checkout server function before redirecting to the payment gateway.
CREATE OR REPLACE FUNCTION public.initiate_beta_checkout(
  _user_id uuid,
  _payment_ref text,
  _provider text DEFAULT 'paystack'
)
RETURNS public.beta_pending_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.beta_lodges_config%ROWTYPE;
  pending public.beta_pending_payments%ROWTYPE;
BEGIN
  -- Fetch current dynamic configuration
  SELECT * INTO cfg FROM public.beta_lodges_config WHERE id = 'default';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beta Lodges configuration not found';
  END IF;

  -- Reject if paid access is currently disabled (no need for a pending record)
  IF cfg.is_paid_access_enabled IS FALSE THEN
    RAISE EXCEPTION 'Paid access is currently disabled; no payment required';
  END IF;

  -- Reject if the reference is already used (pending or completed)
  IF EXISTS (
    SELECT 1 FROM public.beta_pending_payments WHERE payment_reference = _payment_ref
    UNION ALL
    SELECT 1 FROM public.beta_access_passes WHERE payment_reference = _payment_ref
  ) THEN
    RAISE EXCEPTION 'Payment reference already exists';
  END IF;

  -- Create snapshot record
  INSERT INTO public.beta_pending_payments (
    user_id,
    payment_reference,
    payment_provider,
    snapshot_fee_ngn,
    snapshot_duration_days,
    snapshot_currency,
    status,
    expires_at
  ) VALUES (
    _user_id,
    _payment_ref,
    COALESCE(_provider, 'paystack'),
    cfg.access_fee_ngn,
    cfg.access_duration_days,
    cfg.currency,
    'pending',
    now() + interval '2 hours'
  )
  RETURNING * INTO pending;

  RETURN pending;
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_beta_checkout(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_beta_checkout(uuid, text, text) TO service_role;


-- 11. RPC: Confirm Pending Payment → Issue Access Pass (service_role only)
-- Verifies the pending record is valid, matches the actual payment amount, marks it complete,
-- and issues the access pass using the SNAPSHOT amounts (not the live config).
CREATE OR REPLACE FUNCTION public.confirm_beta_pending_payment(
  _payment_ref text,
  _verified_amount_ngn integer,
  _user_id uuid
)
RETURNS public.beta_access_passes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pend public.beta_pending_payments%ROWTYPE;
  new_pass public.beta_access_passes%ROWTYPE;
  starts_ts timestamptz := now();
  expires_ts timestamptz;
BEGIN
  -- Lock the pending record for this reference to prevent concurrent duplicate verification
  SELECT * INTO pend
  FROM public.beta_pending_payments
  WHERE payment_reference = _payment_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending payment found for reference: %', _payment_ref;
  END IF;

  -- Verify ownership: the verifying user must match the initiating user
  IF pend.user_id <> _user_id THEN
    RAISE EXCEPTION 'Payment reference does not belong to this user';
  END IF;

  -- Reject if the pending record is no longer in pending state
  IF pend.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending payment is in status ''%'' and cannot be completed', pend.status;
  END IF;

  -- Reject if the checkout session has expired (student took longer than 2 hours).
  -- NOTE: RAISE EXCEPTION aborts the outer transaction, so a status UPDATE here
  -- would be rolled back. Expiry is already marked by the application layer before
  -- this function is called; this check is a secondary DB-level defence only.
  IF pend.expires_at < now() THEN
    RAISE EXCEPTION 'Checkout session has expired. Please start a new checkout.';
  END IF;

  -- Validate verified amount against the SNAPSHOT fee (not the live config)
  IF _verified_amount_ngn < pend.snapshot_fee_ngn THEN
    RAISE EXCEPTION
      'Verified amount (₦%) is less than the checkout snapshot fee (₦%)',
      _verified_amount_ngn, pend.snapshot_fee_ngn;
  END IF;

  -- Calculate expiry using the SNAPSHOT duration (not the live config)
  expires_ts := starts_ts + (pend.snapshot_duration_days || ' days')::interval;

  -- Issue the access pass
  INSERT INTO public.beta_access_passes (
    user_id,
    payment_reference,
    payment_provider,
    amount_paid,
    currency,
    duration_days,
    starts_at,
    expires_at,
    is_active
  ) VALUES (
    pend.user_id,
    pend.payment_reference,
    pend.payment_provider,
    _verified_amount_ngn,
    pend.snapshot_currency,
    pend.snapshot_duration_days,
    starts_ts,
    expires_ts,
    true
  )
  RETURNING * INTO new_pass;

  -- Mark pending record as completed
  UPDATE public.beta_pending_payments SET status = 'completed' WHERE id = pend.id;

  RETURN new_pass;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_beta_pending_payment(text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_beta_pending_payment(text, integer, uuid) TO service_role;


-- 12. Storage Security: Protected Bucket for Private Beta Media
-- Creates the bucket if not exists and locks it down via storage.objects RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('beta-media', 'beta-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Users can only read beta-media if they have valid beta access, own the object, or are admins
DROP POLICY IF EXISTS "beta_media_access" ON storage.objects;
CREATE POLICY "beta_media_access"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'beta-media' AND (
      public.has_valid_beta_access(auth.uid()) OR
      public.has_role(auth.uid(), 'admin') OR
      auth.uid()::text = (storage.foldername(name))[1]
    )
  );
