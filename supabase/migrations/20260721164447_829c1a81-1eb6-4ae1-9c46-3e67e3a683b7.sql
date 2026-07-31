
-- ============ EXTENSÕES EM TABELAS EXISTENTES ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_qty numeric,
  ADD COLUMN IF NOT EXISTS min_stock_qty numeric,
  ADD COLUMN IF NOT EXISTS availability_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz;

ALTER TABLE public.table_orders
  ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- ============ SUPPLIERS ============
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  contact_name text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant ON public.suppliers(restaurant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers manageable by restaurant admins/resellers"
  ON public.suppliers FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STOCK_ITEMS ============
CREATE TABLE IF NOT EXISTS public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  unit text NOT NULL DEFAULT 'un' CHECK (unit IN ('un','kg','g','L','ml')),
  category text,
  current_qty numeric NOT NULL DEFAULT 0,
  min_qty numeric NOT NULL DEFAULT 0,
  max_qty numeric,
  average_cost numeric NOT NULL DEFAULT 0,
  last_cost numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_items_restaurant ON public.stock_items(restaurant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock items manageable by restaurant admins/resellers"
  ON public.stock_items FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRODUCT_RECIPES ============
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'un' CHECK (unit IN ('un','kg','g','L','ml')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, stock_item_id)
);
CREATE INDEX IF NOT EXISTS idx_recipes_restaurant ON public.product_recipes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON public.product_recipes(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipes TO authenticated;
GRANT ALL ON public.product_recipes TO service_role;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipes manageable by restaurant admins/resellers"
  ON public.product_recipes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );
CREATE TRIGGER update_product_recipes_updated_at BEFORE UPDATE ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STOCK_MOVEMENTS ============
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('entrada_compra','saida_venda','ajuste','perda','producao','transferencia')),
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  reference_type text CHECK (reference_type IN ('order','table_order','purchase','manual','system')),
  reference_id text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_restaurant ON public.stock_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_movements_item ON public.stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON public.stock_movements(created_at DESC);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Movements readable by restaurant admins/resellers"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );
-- Movimentações são criadas apenas via RPCs SECURITY DEFINER; nenhuma policy de INSERT via cliente.

-- ============ PURCHASES ============
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','received','cancelled')),
  received_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_restaurant ON public.purchases(restaurant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchases manageable by restaurant admins/resellers"
  ON public.purchases FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PURCHASE_ITEMS ============
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchase items manageable via parent purchase"
  ON public.purchase_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_items.purchase_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.is_admin_of_restaurant(auth.uid(), p.restaurant_id)
        OR public.is_reseller_of_restaurant(auth.uid(), p.restaurant_id)
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_items.purchase_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.is_admin_of_restaurant(auth.uid(), p.restaurant_id)
        OR public.is_reseller_of_restaurant(auth.uid(), p.restaurant_id)
      )
  ));

-- ============ HELPERS: conversão de unidades ============
CREATE OR REPLACE FUNCTION public.convert_stock_qty(p_qty numeric, p_from text, p_to text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_from = p_to THEN RETURN p_qty; END IF;
  IF (p_from = 'kg' AND p_to = 'g') OR (p_from = 'L' AND p_to = 'ml') THEN RETURN p_qty * 1000; END IF;
  IF (p_from = 'g' AND p_to = 'kg') OR (p_from = 'ml' AND p_to = 'L') THEN RETURN p_qty / 1000; END IF;
  RETURN p_qty; -- unidades incompatíveis: sem conversão
END;
$$;

-- ============ FUNÇÃO: refresh product availability ============
CREATE OR REPLACE FUNCTION public.refresh_product_availability(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_available boolean := true;
  v_recipe record;
  v_have numeric;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND OR v_product.availability_locked THEN RETURN; END IF;

  -- Ficha técnica?
  IF EXISTS (SELECT 1 FROM public.product_recipes WHERE product_id = p_product_id) THEN
    FOR v_recipe IN
      SELECT pr.quantity, pr.unit AS recipe_unit, si.current_qty, si.unit AS item_unit
      FROM public.product_recipes pr
      JOIN public.stock_items si ON si.id = pr.stock_item_id
      WHERE pr.product_id = p_product_id
    LOOP
      v_have := public.convert_stock_qty(v_recipe.current_qty, v_recipe.item_unit, v_recipe.recipe_unit);
      IF v_have < v_recipe.quantity THEN
        v_available := false;
        EXIT;
      END IF;
    END LOOP;
  ELSIF v_product.track_stock THEN
    IF COALESCE(v_product.stock_qty, 0) <= 0 THEN v_available := false; END IF;
  END IF;

  IF v_product.is_available <> v_available THEN
    UPDATE public.products SET is_available = v_available WHERE id = p_product_id;
  END IF;
END;
$$;

-- ============ RPC: registro manual de movimentação ============
CREATE OR REPLACE FUNCTION public.register_stock_movement(
  p_stock_item_id uuid,
  p_type text,
  p_quantity numeric,
  p_unit_cost numeric DEFAULT 0,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.stock_items%ROWTYPE;
  v_signed numeric;
  v_new_qty numeric;
  v_new_avg numeric;
  v_id uuid;
BEGIN
  SELECT * INTO v_item FROM public.stock_items WHERE id = p_stock_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'stock_item_not_found'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin'::app_role)
       OR public.is_admin_of_restaurant(auth.uid(), v_item.restaurant_id)
       OR public.is_reseller_of_restaurant(auth.uid(), v_item.restaurant_id)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_type NOT IN ('entrada_compra','ajuste','perda','producao','transferencia') THEN
    RAISE EXCEPTION 'invalid_movement_type';
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

  -- entrada_compra e producao aumentam; perda diminui; ajuste/transferencia usam sinal do input
  v_signed := CASE
    WHEN p_type IN ('entrada_compra','producao') THEN abs(p_quantity)
    WHEN p_type = 'perda' THEN -abs(p_quantity)
    ELSE p_quantity
  END;

  v_new_qty := v_item.current_qty + v_signed;

  -- Recalcula custo médio apenas em entradas positivas com custo informado
  IF v_signed > 0 AND COALESCE(p_unit_cost,0) > 0 AND v_new_qty > 0 THEN
    v_new_avg := ((v_item.current_qty * v_item.average_cost) + (v_signed * p_unit_cost)) / v_new_qty;
  ELSE
    v_new_avg := v_item.average_cost;
  END IF;

  UPDATE public.stock_items
     SET current_qty = v_new_qty,
         average_cost = v_new_avg,
         last_cost = CASE WHEN COALESCE(p_unit_cost,0) > 0 THEN p_unit_cost ELSE last_cost END
   WHERE id = p_stock_item_id;

  INSERT INTO public.stock_movements
    (restaurant_id, stock_item_id, type, quantity, unit_cost, total_cost, reference_type, notes, created_by)
  VALUES
    (v_item.restaurant_id, p_stock_item_id, p_type, v_signed, COALESCE(p_unit_cost,0),
     COALESCE(p_unit_cost,0) * abs(v_signed), 'manual', p_notes, auth.uid())
  RETURNING id INTO v_id;

  -- refresh availability de produtos que usam este insumo
  PERFORM public.refresh_product_availability(pr.product_id)
  FROM public.product_recipes pr
  WHERE pr.stock_item_id = p_stock_item_id;

  RETURN v_id;
END;
$$;

-- ============ RPC: receive purchase ============
CREATE OR REPLACE FUNCTION public.receive_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item record;
  v_stock public.stock_items%ROWTYPE;
  v_new_qty numeric;
  v_new_avg numeric;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase_not_found'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin'::app_role)
       OR public.is_admin_of_restaurant(auth.uid(), v_purchase.restaurant_id)
       OR public.is_reseller_of_restaurant(auth.uid(), v_purchase.restaurant_id)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF v_purchase.status <> 'draft' THEN RAISE EXCEPTION 'purchase_not_draft'; END IF;

  FOR v_item IN
    SELECT * FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    SELECT * INTO v_stock FROM public.stock_items WHERE id = v_item.stock_item_id FOR UPDATE;
    v_new_qty := v_stock.current_qty + v_item.quantity;
    IF v_new_qty > 0 AND v_item.unit_cost > 0 THEN
      v_new_avg := ((v_stock.current_qty * v_stock.average_cost) + (v_item.quantity * v_item.unit_cost)) / v_new_qty;
    ELSE
      v_new_avg := v_stock.average_cost;
    END IF;

    UPDATE public.stock_items
       SET current_qty = v_new_qty,
           average_cost = v_new_avg,
           last_cost = CASE WHEN v_item.unit_cost > 0 THEN v_item.unit_cost ELSE last_cost END
     WHERE id = v_item.stock_item_id;

    INSERT INTO public.stock_movements
      (restaurant_id, stock_item_id, type, quantity, unit_cost, total_cost, reference_type, reference_id, created_by)
    VALUES
      (v_purchase.restaurant_id, v_item.stock_item_id, 'entrada_compra', v_item.quantity,
       v_item.unit_cost, v_item.total_cost, 'purchase', p_purchase_id::text, auth.uid());
  END LOOP;

  UPDATE public.purchases
     SET status = 'received', received_at = now()
   WHERE id = p_purchase_id;

  -- refresh availability
  PERFORM public.refresh_product_availability(pr.product_id)
  FROM public.product_recipes pr
  JOIN public.purchase_items pi ON pi.stock_item_id = pr.stock_item_id
  WHERE pi.purchase_id = p_purchase_id;
END;
$$;

-- ============ FUNÇÃO INTERNA: aplicar baixa para itens ============
CREATE OR REPLACE FUNCTION public.apply_items_stock_deduction(
  p_restaurant_id uuid,
  p_reference_type text,
  p_reference_id text,
  p_items jsonb  -- [{product_id, quantity, quantity_grams, unit_of_sale}]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_it jsonb;
  v_product public.products%ROWTYPE;
  v_qty numeric;
  v_qty_grams numeric;
  v_unit text;
  v_recipe record;
  v_consume numeric;
  v_new_qty numeric;
  v_affected_products uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RETURN; END IF;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_it->>'product_id' IS NULL THEN CONTINUE; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = (v_it->>'product_id')::uuid;
    IF NOT FOUND OR v_product.restaurant_id <> p_restaurant_id THEN CONTINUE; END IF;

    v_qty := COALESCE((v_it->>'quantity')::numeric, 1);
    v_qty_grams := NULLIF(v_it->>'quantity_grams','')::numeric;
    v_unit := COALESCE(v_it->>'unit_of_sale', v_product.unit_of_sale, 'un');

    -- Ficha técnica tem prioridade
    IF EXISTS (SELECT 1 FROM public.product_recipes WHERE product_id = v_product.id) THEN
      FOR v_recipe IN
        SELECT pr.stock_item_id, pr.quantity AS r_qty, pr.unit AS r_unit, si.unit AS item_unit, si.current_qty, si.average_cost
        FROM public.product_recipes pr
        JOIN public.stock_items si ON si.id = pr.stock_item_id
        WHERE pr.product_id = v_product.id
      LOOP
        v_consume := v_recipe.r_qty * v_qty;
        -- se produto vendido por peso, escala proporcionalmente ao "quantity_grams / basis"
        IF v_qty_grams IS NOT NULL AND v_unit IN ('kg','g','L','ml') THEN
          v_consume := v_recipe.r_qty * (v_qty_grams / CASE WHEN v_unit IN ('kg','L') THEN 1000 ELSE 1 END) * v_qty;
        END IF;
        -- converter unidade da receita para unidade do insumo
        v_consume := public.convert_stock_qty(v_consume, v_recipe.r_unit, v_recipe.item_unit);
        v_new_qty := v_recipe.current_qty - v_consume;
        UPDATE public.stock_items SET current_qty = v_new_qty WHERE id = v_recipe.stock_item_id;
        INSERT INTO public.stock_movements
          (restaurant_id, stock_item_id, product_id, type, quantity, unit_cost, total_cost, reference_type, reference_id)
        VALUES
          (p_restaurant_id, v_recipe.stock_item_id, v_product.id, 'saida_venda', -v_consume,
           v_recipe.average_cost, v_recipe.average_cost * v_consume, p_reference_type, p_reference_id);
      END LOOP;
      v_affected_products := v_affected_products || v_product.id;
    ELSIF v_product.track_stock THEN
      v_consume := v_qty;
      IF v_qty_grams IS NOT NULL AND v_unit IN ('kg','g','L','ml') THEN
        v_consume := (v_qty_grams / CASE WHEN v_unit IN ('kg','L') THEN 1000 ELSE 1 END) * v_qty;
      END IF;
      UPDATE public.products SET stock_qty = COALESCE(stock_qty,0) - v_consume WHERE id = v_product.id;
      INSERT INTO public.stock_movements
        (restaurant_id, product_id, type, quantity, unit_cost, total_cost, reference_type, reference_id)
      VALUES
        (p_restaurant_id, v_product.id, 'saida_venda', -v_consume, 0, 0, p_reference_type, p_reference_id);
      v_affected_products := v_affected_products || v_product.id;
    END IF;
  END LOOP;

  -- refresh availability
  PERFORM public.refresh_product_availability(pid)
  FROM unnest(v_affected_products) AS pid;
END;
$$;

-- ============ TRIGGERS DE BAIXA AUTOMÁTICA ============
CREATE OR REPLACE FUNCTION public.trg_deduct_order_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_should boolean := false;
BEGIN
  IF NEW.stock_deducted_at IS NOT NULL THEN RETURN NEW; END IF;
  -- concluir ou pagar dispara baixa
  IF NEW.status = 'completed' THEN v_should := true; END IF;
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN v_should := true; END IF;

  IF NOT v_should THEN RETURN NEW; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id,
    'quantity', oi.quantity,
    'quantity_grams', COALESCE(oi.final_quantity_grams, oi.quantity_grams),
    'unit_of_sale', oi.unit_of_sale
  )), '[]'::jsonb) INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = NEW.id;

  PERFORM public.apply_items_stock_deduction(NEW.restaurant_id, 'order', NEW.id::text, v_items);
  NEW.stock_deducted_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deduct_stock_on_order_change ON public.orders;
CREATE TRIGGER deduct_stock_on_order_change
BEFORE UPDATE ON public.orders
FOR EACH ROW
WHEN (
  (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  OR (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid')
)
EXECUTE FUNCTION public.trg_deduct_order_stock();

CREATE OR REPLACE FUNCTION public.trg_deduct_table_order_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF NEW.stock_deducted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', toi.product_id,
    'quantity', toi.quantity,
    'unit_of_sale', 'un'
  )), '[]'::jsonb) INTO v_items
  FROM public.table_order_items toi
  WHERE toi.table_order_id = NEW.id AND toi.status <> 'cancelled';

  PERFORM public.apply_items_stock_deduction(NEW.restaurant_id, 'table_order', NEW.id::text, v_items);
  NEW.stock_deducted_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deduct_stock_on_table_order_paid ON public.table_orders;
CREATE TRIGGER deduct_stock_on_table_order_paid
BEFORE UPDATE ON public.table_orders
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')
EXECUTE FUNCTION public.trg_deduct_table_order_stock();

-- ============ RPC: low stock summary ============
CREATE OR REPLACE FUNCTION public.get_low_stock_items(p_restaurant_id uuid)
RETURNS TABLE(id uuid, name text, current_qty numeric, min_qty numeric, unit text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, current_qty, min_qty, unit
  FROM public.stock_items
  WHERE restaurant_id = p_restaurant_id
    AND is_active = true
    AND current_qty <= min_qty
  ORDER BY (current_qty - min_qty) ASC, name;
$$;
