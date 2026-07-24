
-- Nearest driver suggestion (haversine, prioritizes available drivers)
CREATE OR REPLACE FUNCTION public.suggest_nearest_driver(p_order_id bigint)
RETURNS TABLE(driver_id uuid, driver_name text, distance_km numeric, status text, last_seen timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest uuid;
  v_lat double precision;
  v_lng double precision;
BEGIN
  SELECT o.restaurant_id INTO v_rest FROM public.orders o WHERE o.id = p_order_id;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT (public.is_admin_of_restaurant(auth.uid(), v_rest) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT sc.address_lat, sc.address_lng INTO v_lat, v_lng
  FROM public.store_config sc WHERE sc.restaurant_id = v_rest;

  RETURN QUERY
  SELECT d.id, d.name,
    CASE WHEN v_lat IS NULL OR v_lng IS NULL OR l.lat IS NULL THEN NULL::numeric
      ELSE round((6371 * acos(
        cos(radians(v_lat)) * cos(radians(l.lat)) *
        cos(radians(l.lng) - radians(v_lng)) +
        sin(radians(v_lat)) * sin(radians(l.lat))
      ))::numeric, 2)
    END AS distance_km,
    d.status, l.updated_at
  FROM public.delivery_drivers d
  LEFT JOIN public.delivery_driver_locations l ON l.driver_id = d.id
  WHERE d.restaurant_id = v_rest AND d.is_active = true
    AND d.status IN ('available','returning')
  ORDER BY
    CASE WHEN d.status = 'available' THEN 0 ELSE 1 END,
    distance_km NULLS LAST,
    l.updated_at DESC NULLS LAST
  LIMIT 5;
END;
$$;

-- Driver opens their own shift via PIN
CREATE OR REPLACE FUNCTION public.driver_open_shift(p_driver_id uuid, p_pin text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rest uuid; v_id uuid; v_open uuid;
BEGIN
  SELECT restaurant_id INTO v_rest FROM public.delivery_drivers
  WHERE id = p_driver_id AND pin = p_pin AND is_active = true;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'invalid_driver'; END IF;

  SELECT id INTO v_open FROM public.delivery_driver_shifts
  WHERE driver_id = p_driver_id AND status = 'open' LIMIT 1;
  IF v_open IS NOT NULL THEN RETURN v_open; END IF;

  INSERT INTO public.delivery_driver_shifts (restaurant_id, driver_id, status, opened_at)
  VALUES (v_rest, p_driver_id, 'open', now())
  RETURNING id INTO v_id;

  UPDATE public.delivery_drivers SET status = 'available' WHERE id = p_driver_id;
  RETURN v_id;
END;
$$;

-- Driver closes their own open shift via PIN
CREATE OR REPLACE FUNCTION public.driver_close_shift(p_driver_id uuid, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rest uuid;
BEGIN
  SELECT restaurant_id INTO v_rest FROM public.delivery_drivers
  WHERE id = p_driver_id AND pin = p_pin AND is_active = true;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'invalid_driver'; END IF;

  UPDATE public.delivery_driver_shifts
    SET status='closed', closed_at=now()
   WHERE driver_id = p_driver_id AND status = 'open';

  UPDATE public.delivery_drivers SET status = 'offline' WHERE id = p_driver_id;
END;
$$;

-- Fetch active drivers with location (for admin operations map)
CREATE OR REPLACE FUNCTION public.get_drivers_with_location(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid, name text, phone text, vehicle_type text, status text,
  photo_url text, lat double precision, lng double precision, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin_of_restaurant(auth.uid(), p_restaurant_id) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY
    SELECT d.id, d.name, d.phone, d.vehicle_type, d.status, d.photo_url,
      l.lat, l.lng, l.updated_at
    FROM public.delivery_drivers d
    LEFT JOIN public.delivery_driver_locations l ON l.driver_id = d.id
    WHERE d.restaurant_id = p_restaurant_id AND d.is_active = true
    ORDER BY d.name;
END;
$$;

-- Aggregated shift report for restaurant (period)
CREATE OR REPLACE FUNCTION public.get_driver_shifts_report(
  p_restaurant_id uuid,
  p_start timestamptz DEFAULT (now() - interval '30 days'),
  p_end   timestamptz DEFAULT now()
)
RETURNS TABLE(
  driver_id uuid, driver_name text, shifts_count bigint,
  total_deliveries bigint, total_commission numeric,
  total_hours numeric, avg_rating numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin_of_restaurant(auth.uid(), p_restaurant_id) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY
    SELECT
      d.id, d.name,
      COUNT(s.id)::bigint AS shifts_count,
      COALESCE(SUM(s.deliveries_count),0)::bigint AS total_deliveries,
      COALESCE(SUM(s.commission_total),0)::numeric AS total_commission,
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(s.closed_at, now()) - s.opened_at)) / 3600.0), 0)::numeric AS total_hours,
      (SELECT round(AVG(r.stars)::numeric, 2) FROM public.delivery_ratings r WHERE r.driver_id = d.id AND r.created_at BETWEEN p_start AND p_end) AS avg_rating
    FROM public.delivery_drivers d
    LEFT JOIN public.delivery_driver_shifts s
      ON s.driver_id = d.id AND s.opened_at BETWEEN p_start AND p_end
    WHERE d.restaurant_id = p_restaurant_id
    GROUP BY d.id, d.name
    ORDER BY total_deliveries DESC, d.name;
END;
$$;
