import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENC_KEY = Deno.env.get('AI_CRED_ENCRYPTION_KEY');

const ALLOWED_PROVIDERS = new Set(['openai', 'gemini']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    // Cliente autenticado (valida o JWT do usuário)
    const authed = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await authed.auth.getUser();
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userRes.user.id;

    const body = await req.json();
    const action = String(body.action || '');
    const restaurant_id = String(body.restaurant_id || '');
    const provider = String(body.provider || '').toLowerCase();

    if (!restaurant_id) return json({ error: 'restaurant_id required' }, 400);
    if (!ALLOWED_PROVIDERS.has(provider)) return json({ error: 'invalid provider' }, 400);

    // Confirma que o usuário é o reseller dono do restaurante (ou admin)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isReseller } = await admin.rpc('is_reseller_of_restaurant', {
      _user_id: userId, _restaurant_id: restaurant_id,
    });
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isReseller && !isAdmin) return json({ error: 'forbidden' }, 403);

    if (action === 'status') {
      const { data } = await admin
        .from('org_ai_credentials')
        .select('provider, updated_at')
        .eq('restaurant_id', restaurant_id);
      return json({ providers: data ?? [] });
    }

    if (action === 'set') {
      const api_key = String(body.api_key || '');
      if (api_key.length < 8) return json({ error: 'api_key too short' }, 400);
      if (!ENC_KEY) {
        console.error('AI_CRED_ENCRYPTION_KEY not configured');
        return json({ error: 'encryption not configured' }, 500);
      }

      const { data: encrypted, error: encErr } = await admin
        .rpc('encrypt_ai_credential' as any, { p_key: ENC_KEY, p_plain: api_key });
      if (encErr || !encrypted) {
        console.error('encrypt failed', encErr);
        return json({ error: 'encrypt failed' }, 500);
      }

      const { error } = await admin
        .from('org_ai_credentials')
        .upsert(
          { restaurant_id, provider, api_key_encrypted: encrypted as string },
          { onConflict: 'restaurant_id,provider' },
        );
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === 'clear') {
      const { error } = await admin
        .from('org_ai_credentials')
        .delete()
        .eq('restaurant_id', restaurant_id)
        .eq('provider', provider);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e: any) {
    console.error('manage-ai-credential error', e);
    return json({ error: 'internal' }, 500);
  }
});