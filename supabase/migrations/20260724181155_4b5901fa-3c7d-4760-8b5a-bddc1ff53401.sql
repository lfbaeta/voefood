
-- Fase 1: identidade por tipo de estabelecimento
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS business_subtype text,
  ADD COLUMN IF NOT EXISTS capabilities_override jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS business_subtype text,
  ADD COLUMN IF NOT EXISTS capabilities_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS setup_seeded boolean NOT NULL DEFAULT false;

-- Campos por tipo em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS unit_of_sale text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS price_per_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS requires_prescription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS batch_number text;

-- Validação leve via trigger (CHECK evitado por serem regras evolutivas)
CREATE OR REPLACE FUNCTION public.validate_product_unit_of_sale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.unit_of_sale NOT IN ('un', 'kg', 'g', 'ml', 'l', 'dose', 'porcao') THEN
    RAISE EXCEPTION 'unit_of_sale inválido: %', NEW.unit_of_sale;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_unit_of_sale ON public.products;
CREATE TRIGGER trg_validate_product_unit_of_sale
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_unit_of_sale();
