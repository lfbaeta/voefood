-- Função pública (SECURITY DEFINER) para verificar se o sistema já possui ao menos 1 reseller ativo.
-- Usada para evitar loops de /setup quando RLS bloqueia SELECT direto em views.
CREATE OR REPLACE FUNCTION public.get_has_any_reseller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.is_active = true
    LIMIT 1
  );
$$;

-- Permite chamada pública via RPC
GRANT EXECUTE ON FUNCTION public.get_has_any_reseller() TO anon;
GRANT EXECUTE ON FUNCTION public.get_has_any_reseller() TO authenticated;
