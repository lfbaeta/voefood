import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/fiscalCors.ts';

// Focus NFe posts to configured URL. We optionally validate a shared secret via query ?s=...
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const expected = Deno.env.get('FOCUS_NFE_WEBHOOK_SECRET');
    if (expected && url.searchParams.get('s') !== expected) {
      return new Response('forbidden', { status: 403 });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    // Focus posts: { ref, status, chave_nfe, protocolo, caminho_xml_nota_fiscal, caminho_danfe, qrcode_url, mensagem_sefaz, numero, serie }
    const reference = body.ref;
    if (!reference) return new Response('ok', { headers: corsHeaders });

    const { data: inv } = await admin.from('fiscal_invoices').select('*').eq('reference', reference).maybeSingle();
    if (!inv) return new Response('ok', { headers: corsHeaders });

    const patch: any = { raw_response: body };
    if (body.status === 'autorizado') {
      patch.status = 'authorized';
      patch.chave_acesso = body.chave_nfe ?? inv.chave_acesso;
      patch.numero = body.numero ?? inv.numero;
      patch.serie = body.serie ?? inv.serie;
      patch.protocolo = body.protocolo ?? inv.protocolo;
      patch.xml_url = body.caminho_xml_nota_fiscal ?? inv.xml_url;
      patch.danfe_url = body.caminho_danfe ?? inv.danfe_url;
      patch.qr_code_url = body.qrcode_url ?? inv.qr_code_url;
      patch.data_autorizacao = inv.data_autorizacao ?? new Date().toISOString();
    } else if (body.status === 'cancelado') {
      patch.status = 'cancelled';
      patch.data_cancelamento = new Date().toISOString();
    } else if (body.status === 'erro_autorizacao' || body.status === 'denegado') {
      patch.status = 'rejected';
      patch.rejection_message = (body.mensagem_sefaz || body.mensagem || '').slice(0, 500);
    }

    await admin.from('fiscal_invoices').update(patch).eq('id', inv.id);
    await admin.from('fiscal_events').insert({
      invoice_id: inv.id, restaurant_id: inv.restaurant_id, event_type: 'webhook', payload: body,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fiscal-webhook', e);
    return new Response('error', { status: 500 });
  }
});
