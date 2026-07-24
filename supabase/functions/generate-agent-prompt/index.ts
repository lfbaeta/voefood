import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await authed.auth.getUser();
    if (!userRes?.user) return json({ error: "unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
    const { data: isRestaurantAdmin } = await admin.rpc("is_restaurant_admin", { _user_id: userRes.user.id });
    const { data: isReseller } = await admin.rpc("is_reseller", { _user_id: userRes.user.id });
    if (!isAdmin && !isRestaurantAdmin && !isReseller) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const tipo = String(body?.tipo || "attendant");
    const nome_restaurante = String(body?.nome_restaurante || "nosso restaurante").slice(0, 120);
    const descricao = String(body?.descricao || "").slice(0, 500);
    const field = String(body?.field || "system_prompt"); // system_prompt | objective

    const sys = `Você é especialista em escrever prompts de atendimento por WhatsApp para restaurantes brasileiros. Escreva em português BR, direto, sem markdown, sem emojis decorativos. Foco em: humanização, anti-repetição, upsell natural, uso correto de ferramentas.`;

    const userMsg = field === "objective"
      ? `Restaurante: ${nome_restaurante}\nTipo de agente: ${tipo}\nContexto extra: ${descricao || "(nenhum)"}\n\nEscreva um OBJETIVO PRINCIPAL curto (3 a 5 linhas) para esse agente. Foque em o que ele precisa entregar ao final da conversa.`
      : `Restaurante: ${nome_restaurante}\nTipo de agente: ${tipo}\nContexto extra: ${descricao || "(nenhum)"}\n\nEscreva um PROMPT DE PERSONA completo para esse agente. Estrutura: parágrafo curto definindo quem é o agente, depois seções CONVERSA NATURAL, ESTRATÉGIA, REGRAS DE OURO em bullets curtos. Inclua regras anti-repetição e uso de emojis moderado. Não use markdown (sem ** ou #). No máximo 25 linhas.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
        temperature: 0.7,
      }),
    });
    if (res.status === 429) return json({ error: "Limite de uso da IA atingido, tente novamente em alguns segundos." }, 429);
    if (res.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    if (!res.ok) {
      const t = await res.text();
      console.error("generate-agent-prompt AI fail", res.status, t.slice(0, 400));
      return json({ error: "Falha ao gerar prompt" }, 500);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return json({ text });
  } catch (e) {
    console.error("generate-agent-prompt fatal", e);
    return json({ error: "internal" }, 500);
  }
});