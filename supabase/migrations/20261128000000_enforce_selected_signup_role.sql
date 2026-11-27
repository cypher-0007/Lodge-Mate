-- Make the selected signup role authoritative when signup metadata is reconciled.
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

  DELETE FROM public.user_roles
  WHERE user_id = uid
    AND role <> requested_role::public.app_role
    AND role <> 'admin'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, requested_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET provider_type = CASE
    WHEN requested_role = 'landlord' THEN
      CASE WHEN _provider_type IN ('landlord', 'agent') THEN _provider_type
           ELSE COALESCE(provider_type, 'landlord') END
    ELSE NULL
  END
  WHERE id = uid;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_signup_role(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_user_signup_role(text, text) TO authenticated;
