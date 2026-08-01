-- 1) Restrict all admin write policies to the authenticated role
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text = '{public}'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
      AND tablename IN (
        'coupons','addon_groups','products','categories','waiters',
        'delivery_zones','business_hours','store_config',
        'table_order_items','table_orders','reseller_evolution_config'
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- reseller_evolution_config SELECT is also public-role; scope it to authenticated
ALTER POLICY "Resellers can view evolution config" ON public.reseller_evolution_config TO authenticated;

-- 2) Scope public menu reads to active restaurants only
ALTER POLICY "Products are publicly readable" ON public.products
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = products.restaurant_id AND r.is_active));

ALTER POLICY "Categories are publicly readable" ON public.categories
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = categories.restaurant_id AND r.is_active));

ALTER POLICY "Addon groups are publicly readable" ON public.addon_groups
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = addon_groups.restaurant_id AND r.is_active));

ALTER POLICY "Business hours are publicly readable" ON public.business_hours
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = business_hours.restaurant_id AND r.is_active));

ALTER POLICY "Delivery zones are publicly readable" ON public.delivery_zones
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = delivery_zones.restaurant_id AND r.is_active));

ALTER POLICY "pizza_sizes public read" ON public.pizza_sizes
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = pizza_sizes.restaurant_id AND r.is_active));

ALTER POLICY "pizza_borders public read" ON public.pizza_borders_catalog
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = pizza_borders_catalog.restaurant_id AND r.is_active));

ALTER POLICY "pizza_flavors public read" ON public.pizza_flavors_catalog
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = pizza_flavors_catalog.restaurant_id AND r.is_active));

ALTER POLICY "Addon options are publicly readable" ON public.addon_options
  USING (EXISTS (
    SELECT 1 FROM public.addon_groups ag
    JOIN public.restaurants r ON r.id = ag.restaurant_id
    WHERE ag.id = addon_options.group_id AND r.is_active
  ));

ALTER POLICY "Product addon groups are publicly readable" ON public.product_addon_groups
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.restaurants r ON r.id = p.restaurant_id
    WHERE p.id = product_addon_groups.product_id AND r.is_active
  ));

ALTER POLICY "pizza_border_prices public read" ON public.pizza_border_prices
  USING (EXISTS (
    SELECT 1 FROM public.pizza_borders_catalog b
    JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE b.id = pizza_border_prices.border_id AND r.is_active
  ));

ALTER POLICY "pizza_flavor_prices public read" ON public.pizza_flavor_prices
  USING (EXISTS (
    SELECT 1 FROM public.pizza_flavors_catalog f
    JOIN public.restaurants r ON r.id = f.restaurant_id
    WHERE f.id = pizza_flavor_prices.flavor_id AND r.is_active
  ));