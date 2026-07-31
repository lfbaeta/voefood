CREATE TABLE public.demo_users (
  user_id uuid PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.demo_users TO authenticated;
GRANT ALL ON public.demo_users TO service_role;

ALTER TABLE public.demo_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view demo users"
ON public.demo_users FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.demo_users d WHERE d.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.block_demo_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'demo_read_only'
      USING HINT = 'Conta de demonstracao: alteracoes nao sao permitidas.';
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> 'demo_users'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS zz_block_demo_writes ON public.%I;
       CREATE TRIGGER zz_block_demo_writes
       BEFORE INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH STATEMENT EXECUTE FUNCTION public.block_demo_writes();',
      r.relname, r.relname);
  END LOOP;
END $$;