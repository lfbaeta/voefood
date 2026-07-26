import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractEvolutionMessageId, formatEvolutionError, sendEvolutionText } from "../_shared/evolutionSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeUrl(u: string) { return u.trim().replace(/\/$/, ""); }

const fmtCurrency = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// event -> template key + status filter
function mapEventToTemplate(event: string, newStatus: string): { key: string; filter: string } | null {
  if (event === "pix_pending") return { key: "pix", filter: "pix_pending" };
  if (event === "accepted_on_create") return { key: "accepted", filter: "accepted" };
  // Fluxo do painel: pending → preparing (aceito) → delivery → completed
  if (newStatus === "preparing") return { key: "accepted", filter: "accepted" };
  if (newStatus === "delivery") return { key: "delivery", filter: "delivery" };
  if (newStatus === "completed") return { key: "completed", filter: "completed" };
  if (newStatus === "cancelled") return { key: "cancelled", filter: "cancelled" };
  return null;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  pix: `Oi, {nome}! Seu pedido de {total} está aguardando o pagamento; para finalizar, basta copiar a chave Pix que vou enviar logo abaixo. 😊\n\n💠 *Chave Pix ({tipo_chave}):*\n{chave_pix}`,
  accepted: `Olá {nome}, seu pedido foi confirmado e está sendo preparado 🥰\n\n*Pedido: #{pedido}*\n---------------------------------------\n📦 *Produtos*\n{produtos}\n---------------------------------------\n{subtotal} Total dos produtos\n{taxa_entrega} Taxa de entrega\n*{total} Total*\n\nForma de pagamento: {forma_pagamento}\n{status_pagamento}\n---------------------------------------\n👤 Nome: {nome}\n📍 Bairro: {bairro}\n🏠 Rua: {rua}\n🔢 Número: {numero}\n{complemento}🕐 Previsão de entrega: {previsao}\n\nObrigado pela preferência 😉`,
  preparing: `Olá {nome}! 👨‍🍳\n\nSeu pedido #{pedido} está sendo preparado com muito carinho!\n\nEm breve sairá para entrega! 🚀`,
  delivery: `Olá, {nome}! 🛵\n\nSeu pedido #{pedido} saiu para entrega!\n\nEm breve chegará até você! 📍`,
  completed: `Olá {nome}! 🎉\n\nSeu pedido #{pedido} foi entregue com sucesso!\n\nObrigado pela preferência! ❤️\nEsperamos você novamente em breve!`,
  cancelled: `Olá {nome}, infelizmente seu pedido #{pedido} foi cancelado. Se tiver dúvidas, estamos por aqui!`,
};

function applyTemplate(tpl: string, ctx: Record<string, string>): string {
  return tpl.replace(/{(\w+)}/g, (_, k) => (ctx[k] ?? ""));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: cfg } = await supa
      .from("internal_webhook_config")
      .select("key,value")
      .in("key", ["agent_notify_secret"]);
    const secret = cfg?.find((c: any) => c.key === "agent_notify_secret")?.value;
    const provided = req.headers.get("x-internal-secret");
    if (!secret || !provided || provided !== secret) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = Number(body?.order_id);
    const event = String(body?.event || "");
    const newStatus = String(body?.new_status || "");
    if (!orderId) return json({ error: "order_id required" }, 400);

    const tpl = mapEventToTemplate(event, newStatus);
    if (!tpl) return json({ ok: true, skipped: "no_template" });

    // pedido
    const { data: order } = await supa.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return json({ error: "order not found" }, 404);
    if (!order.restaurant_id) return json({ ok: true, skipped: "no_restaurant" });

    // dedupe
    const { data: existing } = await supa
      .from("agent_status_dispatches")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", tpl.filter)
      .maybeSingle();
    if (existing) return json({ ok: true, skipped: "already_sent" });

    // agente default do restaurante
    const { data: agent } = await supa
      .from("restaurant_agents")
      .select("id, auto_notify_status, notify_statuses, dedicated_instance_id")
      .eq("restaurant_id", order.restaurant_id)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    if (!agent || !agent.auto_notify_status) return json({ ok: true, skipped: "agent_off" });
    const allowed: string[] = agent.notify_statuses ?? [];
    if (allowed.length && !allowed.includes(tpl.filter)) return json({ ok: true, skipped: "status_disabled" });

    // store_config para templates customizados e delivery time
    const { data: store } = await supa
      .from("store_config")
      .select("pix_message, pix_key, pix_key_type, msg_order_accepted, msg_order_preparing, msg_order_delivery, msg_order_completed, delivery_time_min, delivery_time_max, timezone")
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();

    // items
    const { data: items } = await supa
      .from("order_items")
      .select("product_name, quantity, unit_price, observation")
      .eq("order_id", orderId);
    const itemsList = (items ?? []).map((i: any) => {
      let line = `${fmtCurrency(Number(i.unit_price) * Number(i.quantity))} ${i.quantity}x ${i.product_name}`;
      if (i.observation) line += `\n   📝 ${i.observation}`;
      return line;
    }).join("\n");
    const subtotal = (items ?? []).reduce((s: number, i: any) => s + Number(i.unit_price) * Number(i.quantity), 0);
    const deliveryFee = Number(order.total_amount) - subtotal;

    const paymentLabels: Record<string, string> = {
      pix: "Pix Online",
      money: `Dinheiro (Troco para R$ ${order.change_for || "não informado"})`,
      card: "Cartão na entrega",
    };
    const paymentStatusText = order.payment_method === "pix"
      ? "Já recebemos seu pagamento. ✅"
      : "Pagamento na entrega.";

    const now = new Date();
    const dMin = new Date(now.getTime() + (store?.delivery_time_min || 30) * 60000);
    const dMax = new Date(now.getTime() + (store?.delivery_time_max || 45) * 60000);
    const previsao = `${dMin.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${dMax.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

    const templateMap: Record<string, string | undefined> = {
      pix: store?.pix_message,
      accepted: store?.msg_order_accepted,
      preparing: store?.msg_order_preparing,
      delivery: store?.msg_order_delivery,
      completed: store?.msg_order_completed,
      cancelled: undefined,
    };
    const template = templateMap[tpl.key] || DEFAULT_TEMPLATES[tpl.key];

    const message = applyTemplate(template, {
      nome: order.customer_name || "",
      pedido: String(order.id),
      total: fmtCurrency(Number(order.total_amount)),
      subtotal: fmtCurrency(subtotal),
      taxa_entrega: fmtCurrency(deliveryFee),
      chave_pix: store?.pix_key || "",
      tipo_chave: store?.pix_key_type || "Chave",
      produtos: itemsList,
      forma_pagamento: paymentLabels[order.payment_method] || order.payment_method || "",
      status_pagamento: paymentStatusText,
      bairro: order.address_neighborhood || "",
      rua: order.address_street || "",
      numero: order.address_number || "",
      complemento: order.address_complement ? `🏷️ Complemento: ${order.address_complement}\n` : "",
      previsao,
    });

    // encontra instancia evolution conectada
    let instQ = supa.from("evolution_instances").select("*").eq("restaurant_id", order.restaurant_id);
    if (agent.dedicated_instance_id) instQ = instQ.eq("id", agent.dedicated_instance_id);
    const { data: insts } = await instQ;
    const inst = (insts ?? [])
      .filter((i: any) => i.status === "connected")
      .sort((a: any, b: any) => Number(b.is_default) - Number(a.is_default))[0];
    if (!inst) return json({ ok: true, skipped: "no_instance" });

    const { data: evoCfg } = await supa
      .from("reseller_evolution_config")
      .select("server_url, global_api_key")
      .eq("reseller_id", inst.reseller_id)
      .maybeSingle();
    if (!evoCfg?.server_url || !evoCfg?.global_api_key) return json({ ok: true, skipped: "no_evo_config" });

    const url = normalizeUrl(evoCfg.server_url);
    const phone = String(order.customer_phone || "");
    const sendRes = await sendEvolutionText({
      serverUrl: url,
      globalApiKey: evoCfg.global_api_key,
      instanceToken: inst.instance_token,
      instanceName: inst.instance_name,
      instanceUuid: inst.instance_uuid,
      debug: Deno.env.get("EVOLUTION_DEBUG") === "true",
    }, phone, message);
    if (!sendRes.ok) {
      const error = formatEvolutionError(sendRes, "Falha ao enviar notificação de pedido.");
      console.error("[agent-notify-order-status] send failed", error, JSON.stringify(sendRes.attempts).slice(0, 2000));
      return json({ ok: false, error, response: sendRes.body, attempts: sendRes.attempts }, 502);
    }
    const waId = extractEvolutionMessageId(sendRes.body);

    await supa.from("agent_status_dispatches").insert({
      order_id: orderId,
      status: tpl.filter,
      restaurant_id: order.restaurant_id,
      wa_message_id: waId,
    });

    return json({ ok: true, sent: true, status: tpl.filter });
  } catch (e: any) {
    console.error("[agent-notify-order-status] fatal", e);
    return json({ error: "internal" }, 500);
  }
});
