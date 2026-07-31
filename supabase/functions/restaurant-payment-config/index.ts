import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type Provider = 'mercado_pago' | 'asaas'

interface Body {
  action: 'get' | 'save' | 'test' | 'disable'
  provider: Provider
  restaurant_id: string
  is_enabled?: boolean
  environment?: 'sandbox' | 'production'
  accepts_pix?: boolean
  accepts_credit_card?: boolean
  credentials?: Record<string, string>
  public_key?: string
  display_name?: string
}

function maskCredentials(creds: Record<string, string> | null | undefined) {
  if (!creds) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(creds)) {
    if (!v) { out[k] = ''; continue }
    out[k] = v.length <= 8 ? '••••' : `${v.slice(0, 4)}••••${v.slice(-4)}`
  }
  return out
}

async function testProvider(provider: Provider, credentials: Record<string, string>, environment: string) {
  try {
    if (provider === 'mercado_pago') {
      const token = credentials.access_token
      if (!token) return { ok: false, message: 'access_token ausente' }
      const r = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) return { ok: false, message: `Mercado Pago respondeu ${r.status}` }
      const data = await r.json()
      return { ok: true, message: `Conectado como ${data.nickname || data.email || data.id}` }
    }
    if (provider === 'asaas') {
      const apiKey = credentials.api_key
      if (!apiKey) return { ok: false, message: 'api_key ausente' }
      const base = environment === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'
      const r = await fetch(`${base}/myAccount`, { headers: { access_token: apiKey } })
      if (!r.ok) return { ok: false, message: `Asaas respondeu ${r.status}` }
      const data = await r.json()
      return { ok: true, message: `Conectado: ${data.name || data.email || 'OK'}` }
    }
    return { ok: false, message: 'Provedor desconhecido' }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claims.claims.sub as string
    const body = (await req.json()) as Body
    if (!body?.restaurant_id || !body?.provider || !body?.action) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(SUPABASE_URL, SERVICE)

    // verifica admin do restaurante
    const { data: isAdmin } = await admin.rpc('is_admin_of_restaurant', { _user_id: userId, _restaurant_id: body.restaurant_id })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: existing } = await admin
      .from('restaurant_payment_gateways')
      .select('*')
      .eq('restaurant_id', body.restaurant_id)
      .eq('provider', body.provider)
      .maybeSingle()

    if (body.action === 'get') {
      return new Response(JSON.stringify({
        exists: !!existing,
        is_enabled: existing?.is_enabled ?? false,
        environment: existing?.environment ?? 'production',
        accepts_pix: existing?.accepts_pix ?? true,
        accepts_credit_card: existing?.accepts_credit_card ?? true,
        public_key: existing?.public_key ?? null,
        display_name: existing?.display_name ?? null,
        credentials_masked: maskCredentials(existing?.credentials as any),
        last_test_at: existing?.last_test_at ?? null,
        last_test_ok: existing?.last_test_ok ?? null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // mescla credenciais novas com as existentes (não sobrescreve com vazio)
    const mergedCreds: Record<string, string> = { ...(existing?.credentials as any || {}) }
    if (body.credentials) {
      for (const [k, v] of Object.entries(body.credentials)) {
        if (typeof v === 'string' && v.trim() !== '') mergedCreds[k] = v.trim()
      }
    }

    if (body.action === 'test') {
      const result = await testProvider(body.provider, mergedCreds, body.environment ?? existing?.environment ?? 'production')
      if (existing) {
        await admin.from('restaurant_payment_gateways').update({
          last_test_at: new Date().toISOString(),
          last_test_ok: result.ok,
        }).eq('id', existing.id)
      }
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'disable') {
      await admin.from('restaurant_payment_gateways').update({ is_enabled: false }).eq('restaurant_id', body.restaurant_id).eq('provider', body.provider)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'save') {
      const payload = {
        restaurant_id: body.restaurant_id,
        provider: body.provider,
        is_enabled: body.is_enabled ?? existing?.is_enabled ?? false,
        environment: body.environment ?? existing?.environment ?? 'production',
        accepts_pix: body.accepts_pix ?? existing?.accepts_pix ?? true,
        accepts_credit_card: body.accepts_credit_card ?? existing?.accepts_credit_card ?? true,
        credentials: mergedCreds,
        public_key: body.public_key ?? existing?.public_key ?? null,
        display_name: body.display_name ?? existing?.display_name ?? null,
      }
      const { error } = await admin
        .from('restaurant_payment_gateways')
        .upsert(payload, { onConflict: 'restaurant_id,provider' })
      if (error) {
        console.error('save error', error)
        return new Response(JSON.stringify({ error: 'Erro ao salvar' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
