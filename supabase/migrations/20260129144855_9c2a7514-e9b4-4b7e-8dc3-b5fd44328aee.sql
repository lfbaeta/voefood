-- Ativar proteção de senhas vazadas não pode ser feito via SQL
-- É uma configuração do Auth que precisa ser ativada via dashboard/API

-- Vamos garantir que as políticas INSERT problemáticas estejam corrigidas
-- Verificar e corrigir políticas WITH CHECK (true) para INSERT/UPDATE/DELETE

-- landing_page_leads - permitir INSERT público mas restringir SELECT
DROP POLICY IF EXISTS "Allow public insert for leads" ON public.landing_page_leads;
DROP POLICY IF EXISTS "Leads publicly insertable" ON public.landing_page_leads;
DROP POLICY IF EXISTS "Resellers can view their leads" ON public.landing_page_leads;

-- INSERT público para captura de leads (necessário para landing page)
CREATE POLICY "Leads publicly insertable"
ON public.landing_page_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- SELECT apenas para resellers
CREATE POLICY "Resellers can view their leads"
ON public.landing_page_leads
FOR SELECT
TO authenticated
USING (
  reseller_id IN (
    SELECT id FROM public.resellers WHERE user_id = auth.uid()
  )
);

-- Corrigir table_orders INSERT
DROP POLICY IF EXISTS "Table orders can be created" ON public.table_orders;
DROP POLICY IF EXISTS "Table orders insertable by admin or waiter" ON public.table_orders;

CREATE POLICY "Table orders insertable by admin or waiter"
ON public.table_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_of_restaurant(auth.uid(), restaurant_id)
);

-- Permitir INSERT anônimo apenas para mesas (garçons sem login)
CREATE POLICY "Table orders insertable anonymously with valid table"
ON public.table_orders
FOR INSERT
TO anon
WITH CHECK (
  table_id IS NOT NULL 
  AND EXISTS (SELECT 1 FROM public.tables WHERE id = table_id)
);

-- Corrigir table_order_items INSERT
DROP POLICY IF EXISTS "Table order items can be created" ON public.table_order_items;
DROP POLICY IF EXISTS "Table order items insertable" ON public.table_order_items;

CREATE POLICY "Table order items insertable"
ON public.table_order_items
FOR INSERT
TO authenticated, anon
WITH CHECK (
  table_order_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.table_orders 
    WHERE id = table_order_id
    AND status IN ('open', 'requesting_bill')
  )
);