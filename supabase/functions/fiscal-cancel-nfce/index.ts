import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/fiscalCors.ts';

function focusBase(env: string) {
  return env === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
}
function focusToken(env: string) {
  return env === 'producao' ? Deno.env.get('FOCUS_NFE_TOKEN_PRODUCAO') : Deno.env.get('FOCUS_NFE_TOKEN_HOMOLOGACAO');
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
    if (!claims?.claims?.sub) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    const userId = claims.claims.sub;

    const { invoice_id, justificativa } = await req.json();
    if (!invoice_id || !justificativa || justificativa.length < 15) {
      return new Response(JSON.stringify({ error: 'justificativa (mín. 15 chars) obrigatória' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: inv } = await admin.from('fiscal_invoices').select('*').eq('id', invoice_id).maybeSingle();
    if (!inv) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: corsHeaders });
    if (inv.status !== 'authorized') {
      return new Response(JSON.stringify({ error: 'Only authorized invoices can be cancelled' }), { status: 400, headers: corsHeaders });
    }

    const { data: isAdmin } = await admin.rpc('is_admin_of_restaurant', {
      _user_id: userId, _restaurant_id: inv.restaurant_id,
    });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });

    const { data: cfg } = await admin.from('fiscal_config').select('environment').eq('restaurant_id', inv.restaurant_id).maybeSingle();
    const env = cfg?.environment ?? 'homologacao';
    const providerToken = focusToken(env);
    if (!providerToken) return new Response(JSON.stringify({ error: 'Focus token missing' }), { status: 500, headers: corsHeaders });

    const url = `${focusBase(env)}/v2/nfce/${encodeURIComponent(inv.reference)}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: basicAuth(providerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ justificativa }),
    });
    const respText = await resp.text();
    let respJson: any = null; try { respJson = JSON.parse(respText); } catch {}

    await admin.from('fiscal_events').insert({
      invoice_id: inv.id, restaurant_id: inv.restaurant_id, event_type: 'cancel', user_id: userId,
      payload: { status: resp.status, justificativa, response: respJson ?? respText },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Focus NFe rejected', status: resp.status, details: respJson ?? respText }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('fiscal_invoices').update({
      status: 'cancelled', data_cancelamento: new Date().toISOString(),
      cancellation_reason: justificativa,
    }).eq('id', inv.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fiscal-cancel-nfce', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
