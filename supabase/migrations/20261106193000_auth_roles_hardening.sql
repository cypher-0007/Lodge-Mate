-- ==============================================================================
-- Migration: Auth Roles Hardening & Provider Type Differentiation
-- ==============================================================================

-- 1. Add provider_type to profiles if not exists ('landlord' or 'agent')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provider_type text CHECK (provider_type IN ('landlord', 'agent'));

-- 2. Update handle_new_user() to record provider_type from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requested_role text;
  requested_provider text;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  IF requested_role NOT IN ('student','landlord') THEN 
    requested_role := 'student'; 
  END IF;

  requested_provider := NEW.raw_user_meta_data->>'provider_type';
  IF requested_provider NOT IN ('landlord', 'agent') THEN
    IF requested_role = 'landlord' THEN
      requested_provider := 'landlord';
    ELSE
      requested_provider := null;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, school, provider_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'school',
    requested_provider
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    provider_type = COALESCE(EXCLUDED.provider_type, public.profiles.provider_type);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

-- 3. Backend Role Enforcement & Approval Safeguards for Listings
-- Landlords can list any space; students can list shared bedspaces and takeovers.
-- Non-admin owners can only insert with status = 'pending' and verified = false.
DROP POLICY IF EXISTS "listings_insert_own" ON public.listings;
CREATE POLICY "listings_insert_own" ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id 
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        status = 'pending'
        AND verified = false
        AND (
          public.has_role(auth.uid(), 'landlord')
          OR (public.has_role(auth.uid(), 'student') AND kind IN ('Bedspace', 'Takeover'))
        )
      )
    )
  );

-- Non-admin owners can update their listings, but CANNOT self-approve or self-verify
DROP POLICY IF EXISTS "listings_update_own" ON public.listings;
CREATE POLICY "listings_update_own" ON public.listings
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (status = 'pending' AND verified = false)
    )
  );

-- 4. Backend Role Enforcement for Inspections
-- Only students or admins can create inspection requests (landlords cannot request inspections)
DROP POLICY IF EXISTS "inspections_insert_own" ON public.inspections;
CREATE POLICY "inspections_insert_own" ON public.inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND (public.has_role(auth.uid(), 'student') OR public.has_role(auth.uid(), 'admin'))
  );

-- 5. Helper RPC to assign role on OAuth signup / sync
CREATE OR REPLACE FUNCTION public.sync_user_signup_role(
  _role text,
  _provider_type text DEFAULT null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  valid_role public.app_role;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _role NOT IN ('student', 'landlord') THEN
    _role := 'student';
  END IF;

  valid_role := _role::public.app_role;

  -- Ensure user has at least one role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, valid_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Update provider_type if specified
  IF _provider_type IN ('landlord', 'agent') THEN
    UPDATE public.profiles
    SET provider_type = _provider_type
    WHERE id = uid;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_signup_role(text, text) TO authenticated;

