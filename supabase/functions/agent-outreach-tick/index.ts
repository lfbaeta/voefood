import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const digitsOnly = (s: string) => (s || "").replace(/\D/g, "");
const normalizeUrl = (u: string) => u.trim().replace(/\/$/, "");

async function generateMessage(objective: string, restaurantName: string, customerName: string | null): Promise<string> {
  const sys = `Você é o atendente virtual do restaurante ${restaurantName}. Escreva UMA mensagem de WhatsApp, curta, gentil, sem emojis em excesso, em português BR. Não use markdown.`;
  const user = `Objetivo da mensagem proativa: ${objective}\nNome do cliente: ${customerName || "(desconhecido)"}\nEscreva apenas a mensagem, sem aspas.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.6,
      }),
    });
    if (!res.ok) return objective;
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content?.trim();
    return (txt || objective).slice(0, 600);
  } catch { return objective; }
}

async function sendWa(server: string, apiKey: string, number: string, text: string) {
  const res = await fetch(`${normalizeUrl(server)}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number, text }),
  });
  return res.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ============ 1) Agendar NPS pós-entrega ============
    const npsLimits = await supa
      .from("agent_safety_limits")
      .select("restaurant_id, nps_after_delivery_enabled, nps_delay_minutes")
      .eq("nps_after_delivery_enabled", true);
    if (npsLimits.data?.length) {
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      for (const sl of npsLimits.data) {
        const { data: delivered } = await supa
          .from("orders")
          .select("id, customer_phone, customer_name, conversation_id, updated_at")
          .eq("restaurant_id", sl.restaurant_id)
          .in("status", ["delivered", "completed"])
          .is("agent_nps_scheduled_at", null)
          .gte("updated_at", since)
          .limit(20);
        for (const o of delivered ?? []) {
          if (!o.conversation_id) continue;
          const fireAt = new Date(Date.now() + (Number(sl.nps_delay_minutes || 40)) * 60_000).toISOString();
          const { data: conv } = await supa.from("wa_conversations").select("contact_id, ai_agent_id").eq("id", o.conversation_id).maybeSingle();
          if (!conv) continue;
          await supa.from("ai_outreach_queue").insert({
            restaurant_id: sl.restaurant_id,
            conversation_id: o.conversation_id,
            contact_id: conv.contact_id,
            agent_id: conv.ai_agent_id,
            objective: `Cliente recebeu o pedido #${o.id}. Pergunte rapidamente como foi (1 a 5) e se quer deixar algum comentário. Tom leve.`,
            status: "scheduled",
            next_run_at: fireAt,
            max_followups: 1,
          });
          await supa.from("orders").update({ agent_nps_scheduled_at: new Date().toISOString() }).eq("id", o.id);
        }
      }
    }

    // ============ 2) Disparar follow-ups vencidos ============
    const { data: due, error } = await supa.rpc("claim_due_outreach", { p_limit: 25 });
    if (error) return json({ ok: false, error: error.message }, 500);
    let sent = 0, failed = 0;
    for (const item of due ?? []) {
      try {
        const { data: conv } = await supa
          .from("wa_conversations")
          .select("id, restaurant_id, contact_id, instance_id, ai_enabled, assigned_user_id")
          .eq("id", item.conversation_id)
          .maybeSingle();
        if (!conv || !conv.ai_enabled || conv.assigned_user_id) {
          await supa.from("ai_outreach_queue").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", item.id);
          continue;
        }
        const { data: contact } = await supa.from("wa_contacts").select("phone_e164, name").eq("id", conv.contact_id).maybeSingle();
        const { data: inst } = await supa.from("evolution_instances").select("instance_name, reseller_id, instance_token, status").eq("id", conv.instance_id).maybeSingle();
        const { data: cfg } = await supa.from("reseller_evolution_config").select("server_url, global_api_key").eq("reseller_id", inst?.reseller_id).maybeSingle();
        const { data: store } = await supa.from("store_config").select("name").eq("restaurant_id", conv.restaurant_id).maybeSingle();
        if (!contact?.phone_e164 || !inst || inst.status !== "connected" || !cfg?.server_url) {
          await supa.from("ai_outreach_queue").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", item.id);
          failed++;
          continue;
        }
        const text = await generateMessage(item.objective, store?.name || "o restaurante", contact.name);
        const ok = await sendWa(cfg.server_url, inst.instance_token || cfg.global_api_key, digitsOnly(contact.phone_e164), text);
        await supa.from("wa_messages").insert({
          restaurant_id: conv.restaurant_id, conversation_id: conv.id, direction: "out", from_me: true,
          content_type: "text", text, status: ok ? "sent" : "failed", sent_at: new Date().toISOString(),
        });
        await supa.from("ai_outreach_queue").update({
          status: ok ? "sent" : "failed",
          followups_sent: 1,
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        if (ok) sent++; else failed++;
      } catch (e) {
        console.error("[outreach-tick] item failed", item.id, e);
        await supa.from("ai_outreach_queue").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", item.id);
        failed++;
      }
    }

    // ============ 3) Detectar pedidos abandonados ============
    const aban = await supa
      .from("agent_safety_limits")
      .select("restaurant_id, abandoned_followup_enabled, abandoned_followup_minutes")
      .eq("abandoned_followup_enabled", true);
    if (aban.data?.length) {
      for (const sl of aban.data) {
        const minutes = Number(sl.abandoned_followup_minutes || 30);
        const since = new Date(Date.now() - minutes * 60_000).toISOString();
        const win = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: convs } = await supa
          .from("wa_conversations")
          .select("id, contact_id, ai_agent_id, last_message_at")
          .eq("restaurant_id", sl.restaurant_id)
          .eq("ai_enabled", true)
          .is("assigned_user_id", null)
          .lt("last_message_at", since)
          .gte("last_message_at", win)
          .limit(20);
        for (const c of convs ?? []) {
          const { data: lastMsg } = await supa.from("wa_messages")
            .select("direction").eq("conversation_id", c.id)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (lastMsg?.direction !== "out") continue; // só cutuca se o último foi do agente
          const { data: existing } = await supa.from("ai_outreach_queue")
            .select("id").eq("conversation_id", c.id).in("status", ["scheduled", "sending"]).limit(1).maybeSingle();
          if (existing) continue;
          await supa.from("ai_outreach_queue").insert({
            restaurant_id: sl.restaurant_id,
            conversation_id: c.id,
            contact_id: c.contact_id,
            agent_id: c.ai_agent_id,
            objective: "Cliente sumiu no meio do atendimento. Pergunte de leve se ainda quer fechar o pedido ou se posso ajudar com algo.",
            status: "scheduled",
            next_run_at: new Date(Date.now() + 60_000).toISOString(),
            max_followups: 1,
          });
        }
      }
    }

    return json({ ok: true, sent, failed });
  } catch (e) {
    console.error("[outreach-tick] fatal", e);
    return json({ error: "internal" }, 500);
  }
});