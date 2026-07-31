
-- =========================================
-- WhatsApp / Evolution GO — Fase 1
-- =========================================

-- Limite de instâncias por plano
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS wa_instances_limit integer NOT NULL DEFAULT 1;

-- =========================================
-- 1) reseller_evolution_config
-- =========================================
CREATE TABLE public.reseller_evolution_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL UNIQUE,
  server_url text NOT NULL,
  global_api_key text NOT NULL,
  is_configured boolean NOT NULL DEFAULT false,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants: NÃO damos SELECT ao authenticated diretamente na tabela
-- para evitar exposição de global_api_key. Client lerá via VIEW segura.
GRANT INSERT, UPDATE, DELETE ON public.reseller_evolution_config TO authenticated;
GRANT ALL ON public.reseller_evolution_config TO service_role;

ALTER TABLE public.reseller_evolution_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller can insert own evolution config"
  ON public.reseller_evolution_config FOR INSERT TO authenticated
  WITH CHECK (reseller_id = public.get_user_reseller_id(auth.uid()));

CREATE POLICY "Reseller can update own evolution config"
  ON public.reseller_evolution_config FOR UPDATE TO authenticated
  USING (reseller_id = public.get_user_reseller_id(auth.uid()))
  WITH CHECK (reseller_id = public.get_user_reseller_id(auth.uid()));

CREATE POLICY "Reseller can delete own evolution config"
  ON public.reseller_evolution_config FOR DELETE TO authenticated
  USING (reseller_id = public.get_user_reseller_id(auth.uid()));

-- VIEW segura para o client (sem global_api_key, com máscara)
CREATE VIEW public.reseller_evolution_config_safe
WITH (security_invoker = true) AS
SELECT
  id,
  reseller_id,
  server_url,
  CASE
    WHEN global_api_key IS NOT NULL AND length(global_api_key) > 0
      THEN repeat('•', greatest(length(global_api_key) - 4, 0)) || right(global_api_key, 4)
    ELSE NULL
  END AS global_api_key_masked,
  (global_api_key IS NOT NULL AND length(global_api_key) > 0) AS has_api_key,
  is_configured,
  last_tested_at,
  created_at,
  updated_at
FROM public.reseller_evolution_config
WHERE reseller_id = public.get_user_reseller_id(auth.uid());

GRANT SELECT ON public.reseller_evolution_config_safe TO authenticated;

CREATE TRIGGER trg_reseller_evolution_config_updated_at
  BEFORE UPDATE ON public.reseller_evolution_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 2) evolution_instances
-- =========================================
CREATE TABLE public.evolution_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  reseller_id uuid NOT NULL,
  instance_name text NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','waiting_qr','connected','paused')),
  is_default boolean NOT NULL DEFAULT false,
  qr_code text,
  qr_expires_at timestamptz,
  webhook_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, instance_name)
);

CREATE INDEX idx_evolution_instances_restaurant ON public.evolution_instances(restaurant_id);
CREATE INDEX idx_evolution_instances_reseller ON public.evolution_instances(reseller_id);
CREATE INDEX idx_evolution_instances_webhook_token ON public.evolution_instances(webhook_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evolution_instances TO authenticated;
GRANT ALL ON public.evolution_instances TO service_role;

ALTER TABLE public.evolution_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller and restaurant admin can view instances"
  ON public.evolution_instances FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Reseller can manage instances"
  ON public.evolution_instances FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Reseller and restaurant admin can update instances"
  ON public.evolution_instances FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Reseller can delete instances"
  ON public.evolution_instances FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE TRIGGER trg_evolution_instances_updated_at
  BEFORE UPDATE ON public.evolution_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 3) wa_contacts
-- =========================================
CREATE TABLE public.wa_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  name text,
  avatar_url text,
  linked_customer_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, phone_e164)
);

CREATE INDEX idx_wa_contacts_restaurant ON public.wa_contacts(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_contacts TO authenticated;
GRANT ALL ON public.wa_contacts TO service_role;

ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view contacts"
  ON public.wa_contacts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can manage contacts"
  ON public.wa_contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can update contacts"
  ON public.wa_contacts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can delete contacts"
  ON public.wa_contacts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE TRIGGER trg_wa_contacts_updated_at
  BEFORE UPDATE ON public.wa_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 4) wa_conversations
-- =========================================
CREATE TABLE public.wa_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','pending','resolved','snoozed')),
  assigned_user_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  ai_enabled boolean NOT NULL DEFAULT false,
  ai_agent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, contact_id)
);

CREATE INDEX idx_wa_conversations_restaurant ON public.wa_conversations(restaurant_id);
CREATE INDEX idx_wa_conversations_status ON public.wa_conversations(restaurant_id, status);
CREATE INDEX idx_wa_conversations_last_msg ON public.wa_conversations(restaurant_id, last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_conversations TO authenticated;
GRANT ALL ON public.wa_conversations TO service_role;

ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view conversations"
  ON public.wa_conversations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can insert conversations"
  ON public.wa_conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can update conversations"
  ON public.wa_conversations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can delete conversations"
  ON public.wa_conversations FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE TRIGGER trg_wa_conversations_updated_at
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 5) wa_messages
-- =========================================
CREATE TABLE public.wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  wa_message_id text,
  from_me boolean NOT NULL DEFAULT false,
  content_type text NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text','image','audio','video','document','sticker','location','contact')),
  text text,
  media_url text,
  media_mime text,
  media_filename text,
  reply_to_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed')),
  sender_user_id uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_messages_conversation ON public.wa_messages(conversation_id, created_at);
CREATE INDEX idx_wa_messages_restaurant ON public.wa_messages(restaurant_id);
CREATE INDEX idx_wa_messages_wa_id ON public.wa_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.wa_messages TO authenticated;
GRANT ALL ON public.wa_messages TO service_role;

ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view messages"
  ON public.wa_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can insert messages"
  ON public.wa_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE POLICY "Tenant can update messages"
  ON public.wa_messages FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

-- Trigger: sync last_message_* na conversation
CREATE OR REPLACE FUNCTION public.sync_wa_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wa_conversations
  SET
    last_message_at = COALESCE(NEW.sent_at, NEW.created_at),
    last_message_preview = LEFT(
      COALESCE(
        NEW.text,
        CASE NEW.content_type
          WHEN 'image' THEN '📷 Imagem'
          WHEN 'audio' THEN '🎤 Áudio'
          WHEN 'video' THEN '🎥 Vídeo'
          WHEN 'document' THEN '📄 Documento'
          WHEN 'sticker' THEN '🌟 Sticker'
          WHEN 'location' THEN '📍 Localização'
          WHEN 'contact' THEN '👤 Contato'
          ELSE 'Mensagem'
        END
      ), 200),
    unread_count = CASE
      WHEN NEW.direction = 'in' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_wa_conversation_last_message
  AFTER INSERT ON public.wa_messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_wa_conversation_last_message();

-- =========================================
-- 6) Realtime publication
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.evolution_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;

ALTER TABLE public.evolution_instances REPLICA IDENTITY FULL;
ALTER TABLE public.wa_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.wa_messages REPLICA IDENTITY FULL;
