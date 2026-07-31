
-- ============ store_config: novos toggles/preferências ============
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS auto_print_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_print_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_print_table boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_print_quick_sale boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS print_split_by_department boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS print_default_paper_width smallint NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS print_default_copies smallint NOT NULL DEFAULT 1;

-- ============ print_stations ============
CREATE TABLE IF NOT EXISTS public.print_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  device_fingerprint text NOT NULL,
  role text NOT NULL DEFAULT 'all' CHECK (role IN ('all','kitchen','bar','cashier')),
  paper_width smallint NOT NULL DEFAULT 48 CHECK (paper_width IN (32,48)),
  copies smallint NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 3),
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, device_fingerprint, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_stations TO authenticated;
GRANT ALL ON public.print_stations TO service_role;
ALTER TABLE public.print_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_stations_select" ON public.print_stations
  FOR SELECT TO authenticated
  USING (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "print_stations_write" ON public.print_stations
  FOR ALL TO authenticated
  USING (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(),'admin'::app_role)
  )
  WITH CHECK (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(),'admin'::app_role)
  );

CREATE TRIGGER trg_print_stations_updated_at
  BEFORE UPDATE ON public.print_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ print_jobs ============
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  station_role text NOT NULL DEFAULT 'all' CHECK (station_role IN ('all','kitchen','bar','cashier')),
  source text NOT NULL CHECK (source IN ('delivery','table','quick_sale','reprint','test')),
  source_id text,
  dedupe_key text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','printing','done','failed','cancelled')),
  attempts smallint NOT NULL DEFAULT 0,
  last_error text,
  printed_at timestamptz,
  printed_by_station uuid REFERENCES public.print_stations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS print_jobs_dedupe_key
  ON public.print_jobs (restaurant_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS print_jobs_pending_idx
  ON public.print_jobs (restaurant_id, status, station_role, created_at)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_jobs_select" ON public.print_jobs
  FOR SELECT TO authenticated
  USING (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "print_jobs_write" ON public.print_jobs
  FOR ALL TO authenticated
  USING (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(),'admin'::app_role)
  )
  WITH CHECK (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(),'admin'::app_role)
  );

CREATE TRIGGER trg_print_jobs_updated_at
  BEFORE UPDATE ON public.print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_stations;

-- ============ Claim RPC: dedupe concorrente entre runners ============
CREATE OR REPLACE FUNCTION public.claim_print_job(p_job_id uuid, p_station_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows int;
BEGIN
  UPDATE public.print_jobs
     SET status = 'printing',
         printed_by_station = p_station_id,
         attempts = attempts + 1,
         updated_at = now()
   WHERE id = p_job_id
     AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_print_job(uuid, uuid) TO authenticated;
