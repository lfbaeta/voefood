// deno-lint-ignore-file no-explicit-any
// Public endpoint (verify_jwt=false). Safely dispatches Web Push notifications
// by looking up authoritative data from the DB — clients cannot inject arbitrary titles/bodies.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

type EventName = 'new_order' | 'order_status' | 'payment' | 'table_call';

interface EventBody {
  event: EventName;
  order_id?: number;
  table_order_id?: number;
}

const STATUS_LABELS: Record<string, { title: string; body: (name: string, id: number) => string }> = {
  pending: { title: 'Pedido recebido', body: (_n, id) => `Seu pedido #${id} foi recebido.` },
  preparing: { title: 'Pedido em preparo 👨‍🍳', body: (_n, id) => `Seu pedido #${id} já está sendo preparado!` },
  delivery: { title: 'Saiu para entrega 🛵', body: (_n, id) => `Seu pedido #${id} saiu para entrega.` },
  completed: { title: 'Pedido entregue 🎉', body: (_n, id) => `Seu pedido #${id} foi finalizado. Obrigado!` },
  cancelled: { title: 'Pedido cancelado', body: (_n, id) => `Seu pedido #${id} foi cancelado.` },
};

async function sendToSubscriptions(
  subs: any[],
  payload: { title: string; body: string; url: string; tag?: string; requireInteraction?: boolean; data?: any },
) {
  const notif = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        notif,
        { TTL: 60 },
      );
      sent++;
      await admin.from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
        .eq('id', s.id);
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id);
        removed++;
      } else {
        await admin.from('push_subscriptions')
          .update({ failure_count: (s.failure_count || 0) + 1 })
          .eq('id', s.id);
      }
    }
  }
  return { sent, removed };
}

async function findSubs(filters: {
  restaurant_id: string;
  topic: string;
  role?: 'staff' | 'customer';
  order_id?: number;
}) {
  let q = admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failure_count')
    .eq('restaurant_id', filters.restaurant_id)
    .contains('topics', [filters.topic]);
  if (filters.role) q = q.eq('role', filters.role);
  if (filters.order_id) q = q.eq('order_id', filters.order_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as EventBody;
    if (!body?.event) {
      return new Response(JSON.stringify({ error: 'missing_event' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: any = { ok: true };

    async function record(row: {
      restaurant_id: string;
      audience: 'staff' | 'customer';
      event_type: string;
      title: string;
      body: string;
      url?: string | null;
      order_id?: number | null;
      table_order_id?: number | null;
      customer_phone?: string | null;
      data?: Record<string, unknown>;
    }) {
      try {
        await admin.from('notifications').insert({
          restaurant_id: row.restaurant_id,
          audience: row.audience,
          event_type: row.event_type,
          title: row.title,
          body: row.body,
          url: row.url ?? null,
          order_id: row.order_id ?? null,
          table_order_id: row.table_order_id ?? null,
          customer_phone: row.customer_phone ?? null,
          data: row.data ?? {},
        });
      } catch (e) {
        console.warn('[notify-event] record failed', e);
      }
    }

    if (body.event === 'new_order' && body.order_id) {
      const { data: order } = await admin
        .from('orders')
        .select('id, restaurant_id, customer_name, total_amount, status')
        .eq('id', body.order_id)
        .maybeSingle();
      if (!order) throw new Error('order_not_found');
      const title = '🔔 Novo pedido!';
      const bodyText = `#${order.id} — ${order.customer_name} — R$ ${Number(order.total_amount).toFixed(2)}`;
      await record({
        restaurant_id: order.restaurant_id, audience: 'staff', event_type: 'new_order',
        title, body: bodyText, url: '/admin/orders', order_id: order.id,
        data: { customer_name: order.customer_name, total: Number(order.total_amount) },
      });
      const subs = await findSubs({ restaurant_id: order.restaurant_id, topic: 'new_order', role: 'staff' });
      result = await sendToSubscriptions(subs, {
        title, body: bodyText, url: '/admin/orders',
        tag: `new_order_${order.id}`, requireInteraction: true, data: { orderId: order.id },
      });
    }
    else if (body.event === 'order_status' && body.order_id) {
      const { data: order } = await admin
        .from('orders')
        .select('id, restaurant_id, customer_name, customer_phone, status, restaurant:restaurants(slug)')
        .eq('id', body.order_id)
        .maybeSingle();
      if (!order) throw new Error('order_not_found');
      const slug = (order as any).restaurant?.slug;
      const label = STATUS_LABELS[order.status] || { title: 'Pedido atualizado', body: (_n: string, id: number) => `Pedido #${id} atualizado.` };
      const title = label.title;
      const bodyText = label.body(order.customer_name, order.id);
      const url = `/order/${order.id}`;
      await record({
        restaurant_id: order.restaurant_id, audience: 'customer', event_type: 'order_status',
        title, body: bodyText, url, order_id: order.id, customer_phone: order.customer_phone,
        data: { status: order.status },
      });
      const subs = await findSubs({ restaurant_id: order.restaurant_id, topic: 'order_status', role: 'customer', order_id: order.id });
      result = await sendToSubscriptions(subs, {
        title, body: bodyText, url,
        tag: `order_${order.id}`, data: { orderId: order.id, status: order.status },
      });
    }
    else if (body.event === 'payment' && body.order_id) {
      const { data: order } = await admin
        .from('orders')
        .select('id, restaurant_id, customer_name, customer_phone, total_amount, payment_status, restaurant:restaurants(slug)')
        .eq('id', body.order_id)
        .maybeSingle();
      if (!order || order.payment_status !== 'paid') throw new Error('not_paid');
      const slug = (order as any).restaurant?.slug;
      const custUrl = `/order/${order.id}`;
      await record({
        restaurant_id: order.restaurant_id, audience: 'customer', event_type: 'payment',
        title: '✅ Pagamento aprovado', body: `Pedido #${order.id} — pagamento confirmado.`,
        url: custUrl, order_id: order.id, customer_phone: order.customer_phone,
      });
      await record({
        restaurant_id: order.restaurant_id, audience: 'staff', event_type: 'payment',
        title: '💰 Pagamento recebido',
        body: `Pedido #${order.id} — R$ ${Number(order.total_amount).toFixed(2)} pago online.`,
        url: '/admin/orders', order_id: order.id,
      });
      const custSubs = await findSubs({ restaurant_id: order.restaurant_id, topic: 'payment', role: 'customer', order_id: order.id });
      const staffSubs = await findSubs({ restaurant_id: order.restaurant_id, topic: 'new_order', role: 'staff' });
      const rCust = await sendToSubscriptions(custSubs, {
        title: '✅ Pagamento aprovado', body: `Pedido #${order.id} — pagamento confirmado.`,
        url: custUrl, tag: `pay_${order.id}`, data: { orderId: order.id },
      });
      const rStaff = await sendToSubscriptions(staffSubs, {
        title: '💰 Pagamento recebido',
        body: `Pedido #${order.id} — R$ ${Number(order.total_amount).toFixed(2)} pago online.`,
        url: '/admin/orders', tag: `pay_staff_${order.id}`, data: { orderId: order.id },
      });
      result = { ok: true, customer: rCust, staff: rStaff };
    }
    else if (body.event === 'table_call' && body.table_order_id) {
      const { data: tOrder } = await admin
        .from('table_orders')
        .select('id, restaurant_id, status, table:tables(number, name)')
        .eq('id', body.table_order_id)
        .maybeSingle();
      if (!tOrder) throw new Error('table_order_not_found');
      const tableLabel = (tOrder as any).table?.name || `Mesa ${(tOrder as any).table?.number ?? ''}`;
      const title = '🛎️ Chamada da mesa';
      const bodyText = `${tableLabel} está pedindo a conta.`;
      await record({
        restaurant_id: (tOrder as any).restaurant_id, audience: 'staff', event_type: 'table_call',
        title, body: bodyText, url: '/admin/pdv', table_order_id: tOrder.id,
        data: { table: tableLabel },
      });
      const subs = await findSubs({ restaurant_id: (tOrder as any).restaurant_id, topic: 'table_call', role: 'staff' });
      result = await sendToSubscriptions(subs, {
        title, body: bodyText, url: '/admin/pdv',
        tag: `table_call_${tOrder.id}`, requireInteraction: true, data: { tableOrderId: tOrder.id },
      });
    } else {
      return new Response(JSON.stringify({ error: 'invalid_event' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[notify-event] error', e?.message || e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
