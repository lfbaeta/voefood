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

// Simulated tools — same names as the bot, but no real side effects (Evolution, orders).
function fakeTools(supa: any, restaurantId: string) {
  return {
    schemas: [
      { type: "function", function: { name: "consultar_cardapio", description: "Lista produtos (com acréscimos opcionais).", parameters: { type: "object", properties: { busca: { type: "string" }, categoria: { type: "string" }, incluir_acrescimos: { type: "boolean" } }, additionalProperties: false } } },
      { type: "function", function: { name: "consultar_produto_detalhado", description: "Ficha completa do produto + acréscimos.", parameters: { type: "object", properties: { product_id: { type: "string" }, product_name: { type: "string" } }, additionalProperties: false } } },
      { type: "function", function: { name: "consultar_taxa_entrega", description: "Taxa por bairro.", parameters: { type: "object", properties: { bairro: { type: "string" } }, required: ["bairro"], additionalProperties: false } } },
      { type: "function", function: { name: "sugerir_complementos", description: "Upsell.", parameters: { type: "object", properties: { base_product_name: { type: "string" } }, required: ["base_product_name"], additionalProperties: false } } },
      { type: "function", function: { name: "enviar_foto_produto", description: "Envia foto (simulado).", parameters: { type: "object", properties: { product_ids: { type: "array", items: { type: "string" } }, product_name: { type: "string" }, caption: { type: "string" } }, additionalProperties: false } } },
      { type: "function", function: { name: "enviar_link_cardapio", description: "Envia link.", parameters: { type: "object", properties: { message: { type: "string" } }, additionalProperties: false } } },
      { type: "function", function: { name: "enviar_link_produto", description: "Envia link direto de UM produto.", parameters: { type: "object", properties: { product_id: { type: "string" }, product_name: { type: "string" }, message: { type: "string" } }, additionalProperties: false } } },
      { type: "function", function: { name: "consultar_historico_cliente", description: "Memória do cliente (simulada no playground).", parameters: { type: "object", properties: {}, additionalProperties: false } } },
      { type: "function", function: { name: "repetir_pedido", description: "Repete pedido anterior como novo (simulado).", parameters: { type: "object", properties: { order_id: { type: "integer" }, observacao_extra: { type: "string" } }, additionalProperties: false } } },
      { type: "function", function: { name: "consultar_horario_funcionamento", description: "Horários por dia da semana e se está aberto agora.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
      { type: "function", function: { name: "consultar_cupons_ativos", description: "Lista cupons válidos hoje.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
      { type: "function", function: { name: "aplicar_cupom", description: "Valida cupom e calcula desconto sobre subtotal.", parameters: { type: "object", properties: { codigo: { type: "string" }, subtotal: { type: "number" } }, required: ["codigo","subtotal"], additionalProperties: false } } },
      { type: "function", function: { name: "consultar_base_conhecimento", description: "Busca semântica na base de conhecimento treinada pelo restaurante.", parameters: { type: "object", properties: { pergunta: { type: "string" }, limite: { type: "integer" } }, required: ["pergunta"], additionalProperties: false } } },
    ],
    exec: async (name: string, args: any) => {
      if (name === "consultar_cardapio") {
        let q = supa.from("products").select("id, name, price, description, image_url, category_id").eq("restaurant_id", restaurantId).eq("is_available", true);
        if (args?.busca) q = q.ilike("name", `%${args.busca}%`);
        const { data } = await q.limit(40);
        return { produtos: (data ?? []).map((p: any) => ({ id: p.id, nome: p.name, preco: Number(p.price), descricao: p.description, tem_foto: !!p.image_url })) };
      }
      if (name === "consultar_produto_detalhado") {
        let q = supa.from("products").select("id, name, price, description, image_url").eq("restaurant_id", restaurantId);
        if (args?.product_id) q = q.eq("id", String(args.product_id));
        else if (args?.product_name) q = q.ilike("name", `%${String(args.product_name)}%`);
        const { data } = await q.limit(1).maybeSingle();
        if (!data) return { erro: "Produto não encontrado" };
        // Acréscimos
        const { data: links } = await supa.from("product_addon_groups").select("addon_group_id").eq("product_id", data.id);
        const gids = (links ?? []).map((l: any) => l.addon_group_id);
        let acrescimos: any[] = [];
        if (gids.length) {
          const { data: gs } = await supa.from("addon_groups").select("id, name, title, is_required, max_selections").in("id", gids);
          const { data: ops } = await supa.from("addon_options").select("group_id, name, price").in("group_id", gids).eq("is_available", true);
          acrescimos = (gs ?? []).map((g: any) => ({
            nome: g.title || g.name,
            obrigatorio: !!g.is_required,
            max_escolhas: g.max_selections,
            opcoes: (ops ?? []).filter((o: any) => o.group_id === g.id).map((o: any) => ({ nome: o.name, preco_extra: Number(o.price) })),
          }));
        }
        return { id: data.id, nome: data.name, preco: Number(data.price), descricao: data.description, tem_foto: !!data.image_url, acrescimos };
      }
      if (name === "consultar_taxa_entrega") {
        const { data: zones } = await supa.from("delivery_zones").select("name, fee").eq("restaurant_id", restaurantId).eq("is_active", true);
        const t = String(args?.bairro || "").toLowerCase();
        const m = (zones ?? []).find((z: any) => String(z.name).toLowerCase().includes(t));
        if (m) return { bairro: m.name, taxa: Number(m.fee) };
        const { data: sc } = await supa.from("store_config").select("delivery_fee").eq("restaurant_id", restaurantId).maybeSingle();
        return { bairro: null, taxa: Number(sc?.delivery_fee ?? 0), observacao: "padrão" };
      }
      if (name === "sugerir_complementos") {
        const { data } = await supa.from("products").select("name, price, category_id").eq("restaurant_id", restaurantId).eq("is_available", true).limit(3);
        return { sugestoes: (data ?? []).map((p: any) => ({ nome: p.name, preco: Number(p.price) })) };
      }
      if (name === "enviar_foto_produto") return { simulado: true, acao: "enviaria foto de " + (args?.product_name || (args?.product_ids?.join(", ")) || "?") };
      if (name === "enviar_link_cardapio") return { simulado: true, acao: "enviaria link do cardápio" };
      if (name === "enviar_link_produto") return { simulado: true, acao: "enviaria link de " + (args?.product_name || args?.product_id || "?") };
      if (name === "consultar_historico_cliente") {
        // Simulação: cria um cliente fictício de testes
        const { data: prods } = await supa.from("products").select("name, price").eq("restaurant_id", restaurantId).eq("is_available", true).limit(3);
        const itens = (prods ?? []).map((p: any) => ({ nome: p.name, quantidade: 1, preco_unit: Number(p.price) }));
        return {
          total_pedidos: 4,
          pedido_de_sempre: { vezes_repetido: 3, order_id_referencia: 9999, itens },
          ultimo_pedido: { order_id: 9999, status: "completed", pagamento: "Pix", itens, endereco: { rua: "Rua Exemplo", numero: "100", bairro: "Centro" } },
          ultimo_pagamento: "Pix",
          sessao_nova: true,
        };
      }
      if (name === "repetir_pedido") return { simulado: true, order_id: 10000, baseado_em: args?.order_id ?? 9999, acao: "novo pedido criado a partir do anterior" };
      if (name === "consultar_horario_funcionamento") {
        const { data: hours } = await supa.from("business_hours").select("day_of_week, open_time, close_time, is_active").eq("restaurant_id", restaurantId).order("day_of_week");
        const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
        return { horarios: (hours ?? []).map((h: any) => ({ dia: dias[h.day_of_week], ativo: !!h.is_active, abre: String(h.open_time).slice(0,5), fecha: String(h.close_time).slice(0,5) })) };
      }
      if (name === "consultar_cupons_ativos") {
        const nowIso = new Date().toISOString();
        const { data: cps } = await supa.from("coupons").select("code, discount_type, discount_value, min_order_value, max_uses, current_uses, expires_at").eq("restaurant_id", restaurantId).eq("is_active", true);
        const valid = (cps ?? []).filter((c: any) => (!c.expires_at || c.expires_at >= nowIso) && (c.max_uses == null || Number(c.current_uses ?? 0) < Number(c.max_uses)));
        return { cupons: valid.map((c: any) => ({ codigo: c.code, tipo: c.discount_type, valor: Number(c.discount_value), pedido_minimo: c.min_order_value ? Number(c.min_order_value) : null })) };
      }
      if (name === "aplicar_cupom") {
        const { data: cp } = await supa.from("coupons").select("code, discount_type, discount_value, min_order_value, is_active, expires_at, max_uses, current_uses").eq("restaurant_id", restaurantId).ilike("code", String(args?.codigo || "")).maybeSingle();
        if (!cp) return { valido: false, motivo: "Cupom não encontrado" };
        if (!cp.is_active) return { valido: false, motivo: "Cupom inativo" };
        if (cp.expires_at && new Date(cp.expires_at).getTime() < Date.now()) return { valido: false, motivo: "Expirado" };
        if (cp.max_uses != null && Number(cp.current_uses ?? 0) >= Number(cp.max_uses)) return { valido: false, motivo: "Esgotado" };
        const subtotal = Number(args?.subtotal || 0);
        if (cp.min_order_value && subtotal < Number(cp.min_order_value)) return { valido: false, motivo: `Pedido mínimo R$ ${Number(cp.min_order_value).toFixed(2)}` };
        const desc = cp.discount_type === "percentage" ? subtotal * (Number(cp.discount_value) / 100) : Number(cp.discount_value);
        return { valido: true, codigo: cp.code, desconto: Number(Math.min(desc, subtotal).toFixed(2)) };
      }
      if (name === "consultar_base_conhecimento") {
        const pergunta = String(args?.pergunta || "").trim();
        if (!pergunta) return { erro: "pergunta vazia" };
        try {
          const er = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
            body: JSON.stringify({ model: "openai/text-embedding-3-small", input: pergunta.slice(0, 1500) }),
          });
          if (!er.ok) return { erro: "embedding falhou" };
          const ed = await er.json();
          const vec = ed?.data?.[0]?.embedding;
          if (!vec) return { erro: "sem embedding" };
          const { data: matches } = await supa.rpc("match_agent_knowledge", {
            p_restaurant_id: restaurantId, p_query_embedding: vec, p_match_count: Math.min(Number(args?.limite ?? 4), 8),
          });
          return { trechos: (matches ?? []).map((m: any) => ({ fonte: m.source_label || m.source_type, relevancia: Number((m.similarity ?? 0).toFixed(3)), conteudo: m.content })) };
        } catch (e: any) { return { erro: e?.message || "falha" }; }
      }
      return { erro: "tool desconhecida" };
    },
  };
}

function buildSystemPrompt(agent: any, store: any): string {
  const toneMap: Record<string, string> = { friendly: "amigável", fun: "divertida", formal: "formal", professional: "profissional" };
  const lengthMap: Record<string, string> = { short: "Máx 2 linhas/bolha.", medium: "Até 4 linhas/bolha.", long: "Até 6 linhas/bolha." };
  const emojiMap: Record<string, string> = { none: "Sem emojis.", moderate: "1–2 emojis por msg.", heavy: "Vários emojis com bom gosto." };
  const L: string[] = [agent.system_prompt || ""];
  if (agent.objective) L.push("\n=== OBJETIVO ===\n" + agent.objective);
  if (agent.can_do?.length) L.push("\n=== PODE FAZER ===\n" + agent.can_do.map((s: string) => "• " + s).join("\n"));
  if (agent.cannot_do?.length) L.push("\n=== NÃO PODE FAZER ===\n" + agent.cannot_do.map((s: string) => "• " + s).join("\n"));
  if (agent.forbidden_phrases?.length) L.push("\n=== FRASES PROIBIDAS ===\n" + agent.forbidden_phrases.map((s: string) => `"${s}"`).join(", "));
  if (agent.custom_instructions && String(agent.custom_instructions).trim()) {
    L.push("\n=== TREINAMENTO DO RESTAURANTE (siga à risca) ===\n" + String(agent.custom_instructions).trim());
  }
  if (Array.isArray(agent.knowledge_faq) && agent.knowledge_faq.length) {
    const faq = agent.knowledge_faq
      .filter((q: any) => q && (q.question || q.answer))
      .map((q: any, i: number) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`)
      .join("\n\n");
    if (faq) L.push("\n=== BASE DE CONHECIMENTO (FAQ) ===\n" + faq);
  }
  if (Array.isArray(agent.example_conversations) && agent.example_conversations.length) {
    const ex = agent.example_conversations
      .filter((e: any) => e && (e.user || e.assistant))
      .map((e: any, i: number) => `Exemplo ${i + 1}:\nCliente: ${e.user}\nAgente: ${e.assistant}`)
      .join("\n\n");
    if (ex) L.push("\n=== EXEMPLOS DE CONVERSA (use como referência de estilo e tom) ===\n" + ex);
  }
  L.push(
    `\n=== ESTILO ===\nTom: ${toneMap[agent.tone] || "amigável"}. ${lengthMap[agent.message_length] || lengthMap.short} ${emojiMap[agent.emoji_level] || emojiMap.moderate}`,
    agent.split_messages ? "Para soar humano, quebre em até 3 bolhas com '---'." : "",
    "REGRAS DURAS: nunca repita a mesma frase/pergunta. Máx 1 pergunta. Sem markdown.",
    `\n=== RESTAURANTE ===\n${store?.name ?? "—"} | Taxa padrão R$ ${Number(store?.delivery_fee ?? 0).toFixed(2)} | ${store?.delivery_time_min ?? 30}-${store?.delivery_time_max ?? 45} min`,
  );
  return L.join("\n").replaceAll("{RESTAURANTE}", store?.name ?? "nosso restaurante");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // AuthN + AuthZ: caller must be admin/reseller of the target restaurant
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authed = createClient(SUPABASE_URL, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await authed.auth.getUser();
    if (!userRes?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const agent = body?.agent;
    const restaurant_id = String(body?.restaurant_id || "");
    const messages: Array<{ role: string; content: string }> = body?.messages || [];
    if (!agent || !restaurant_id || !Array.isArray(messages)) return json({ error: "bad payload" }, 400);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const [{ data: isAdmin }, { data: isRestaurantAdmin }, { data: isReseller }] = await Promise.all([
      supa.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" }),
      supa.rpc("is_admin_of_restaurant", { _user_id: userRes.user.id, _restaurant_id: restaurant_id }),
      supa.rpc("is_reseller_of_restaurant", { _user_id: userRes.user.id, _restaurant_id: restaurant_id }),
    ]);
    if (!isAdmin && !isRestaurantAdmin && !isReseller) return json({ error: "forbidden" }, 403);

    const { data: store } = await supa.from("store_config").select("name, is_open, delivery_fee, delivery_time_min, delivery_time_max, min_order_value").eq("restaurant_id", restaurant_id).maybeSingle();

    const tools = fakeTools(supa, restaurant_id);
    const sys = buildSystemPrompt(agent, store);
    const convo: any[] = [{ role: "system", content: sys }, ...messages];

    const traces: Array<{ tool: string; input: any; output: any }> = [];
    let finalText = "";

    for (let step = 0; step < Math.min(Number(agent.max_steps || 6), 8); step++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: agent.model || "google/gemini-2.5-flash",
          messages: convo, tools: tools.schemas, temperature: Number(agent.temperature ?? 0.7), tool_choice: "auto",
        }),
      });
      if (res.status === 429) return json({ error: "Rate limit, aguarde alguns segundos." }, 429);
      if (res.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      if (!res.ok) {
        const t = await res.text();
        console.error("playground AI fail", res.status, t.slice(0, 300));
        return json({ error: "Falha na IA" }, 500);
      }
      const data = await res.json();
      const msg = data?.choices?.[0]?.message;
      if (!msg) break;
      if (msg.tool_calls?.length) {
        convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args: any = {}; try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          const out = await tools.exec(tc.function?.name, args);
          traces.push({ tool: tc.function?.name, input: args, output: out });
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
        }
        continue;
      }
      finalText = (msg.content || "").trim();
      break;
    }

    // split bubbles too
    const bubbles = (agent.split_messages
      ? finalText.split(/\n\s*-{3,}\s*\n/g).map((s) => s.trim()).filter(Boolean)
      : [finalText]).slice(0, 3);

    return json({ bubbles: bubbles.length ? bubbles : [finalText], traces });
  } catch (e) {
    console.error("agent-playground fatal", e);
    return json({ error: "internal" }, 500);
  }
});