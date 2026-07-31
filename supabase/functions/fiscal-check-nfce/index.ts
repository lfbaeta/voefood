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

    const { invoice_id } = await req.json();
    const { data: inv } = await admin.from('fiscal_invoices').select('*').eq('id', invoice_id).maybeSingle();
    if (!inv) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: corsHeaders });

    const { data: isAdmin } = await admin.rpc('is_admin_of_restaurant', {
      _user_id: userId, _restaurant_id: inv.restaurant_id,
    });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });

    const { data: cfg } = await admin.from('fiscal_config').select('environment').eq('restaurant_id', inv.restaurant_id).maybeSingle();
    const env = cfg?.environment ?? 'homologacao';
    const providerToken = focusToken(env);
    if (!providerToken) return new Response(JSON.stringify({ error: 'Focus token missing' }), { status: 500, headers: corsHeaders });

    const url = `${focusBase(env)}/v2/nfce/${encodeURIComponent(inv.reference)}`;
    const resp = await fetch(url, { headers: { Authorization: basicAuth(providerToken) } });
    const respJson = await resp.json().catch(() => null);

    if (respJson?.status === 'autorizado') {
      await admin.from('fiscal_invoices').update({
        status: 'authorized',
        chave_acesso: respJson.chave_nfe ?? inv.chave_acesso,
        numero: respJson.numero ?? inv.numero,
        protocolo: respJson.protocolo ?? inv.protocolo,
        xml_url: respJson.caminho_xml_nota_fiscal ?? inv.xml_url,
        danfe_url: respJson.caminho_danfe ?? inv.danfe_url,
        qr_code_url: respJson.qrcode_url ?? inv.qr_code_url,
        data_autorizacao: inv.data_autorizacao ?? new Date().toISOString(),
        raw_response: respJson,
      }).eq('id', inv.id);
    } else if (respJson?.status === 'erro_autorizacao' || respJson?.status === 'denegado') {
      await admin.from('fiscal_invoices').update({
        status: 'rejected',
        rejection_message: (respJson.mensagem_sefaz || respJson.mensagem || '').slice(0, 500),
        raw_response: respJson,
      }).eq('id', inv.id);
    }

    await admin.from('fiscal_events').insert({
      invoice_id: inv.id, restaurant_id: inv.restaurant_id, event_type: 'check',
      user_id: userId, payload: { status: resp.status, response: respJson },
    });

    return new Response(JSON.stringify({ ok: true, response: respJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fiscal-check-nfce', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
