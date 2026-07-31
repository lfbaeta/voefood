ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promo_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS promo_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_product_promo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.promo_enabled THEN
    IF NEW.promo_price IS NULL THEN
      RAISE EXCEPTION 'Valor promocional é obrigatório quando a promoção está ativa';
    END IF;
    IF NEW.promo_price <= 0 THEN
      RAISE EXCEPTION 'Valor promocional deve ser maior que zero';
    END IF;
    IF NEW.price IS NOT NULL AND NEW.promo_price >= NEW.price THEN
      RAISE EXCEPTION 'Valor promocional deve ser menor que o preço normal';
    END IF;
    IF NEW.promo_starts_at IS NOT NULL AND NEW.promo_ends_at IS NOT NULL
       AND NEW.promo_ends_at <= NEW.promo_starts_at THEN
      RAISE EXCEPTION 'A data final da promoção deve ser posterior à data inicial';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_promo ON public.products;
CREATE TRIGGER trg_validate_product_promo
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.validate_product_promo();