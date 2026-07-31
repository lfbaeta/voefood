
-- ============ Extensões ============
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ Agentes ============
CREATE TABLE public.restaurant_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'attendant',
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_steps INT NOT NULL DEFAULT 8,
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_restaurant_agents_rest ON public.restaurant_agents(restaurant_id);
CREATE UNIQUE INDEX uniq_one_default_agent_per_restaurant
  ON public.restaurant_agents(restaurant_id) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_agents TO authenticated;
GRANT ALL ON public.restaurant_agents TO service_role;
ALTER TABLE public.restaurant_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents viewable by restaurant admins and resellers"
  ON public.restaurant_agents FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Agents insertable by restaurant admins and resellers"
  ON public.restaurant_agents FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Agents updatable by restaurant admins and resellers"
  ON public.restaurant_agents FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Agents deletable by restaurant admins and resellers"
  ON public.restaurant_agents FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_restaurant_agents_updated_at
  BEFORE UPDATE ON public.restaurant_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Limites de segurança ============
CREATE TABLE public.agent_safety_limits (
  restaurant_id UUID PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  max_tool_executions_per_day INT NOT NULL DEFAULT 5000,
  max_cost_cents_per_day INT NOT NULL DEFAULT 50000,
  cancel_max_value_cents INT NOT NULL DEFAULT 20000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agent_safety_limits TO authenticated;
GRANT ALL ON public.agent_safety_limits TO service_role;
ALTER TABLE public.agent_safety_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Safety limits viewable by restaurant admins and resellers"
  ON public.agent_safety_limits FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Safety limits manageable by restaurant admins and resellers"
  ON public.agent_safety_limits FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Safety limits updatable by restaurant admins and resellers"
  ON public.agent_safety_limits FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

-- ============ Auditoria de execuções ============
CREATE TABLE public.agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.restaurant_agents(id) ON DELETE SET NULL,
  agent_name TEXT,
  contact_id UUID,
  conversation_id UUID,
  channel TEXT,
  tool_name TEXT NOT NULL,
  input JSONB,
  output JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration_ms INT,
  estimated_cost_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tool_exec_restaurant_date ON public.agent_tool_executions(restaurant_id, created_at DESC);
CREATE INDEX idx_tool_exec_conversation ON public.agent_tool_executions(conversation_id);

GRANT SELECT ON public.agent_tool_executions TO authenticated;
GRANT ALL ON public.agent_tool_executions TO service_role;
ALTER TABLE public.agent_tool_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tool executions viewable by restaurant admins and resellers"
  ON public.agent_tool_executions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
-- inserts apenas via service_role (edge functions)

-- ============ Fila de outreach ============
CREATE TABLE public.ai_outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  conversation_id UUID,
  agent_id UUID REFERENCES public.restaurant_agents(id) ON DELETE SET NULL,
  objective TEXT NOT NULL,
  extra_context TEXT,
  snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'scheduled',
  next_run_at TIMESTAMPTZ NOT NULL,
  followups_sent INT NOT NULL DEFAULT 0,
  max_followups INT NOT NULL DEFAULT 3,
  followup_interval_hours INT NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outreach_due ON public.ai_outreach_queue(next_run_at) WHERE status = 'scheduled';
CREATE INDEX idx_outreach_restaurant ON public.ai_outreach_queue(restaurant_id, status);

GRANT SELECT, UPDATE, DELETE ON public.ai_outreach_queue TO authenticated;
GRANT ALL ON public.ai_outreach_queue TO service_role;
ALTER TABLE public.ai_outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Outreach viewable by restaurant admins and resellers"
  ON public.ai_outreach_queue FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Outreach updatable by restaurant admins and resellers"
  ON public.ai_outreach_queue FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Outreach deletable by restaurant admins and resellers"
  ON public.ai_outreach_queue FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_outreach_updated_at
  BEFORE UPDATE ON public.ai_outreach_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Roteamento de IA ============
CREATE TABLE public.org_ai_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  capability TEXT NOT NULL DEFAULT 'agent_chat',
  provider TEXT NOT NULL DEFAULT 'lovable',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, capability)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_ai_routing TO authenticated;
GRANT ALL ON public.org_ai_routing TO service_role;
ALTER TABLE public.org_ai_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Routing viewable by restaurant admins and resellers"
  ON public.org_ai_routing FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Routing manageable by reseller"
  ON public.org_ai_routing FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Routing updatable by reseller"
  ON public.org_ai_routing FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_reseller_of_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Routing deletable by reseller"
  ON public.org_ai_routing FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_org_ai_routing_updated_at
  BEFORE UPDATE ON public.org_ai_routing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Credenciais externas (criptografadas) ============
CREATE TABLE public.org_ai_credentials (
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, provider)
);
-- Sem grants para anon/authenticated: somente service_role (edge functions) acessam.
GRANT ALL ON public.org_ai_credentials TO service_role;
ALTER TABLE public.org_ai_credentials ENABLE ROW LEVEL SECURITY;
-- Sem policies: nenhum acesso direto do cliente.

CREATE TRIGGER trg_org_ai_credentials_updated_at
  BEFORE UPDATE ON public.org_ai_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Debounce do bot ============
CREATE TABLE public.bot_debounce (
  conversation_id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  fire_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bot_debounce_fire ON public.bot_debounce(fire_at);
-- Sem grants: somente service_role manipula.
GRANT ALL ON public.bot_debounce TO service_role;
ALTER TABLE public.bot_debounce ENABLE ROW LEVEL SECURITY;

-- ============ Vínculo conversa → pedido ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS conversation_id UUID,
  ADD COLUMN IF NOT EXISTS created_by_agent_id UUID REFERENCES public.restaurant_agents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_conversation ON public.orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent ON public.orders(created_by_agent_id);
