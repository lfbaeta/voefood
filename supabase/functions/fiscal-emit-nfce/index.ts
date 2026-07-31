import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/fiscalCors.ts';

function focusBase(env: string) {
  return env === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
}
function focusToken(env: string) {
  return env === 'producao'
    ? Deno.env.get('FOCUS_NFE_TOKEN_PRODUCAO')
    : Deno.env.get('FOCUS_NFE_TOKEN_HOMOLOGACAO');
}
function basicAuth(token: string) { return 'Basic ' + btoa(`${token}:`); }

// SEFAZ payment method codes
function mapPayment(method: string | null | undefined): string {
  const m = (method || '').toLowerCase();
  if (['dinheiro', 'money', 'cash'].includes(m)) return '01';
  if (['credit', 'credito', 'credit_card', 'card', 'cartao'].includes(m)) return '03';
  if (['debit', 'debito', 'debit_card'].includes(m)) return '04';
  if (['pix'].includes(m)) return '17';
  return '99';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub;

    const { restaurant_id, order_id, table_order_id, cpf, customer_name } = await req.json();
    if (!restaurant_id || (!order_id && !table_order_id)) {
      return new Response(JSON.stringify({ error: 'restaurant_id and order_id or table_order_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await admin.rpc('is_admin_of_restaurant', {
      _user_id: userId, _restaurant_id: restaurant_id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: cfg } = await admin
      .from('fiscal_config').select('*').eq('restaurant_id', restaurant_id).maybeSingle();
    if (!cfg || !cfg.is_enabled) {
      return new Response(JSON.stringify({ error: 'Fiscal module not enabled' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const providerToken = focusToken(cfg.environment);
    if (!providerToken) {
      return new Response(JSON.stringify({ error: 'Focus NFe token not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load order + items
    let items: any[] = [];
    let paymentMethod: string | null = null;
    let totalAmount = 0;
    let discount = 0;

    if (order_id) {
      const { data: order } = await admin.from('orders').select('*').eq('id', order_id).maybeSingle();
      if (!order || order.restaurant_id !== restaurant_id) throw new Error('order not found');
      const { data: oi } = await admin.from('order_items').select('*').eq('order_id', order_id);
      items = (oi ?? []).map((it: any) => ({
        name: it.product_name, quantity: Number(it.quantity),
        unit_price: Number(it.final_unit_price ?? it.unit_price),
      }));
      paymentMethod = order.payment_method;
      totalAmount = Number(order.total_amount);
    } else {
      const { data: torder } = await admin.from('table_orders').select('*').eq('id', table_order_id).maybeSingle();
      if (!torder || torder.restaurant_id !== restaurant_id) throw new Error('table_order not found');
      const { data: oi } = await admin.from('table_order_items').select('*').eq('table_order_id', table_order_id);
      items = (oi ?? []).filter((it: any) => it.status !== 'cancelled').map((it: any) => ({
        name: it.product_name, quantity: Number(it.quantity), unit_price: Number(it.unit_price),
      }));
      paymentMethod = torder.payment_method;
      totalAmount = Number(torder.total_amount);
      discount = Number(torder.discount ?? 0);
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items to invoice' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reference = `nfce-${restaurant_id.slice(0, 8)}-${crypto.randomUUID()}`;
    const valorProdutos = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

    const nfceItems = items.map((it, idx) => ({
      numero_item: idx + 1,
      codigo_produto: `PROD${idx + 1}`,
      descricao: it.name,
      cfop: cfg.default_cfop,
      unidade_comercial: 'UN',
      quantidade_comercial: it.quantity,
      valor_unitario_comercial: it.unit_price.toFixed(2),
      valor_unitario_tributavel: it.unit_price.toFixed(2),
      unidade_tributavel: 'UN',
      quantidade_tributavel: it.quantity,
      codigo_ncm: cfg.default_ncm,
      icms_origem: cfg.default_origem,
      icms_situacao_tributaria: cfg.default_csosn,
      pis_situacao_tributaria: '07',
      cofins_situacao_tributaria: '07',
    }));

    const payload: any = {
      cnpj_emitente: (cfg.cnpj || '').replace(/\D/g, ''),
      indicador_inscricao_estadual_destinatario: cpf ? '9' : undefined,
      cpf_destinatario: cpf ? cpf.replace(/\D/g, '') : undefined,
      nome_destinatario: customer_name || undefined,
      presenca_comprador: '1',
      modalidade_frete: '9',
      local_destino: '1',
      natureza_operacao: 'Venda de mercadoria',
      data_emissao: new Date().toISOString(),
      items: nfceItems,
      formas_pagamento: [{
        forma_pagamento: mapPayment(paymentMethod),
        valor_pagamento: totalAmount.toFixed(2),
      }],
      valor_desconto: discount > 0 ? discount.toFixed(2) : undefined,
    };

    // Insert invoice as processing
    const { data: invoice, error: insErr } = await admin.from('fiscal_invoices').insert({
      restaurant_id, reference, order_id: order_id ?? null, table_order_id: table_order_id ?? null,
      status: 'processing', valor_total: totalAmount, valor_produtos: valorProdutos,
      valor_desconto: discount, customer_cpf: cpf ?? null, customer_name: customer_name ?? null,
      payment_method: paymentMethod, raw_payload: payload, created_by: userId,
    }).select().single();
    if (insErr) throw insErr;

    const url = `${focusBase(cfg.environment)}/v2/nfce?ref=${encodeURIComponent(reference)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: basicAuth(providerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const respText = await resp.text();
    let respJson: any = null;
    try { respJson = JSON.parse(respText); } catch {}

    await admin.from('fiscal_events').insert({
      invoice_id: invoice.id, restaurant_id, event_type: 'create', user_id: userId,
      payload: { status: resp.status, response: respJson ?? respText },
    });

    if (!resp.ok && resp.status !== 202) {
      await admin.from('fiscal_invoices').update({
        status: 'rejected',
        rejection_message: (respJson?.mensagem || respJson?.erros?.[0]?.mensagem || respText).slice(0, 500),
        raw_response: respJson ?? { raw: respText },
      }).eq('id', invoice.id);

      return new Response(JSON.stringify({ error: 'Focus NFe rejected', status: resp.status, details: respJson ?? respText, invoice_id: invoice.id }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('fiscal_invoices').update({
      raw_response: respJson ?? { raw: respText },
      status: respJson?.status === 'autorizado' ? 'authorized' : 'processing',
      chave_acesso: respJson?.chave_nfe ?? null,
      numero: respJson?.numero ?? null,
      serie: respJson?.serie ?? cfg.serie,
      protocolo: respJson?.protocolo ?? null,
      xml_url: respJson?.caminho_xml_nota_fiscal ?? null,
      danfe_url: respJson?.caminho_danfe ?? null,
      qr_code_url: respJson?.qrcode_url ?? null,
      data_emissao: new Date().toISOString(),
      data_autorizacao: respJson?.status === 'autorizado' ? new Date().toISOString() : null,
    }).eq('id', invoice.id);

    return new Response(JSON.stringify({ ok: true, invoice_id: invoice.id, reference, response: respJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('fiscal-emit-nfce error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
