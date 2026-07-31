DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tgrelid::regclass AS tbl FROM pg_trigger WHERE tgname = 'zz_block_demo_writes'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_block_demo_writes ON %s', r.tbl);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.block_demo_writes() CASCADE;
DROP FUNCTION IF EXISTS public.is_demo_user(uuid) CASCADE;
DROP TABLE IF EXISTS public.demo_users CASCADE;