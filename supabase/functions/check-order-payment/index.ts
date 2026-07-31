import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Reconciliação de pagamento de um pedido:
// - Se já está pago/estornado, retorna.
// - Se PIX expirou (payment_pix_expires_at < now), marca como `expired`.
// - Caso contrário, consulta o gateway com o `payment_provider_id` e atualiza.
// Pública (sem JWT): a consulta é por order_id e só atualiza o pedido correspondente; nenhum segredo do gateway é retornado.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE)

    const { order_id } = await req.json().catch(() => ({} as any))
    const orderId = Number(order_id)
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'order_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: order } = await admin
      .from('orders')
      .select('id, restaurant_id, payment_status, payment_provider, payment_provider_id, payment_pix_expires_at, total_amount')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (['paid', 'refunded', 'cancelled'].includes(order.payment_status || '')) {
      return new Response(JSON.stringify({ ok: true, status: order.payment_status, source: 'cache' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Expira PIX vencido
    if (
      order.payment_status === 'pending' &&
      order.payment_pix_expires_at &&
      new Date(order.payment_pix_expires_at).getTime() < Date.now()
    ) {
      await admin.from('orders').update({ payment_status: 'expired' }).eq('id', orderId)
      return new Response(JSON.stringify({ ok: true, status: 'expired', source: 'local' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!order.payment_provider || !order.payment_provider_id) {
      return new Response(JSON.stringify({ ok: true, status: order.payment_status, source: 'cache' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: gateway } = await admin
      .from('restaurant_payment_gateways')
      .select('credentials, environment')
      .eq('restaurant_id', order.restaurant_id)
      .eq('provider', order.payment_provider)
      .maybeSingle()

    if (!gateway) {
      return new Response(JSON.stringify({ ok: true, status: order.payment_status, source: 'cache' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const creds = (gateway.credentials as any) || {}

    let newStatus: string | null = null

    if (order.payment_provider === 'mercado_pago') {
      const token = creds.access_token
      if (!token) {
        return new Response(JSON.stringify({ ok: true, status: order.payment_status, source: 'cache' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${order.payment_provider_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) {
        return new Response(JSON.stringify({ error: 'Falha consultando Mercado Pago' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const p = await r.json()
      newStatus = p.status === 'approved' ? 'paid'
        : (p.status === 'rejected' || p.status === 'cancelled') ? 'failed'
        : p.status === 'refunded' ? 'refunded'
        : 'pending'
    } else if (order.payment_provider === 'asaas') {
      const apiKey = creds.api_key
      if (!apiKey) {
        return new Response(JSON.stringify({ ok: true, status: order.payment_status, source: 'cache' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const base = gateway.environment === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'
      const r = await fetch(`${base}/payments/${order.payment_provider_id}`, {
        headers: { access_token: apiKey },
      })
      if (!r.ok) {
        return new Response(JSON.stringify({ error: 'Falha consultando Asaas' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const p = await r.json()
      const map: Record<string, string> = {
        CONFIRMED: 'paid', RECEIVED: 'paid', RECEIVED_IN_CASH: 'paid',
        PENDING: 'pending', AWAITING_RISK_ANALYSIS: 'pending',
        OVERDUE: 'expired',
        REFUSED: 'failed', PAYMENT_DELETED: 'cancelled',
        REFUNDED: 'refunded', CHARGEBACK_REQUESTED: 'refunded', CHARGEBACK_DISPUTE: 'refunded',
      }
      newStatus = map[p.status] || 'pending'
    }

    if (newStatus && newStatus !== order.payment_status) {
      await admin.from('orders').update({
        payment_status: newStatus,
        payment_paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
      }).eq('id', orderId)
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus || order.payment_status, source: 'gateway' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})