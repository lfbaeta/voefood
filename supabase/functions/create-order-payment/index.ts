import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type Provider = 'mercado_pago' | 'asaas'
type Method = 'pix' | 'credit_card'

interface Body {
  order_id: number
  provider: Provider
  method: Method
  card?: {
    token: string
    installments?: number
    holder_name?: string
    holder_doc?: string
    issuer?: string
    payment_method_id?: string // MP brand id (visa, master...)
  }
  card_raw?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
    installments?: number
    holder_doc?: string
  }
  payer?: {
    email?: string
    doc?: string
    name?: string
  }
}

function urlBase(env: string, provider: Provider) {
  if (provider === 'asaas') return env === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'
  return 'https://api.mercadopago.com'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE)

    const body = (await req.json()) as Body
    if (!body?.order_id || !body?.provider || !body?.method) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, total_amount, restaurant_id, customer_name, customer_phone, payment_status, payment_provider, payment_provider_id, payment_pix_qr_code, payment_pix_qr_code_base64, payment_pix_expires_at, created_at, payment_attempts')
      .eq('id', body.order_id)
      .maybeSingle()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Anti-carding: block old orders and cap attempts per order.
    const ageMs = Date.now() - new Date((order as any).created_at).getTime()
    if (ageMs > 24 * 60 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'order expired' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const attempts = Number((order as any).payment_attempts ?? 0)
    if (attempts >= 5 && order.payment_status !== 'paid') {
      return new Response(JSON.stringify({ error: 'too many payment attempts' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // Increment attempts up-front so retries are counted even on downstream failure
    await admin.from('orders').update({ payment_attempts: attempts + 1 }).eq('id', order.id)

    if (order.payment_status === 'paid') {
      return new Response(JSON.stringify({ ok: true, status: 'paid' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // se já existe PIX pendente, devolve o mesmo
    if (body.method === 'pix' && order.payment_status === 'pending' && order.payment_pix_qr_code && order.payment_provider === body.provider) {
      return new Response(JSON.stringify({
        ok: true,
        status: 'pending',
        pix_qr_code: order.payment_pix_qr_code,
        pix_qr_code_base64: order.payment_pix_qr_code_base64,
        expires_at: order.payment_pix_expires_at,
        provider_id: order.payment_provider_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: gateway } = await admin
      .from('restaurant_payment_gateways')
      .select('*')
      .eq('restaurant_id', order.restaurant_id)
      .eq('provider', body.provider)
      .eq('is_enabled', true)
      .maybeSingle()

    if (!gateway) {
      return new Response(JSON.stringify({ error: 'Gateway não configurado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const creds = (gateway.credentials as any) || {}
    const amount = Number(order.total_amount)
    const description = `Pedido #${order.id}`

    if (body.provider === 'mercado_pago') {
      const token = creds.access_token
      if (!token) return new Response(JSON.stringify({ error: 'Token MP ausente' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const payerEmail = body.payer?.email || `cliente+${order.id}@peddi.online`
      const payload: any = {
        transaction_amount: amount,
        description,
        external_reference: String(order.id),
        payer: { email: payerEmail, first_name: order.customer_name },
      }
      if (body.method === 'pix') {
        payload.payment_method_id = 'pix'
      } else {
        if (!body.card?.token) return new Response(JSON.stringify({ error: 'card.token ausente' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        payload.token = body.card.token
        payload.installments = body.card.installments || 1
        if (body.card.payment_method_id) payload.payment_method_id = body.card.payment_method_id
        if (body.card.issuer) payload.issuer_id = body.card.issuer
        if (body.payer?.doc) payload.payer.identification = { type: 'CPF', number: body.payer.doc.replace(/\D/g, '') }
      }

      const r = await fetch(`${urlBase(gateway.environment, 'mercado_pago')}/v1/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `order-${order.id}-${body.method}-${Date.now()}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) {
        console.error('MP error', data)
        return new Response(JSON.stringify({ error: data?.message || 'Erro no Mercado Pago' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const status = data.status === 'approved' ? 'paid' : (data.status === 'rejected' ? 'failed' : 'pending')
      const pix = body.method === 'pix' ? {
        pix_qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        pix_qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        expires_at: data.date_of_expiration,
      } : null

      await admin.from('orders').update({
        payment_status: status,
        payment_provider: 'mercado_pago',
        payment_provider_id: String(data.id),
        payment_method_online: body.method,
        payment_pix_qr_code: pix?.pix_qr_code ?? null,
        payment_pix_qr_code_base64: pix?.pix_qr_code_base64 ?? null,
        payment_pix_expires_at: pix?.expires_at ?? null,
        payment_paid_at: status === 'paid' ? new Date().toISOString() : null,
      }).eq('id', order.id)

      return new Response(JSON.stringify({
        ok: true,
        status,
        provider_id: String(data.id),
        ...(pix || {}),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.provider === 'asaas') {
      const apiKey = creds.api_key
      if (!apiKey) return new Response(JSON.stringify({ error: 'API key Asaas ausente' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const base = urlBase(gateway.environment, 'asaas')

      // cria customer simples
      const customerName = order.customer_name || 'Cliente'
      const customerPhone = (order.customer_phone || '').replace(/\D/g, '')
      const custRes = await fetch(`${base}/customers`, {
        method: 'POST',
        headers: { access_token: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerName,
          mobilePhone: customerPhone || undefined,
          cpfCnpj: body.payer?.doc?.replace(/\D/g, '') || undefined,
          email: body.payer?.email || undefined,
        }),
      })
      const customer = await custRes.json()
      if (!custRes.ok || !customer?.id) {
        console.error('Asaas customer error', customer)
        return new Response(JSON.stringify({ error: customer?.errors?.[0]?.description || 'Erro ao criar cliente Asaas' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const today = new Date()
      const dueDate = today.toISOString().split('T')[0]

      const payPayload: any = {
        customer: customer.id,
        billingType: body.method === 'pix' ? 'PIX' : 'CREDIT_CARD',
        value: amount,
        dueDate,
        description,
        externalReference: String(order.id),
      }
      if (body.method === 'credit_card') {
        if (body.card?.token) {
          payPayload.creditCardToken = body.card.token
          payPayload.installmentCount = body.card.installments || 1
        } else if (body.card_raw) {
          const cr = body.card_raw
          const phoneClean = (order.customer_phone || '').replace(/\D/g, '')
          payPayload.creditCard = {
            holderName: cr.holderName,
            number: cr.number,
            expiryMonth: cr.expiryMonth,
            expiryYear: cr.expiryYear,
            ccv: cr.ccv,
          }
          payPayload.creditCardHolderInfo = {
            name: cr.holderName,
            email: body.payer?.email || `cliente+${order.id}@peddi.online`,
            cpfCnpj: (cr.holder_doc || body.payer?.doc || '').replace(/\D/g, ''),
            postalCode: '00000000',
            addressNumber: '0',
            phone: phoneClean || undefined,
            mobilePhone: phoneClean || undefined,
          }
          payPayload.remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
          payPayload.installmentCount = cr.installments || 1
        } else {
          return new Response(JSON.stringify({ error: 'Dados do cartão ausentes' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      const payRes = await fetch(`${base}/payments`, {
        method: 'POST',
        headers: { access_token: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payPayload),
      })
      const pay = await payRes.json()
      if (!payRes.ok) {
        console.error('Asaas payment error', pay)
        return new Response(JSON.stringify({ error: pay?.errors?.[0]?.description || 'Erro Asaas' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      let pix: any = null
      if (body.method === 'pix') {
        const qrRes = await fetch(`${base}/payments/${pay.id}/pixQrCode`, { headers: { access_token: apiKey } })
        const qr = await qrRes.json()
        pix = {
          pix_qr_code: qr.payload,
          pix_qr_code_base64: qr.encodedImage,
          expires_at: qr.expirationDate,
        }
      }

      const statusMap: Record<string, string> = {
        CONFIRMED: 'paid', RECEIVED: 'paid', RECEIVED_IN_CASH: 'paid',
        PENDING: 'pending', AWAITING_RISK_ANALYSIS: 'pending',
        REFUSED: 'failed', REFUNDED: 'refunded',
      }
      const status = statusMap[pay.status] || 'pending'

      await admin.from('orders').update({
        payment_status: status,
        payment_provider: 'asaas',
        payment_provider_id: String(pay.id),
        payment_method_online: body.method,
        payment_pix_qr_code: pix?.pix_qr_code ?? null,
        payment_pix_qr_code_base64: pix?.pix_qr_code_base64 ?? null,
        payment_pix_expires_at: pix?.expires_at ?? null,
        payment_paid_at: status === 'paid' ? new Date().toISOString() : null,
      }).eq('id', order.id)

      return new Response(JSON.stringify({
        ok: true,
        status,
        provider_id: String(pay.id),
        ...(pix || {}),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Provider inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
