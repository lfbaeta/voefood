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

// Reprocess a rejected/error/processing invoice: consult Focus by ref; if still pending, do nothing.
// If the invoice is rejected and the caller sets `retry=true`, re-POST original raw_payload with new ref.
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

    const { restaurant_id, invoice_ids, retry_rejected } = await req.json();
    if (!restaurant_id) return new Response(JSON.stringify({ error: 'restaurant_id required' }), { status: 400, headers: corsHeaders });

    const { data: isAdmin } = await admin.rpc('is_admin_of_restaurant', {
      _user_id: userId, _restaurant_id: restaurant_id,
    });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });

    const { data: cfg } = await admin.from('fiscal_config').select('environment').eq('restaurant_id', restaurant_id).maybeSingle();
    const env = cfg?.environment ?? 'homologacao';
    const providerToken = focusToken(env);
    if (!providerToken) return new Response(JSON.stringify({ error: 'Focus token missing' }), { status: 500, headers: corsHeaders });

    let q = admin.from('fiscal_invoices').select('*').eq('restaurant_id', restaurant_id);
    if (Array.isArray(invoice_ids) && invoice_ids.length > 0) {
      q = q.in('id', invoice_ids);
    } else {
      q = q.in('status', retry_rejected ? ['processing', 'rejected', 'error'] : ['processing']);
    }
    const { data: invs } = await q.limit(50);
    const list = (invs as any[]) ?? [];

    const results: any[] = [];
    for (const inv of list) {
      try {
        if (inv.status === 'processing') {
          const url = `${focusBase(env)}/v2/nfce/${encodeURIComponent(inv.reference)}`;
          const r = await fetch(url, { headers: { Authorization: basicAuth(providerToken) } });
          const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
          const status = j?.status;
          const patch: any = { raw_response: j ?? { raw: t } };
          if (status === 'autorizado') {
            patch.status = 'authorized';
            patch.chave_acesso = j?.chave_nfe ?? inv.chave_acesso;
            patch.numero = j?.numero ?? inv.numero;
            patch.serie = j?.serie ?? inv.serie;
            patch.protocolo = j?.protocolo ?? inv.protocolo;
            patch.xml_url = j?.caminho_xml_nota_fiscal ?? inv.xml_url;
            patch.danfe_url = j?.caminho_danfe ?? inv.danfe_url;
            patch.qr_code_url = j?.qrcode_url ?? inv.qr_code_url;
            patch.data_autorizacao = new Date().toISOString();
          } else if (status === 'erro_autorizacao' || status === 'denegado') {
            patch.status = 'rejected';
            patch.rejection_message = (j?.mensagem_sefaz || j?.mensagem || '').slice(0, 500);
          }
          await admin.from('fiscal_invoices').update(patch).eq('id', inv.id);
          results.push({ id: inv.id, action: 'checked', status: patch.status ?? inv.status });
          continue;
        }

        if (retry_rejected && (inv.status === 'rejected' || inv.status === 'error') && inv.raw_payload) {
          const newRef = `${inv.reference}-retry-${Date.now().toString(36)}`;
          const url = `${focusBase(env)}/v2/nfce?ref=${encodeURIComponent(newRef)}`;
          const r = await fetch(url, {
            method: 'POST',
            headers: { Authorization: basicAuth(providerToken), 'Content-Type': 'application/json' },
            body: JSON.stringify(inv.raw_payload),
          });
          const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
          const ok = r.ok || r.status === 202;
          await admin.from('fiscal_events').insert({
            invoice_id: inv.id, restaurant_id, event_type: 'retry', user_id: userId,
            payload: { status: r.status, response: j ?? t, new_reference: newRef },
          });
          const patch: any = {
            reference: newRef, raw_response: j ?? { raw: t },
            status: ok ? (j?.status === 'autorizado' ? 'authorized' : 'processing') : 'rejected',
            rejection_message: !ok ? (j?.mensagem || j?.erros?.[0]?.mensagem || t).slice(0, 500) : null,
          };
          if (j?.chave_nfe) patch.chave_acesso = j.chave_nfe;
          if (j?.numero) patch.numero = j.numero;
          if (j?.caminho_xml_nota_fiscal) patch.xml_url = j.caminho_xml_nota_fiscal;
          if (j?.caminho_danfe) patch.danfe_url = j.caminho_danfe;
          if (j?.qrcode_url) patch.qr_code_url = j.qrcode_url;
          if (j?.status === 'autorizado') patch.data_autorizacao = new Date().toISOString();
          await admin.from('fiscal_invoices').update(patch).eq('id', inv.id);
          results.push({ id: inv.id, action: 'retried', status: patch.status });
        }
      } catch (e: any) {
        results.push({ id: inv.id, action: 'error', error: e?.message ?? 'unknown' });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fiscal-reprocess', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
