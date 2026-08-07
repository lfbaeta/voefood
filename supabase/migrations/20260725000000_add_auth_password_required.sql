-- Adiciona coluna para controle de obrigatoriedade de senha no acesso via revendedor
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS auth_password_required boolean NOT NULL DEFAULT true;

-- Atualiza a função de visualização pública para não incluir este campo (segurança)
-- Na verdade, useStoreConfig já filtra campos, mas é bom garantir que o RPC público não o retorne.
-- O RPC get_public_store_config já é limitado, não precisamos mexer nele se não quisermos expor o toggle.

GRANT SELECT, UPDATE ON public.store_config TO authenticated;
GRANT ALL ON public.store_config TO service_role;
