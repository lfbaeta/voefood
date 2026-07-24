import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Webhook do Asaas para pagamentos de pedidos do cardápio.
// URL deve incluir ?restaurant_id=<uuid>. Validamos o header `asaas-access-token` contra o webhook_token do restaurante.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE)

    const url = new URL(req.url)
    const restaurantIdParam = url.searchParams.get('restaurant_id')
    if (!restaurantIdParam) {
      return new Response(JSON.stringify({ error: 'missing restaurant_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: gateway } = await admin
      .from('restaurant_payment_gateways')
      .select('credentials, is_enabled')
      .eq('restaurant_id', restaurantIdParam)
      .eq('provider', 'asaas')
      .maybeSingle()

    if (!gateway || !gateway.is_enabled) {
      return new Response(JSON.stringify({ error: 'gateway not configured' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const creds = (gateway.credentials as any) || {}
    const expectedToken = creds.webhook_token as string | undefined
    const providedToken = req.headers.get('asaas-access-token') || req.headers.get('Asaas-Access-Token')
    if (!expectedToken) {
      console.warn('asaas-webhook: no webhook_token configured for restaurant', restaurantIdParam)
      return new Response(JSON.stringify({ error: 'webhook not configured' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (providedToken !== expectedToken) {
      console.warn('asaas-webhook: invalid token for restaurant', restaurantIdParam)
      return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const asaasApiKey = (creds.api_key as string | undefined)
    if (!asaasApiKey) {
      return new Response(JSON.stringify({ error: 'api_key missing' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const payment = body?.payment
    if (!payment?.id) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const orderId = payment.externalReference ? Number(payment.externalReference) : null
    if (!orderId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Re-verify against Asaas API using the merchant's api_key — never trust the raw webhook body
    const asaasBase = gateway && (gateway as any).environment === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'
    const verifyRes = await fetch(`${asaasBase}/payments/${payment.id}`, { headers: { access_token: asaasApiKey } })
    if (!verifyRes.ok) {
      console.warn('asaas-webhook: verify failed', verifyRes.status)
      return new Response(JSON.stringify({ error: 'verify failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const verified = await verifyRes.json()
    const verifiedExt = verified?.externalReference ? Number(verified.externalReference) : null
    if (verifiedExt !== orderId) {
      return new Response(JSON.stringify({ error: 'reference mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const statusMap: Record<string, string> = {
      CONFIRMED: 'paid', RECEIVED: 'paid', RECEIVED_IN_CASH: 'paid',
      PENDING: 'pending', AWAITING_RISK_ANALYSIS: 'pending',
      OVERDUE: 'expired',
      REFUSED: 'failed', PAYMENT_DELETED: 'cancelled',
      REFUNDED: 'refunded', CHARGEBACK_REQUESTED: 'refunded', CHARGEBACK_DISPUTE: 'refunded',
    }
    const status = statusMap[verified.status] || 'pending'

    await admin.from('orders').update({
      payment_status: status,
      payment_provider: 'asaas',
      payment_provider_id: String(verified.id),
      payment_paid_at: status === 'paid' ? new Date().toISOString() : null,
    }).eq('id', orderId).eq('restaurant_id', restaurantIdParam)

    return new Response(JSON.stringify({ ok: true, status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
