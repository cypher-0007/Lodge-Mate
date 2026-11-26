-- Repair landlord / agent role assignment for existing and future accounts.
-- Admin remains a privileged role and is never assignable through signup.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provider_type text
  CHECK (provider_type IN ('landlord', 'agent'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  requested_provider text;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  requested_provider := NEW.raw_user_meta_data->>'provider_type';

  IF requested_provider IN ('landlord', 'agent') THEN
    requested_role := 'landlord';
  END IF;

  IF requested_role NOT IN ('student', 'landlord') THEN
    requested_role := 'student';
  END IF;

  IF requested_role = 'landlord'
     AND (requested_provider IS NULL OR requested_provider NOT IN ('landlord', 'agent')) THEN
    requested_provider := 'landlord';
  ELSIF requested_role = 'student' THEN
    requested_provider := NULL;
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
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_signup_role(
  _role text,
  _provider_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  requested_role text := _role;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _provider_type IN ('landlord', 'agent') THEN
    requested_role := 'landlord';
  END IF;

  IF requested_role NOT IN ('student', 'landlord') THEN
    requested_role := 'student';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, requested_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF requested_role = 'landlord' THEN
    UPDATE public.profiles
    SET provider_type = CASE
      WHEN _provider_type IN ('landlord', 'agent') THEN _provider_type
      ELSE COALESCE(provider_type, 'landlord')
    END
    WHERE id = uid;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_signup_role(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_user_signup_role(text, text) TO authenticated;

-- Backfill users created before the corrected trigger / RPC was installed.
UPDATE public.profiles AS p
SET provider_type = CASE
  WHEN u.raw_user_meta_data->>'provider_type' IN ('landlord', 'agent')
    THEN u.raw_user_meta_data->>'provider_type'
  ELSE 'landlord'
END
FROM auth.users AS u
WHERE p.id = u.id
  AND (
    u.raw_user_meta_data->>'role' = 'landlord'
    OR u.raw_user_meta_data->>'provider_type' IN ('landlord', 'agent')
  );

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'landlord'::public.app_role
FROM auth.users AS u
WHERE u.raw_user_meta_data->>'role' = 'landlord'
   OR u.raw_user_meta_data->>'provider_type' IN ('landlord', 'agent')
ON CONFLICT (user_id, role) DO NOTHING;
