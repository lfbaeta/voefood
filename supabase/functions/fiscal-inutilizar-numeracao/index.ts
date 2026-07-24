import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/fiscalCors.ts';

function focusBase(env: string) {
  return env === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
}
function focusToken(env: string) {
  return env === 'producao'
    ? Deno.env.get('FOCUS_NFE_TOKEN_PRODUCAO')
    : Deno.env.get('FOCUS_NFE_TOKEN_HOMOLOGACAO');
}
function basicAuth(token: string) { return 'Basic ' + btoa(`${token}:`); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub;

    const { restaurant_id, serie, numero_inicial, numero_final, justificativa } = await req.json();
    if (!restaurant_id || !serie || !numero_inicial || !numero_final || !justificativa || justificativa.length < 15) {
      return new Response(JSON.stringify({ error: 'campos obrigatórios: serie, numero_inicial, numero_final, justificativa (>=15)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (Number(numero_final) < Number(numero_inicial)) {
      return new Response(JSON.stringify({ error: 'numero_final deve ser >= numero_inicial' }), { status: 400, headers: corsHeaders });
    }

    const { data: isAdmin } = await admin.rpc('is_admin_of_restaurant', {
      _user_id: userId, _restaurant_id: restaurant_id,
    });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });

    const { data: cfg } = await admin.from('fiscal_config').select('*').eq('restaurant_id', restaurant_id).maybeSingle();
    if (!cfg) return new Response(JSON.stringify({ error: 'fiscal_config missing' }), { status: 400, headers: corsHeaders });
    const providerToken = focusToken(cfg.environment);
    if (!providerToken) return new Response(JSON.stringify({ error: 'Focus token missing' }), { status: 500, headers: corsHeaders });

    const reference = `inut-${restaurant_id.slice(0, 8)}-${crypto.randomUUID()}`;
    const { data: inserted, error: insErr } = await admin.from('fiscal_inutilizacoes').insert({
      restaurant_id, serie: Number(serie),
      numero_inicial: Number(numero_inicial), numero_final: Number(numero_final),
      justificativa, reference, created_by: userId, status: 'processing',
    }).select().single();
    if (insErr) throw insErr;

    const payload = {
      cnpj: (cfg.cnpj || '').replace(/\D/g, ''),
      serie: Number(serie),
      numero_inicial: Number(numero_inicial),
      numero_final: Number(numero_final),
      justificativa,
    };

    const url = `${focusBase(cfg.environment)}/v2/nfce/inutilizacao?ref=${encodeURIComponent(reference)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: basicAuth(providerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const respText = await resp.text();
    let respJson: any = null; try { respJson = JSON.parse(respText); } catch {}

    const ok = resp.ok || resp.status === 202;
    await admin.from('fiscal_inutilizacoes').update({
      status: ok ? (respJson?.status === 'autorizado' ? 'authorized' : 'processing') : 'rejected',
      protocolo: respJson?.protocolo ?? null,
      rejection_message: !ok ? (respJson?.mensagem || respJson?.erros?.[0]?.mensagem || respText).slice(0, 500) : null,
      raw_response: respJson ?? { raw: respText },
    }).eq('id', inserted.id);

    return new Response(JSON.stringify({ ok, id: inserted.id, response: respJson ?? respText }), {
      status: ok ? 200 : resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fiscal-inutilizar-numeracao', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
