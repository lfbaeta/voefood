
-- =========================================================
-- MÓDULO DE ENTREGADORES
-- =========================================================

-- 1. delivery_drivers
CREATE TABLE public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  cpf TEXT,
  photo_url TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'motorcycle' CHECK (vehicle_type IN ('motorcycle','bicycle','car','foot')),
  vehicle_plate TEXT,
  vehicle_model TEXT,
  pin TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','available','on_delivery','returning','paused')),
  commission_type TEXT NOT NULL DEFAULT 'fixed' CHECK (commission_type IN ('fixed','percent','per_km')),
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  pix_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, pin)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_drivers TO authenticated;
GRANT ALL ON public.delivery_drivers TO service_role;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own drivers"
  ON public.delivery_drivers FOR ALL TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_delivery_drivers_updated
  BEFORE UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_delivery_drivers_restaurant ON public.delivery_drivers(restaurant_id, is_active);

-- 2. delivery_driver_locations
CREATE TABLE public.delivery_driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_driver_locations TO authenticated;
GRANT ALL ON public.delivery_driver_locations TO service_role;
ALTER TABLE public.delivery_driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own driver locations"
  ON public.delivery_driver_locations FOR SELECT TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_driver_locations_restaurant ON public.delivery_driver_locations(restaurant_id);

-- 3. delivery_driver_shifts
CREATE TABLE public.delivery_driver_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  deliveries_count INT NOT NULL DEFAULT 0,
  commission_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_collected NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_driver_shifts TO authenticated;
GRANT ALL ON public.delivery_driver_shifts TO service_role;
ALTER TABLE public.delivery_driver_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage driver shifts"
  ON public.delivery_driver_shifts FOR ALL TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_driver_shifts_updated
  BEFORE UPDATE ON public.delivery_driver_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_driver_shifts_driver ON public.delivery_driver_shifts(driver_id, status);

-- 4. delivery_assignments
CREATE TABLE public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','refused','picked_up','delivered','cancelled')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  commission_amount NUMERIC(10,2),
  distance_km NUMERIC(8,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_assignments TO authenticated;
GRANT ALL ON public.delivery_assignments TO service_role;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage assignments"
  ON public.delivery_assignments FOR ALL TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_delivery_assignments_updated
  BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_delivery_assignments_order ON public.delivery_assignments(order_id);
CREATE INDEX idx_delivery_assignments_driver ON public.delivery_assignments(driver_id, status);

-- 5. delivery_ratings
CREATE TABLE public.delivery_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_ratings TO authenticated;
GRANT ALL ON public.delivery_ratings TO service_role;
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view ratings"
  ON public.delivery_ratings FOR SELECT TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Colunas em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_status TEXT,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON public.orders(assigned_driver_id);

-- 7. Configurações em store_config
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS driver_assignment_mode TEXT NOT NULL DEFAULT 'manual' CHECK (driver_assignment_mode IN ('manual','auto')),
  ADD COLUMN IF NOT EXISTS driver_auto_timeout_seconds INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS driver_max_radius_km NUMERIC(6,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS driver_default_commission NUMERIC(10,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS driver_public_tracking_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS driver_customer_rating_enabled BOOLEAN NOT NULL DEFAULT true;

-- 8. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignments;

-- =========================================================
-- RPCs
-- =========================================================

-- Validate driver PIN
CREATE OR REPLACE FUNCTION public.validate_driver_pin(p_restaurant_id UUID, p_pin TEXT)
RETURNS TABLE(driver_id UUID, driver_name TEXT, vehicle_type TEXT, photo_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, vehicle_type, photo_url
  FROM public.delivery_drivers
  WHERE restaurant_id = p_restaurant_id
    AND pin = p_pin
    AND is_active = true
  LIMIT 1;
$$;

-- List active drivers (for admin dropdown)
CREATE OR REPLACE FUNCTION public.list_active_drivers(p_restaurant_id UUID)
RETURNS TABLE(id UUID, name TEXT, phone TEXT, vehicle_type TEXT, status TEXT, photo_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, phone, vehicle_type, status, photo_url
  FROM public.delivery_drivers
  WHERE restaurant_id = p_restaurant_id AND is_active = true
  ORDER BY status, name;
$$;

-- Driver update location (called from driver PWA)
CREATE OR REPLACE FUNCTION public.driver_update_location(
  p_driver_id UUID, p_pin TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION,
  p_heading DOUBLE PRECISION DEFAULT NULL, p_speed DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest UUID;
BEGIN
  SELECT restaurant_id INTO v_rest FROM public.delivery_drivers
  WHERE id = p_driver_id AND pin = p_pin AND is_active = true;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'invalid_driver'; END IF;

  INSERT INTO public.delivery_driver_locations (driver_id, restaurant_id, lat, lng, heading, speed, accuracy, updated_at)
  VALUES (p_driver_id, v_rest, p_lat, p_lng, p_heading, p_speed, p_accuracy, now())
  ON CONFLICT (driver_id) DO UPDATE
    SET lat = EXCLUDED.lat, lng = EXCLUDED.lng,
        heading = EXCLUDED.heading, speed = EXCLUDED.speed,
        accuracy = EXCLUDED.accuracy, updated_at = now();
END;
$$;

-- Admin assigns driver to order (manual)
CREATE OR REPLACE FUNCTION public.assign_driver_to_order(p_order_id BIGINT, p_driver_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest UUID;
  v_driver_rest UUID;
BEGIN
  SELECT restaurant_id INTO v_rest FROM public.orders WHERE id = p_order_id;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT (public.is_admin_of_restaurant(auth.uid(), v_rest) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT restaurant_id INTO v_driver_rest FROM public.delivery_drivers WHERE id = p_driver_id AND is_active = true;
  IF v_driver_rest IS NULL OR v_driver_rest <> v_rest THEN RAISE EXCEPTION 'driver_invalid'; END IF;

  UPDATE public.orders SET assigned_driver_id = p_driver_id, driver_status = 'offered' WHERE id = p_order_id;

  INSERT INTO public.delivery_assignments (restaurant_id, order_id, driver_id, status)
  VALUES (v_rest, p_order_id, p_driver_id, 'offered');
END;
$$;

-- Driver actions (accept, refuse, pickup, deliver)
CREATE OR REPLACE FUNCTION public.driver_action_order(
  p_driver_id UUID, p_pin TEXT, p_order_id BIGINT, p_action TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest UUID;
  v_assigned UUID;
BEGIN
  SELECT restaurant_id INTO v_rest FROM public.delivery_drivers
  WHERE id = p_driver_id AND pin = p_pin AND is_active = true;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'invalid_driver'; END IF;

  SELECT assigned_driver_id INTO v_assigned FROM public.orders WHERE id = p_order_id AND restaurant_id = v_rest;
  IF v_assigned IS NULL OR v_assigned <> p_driver_id THEN RAISE EXCEPTION 'order_not_assigned'; END IF;

  IF p_action = 'accept' THEN
    UPDATE public.orders SET driver_status = 'accepted' WHERE id = p_order_id;
    UPDATE public.delivery_assignments SET status = 'accepted', responded_at = now()
      WHERE order_id = p_order_id AND driver_id = p_driver_id AND status = 'offered';
    UPDATE public.delivery_drivers SET status = 'on_delivery' WHERE id = p_driver_id;
  ELSIF p_action = 'refuse' THEN
    UPDATE public.orders SET assigned_driver_id = NULL, driver_status = NULL WHERE id = p_order_id;
    UPDATE public.delivery_assignments SET status = 'refused', responded_at = now()
      WHERE order_id = p_order_id AND driver_id = p_driver_id AND status = 'offered';
  ELSIF p_action = 'pickup' THEN
    UPDATE public.orders SET driver_status = 'picked_up', picked_up_at = now(), status = 'delivering' WHERE id = p_order_id;
    UPDATE public.delivery_assignments SET status = 'picked_up', picked_up_at = now()
      WHERE order_id = p_order_id AND driver_id = p_driver_id;
  ELSIF p_action = 'deliver' THEN
    UPDATE public.orders SET driver_status = 'delivered', delivered_at = now(), status = 'completed' WHERE id = p_order_id;
    UPDATE public.delivery_assignments SET status = 'delivered', delivered_at = now()
      WHERE order_id = p_order_id AND driver_id = p_driver_id;
    UPDATE public.delivery_drivers SET status = 'available' WHERE id = p_driver_id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;

-- Driver's own dashboard data
CREATE OR REPLACE FUNCTION public.get_driver_orders(p_driver_id UUID, p_pin TEXT)
RETURNS TABLE(
  id BIGINT, customer_name TEXT, customer_phone TEXT,
  address_street TEXT, address_number TEXT, address_neighborhood TEXT,
  address_complement TEXT, address_reference TEXT,
  total_amount NUMERIC, payment_method TEXT, change_for NUMERIC,
  driver_status TEXT, status TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest UUID;
BEGIN
  SELECT restaurant_id INTO v_rest FROM public.delivery_drivers
  WHERE id = p_driver_id AND pin = p_pin AND is_active = true;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'invalid_driver'; END IF;

  RETURN QUERY
  SELECT o.id, o.customer_name, o.customer_phone,
    o.address_street, o.address_number, o.address_neighborhood,
    o.address_complement, o.address_reference,
    o.total_amount, o.payment_method, o.change_for,
    o.driver_status, o.status, o.created_at
  FROM public.orders o
  WHERE o.restaurant_id = v_rest
    AND o.assigned_driver_id = p_driver_id
    AND o.driver_status IN ('offered','accepted','picked_up')
  ORDER BY o.created_at DESC;
END;
$$;

-- Public tracking for the customer
CREATE OR REPLACE FUNCTION public.get_public_driver_tracking(p_order_id BIGINT, p_customer_phone TEXT)
RETURNS TABLE(
  order_status TEXT, driver_status TEXT, driver_name TEXT, driver_photo TEXT,
  vehicle_type TEXT, driver_phone TEXT,
  driver_lat DOUBLE PRECISION, driver_lng DOUBLE PRECISION, location_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_phone_db TEXT;
  v_din TEXT; v_ddb TEXT;
BEGIN
  SELECT customer_phone INTO v_phone_db FROM public.orders WHERE id = p_order_id;
  IF v_phone_db IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  v_din := regexp_replace(COALESCE(p_customer_phone,''), '[^0-9]', '', 'g');
  v_ddb := regexp_replace(v_phone_db, '[^0-9]', '', 'g');
  IF length(v_din) < 8 OR right(v_ddb,8) <> right(v_din,8) THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  RETURN QUERY
  SELECT o.status, o.driver_status, d.name, d.photo_url, d.vehicle_type, d.phone,
    l.lat, l.lng, l.updated_at
  FROM public.orders o
  LEFT JOIN public.delivery_drivers d ON d.id = o.assigned_driver_id
  LEFT JOIN public.delivery_driver_locations l ON l.driver_id = d.id
  WHERE o.id = p_order_id;
END;
$$;

-- Close driver shift
CREATE OR REPLACE FUNCTION public.close_driver_shift(p_shift_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest UUID;
BEGIN
  SELECT restaurant_id INTO v_rest FROM public.delivery_driver_shifts WHERE id = p_shift_id AND status = 'open';
  IF v_rest IS NULL THEN RAISE EXCEPTION 'shift_not_found'; END IF;
  IF NOT (public.is_admin_of_restaurant(auth.uid(), v_rest) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.delivery_driver_shifts SET status='closed', closed_at=now(), notes=COALESCE(p_notes, notes)
    WHERE id = p_shift_id;
END;
$$;

-- Submit customer rating (public)
CREATE OR REPLACE FUNCTION public.submit_delivery_rating(
  p_order_id BIGINT, p_customer_phone TEXT, p_stars INT, p_comment TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest UUID; v_driver UUID; v_phone_db TEXT; v_din TEXT; v_ddb TEXT;
BEGIN
  IF p_stars < 1 OR p_stars > 5 THEN RAISE EXCEPTION 'invalid_stars'; END IF;
  SELECT restaurant_id, assigned_driver_id, customer_phone INTO v_rest, v_driver, v_phone_db
    FROM public.orders WHERE id = p_order_id;
  IF v_driver IS NULL THEN RAISE EXCEPTION 'no_driver'; END IF;
  v_din := regexp_replace(COALESCE(p_customer_phone,''), '[^0-9]', '', 'g');
  v_ddb := regexp_replace(COALESCE(v_phone_db,''), '[^0-9]', '', 'g');
  IF length(v_din) < 8 OR right(v_ddb,8) <> right(v_din,8) THEN RAISE EXCEPTION 'phone_mismatch'; END IF;

  INSERT INTO public.delivery_ratings (restaurant_id, order_id, driver_id, stars, comment)
  VALUES (v_rest, p_order_id, v_driver, p_stars, p_comment)
  ON CONFLICT (order_id) DO UPDATE SET stars = EXCLUDED.stars, comment = EXCLUDED.comment;
END;
$$;
