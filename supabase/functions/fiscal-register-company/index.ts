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

function basicAuth(token: string) {
  return 'Basic ' + btoa(`${token}:`);
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

    const { data: cfg, error: cfgErr } = await admin
      .from('fiscal_config').select('*').eq('restaurant_id', restaurant_id).maybeSingle();
    if (cfgErr || !cfg) throw new Error('fiscal_config not found');

    const providerToken = focusToken(cfg.environment);
    if (!providerToken) {
      return new Response(JSON.stringify({ error: 'Focus NFe token not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt CSC and certificate
    let cscToken: string | null = null;
    let certBase64: string | null = null;
    let certPassword: string | null = null;
    const encKey = Deno.env.get('AI_CRED_ENCRYPTION_KEY');
    if (encKey) {
      if (cfg.csc_token_cipher) {
        const { data: dec } = await admin.rpc('decrypt_ai_credential', {
          p_key: encKey, p_cipher: cfg.csc_token_cipher,
        });
        cscToken = dec as string;
      }
      if (cfg.certificado_cipher) {
        const { data: dec } = await admin.rpc('decrypt_ai_credential', {
          p_key: encKey, p_cipher: cfg.certificado_cipher,
        });
        certBase64 = dec as string;
      }
      if (cfg.certificado_password_cipher) {
        const { data: dec } = await admin.rpc('decrypt_ai_credential', {
          p_key: encKey, p_cipher: cfg.certificado_password_cipher,
        });
        certPassword = dec as string;
      }
    }

    const body = {
      nome: cfg.razao_social,
      nome_fantasia: cfg.nome_fantasia,
      cnpj: (cfg.cnpj || '').replace(/\D/g, ''),
      inscricao_estadual: cfg.ie,
      inscricao_municipal: cfg.im,
      regime_tributario: cfg.regime_tributario === 'simples_nacional' ? 1
        : cfg.regime_tributario === 'simples_nacional_excesso' ? 2 : 3,
      cep: (cfg.cep || '').replace(/\D/g, ''),
      logradouro: cfg.logradouro,
      numero: cfg.numero,
      complemento: cfg.complemento,
      bairro: cfg.bairro,
      municipio: cfg.municipio,
      uf: cfg.uf,
      codigo_municipio: cfg.codigo_municipio,
      habilita_nfce: true,
      csc_id_producao: cfg.environment === 'producao' ? cfg.csc_id : undefined,
      csc_producao: cfg.environment === 'producao' ? cscToken : undefined,
      csc_id_homologacao: cfg.environment === 'homologacao' ? cfg.csc_id : undefined,
      csc_homologacao: cfg.environment === 'homologacao' ? cscToken : undefined,
      arquivo_certificado_base64: certBase64 ?? undefined,
      senha_certificado: certPassword ?? undefined,
    };

    const url = `${focusBase(cfg.environment)}/v2/empresas`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: basicAuth(providerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const respText = await resp.text();
    let respJson: any = null;
    try { respJson = JSON.parse(respText); } catch {}

    const redacted = {
      ...body,
      arquivo_certificado_base64: certBase64 ? `[REDACTED ${certBase64.length}b]` : undefined,
      senha_certificado: certPassword ? '[REDACTED]' : undefined,
      csc_producao: cscToken && cfg.environment === 'producao' ? '[REDACTED]' : undefined,
      csc_homologacao: cscToken && cfg.environment === 'homologacao' ? '[REDACTED]' : undefined,
    };
    await admin.from('fiscal_events').insert({
      restaurant_id, event_type: 'register_company', user_id: userId,
      payload: { status: resp.status, request: redacted, response: respJson ?? respText },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Focus NFe rejected', status: resp.status, details: respJson ?? respText }), {
        status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('fiscal_config').update({ focus_company_registered: true }).eq('restaurant_id', restaurant_id);

    return new Response(JSON.stringify({ ok: true, response: respJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('fiscal-register-company error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
