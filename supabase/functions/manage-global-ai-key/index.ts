import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mask(v: string | null): string | null {
  if (!v) return null;
  if (v.length <= 8) return '****';
  return v.slice(0, 4) + '••••' + v.slice(-4);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('missing auth header');
      return json({ error: 'unauthorized' }, 401);
    }

    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr || !userRes?.user) {
      console.error('getUser failed', userErr);
      return json({ error: 'unauthorized' }, 401);
    }
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check reseller or admin role via direct queries (more reliable than RPCs)
    const [{ data: resellerRow }, { data: adminRole }] = await Promise.all([
      admin.from('resellers').select('id').eq('user_id', userId).eq('is_active', true).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle(),
    ]);

    if (!resellerRow && !adminRole) {
      console.error('forbidden - user not reseller or admin', { userId });
      return json({ error: 'forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');

    if (action === 'status') {
      const { data } = await admin
        .from('global_ai_config')
        .select('openai_api_key, updated_at')
        .eq('id', true)
        .maybeSingle();
      return json({
        configured: !!data?.openai_api_key,
        masked: mask(data?.openai_api_key ?? null),
        updated_at: data?.updated_at ?? null,
      });
    }

    if (action === 'set') {
      const api_key = String(body.api_key || '').trim();
      if (api_key.length < 20) return json({ error: 'api_key too short' }, 400);
      const { error } = await admin
        .from('global_ai_config')
        .upsert(
          { id: true, openai_api_key: api_key, updated_by: userId, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) {
        console.error('set failed', error);
        return json({ error: 'set_failed', details: error.message }, 500);
      }
      return json({ ok: true });
    }

    if (action === 'clear') {
      const { error } = await admin
        .from('global_ai_config')
        .upsert(
          { id: true, openai_api_key: null, updated_by: userId, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) return json({ error: 'clear_failed', details: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e: any) {
    console.error('manage-global-ai-key error', e);
    return json({ error: 'internal' }, 500);
  }
});
