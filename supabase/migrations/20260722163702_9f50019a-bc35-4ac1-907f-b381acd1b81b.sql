
-- Auto-assign trigger for delivery orders when store is in 'auto' mode
CREATE OR REPLACE FUNCTION public.auto_assign_delivery_driver()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
  v_driver_id UUID;
  v_should_run BOOLEAN := false;
BEGIN
  -- Only for delivery orders (has address) with no driver yet
  IF NEW.assigned_driver_id IS NOT NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.address_street,'') = '' THEN RETURN NEW; END IF;
  IF NEW.status IN ('cancelled','completed') THEN RETURN NEW; END IF;

  -- Fire on INSERT, or on UPDATE when status advances to preparing/delivery
  IF TG_OP = 'INSERT' THEN
    v_should_run := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('preparing','delivery') THEN
    v_should_run := true;
  END IF;
  IF NOT v_should_run THEN RETURN NEW; END IF;

  SELECT driver_assignment_mode INTO v_mode
  FROM public.store_config WHERE restaurant_id = NEW.restaurant_id;
  IF COALESCE(v_mode,'manual') <> 'auto' THEN RETURN NEW; END IF;

  -- Pick nearest available driver with recent location; fallback to any available
  SELECT d.id INTO v_driver_id
  FROM public.delivery_drivers d
  LEFT JOIN public.delivery_driver_locations l ON l.driver_id = d.id
  WHERE d.restaurant_id = NEW.restaurant_id
    AND d.is_active = true
    AND d.status = 'available'
  ORDER BY (l.updated_at IS NULL), l.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_driver_id IS NULL THEN RETURN NEW; END IF;

  NEW.assigned_driver_id := v_driver_id;
  NEW.driver_status := 'offered';

  INSERT INTO public.delivery_assignments (restaurant_id, order_id, driver_id, status)
  VALUES (NEW.restaurant_id, NEW.id, v_driver_id, 'offered')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_auto_assign_driver ON public.orders;
CREATE TRIGGER trg_orders_auto_assign_driver
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_delivery_driver();

-- Allow restaurant admins/resellers to update driver-related store_config fields via RPC
CREATE OR REPLACE FUNCTION public.update_driver_settings(
  p_restaurant_id UUID,
  p_mode TEXT,
  p_timeout INT,
  p_radius NUMERIC,
  p_commission NUMERIC,
  p_public_tracking BOOLEAN,
  p_customer_rating BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin_of_restaurant(auth.uid(), p_restaurant_id)
       OR public.is_reseller_of_restaurant(auth.uid(), p_restaurant_id)
       OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_mode NOT IN ('manual','auto') THEN RAISE EXCEPTION 'invalid_mode'; END IF;

  UPDATE public.store_config
  SET driver_assignment_mode = p_mode,
      driver_auto_timeout_seconds = GREATEST(10, LEAST(600, COALESCE(p_timeout, 60))),
      driver_max_radius_km = GREATEST(0.5, LEAST(100, COALESCE(p_radius, 10))),
      driver_default_commission = GREATEST(0, COALESCE(p_commission, 5)),
      driver_public_tracking_enabled = COALESCE(p_public_tracking, true),
      driver_customer_rating_enabled = COALESCE(p_customer_rating, true)
  WHERE restaurant_id = p_restaurant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_settings(p_restaurant_id UUID)
RETURNS TABLE(
  driver_assignment_mode TEXT,
  driver_auto_timeout_seconds INT,
  driver_max_radius_km NUMERIC,
  driver_default_commission NUMERIC,
  driver_public_tracking_enabled BOOLEAN,
  driver_customer_rating_enabled BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT driver_assignment_mode, driver_auto_timeout_seconds, driver_max_radius_km,
         driver_default_commission, driver_public_tracking_enabled, driver_customer_rating_enabled
  FROM public.store_config WHERE restaurant_id = p_restaurant_id;
$$;

-- Auto-refuse pending offers older than timeout so the next driver gets a chance
CREATE OR REPLACE FUNCTION public.expire_pending_driver_offers()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
  v_timeout INT;
BEGIN
  FOR v_rec IN
    SELECT o.id, o.restaurant_id, o.assigned_driver_id, sc.driver_auto_timeout_seconds AS tmo
    FROM public.orders o
    JOIN public.store_config sc ON sc.restaurant_id = o.restaurant_id
    WHERE o.driver_status = 'offered'
      AND sc.driver_assignment_mode = 'auto'
      AND o.assigned_driver_id IS NOT NULL
  LOOP
    v_timeout := GREATEST(10, COALESCE(v_rec.tmo, 60));
    IF EXISTS (
      SELECT 1 FROM public.delivery_assignments a
      WHERE a.order_id = v_rec.id AND a.driver_id = v_rec.assigned_driver_id
        AND a.status = 'offered'
        AND a.offered_at < now() - (v_timeout || ' seconds')::interval
    ) THEN
      UPDATE public.delivery_assignments SET status = 'refused', responded_at = now()
        WHERE order_id = v_rec.id AND driver_id = v_rec.assigned_driver_id AND status = 'offered';
      UPDATE public.orders SET assigned_driver_id = NULL, driver_status = NULL WHERE id = v_rec.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
