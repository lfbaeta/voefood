ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS waiter_called_at timestamptz;

CREATE OR REPLACE FUNCTION public.table_customer_request(
  p_restaurant_id uuid,
  p_table_number integer,
  p_request text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.tables%ROWTYPE;
  v_recent int;
  v_event text;
  v_title text;
  v_body text;
BEGIN
  IF p_request NOT IN ('call_waiter', 'request_bill') THEN
    RAISE EXCEPTION 'invalid request type';
  END IF;

  SELECT * INTO v_table
  FROM public.tables
  WHERE restaurant_id = p_restaurant_id AND number = p_table_number
  LIMIT 1;

  IF v_table.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_not_found');
  END IF;

  v_event := CASE WHEN p_request = 'call_waiter' THEN 'table_call_waiter' ELSE 'table_request_bill' END;

  SELECT count(*) INTO v_recent
  FROM public.notifications n
  WHERE n.restaurant_id = p_restaurant_id
    AND n.event_type = v_event
    AND n.data->>'table_id' = v_table.id::text
    AND n.created_at > now() - interval '20 seconds';

  IF v_recent > 0 THEN
    RETURN jsonb_build_object('ok', true, 'throttled', true);
  END IF;

  IF p_request = 'call_waiter' THEN
    v_title := 'Mesa ' || v_table.number || ' chamou o garçom';
    v_body := COALESCE(v_table.name, 'Mesa ' || v_table.number) || ' precisa de atendimento.';
    UPDATE public.tables SET waiter_called_at = now(), updated_at = now() WHERE id = v_table.id;
  ELSE
    v_title := 'Mesa ' || v_table.number || ' pediu a conta';
    v_body := COALESCE(v_table.name, 'Mesa ' || v_table.number) || ' solicitou o fechamento da conta.';
    IF v_table.current_order_id IS NOT NULL THEN
      UPDATE public.table_orders
      SET status = 'requesting_bill', updated_at = now()
      WHERE id = v_table.current_order_id AND status = 'open';
      UPDATE public.tables SET status = 'requesting_bill', updated_at = now() WHERE id = v_table.id;
    END IF;
  END IF;

  INSERT INTO public.notifications (restaurant_id, audience, event_type, title, body, table_order_id, data)
  VALUES (
    p_restaurant_id,
    'staff',
    v_event,
    v_title,
    v_body,
    v_table.current_order_id,
    jsonb_build_object('table_id', v_table.id, 'table_number', v_table.number)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.table_customer_request(uuid, integer, text) TO anon, authenticated;