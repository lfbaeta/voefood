
-- pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============= agent_knowledge_chunks =============
CREATE TABLE IF NOT EXISTS public.agent_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'manual',
  source_label text,
  content text NOT NULL,
  embedding extensions.vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_knowledge_chunks_restaurant_idx
  ON public.agent_knowledge_chunks(restaurant_id);
CREATE INDEX IF NOT EXISTS agent_knowledge_chunks_embedding_idx
  ON public.agent_knowledge_chunks USING hnsw (embedding extensions.vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_knowledge_chunks TO authenticated;
GRANT ALL ON public.agent_knowledge_chunks TO service_role;
ALTER TABLE public.agent_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_kc_admin_select" ON public.agent_knowledge_chunks
  FOR SELECT TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_kc_admin_insert" ON public.agent_knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_kc_admin_update" ON public.agent_knowledge_chunks
  FOR UPDATE TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_kc_admin_delete" ON public.agent_knowledge_chunks
  FOR DELETE TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));

CREATE TRIGGER agent_knowledge_chunks_updated_at
  BEFORE UPDATE ON public.agent_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= agent_training_examples =============
CREATE TABLE IF NOT EXISTS public.agent_training_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.restaurant_agents(id) ON DELETE SET NULL,
  user_message text NOT NULL,
  good_assistant_message text NOT NULL,
  bad_assistant_message text,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_training_examples_restaurant_idx
  ON public.agent_training_examples(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_training_examples TO authenticated;
GRANT ALL ON public.agent_training_examples TO service_role;
ALTER TABLE public.agent_training_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_te_admin_select" ON public.agent_training_examples
  FOR SELECT TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_te_admin_insert" ON public.agent_training_examples
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_te_admin_update" ON public.agent_training_examples
  FOR UPDATE TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_te_admin_delete" ON public.agent_training_examples
  FOR DELETE TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));

CREATE TRIGGER agent_training_examples_updated_at
  BEFORE UPDATE ON public.agent_training_examples
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= restaurant_agent_versions =============
CREATE TABLE IF NOT EXISTS public.restaurant_agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.restaurant_agents(id) ON DELETE CASCADE,
  label text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS restaurant_agent_versions_agent_idx
  ON public.restaurant_agent_versions(agent_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.restaurant_agent_versions TO authenticated;
GRANT ALL ON public.restaurant_agent_versions TO service_role;
ALTER TABLE public.restaurant_agent_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_versions_admin_select" ON public.restaurant_agent_versions
  FOR SELECT TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_versions_admin_insert" ON public.restaurant_agent_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));
CREATE POLICY "agent_versions_admin_delete" ON public.restaurant_agent_versions
  FOR DELETE TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id) OR public.is_reseller(auth.uid()));

-- ============= products.agent_pitch =============
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS agent_pitch text;

-- ============= match_agent_knowledge RPC =============
CREATE OR REPLACE FUNCTION public.match_agent_knowledge(
  p_restaurant_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  source_label text,
  source_type text,
  content text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT
    k.id,
    k.source_label,
    k.source_type,
    k.content,
    1 - (k.embedding OPERATOR(extensions.<=>) p_query_embedding) AS similarity
  FROM public.agent_knowledge_chunks k
  WHERE k.restaurant_id = p_restaurant_id
    AND k.embedding IS NOT NULL
  ORDER BY k.embedding OPERATOR(extensions.<=>) p_query_embedding
  LIMIT GREATEST(1, LEAST(p_match_count, 20));
$$;

GRANT EXECUTE ON FUNCTION public.match_agent_knowledge(uuid, extensions.vector, int) TO service_role, authenticated;
