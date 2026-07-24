import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Webhook do Mercado Pago para pagamentos de pedidos do cardápio.
// URL deve incluir ?restaurant_id=<uuid>. Validamos a assinatura HMAC (x-signature) com o webhook_secret do restaurante.

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function parseMpSignature(header: string | null): { ts?: string; v1?: string } {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(',')) {
    const [k, v] = part.split('=')
    if (k && v) out[k.trim()] = v.trim()
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE)

    const url = new URL(req.url)
    const restaurantIdParam = url.searchParams.get('restaurant_id')
    if (!restaurantIdParam) {
      console.warn('mp-webhook: missing restaurant_id')
      return new Response(JSON.stringify({ error: 'missing restaurant_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const rawBody = await req.text()
    let body: any = {}
    try { body = rawBody ? JSON.parse(rawBody) : {} } catch { body = {} }

    const type = body?.type || body?.action || url.searchParams.get('type')
    const paymentId = body?.data?.id || body?.id || url.searchParams.get('data.id') || url.searchParams.get('id')
    if (!paymentId || (type && !String(type).includes('payment'))) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // carrega gateway do restaurante e valida assinatura
    const { data: gateway } = await admin
      .from('restaurant_payment_gateways')
      .select('credentials, restaurant_id, is_enabled')
      .eq('restaurant_id', restaurantIdParam)
      .eq('provider', 'mercado_pago')
      .maybeSingle()

    if (!gateway || !gateway.is_enabled) {
      console.warn('mp-webhook: gateway not found/disabled', restaurantIdParam)
      return new Response(JSON.stringify({ error: 'gateway not configured' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const creds = (gateway.credentials as any) || {}
    const webhookSecret = creds.webhook_secret as string | undefined
    const accessToken = creds.access_token as string | undefined

    if (webhookSecret) {
      const sig = parseMpSignature(req.headers.get('x-signature'))
      const reqId = req.headers.get('x-request-id') || ''
      const dataId = String(body?.data?.id || url.searchParams.get('data.id') || paymentId).toLowerCase()
      if (!sig.ts || !sig.v1) {
        console.warn('mp-webhook: missing signature')
        return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const manifest = `id:${dataId};request-id:${reqId};ts:${sig.ts};`
      const expected = await hmacSha256Hex(webhookSecret, manifest)
      if (expected !== sig.v1) {
        console.warn('mp-webhook: signature mismatch')
        return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    } else {
      console.warn('mp-webhook: no webhook_secret configured for restaurant', restaurantIdParam)
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // localiza pedido a partir do payment_provider_id já gravado, dentro deste restaurante
    const { data: orderByProvider } = await admin
      .from('orders')
      .select('id, restaurant_id, payment_provider, payment_status')
      .eq('restaurant_id', restaurantIdParam)
      .eq('payment_provider', 'mercado_pago')
      .eq('payment_provider_id', String(paymentId))
      .maybeSingle()

    let order = orderByProvider

    // Se não encontramos pelo provider_id, busca por external_reference via API
    if (!order) {
      const r0 = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (r0.ok) {
        const p0 = await r0.json()
        const ext = p0.external_reference
        if (ext) {
          const { data: o } = await admin.from('orders').select('id, restaurant_id, payment_status').eq('id', Number(ext)).eq('restaurant_id', restaurantIdParam).maybeSingle()
          if (o) order = o as any
        }
      }
    }

    if (!order) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!r.ok) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const p = await r.json()
    const status = p.status === 'approved' ? 'paid' : p.status === 'rejected' || p.status === 'cancelled' ? 'failed' : p.status === 'refunded' ? 'refunded' : 'pending'

    await admin.from('orders').update({
      payment_status: status,
      payment_provider_id: String(p.id),
      payment_paid_at: status === 'paid' ? new Date().toISOString() : null,
    }).eq('id', order.id)

    if (status === 'paid') {
      try {
        await admin.functions.invoke('notify-event', { body: { event: 'payment', order_id: order.id } })
      } catch (e) { console.warn('[notify-event payment]', e) }
    }

    return new Response(JSON.stringify({ ok: true, status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
