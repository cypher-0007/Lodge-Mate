-- Hosts may only change availability on their own pending or approved listing.
-- Keep this transition narrow so the availability action cannot edit listing data.
CREATE OR REPLACE FUNCTION public.guard_host_mark_listing_taken()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.owner_id
     AND OLD.status IN ('pending', 'approved')
     AND NEW.status = 'removed'
     AND (to_jsonb(NEW) - 'status' - 'updated_at')
         IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
    RAISE EXCEPTION 'Hosts can only change listing availability in this action';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_host_mark_listing_taken ON public.listings;
CREATE TRIGGER trg_guard_host_mark_listing_taken
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_host_mark_listing_taken();

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
