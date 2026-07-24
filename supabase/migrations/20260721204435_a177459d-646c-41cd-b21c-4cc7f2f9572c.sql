-- 1. Colunas de automação no agente
ALTER TABLE public.restaurant_agents
  ADD COLUMN IF NOT EXISTS auto_notify_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_statuses text[] NOT NULL DEFAULT ARRAY['pix_pending','accepted','preparing','delivery','completed','cancelled']::text[],
  ADD COLUMN IF NOT EXISTS can_close_orders boolean NOT NULL DEFAULT true;

ALTER TABLE public.agent_knowledge_chunks
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Dedupe de disparos
CREATE TABLE IF NOT EXISTS public.agent_status_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id bigint NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  wa_message_id text,
  UNIQUE (order_id, status)
);
GRANT ALL ON public.agent_status_dispatches TO service_role;
ALTER TABLE public.agent_status_dispatches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.agent_status_dispatches;
CREATE POLICY "service role only" ON public.agent_status_dispatches
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 3. Config interna
CREATE TABLE IF NOT EXISTS public.internal_webhook_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.internal_webhook_config TO service_role;
ALTER TABLE public.internal_webhook_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.internal_webhook_config;
CREATE POLICY "service role only" ON public.internal_webhook_config
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

INSERT INTO public.internal_webhook_config(key, value) VALUES
  ('functions_base_url', 'https://pfztejpzsawwbxuagwgb.supabase.co/functions/v1'),
  ('agent_notify_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 4. Trigger
CREATE OR REPLACE FUNCTION public.trg_notify_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_secret text;
  v_event text;
  v_request_id bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_method = 'pix' AND NEW.status = 'pending' THEN
      v_event := 'pix_pending';
    ELSE
      v_event := 'accepted_on_create';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := NEW.status;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT value INTO v_base FROM public.internal_webhook_config WHERE key = 'functions_base_url';
  SELECT value INTO v_secret FROM public.internal_webhook_config WHERE key = 'agent_notify_secret';
  IF v_base IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := v_base || '/agent-notify-order-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'event', v_event,
        'old_status', CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,
        'new_status', NEW.status
      ),
      timeout_milliseconds := 5000
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_notify_order_status http_post failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_status_ins ON public.orders;
CREATE TRIGGER trg_notify_order_status_ins
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_order_status();

DROP TRIGGER IF EXISTS trg_notify_order_status_upd ON public.orders;
CREATE TRIGGER trg_notify_order_status_upd
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_order_status();

-- 5. Backfill de ferramentas
UPDATE public.restaurant_agents
SET allowed_tools = ARRAY(
  SELECT DISTINCT unnest(
    coalesce(allowed_tools, '{}'::text[])
    || ARRAY[
      'consultar_cardapio',
      'consultar_produto_detalhado',
      'enviar_foto_produto',
      'enviar_link_produto',
      'enviar_link_cardapio',
      'consultar_base_conhecimento',
      'consultar_taxa_entrega',
      'consultar_horario_funcionamento',
      'consultar_cupons_ativos',
      'aplicar_cupom',
      'criar_pedido',
      'sugerir_complementos',
      'repetir_pedido',
      'consultar_status_pedido'
    ]
  )
)
WHERE allowed_tools IS NULL OR cardinality(allowed_tools) = 0;

-- 6. Policies do bucket agent-knowledge (path = <restaurant_id>/...)
DROP POLICY IF EXISTS "agent-knowledge admin read" ON storage.objects;
DROP POLICY IF EXISTS "agent-knowledge admin write" ON storage.objects;
DROP POLICY IF EXISTS "agent-knowledge admin update" ON storage.objects;
DROP POLICY IF EXISTS "agent-knowledge admin delete" ON storage.objects;

CREATE POLICY "agent-knowledge admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'agent-knowledge'
    AND (
      public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY "agent-knowledge admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agent-knowledge'
    AND (
      public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY "agent-knowledge admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'agent-knowledge'
    AND (
      public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY "agent-knowledge admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'agent-knowledge'
    AND (
      public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );