
-- Backfill: resellers ativos -> admin
INSERT INTO public.user_roles (user_id, role)
SELECT r.user_id, 'admin'::app_role
FROM public.resellers r
WHERE r.is_active = true AND r.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_reseller_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id AND role = 'admin'::app_role
      AND NOT EXISTS (
        SELECT 1 FROM public.resellers
        WHERE user_id = OLD.user_id AND is_active = true AND id <> OLD.id
      );
    RETURN OLD;
  END IF;

  IF NEW.user_id IS NOT NULL AND NEW.is_active = true THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.is_active = false AND COALESCE(OLD.is_active, false) = true THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'admin'::app_role
      AND NOT EXISTS (
        SELECT 1 FROM public.resellers
        WHERE user_id = NEW.user_id AND is_active = true AND id <> NEW.id
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reseller_user_role ON public.resellers;
CREATE TRIGGER trg_sync_reseller_user_role
AFTER INSERT OR UPDATE OR DELETE ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_user_role();
