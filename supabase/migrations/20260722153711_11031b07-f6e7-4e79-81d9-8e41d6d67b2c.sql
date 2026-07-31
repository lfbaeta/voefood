
-- =============== TAMANHOS ===============
CREATE TABLE public.pizza_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  max_flavors int NOT NULL DEFAULT 1 CHECK (max_flavors BETWEEN 1 AND 4),
  base_price numeric(10,2),
  sort_order int NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pizza_sizes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_sizes TO authenticated;
GRANT ALL ON public.pizza_sizes TO service_role;
ALTER TABLE public.pizza_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pizza_sizes public read" ON public.pizza_sizes FOR SELECT USING (true);
CREATE POLICY "pizza_sizes admin write" ON public.pizza_sizes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE INDEX ON public.pizza_sizes(restaurant_id);
CREATE TRIGGER pizza_sizes_updated BEFORE UPDATE ON public.pizza_sizes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== SABORES ===============
CREATE TABLE public.pizza_flavors_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  ingredients text,
  image_url text,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pizza_flavors_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_flavors_catalog TO authenticated;
GRANT ALL ON public.pizza_flavors_catalog TO service_role;
ALTER TABLE public.pizza_flavors_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pizza_flavors public read" ON public.pizza_flavors_catalog FOR SELECT USING (true);
CREATE POLICY "pizza_flavors admin write" ON public.pizza_flavors_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE INDEX ON public.pizza_flavors_catalog(restaurant_id);
CREATE TRIGGER pizza_flavors_updated BEFORE UPDATE ON public.pizza_flavors_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pizza_flavor_prices (
  flavor_id uuid NOT NULL REFERENCES public.pizza_flavors_catalog(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES public.pizza_sizes(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (flavor_id, size_id)
);
GRANT SELECT ON public.pizza_flavor_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_flavor_prices TO authenticated;
GRANT ALL ON public.pizza_flavor_prices TO service_role;
ALTER TABLE public.pizza_flavor_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pizza_flavor_prices public read" ON public.pizza_flavor_prices FOR SELECT USING (true);
CREATE POLICY "pizza_flavor_prices admin write" ON public.pizza_flavor_prices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pizza_flavors_catalog f WHERE f.id = flavor_id
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), f.restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), f.restaurant_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pizza_flavors_catalog f WHERE f.id = flavor_id
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), f.restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), f.restaurant_id))));

-- =============== BORDAS ===============
CREATE TABLE public.pizza_borders_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pizza_borders_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_borders_catalog TO authenticated;
GRANT ALL ON public.pizza_borders_catalog TO service_role;
ALTER TABLE public.pizza_borders_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pizza_borders public read" ON public.pizza_borders_catalog FOR SELECT USING (true);
CREATE POLICY "pizza_borders admin write" ON public.pizza_borders_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE INDEX ON public.pizza_borders_catalog(restaurant_id);
CREATE TRIGGER pizza_borders_updated BEFORE UPDATE ON public.pizza_borders_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pizza_border_prices (
  border_id uuid NOT NULL REFERENCES public.pizza_borders_catalog(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES public.pizza_sizes(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (border_id, size_id)
);
GRANT SELECT ON public.pizza_border_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_border_prices TO authenticated;
GRANT ALL ON public.pizza_border_prices TO service_role;
ALTER TABLE public.pizza_border_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pizza_border_prices public read" ON public.pizza_border_prices FOR SELECT USING (true);
CREATE POLICY "pizza_border_prices admin write" ON public.pizza_border_prices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pizza_borders_catalog b WHERE b.id = border_id
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), b.restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), b.restaurant_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pizza_borders_catalog b WHERE b.id = border_id
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.is_admin_of_restaurant(auth.uid(), b.restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), b.restaurant_id))));
