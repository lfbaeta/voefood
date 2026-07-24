-- Criar função para listar garçons APENAS com id e nome (sem PIN, sem telefone)
CREATE OR REPLACE FUNCTION public.get_active_waiters(
  p_restaurant_id uuid
)
RETURNS TABLE(id uuid, name text, has_pin boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.id, 
    w.name,
    (w.pin IS NOT NULL AND w.pin != '') AS has_pin
  FROM public.waiters w
  WHERE w.restaurant_id = p_restaurant_id
    AND w.is_active = true
  ORDER BY w.name;
$$;