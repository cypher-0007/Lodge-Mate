-- Keep Auth-created role rows aligned with the role selected at signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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
    provider_type = EXCLUDED.provider_type;

  DELETE FROM public.user_roles
  WHERE user_id = NEW.id AND role <> 'admin'::public.app_role;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
