ALTER TABLE public.store_config REPLICA IDENTITY FULL;
ALTER TABLE public.business_hours REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'store_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'business_hours'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_hours;
  END IF;
END $$;