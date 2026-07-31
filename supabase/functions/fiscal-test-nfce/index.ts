import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/fiscalCors.ts';

// Diagnostic: emits a sample NFC-e in HOMOLOGAÇÃO using current fiscal_config.
// Does NOT persist to fiscal_invoices — pure health-check for the operator.

function basicAuth(token: string) { return 'Basic ' + btoa(`${token}:`); }

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

    const { restaurant_id } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id required' }), {
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
    if (!cfg) {
      return new Response(JSON.stringify({ error: 'Configuração fiscal não encontrada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const providerToken = Deno.env.get('FOCUS_NFE_TOKEN_HOMOLOGACAO');
    if (!providerToken) {
      return new Response(JSON.stringify({ error: 'FOCUS_NFE_TOKEN_HOMOLOGACAO não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reference = `nfce-test-${restaurant_id.slice(0, 8)}-${crypto.randomUUID()}`;
    const payload = {
      cnpj_emitente: (cfg.cnpj || '').replace(/\D/g, ''),
      presenca_comprador: '1',
      modalidade_frete: '9',
      local_destino: '1',
      natureza_operacao: 'Venda de mercadoria (teste homologação)',
      data_emissao: new Date().toISOString(),
      items: [{
        numero_item: 1,
        codigo_produto: 'TESTE01',
        descricao: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
        cfop: cfg.default_cfop || '5102',
        unidade_comercial: 'UN',
        quantidade_comercial: 1,
        valor_unitario_comercial: '0.01',
        valor_unitario_tributavel: '0.01',
        unidade_tributavel: 'UN',
        quantidade_tributavel: 1,
        codigo_ncm: cfg.default_ncm || '21069090',
        icms_origem: cfg.default_origem || '0',
        icms_situacao_tributaria: cfg.default_csosn || '102',
        pis_situacao_tributaria: '07',
        cofins_situacao_tributaria: '07',
      }],
      formas_pagamento: [{ forma_pagamento: '01', valor_pagamento: '0.01' }],
    };

    const url = `https://homologacao.focusnfe.com.br/v2/nfce?ref=${encodeURIComponent(reference)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: basicAuth(providerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let json: any = null; try { json = JSON.parse(text); } catch {}

    return new Response(JSON.stringify({
      ok: resp.ok || resp.status === 202,
      status: resp.status,
      reference,
      response: json ?? { raw: text },
      message: json?.mensagem || json?.mensagem_sefaz || json?.erros?.[0]?.mensagem || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('fiscal-test-nfce error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
