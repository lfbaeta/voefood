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
const ENC_KEY = Deno.env.get("AI_CRED_ENCRYPTION_KEY");
if (!ENC_KEY) console.error("[whatsapp-bot] AI_CRED_ENCRYPTION_KEY missing — AI credential decryption will fail closed");

const HISTORY_LIMIT = 25;
const DEFAULT_MAX_STEPS = 6;
const PUBLIC_APP_URL = (Deno.env.get("PUBLIC_APP_URL") || "https://voefood.com").replace(/\/$/, "");

const skippedMessages: Record<string, string> = {
  ai_disabled: "A IA está desativada nesta conversa.",
  human_active: "A conversa está atribuída a um atendente humano.",
  no_active_agent: "Nenhum agente ativo foi encontrado para este estabelecimento.",
  agent_not_for_this_instance: "O agente ativo está vinculado a outra instância de WhatsApp.",
  daily_limit_reached: "O limite diário de ações do agente foi atingido.",
  no_credential: "O provedor de IA escolhido exige uma chave de API que ainda não foi cadastrada.",
  encryption_key_missing: "A chave interna de criptografia das credenciais de IA não está configurada.",
  decrypt_failed: "Não foi possível descriptografar a chave de IA cadastrada.",
  no_contact: "A conversa não tem telefone de contato válido.",
  instance_disconnected: "A instância de WhatsApp desta conversa está desconectada.",
  no_evo_cfg: "A configuração do servidor Evolution está incompleta.",
  no_inbound_message: "Não há mensagem recebida para o agente responder.",
  already_replied: "O agente já respondeu a última mensagem recebida.",
  duplicate_claim: "A última mensagem recebida já está em processamento ou já foi respondida.",
  contact_rate_limit: "O limite de mensagens por hora para este contato foi atingido.",
  no_reply: "A IA não retornou texto para enviar ao cliente.",
};

const skipped = (reason: string, extra: Record<string, unknown> = {}) =>
  json({ ok: true, skipped: reason, message: skippedMessages[reason] ?? reason, ...extra });

// Constrói a URL pública do restaurante no formato de subdomínio
// (https://{slug}.{host}). Cai no formato /r/:slug quando o host base for
// localhost/preview.
function buildRestaurantUrl(slug: string): string {
  try {
    const u = new URL(PUBLIC_APP_URL);
    const isPreview =
      u.hostname === "localhost" ||
      u.hostname.startsWith("id-preview--") ||
      u.hostname.endsWith(".lovableproject.com");
    if (isPreview) return `${PUBLIC_APP_URL}/r/${slug}`;
    return `${u.protocol}//${slug}.${u.hostname}`;
  } catch {
    return `${PUBLIC_APP_URL}/r/${slug}`;
  }
}
const EMBED_MODEL = "openai/text-embedding-3-small";

async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 1500) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

async function transcribeAudio(mediaUrl: string, mime: string): Promise<string | null> {
  try {
    const audioRes = await fetch(mediaUrl);
    if (!audioRes.ok) return null;
    const blob = await audioRes.blob();
    const extMap: Record<string, string> = {
      "audio/ogg": "ogg", "audio/opus": "ogg", "audio/webm": "webm",
      "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav",
    };
    const base = (mime || "").split(";")[0].trim();
    const ext = extMap[base] || "ogg";
    const fd = new FormData();
    fd.append("model", "openai/gpt-4o-mini-transcribe");
    fd.append("file", blob, `audio.${ext}`);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: fd,
    });
    if (!res.ok) {
      console.error("[whatsapp-bot] transcribe failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data?.text ?? null;
  } catch (e) {
    console.error("[whatsapp-bot] transcribe error", e);
    return null;
  }
}

function digitsOnly(s: string): string { return (s || "").replace(/\D/g, ""); }
function normalizeUrl(u: string): string {
  let s = u.trim().replace(/\/+$/, "");
  s = s.replace(/\/(manager|admin|dashboard|api)(\/.*)?$/i, "");
  return s.replace(/\/+$/, "");
}

// =================== ADDON HELPERS ===================
async function fetchAddonsForProducts(
  supa: any,
  restaurantId: string,
  productIds: string[],
): Promise<Map<string, any[]>> {
  const result = new Map<string, any[]>();
  if (!productIds.length) return result;
  const { data: links } = await supa
    .from("product_addon_groups")
    .select("product_id, addon_group_id")
    .in("product_id", productIds);
  const groupIds = Array.from(new Set((links ?? []).map((l: any) => l.addon_group_id)));
  if (!groupIds.length) return result;
  const [{ data: groups }, { data: options }] = await Promise.all([
    supa.from("addon_groups")
      .select("id, name, title, is_required, max_selections, sort_order")
      .in("id", groupIds)
      .eq("restaurant_id", restaurantId)
      .order("sort_order"),
    supa.from("addon_options")
      .select("id, group_id, name, price, is_available, sort_order")
      .in("group_id", groupIds)
      .eq("is_available", true)
      .order("sort_order"),
  ]);
  const optsByGroup = new Map<string, any[]>();
  for (const o of options ?? []) {
    const arr = optsByGroup.get(o.group_id) ?? [];
    arr.push({ id: o.id, nome: o.name, preco_extra: Number(o.price) });
    optsByGroup.set(o.group_id, arr);
  }
  const groupById = new Map<string, any>();
  for (const g of groups ?? []) {
    groupById.set(g.id, {
      id: g.id,
      nome: g.title || g.name,
      obrigatorio: !!g.is_required,
      max_escolhas: g.max_selections ?? null,
      opcoes: optsByGroup.get(g.id) ?? [],
    });
  }
  for (const l of links ?? []) {
    const g = groupById.get(l.addon_group_id);
    if (!g) continue;
    const arr = result.get(l.product_id) ?? [];
    arr.push(g);
    result.set(l.product_id, arr);
  }
  return result;
}

// =================== PROMPT BUILDER + POST-PROCESS ===================
async function fetchCustomerMemory(
  supa: any,
  restaurantId: string,
  phone: string,
): Promise<{
  total_pedidos: number;
  ultimo_pedido: any | null;
  pedido_de_sempre: any | null;
  ultimo_pagamento: string | null;
  ultimo_endereco: any | null;
  sessao_nova: boolean;
} | null> {
  if (!phone) return null;
  const variants = [phone, digitsOnly(phone), `+${digitsOnly(phone)}`].filter(Boolean);
  const { data: orders } = await supa
    .from("orders")
    .select("id, status, total_amount, payment_method, change_for, created_at, address_street, address_number, address_neighborhood, address_complement, address_reference, customer_name")
    .eq("restaurant_id", restaurantId)
    .in("customer_phone", variants)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(8);
  const list = orders ?? [];
  if (list.length === 0) return { total_pedidos: 0, ultimo_pedido: null, pedido_de_sempre: null, ultimo_pagamento: null, ultimo_endereco: null, sessao_nova: true };

  const ids = list.map((o: any) => o.id);
  const { data: items } = await supa
    .from("order_items")
    .select("order_id, product_name, quantity, unit_price, observation")
    .in("order_id", ids);
  const byOrder = new Map<number, any[]>();
  for (const it of items ?? []) {
    const arr = byOrder.get(it.order_id) ?? [];
    arr.push(it);
    byOrder.set(it.order_id, arr);
  }

  // Build "signature" of each order to detect a repeating combo
  const sig = (o: any) => {
    const its = (byOrder.get(o.id) ?? []).map((i: any) => `${i.quantity}x ${String(i.product_name).toLowerCase().trim()}`);
    return its.sort().join(" | ");
  };
  const sigCounts = new Map<string, { count: number; example: any }>();
  for (const o of list) {
    const s = sig(o);
    if (!s) continue;
    const cur = sigCounts.get(s) ?? { count: 0, example: o };
    cur.count++;
    sigCounts.set(s, cur);
  }
  let pedidoDeSempre: any = null;
  let bestCount = 1;
  for (const [, v] of sigCounts) {
    if (v.count >= 2 && v.count > bestCount) {
      bestCount = v.count;
      pedidoDeSempre = {
        vezes_repetido: v.count,
        order_id_referencia: v.example.id,
        itens: (byOrder.get(v.example.id) ?? []).map((i: any) => ({
          nome: i.product_name, quantidade: i.quantity, preco_unit: Number(i.unit_price), observacao: i.observation,
        })),
      };
    }
  }

  const last = list[0];
  const ultimo = {
    order_id: last.id,
    status: last.status,
    total: Number(last.total_amount),
    quando: last.created_at,
    pagamento: last.payment_method,
    itens: (byOrder.get(last.id) ?? []).map((i: any) => ({
      nome: i.product_name, quantidade: i.quantity, preco_unit: Number(i.unit_price), observacao: i.observation,
    })),
    endereco: {
      rua: last.address_street, numero: last.address_number, bairro: last.address_neighborhood,
      complemento: last.address_complement, referencia: last.address_reference,
    },
  };

  return {
    total_pedidos: list.length,
    ultimo_pedido: ultimo,
    pedido_de_sempre: pedidoDeSempre,
    ultimo_pagamento: last.payment_method ?? null,
    ultimo_endereco: ultimo.endereco,
    sessao_nova: true, // caller decides; we just provide data
  };
}

function buildSystemPrompt(agent: any, store: any, contact: any, memory: any | null, sessaoNova: boolean, trainingExamples: any[] = []): string {
  const toneMap: Record<string, string> = {
    friendly:     "amigável, próxima, como se fosse uma pessoa que trabalha no balcão",
    fun:          "divertida, descontraída, com humor leve",
    formal:       "formal e cortês, sem gírias",
    professional: "profissional e objetiva",
  };
  const lengthMap: Record<string, string> = {
    short:  "Máximo 2 linhas por bolha. Mensagens curtas e diretas.",
    medium: "Até 4 linhas por bolha. Equilibre clareza e detalhe.",
    long:   "Pode explicar com mais detalhe, até 6 linhas por bolha.",
  };
  const emojiMap: Record<string, string> = {
    none:     "NÃO use emojis em nenhuma circunstância.",
    moderate: "Use 1 ou 2 emojis contextuais por mensagem (🍕🥤😋✅📍🔥). Nunca enfileire.",
    heavy:    "Use emojis com frequência para dar vida (🍕🥤😋✅📍🔥🎉👌). Sem exagero esquisito.",
  };

  const lines: string[] = [];
  lines.push(agent.system_prompt || "");

  if (agent.objective && agent.objective.trim()) {
    lines.push("", "=== OBJETIVO PRINCIPAL ===", agent.objective.trim());
  }

  if (Array.isArray(agent.can_do) && agent.can_do.length > 0) {
    lines.push("", "=== O QUE VOCÊ PODE FAZER ===");
    for (const r of agent.can_do) lines.push(`• ${r}`);
  }
  if (Array.isArray(agent.cannot_do) && agent.cannot_do.length > 0) {
    lines.push("", "=== O QUE VOCÊ NÃO PODE FAZER ===");
    for (const r of agent.cannot_do) lines.push(`• ${r}`);
  }
  if (Array.isArray(agent.required_phrases) && agent.required_phrases.length > 0) {
    lines.push("", "=== FRASES OBRIGATÓRIAS (use ao menos uma quando fizer sentido) ===");
    for (const p of agent.required_phrases) lines.push(`• "${p}"`);
  }
  if (Array.isArray(agent.forbidden_phrases) && agent.forbidden_phrases.length > 0) {
    lines.push("", "=== FRASES PROIBIDAS (nunca escreva isso) ===");
    for (const p of agent.forbidden_phrases) lines.push(`• "${p}"`);
  }

  if (agent.custom_instructions && String(agent.custom_instructions).trim()) {
    lines.push("", "=== TREINAMENTO DO RESTAURANTE (siga à risca) ===", String(agent.custom_instructions).trim());
  }
  if (Array.isArray(agent.knowledge_faq) && agent.knowledge_faq.length > 0) {
    const faqs = agent.knowledge_faq.filter((q: any) => q && (q.question || q.answer));
    if (faqs.length) {
      lines.push("", "=== BASE DE CONHECIMENTO (FAQ) ===");
      faqs.forEach((q: any, i: number) => {
        lines.push(`Q${i + 1}: ${q.question}`);
        lines.push(`A${i + 1}: ${q.answer}`);
        lines.push("");
      });
    }
  }
  if (Array.isArray(agent.example_conversations) && agent.example_conversations.length > 0) {
    const exs = agent.example_conversations.filter((e: any) => e && (e.user || e.assistant));
    if (exs.length) {
      lines.push("", "=== EXEMPLOS DE CONVERSA (use como referência de estilo e tom) ===");
      exs.forEach((e: any, i: number) => {
        lines.push(`Exemplo ${i + 1}:`);
        lines.push(`Cliente: ${e.user}`);
        lines.push(`Agente: ${e.assistant}`);
        lines.push("");
      });
    }
  }

  if (Array.isArray(trainingExamples) && trainingExamples.length > 0) {
    lines.push("", "=== CORREÇÕES APRENDIDAS COM O RESTAURANTE (siga estes padrões à risca) ===");
    trainingExamples.slice(0, 12).forEach((ex: any, i: number) => {
      lines.push(`Caso ${i + 1}:`);
      lines.push(`Cliente disse: ${ex.user_message}`);
      if (ex.bad_assistant_message) lines.push(`NÃO responda assim: ${ex.bad_assistant_message}`);
      lines.push(`Responda assim: ${ex.good_assistant_message}`);
      if (ex.note) lines.push(`Motivo: ${ex.note}`);
      lines.push("");
    });
  }

  lines.push(
    "",
    "=== ESTILO DE COMUNICAÇÃO ===",
    `Tom: ${toneMap[agent.tone] || toneMap.friendly}.`,
    `Tamanho: ${lengthMap[agent.message_length] || lengthMap.short}`,
    `Emojis: ${emojiMap[agent.emoji_level] || emojiMap.moderate}`,
    agent.split_messages
      ? "Para soar humano, quebre a resposta em até 3 bolhas separando-as com a linha exata '---'. Cada bolha tem 1 ideia."
      : "Responda em uma única mensagem.",
    "REGRAS DURAS: (1) NUNCA repita a mesma frase, pergunta ou informação dentro da mesma resposta. (2) Termine com NO MÁXIMO UMA pergunta. (3) Sem markdown.",
  );

  if (agent.proactive_upsell) {
    lines.push("Upsell: quando o cliente escolher o prato, ofereça UMA bebida ou sobremesa que combine. Use sugerir_complementos.");
  }
  if (agent.send_photos) {
    lines.push("Fotos: se o cliente pedir 'foto', 'imagem', 'como é', use enviar_foto_produto (aceita até 3 IDs). Se o produto não tiver foto, use enviar_link_produto.");
  }
  lines.push(
    "",
    "=== USO DAS FERRAMENTAS ===",
    "• Antes de fechar um item que tenha opções obrigatórias (ponto da carne, tamanho, sabor, molho), chame consultar_produto_detalhado e pergunte só o que faltar.",
    "• Em criar_pedido, sempre passe selected_addons quando o cliente escolheu acréscimos — o preço extra é somado automaticamente.",
    "• Para mandar um item específico, prefira enviar_link_produto (abre direto a tela do produto) em vez do cardápio inteiro.",
    "• consultar_cardapio aceita incluir_acrescimos=true e categoria='Bebidas' para filtrar.",
  );

  lines.push(
    "",
    "=== CONTEXTO DO RESTAURANTE ===",
    `Nome: ${store?.name ?? "—"}`,
    `Status agora: ${store?.is_open ? "Aberto" : "Fechado"}`,
    `Taxa de entrega padrão: R$ ${Number(store?.delivery_fee ?? 0).toFixed(2)}`,
    `Pedido mínimo: R$ ${Number(store?.min_order_value ?? 0).toFixed(2)}`,
    `Tempo estimado: ${store?.delivery_time_min ?? 30}-${store?.delivery_time_max ?? 45} min`,
    `Cliente: ${contact?.name ?? "(sem nome)"} — ${contact?.phone_e164 ?? ""}`,
  );

  if (Array.isArray(store?._business_hours) && store._business_hours.length > 0) {
    const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
    const ativas = store._business_hours.filter((h: any) => h.is_active);
    if (ativas.length > 0) {
      lines.push("", "=== HORÁRIO DE FUNCIONAMENTO ===");
      for (const h of ativas) {
        const o = String(h.open_time || "").slice(0, 5);
        const c = String(h.close_time || "").slice(0, 5);
        lines.push(`${dias[h.day_of_week] ?? "?"}: ${o} às ${c}`);
      }
      lines.push("Se o cliente perguntar horário ou se está aberto agora, use consultar_horario_funcionamento para confirmar com precisão.");
    }
  }

  if (Array.isArray(store?._active_coupons) && store._active_coupons.length > 0) {
    lines.push("", "=== CUPONS ATIVOS ===");
    for (const c of store._active_coupons) {
      const valor = c.discount_type === "percentage"
        ? `${Number(c.discount_value)}%`
        : `R$ ${Number(c.discount_value).toFixed(2)}`;
      const min = c.min_order_value ? ` (mín. R$ ${Number(c.min_order_value).toFixed(2)})` : "";
      lines.push(`• ${c.code}: ${valor} de desconto${min}`);
    }
    lines.push("Para usar um cupom, chame aplicar_cupom com o código e o subtotal do pedido. Nunca prometa desconto sem validar a tool.");
  }

  if (memory && memory.total_pedidos > 0) {
    lines.push("", "=== MEMÓRIA DO CLIENTE ===");
    lines.push(`Já fez ${memory.total_pedidos} pedido(s) aqui.`);
    if (memory.pedido_de_sempre) {
      const itens = memory.pedido_de_sempre.itens
        .map((i: any) => `${i.quantidade}x ${i.nome}`).join(" + ");
      lines.push(`PEDIDO DE SEMPRE (repetido ${memory.pedido_de_sempre.vezes_repetido}x): ${itens}`);
      lines.push(`order_id de referência para repetir: ${memory.pedido_de_sempre.order_id_referencia}`);
    }
    if (memory.ultimo_pedido) {
      const itens = memory.ultimo_pedido.itens
        .map((i: any) => `${i.quantidade}x ${i.nome}`).join(" + ");
      lines.push(`ÚLTIMO PEDIDO (#${memory.ultimo_pedido.order_id}): ${itens} — pagto: ${memory.ultimo_pedido.pagamento}`);
      const e = memory.ultimo_pedido.endereco;
      if (e?.rua) lines.push(`Endereço usual: ${e.rua}, ${e.numero}${e.complemento ? " " + e.complemento : ""} — ${e.bairro}`);
    }
    if (sessaoNova) {
      lines.push(
        "",
        "=== INICIO DE SESSAO ===",
        "Esta é a primeira mensagem dele depois de horas. Cumprimente pelo NOME e, se existir PEDIDO DE SEMPRE, sugira repetir já listando os itens. Ex: \"Fala Gustavo! Vamos no de sempre? hamburguer 09 + batata chips P + coca lata. Confirma que eu já passo pra cozinha?\".",
        "Se ele só tem ÚLTIMO PEDIDO (sem repetição), ofereça repetir o último: \"Repete o de ontem (X + Y)?\".",
        "Sempre pergunte se quer mudar alguma coisa (sabor, quantidade, troco). Se ele confirmar SIM/POSITIVO, use repetir_pedido com o order_id_referencia (ou o do último pedido) — NÃO precisa re-perguntar endereço/pagamento, eles vêm do pedido anterior. Só pergunte de novo se ele pedir pra trocar.",
      );
    }
  } else if (memory) {
    lines.push("", "=== MEMÓRIA DO CLIENTE ===", "Cliente novo: nunca pediu aqui. Cumprimente e ofereça o cardápio.");
  }

  return lines.filter((l) => l !== undefined).join("\n").replaceAll("{RESTAURANTE}", store?.name ?? "nosso restaurante");
}

function normalizeRepeatKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}\s?!.,]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeRepeatedLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  const seen = new Set<string>();

  for (const ln of lines) {
    const trimmed = ln.trim();
    if (!trimmed) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }

    const norm = normalizeRepeatKey(trimmed);
    if (norm && seen.has(norm)) continue;
    if (norm) seen.add(norm);
    out.push(trimmed);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function hardenReplyText(text: string): string {
  const cleaned = dedupeRepeatedLines(text).trim();
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const uniqueRatio = lines.length / Math.max(1, text.split("\n").filter((l) => l.trim()).length);
  const compact = lines.slice(0, uniqueRatio < 0.5 ? 4 : 10).join("\n\n");
  return compact.slice(0, 900).trim();
}

function splitBubbles(text: string, enabled: boolean): string[] {
  const cleaned = hardenReplyText(text);
  if (!enabled) return [cleaned];
  const parts = cleaned
    .split(/\n\s*-{3,}\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return (parts.length > 1 ? parts : [cleaned]).slice(0, 3);
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// =================== TOOL DEFINITIONS (Phase 2) ===================
const TOOL_SCHEMAS: any[] = [
  {
    type: "function",
    function: {
      name: "consultar_cardapio",
      description: "Lista produtos disponíveis do restaurante, com categoria, foto e (opcional) acréscimos/opções. Use sempre que o cliente pedir o cardápio, perguntar preços ou disponibilidade de produtos.",
      parameters: {
        type: "object",
        properties: {
          busca: { type: "string", description: "Filtro opcional por nome do produto" },
          categoria: { type: "string", description: "Filtro opcional pelo nome da categoria" },
          incluir_acrescimos: { type: "boolean", description: "Se true, retorna os grupos de acréscimos de cada produto. Default false." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_produto_detalhado",
      description: "Retorna a ficha completa de UM produto: descrição, preço, foto e todos os grupos de acréscimos com opções e preços extras. Use antes de fechar um item com opções obrigatórias (ponto da carne, tamanho, molhos) ou quando o cliente perguntar detalhes/se tem extras.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "ID do produto (uuid) — preferido" },
          product_name: { type: "string", description: "Nome aproximado do produto" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_pedido",
      description: "Cria um pedido de delivery. Use SOMENTE após confirmar com o cliente: itens (com acréscimos quando houver), endereço completo, forma de pagamento. Confirme o resumo antes de chamar.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                quantity: { type: "integer", minimum: 1 },
                unit_price: { type: "number", minimum: 0, description: "Preço base do produto (sem acréscimos)" },
                observation: { type: "string" },
                selected_addons: {
                  type: "array",
                  description: "Acréscimos escolhidos pelo cliente, agrupados.",
                  items: {
                    type: "object",
                    properties: {
                      group_name: { type: "string" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            price_extra: { type: "number", minimum: 0 },
                          },
                          required: ["name"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["group_name", "options"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["product_name", "quantity", "unit_price"],
              additionalProperties: false,
            },
            minItems: 1,
          },
          address_street: { type: "string" },
          address_number: { type: "string" },
          address_neighborhood: { type: "string" },
          address_complement: { type: "string" },
          address_reference: { type: "string" },
          payment_method: { type: "string", description: "Ex: 'Dinheiro', 'Pix', 'Cartão na entrega'" },
          change_for: { type: "number", description: "Troco para (somente se dinheiro)" },
          delivery_fee: { type: "number", minimum: 0 },
        },
        required: ["customer_name", "itens", "address_street", "address_number", "address_neighborhood", "payment_method"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_pedido",
      description: "Consulta o status de um pedido pelo ID. Use quando o cliente perguntar sobre um pedido já feito.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "integer" } },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_foto_produto",
      description: "Envia a foto de até 3 produtos pelo WhatsApp com legenda opcional. Use quando o cliente pedir para ver foto/imagem. Informe product_ids (preferido) OU product_id OU product_name. Se o produto não tem foto, a tool retorna sugestão para enviar link em vez disso.",
      parameters: {
        type: "object",
        properties: {
          product_ids: { type: "array", items: { type: "string" }, description: "Lista de até 3 IDs (uuid). Preferido para envio em lote." },
          product_id: { type: "string", description: "ID do produto (uuid) — preferido" },
          product_name: { type: "string", description: "Nome aproximado do produto, usado se product_id não for informado" },
          caption: { type: "string", description: "Legenda curta opcional (até 300 caracteres)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_link_cardapio",
      description: "Envia ao cliente o link público do cardápio COMPLETO do restaurante. Para link de UM produto específico, use enviar_link_produto.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "Mensagem curta opcional para acompanhar o link" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_link_produto",
      description: "Envia um link DIRETO para a página de um produto específico no cardápio digital. Use quando estiver falando de um item e quiser que o cliente abra ele já pronto pra escolher acréscimos.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "ID do produto (uuid) — preferido" },
          product_name: { type: "string", description: "Nome aproximado do produto" },
          message: { type: "string", description: "Mensagem curta opcional para acompanhar o link" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sugerir_complementos",
      description: "Sugere 2–3 produtos complementares (bebida, sobremesa, acompanhamento) que combinam com o item informado. Use para upsell natural após o cliente escolher o prato principal.",
      parameters: {
        type: "object",
        properties: {
          base_product_name: { type: "string", description: "Nome do produto principal que o cliente já escolheu" },
          categorias: {
            type: "array",
            items: { type: "string" },
            description: "Categorias a privilegiar (ex: ['Bebidas', 'Sobremesas']). Opcional.",
          },
        },
        required: ["base_product_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_taxa_entrega",
      description: "Retorna a taxa de entrega para um bairro. Use SEMPRE que o cliente perguntar 'quanto é a entrega' ou informar o endereço.",
      parameters: {
        type: "object",
        properties: {
          bairro: { type: "string", description: "Nome do bairro do cliente" },
        },
        required: ["bairro"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_historico_cliente",
      description: "Retorna a memória do cliente neste restaurante: último pedido, pedido recorrente ('de sempre'), endereço e pagamento usuais. Use no início da conversa para personalizar a saudação e oferecer repetir o pedido.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "repetir_pedido",
      description: "Recria um pedido anterior do mesmo cliente como NOVO pedido pendente, reaproveitando itens, endereço e forma de pagamento. Use APÓS o cliente confirmar que quer repetir ('vamos no de sempre', 'pode mandar igual ao último', 'sim, repete'). Não precisa pedir endereço ou pagamento de novo a menos que o cliente queira mudar.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer", description: "ID do pedido a repetir. Se omitido, usa o ÚLTIMO pedido do cliente." },
          observacao_extra: { type: "string", description: "Observação adicional do cliente (ex: 'sem cebola hoje')." },
          override_payment_method: { type: "string", description: "Trocar forma de pagamento (Dinheiro/Pix/Cartão)." },
          override_change_for: { type: "number", description: "Novo valor de troco (se dinheiro)." },
          override_address_street: { type: "string" },
          override_address_number: { type: "string" },
          override_address_neighborhood: { type: "string" },
          override_address_complement: { type: "string" },
          override_address_reference: { type: "string" },
          delivery_fee: { type: "number", minimum: 0, description: "Taxa de entrega calculada (se mudou de endereço)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_horario_funcionamento",
      description: "Retorna os horários de abertura/fechamento de cada dia da semana e se está aberto agora. Use sempre que o cliente perguntar 'que horas abrem?', 'estão abertos?', 'até que horas?'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_cupons_ativos",
      description: "Lista cupons válidos disponíveis hoje (código, tipo, valor de desconto, pedido mínimo). Use quando o cliente perguntar 'tem cupom?', 'tem desconto?' ou 'tem promo?'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "aplicar_cupom",
      description: "Valida um cupom e calcula o desconto sobre um subtotal informado. Use ANTES de fechar o pedido com criar_pedido. Retorna desconto em R$, novo total e motivo de falha (expirado, esgotado, abaixo do mínimo).",
      parameters: {
        type: "object",
        properties: {
          codigo: { type: "string", description: "Código do cupom como o cliente digitou" },
          subtotal: { type: "number", minimum: 0, description: "Subtotal dos itens (sem taxa de entrega)" },
        },
        required: ["codigo", "subtotal"],
        additionalProperties: false,
      },
    },
  },
];

TOOL_SCHEMAS.push({
  type: "function",
  function: {
    name: "consultar_base_conhecimento",
    description: "Busca informações específicas que o restaurante ensinou ao agente (cardápio extra, regras, políticas, perguntas frequentes, FAQs avançadas, manuais internos). Use SEMPRE que o cliente perguntar algo que NÃO está nas outras tools (cardápio, preço, taxa, cupom, horário, histórico). Ex.: 'vocês têm opção sem glúten?', 'aceita pet?', 'política de troca?'.",
    parameters: {
      type: "object",
      properties: {
        pergunta: { type: "string", description: "A pergunta/intenção do cliente em linguagem natural" },
        limite: { type: "integer", minimum: 1, maximum: 8, description: "Quantos trechos retornar (padrão 4)" },
      },
      required: ["pergunta"],
      additionalProperties: false,
    },
  },
});

// ============ FASE 3 TOOLS ============
TOOL_SCHEMAS.push(
  {
    type: "function",
    function: {
      name: "consultar_status_entrega",
      description: "Detalha o status atual do pedido informado (ou do último pedido do cliente, se omitido): em qual etapa está, previsão e itens.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer", description: "ID do pedido. Se omitido, usa o último pedido do cliente." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_pedido",
      description: "Atualiza observação, forma de pagamento, troco ou endereço de um pedido AINDA NÃO CONFIRMADO/PRONTO. Não permite alterar itens (cancele e refaça nesse caso).",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer" },
          observacao: { type: "string" },
          payment_method: { type: "string" },
          change_for: { type: "number", minimum: 0 },
          address_street: { type: "string" },
          address_number: { type: "string" },
          address_neighborhood: { type: "string" },
          address_complement: { type: "string" },
          address_reference: { type: "string" },
        },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_pedido",
      description: "Cancela um pedido do cliente, respeitando o valor máximo permitido para cancelamento automático configurado pelo restaurante. Pedidos acima do teto exigem escalar_humano.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer" },
          motivo: { type: "string", description: "Motivo informado pelo cliente." },
        },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalar_humano",
      description: "Transfere a conversa para um atendente humano. Use quando o cliente pedir gerente, reclamar de algo grave, pedir reembolso, ou quando o agente não conseguir resolver após 2-3 tentativas. Desativa a IA nesta conversa.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Resumo curto do motivo da escalada." },
          urgencia: { type: "string", enum: ["baixa", "media", "alta"], description: "Urgência percebida." },
        },
        required: ["motivo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_followup",
      description: "Agenda uma mensagem futura para o cliente (lembrete, retomada de pedido abandonado, NPS). O agente original responde no horário marcado.",
      parameters: {
        type: "object",
        properties: {
          objetivo: { type: "string", description: "O que dizer ao cliente quando o follow-up disparar." },
          horas: { type: "number", minimum: 0.25, maximum: 168, description: "Em quantas horas disparar (0.25 = 15 min)." },
        },
        required: ["objetivo", "horas"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_endereco_desconhecido",
      description: "Registra que o cliente forneceu um endereço/bairro que NÃO está em nenhuma zona de entrega cadastrada. Avisa o restaurante para criar a zona depois. Use SEMPRE que consultar_taxa_entrega não encontrar a zona.",
      parameters: {
        type: "object",
        properties: {
          endereco: { type: "string", description: "Endereço bruto como o cliente passou." },
          bairro: { type: "string" },
          observacao: { type: "string" },
        },
        required: ["endereco"],
        additionalProperties: false,
      },
    },
  },
);

function filterToolsByAllowed(allowed: string[]): any[] {
  if (!allowed || allowed.length === 0) return TOOL_SCHEMAS;
  return TOOL_SCHEMAS.filter((t) => allowed.includes(t.function.name));
}

// =================== TOOL EXECUTORS ===================
async function execTool(
  supa: any,
  name: string,
  args: any,
  ctx: {
    restaurant_id: string;
    contact_id: string;
    conversation_id: string;
    agent_id: string;
    customer_phone: string;
    restaurant_slug: string | null;
    evo_server: string;
    evo_api_key: string;
    evo_instance: string;
  },
): Promise<{ success: boolean; output: any; error?: string }> {
  try {
    if (name === "consultar_cardapio") {
      const { data: cats } = await supa
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", ctx.restaurant_id)
        .order("sort_order");
      const catMap = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
      let catFilterIds: string[] | null = null;
      if (args?.categoria && typeof args.categoria === "string") {
        const t = String(args.categoria).toLowerCase();
        catFilterIds = (cats ?? [])
          .filter((c: any) => String(c.name).toLowerCase().includes(t))
          .map((c: any) => c.id);
        if (catFilterIds.length === 0) {
          return { success: true, output: { total: 0, produtos: [], aviso: `Categoria "${args.categoria}" não encontrada` } };
        }
      }
      let q = supa
        .from("products")
        .select("id, name, description, price, category_id, is_available, image_url, agent_pitch")
        .eq("restaurant_id", ctx.restaurant_id)
        .eq("is_available", true);
      if (args?.busca && typeof args.busca === "string") {
        q = q.ilike("name", `%${args.busca}%`);
      }
      if (catFilterIds) q = q.in("category_id", catFilterIds);
      const { data: prods } = await q.limit(80);
      const list = prods ?? [];
      let addonMap = new Map<string, any[]>();
      if (args?.incluir_acrescimos) {
        addonMap = await fetchAddonsForProducts(supa, ctx.restaurant_id, list.map((p: any) => p.id));
      }
      const out = list.map((p: any) => ({
        id: p.id,
        nome: p.name,
        descricao: p.description,
        pitch_para_vender: p.agent_pitch || undefined,
        preco: Number(p.price),
        categoria: catMap.get(p.category_id) ?? "—",
        tem_foto: !!p.image_url,
        acrescimos: args?.incluir_acrescimos ? (addonMap.get(p.id) ?? []) : undefined,
      }));
      return { success: true, output: { total: out.length, produtos: out } };
    }

    if (name === "consultar_produto_detalhado") {
      let prod: any = null;
      if (args?.product_id) {
        const { data } = await supa.from("products")
          .select("id, name, description, price, image_url, category_id, agent_pitch")
          .eq("id", String(args.product_id))
          .eq("restaurant_id", ctx.restaurant_id)
          .maybeSingle();
        prod = data;
      }
      if (!prod && args?.product_name) {
        const { data } = await supa.from("products")
          .select("id, name, description, price, image_url, category_id, agent_pitch")
          .eq("restaurant_id", ctx.restaurant_id)
          .ilike("name", `%${String(args.product_name)}%`)
          .limit(1).maybeSingle();
        prod = data;
      }
      if (!prod) return { success: false, output: null, error: "Produto não encontrado" };
      const addonMap = await fetchAddonsForProducts(supa, ctx.restaurant_id, [prod.id]);
      let categoria = "—";
      if (prod.category_id) {
        const { data: c } = await supa.from("categories").select("name").eq("id", prod.category_id).maybeSingle();
        categoria = c?.name ?? "—";
      }
      return { success: true, output: {
        id: prod.id,
        nome: prod.name,
        descricao: prod.description,
        pitch_para_vender: prod.agent_pitch || undefined,
        preco: Number(prod.price),
        categoria,
        tem_foto: !!prod.image_url,
        acrescimos: addonMap.get(prod.id) ?? [],
      }};
    }

    if (name === "criar_pedido") {
      const items = Array.isArray(args.itens) ? args.itens : [];
      if (items.length === 0) return { success: false, output: null, error: "Sem itens" };
      // Calcula preço final por item somando os acréscimos
      const enriched = items.map((it: any) => {
        const base = Number(it.unit_price) || 0;
        const qty = Number(it.quantity) || 1;
        const addons: any[] = Array.isArray(it.selected_addons) ? it.selected_addons : [];
        let addonsTotal = 0;
        const addonLines: string[] = [];
        for (const g of addons) {
          const opts: any[] = Array.isArray(g?.options) ? g.options : [];
          for (const o of opts) {
            addonsTotal += Number(o?.price_extra) || 0;
          }
          const names = opts.map((o: any) => o?.name).filter(Boolean);
          if (names.length) addonLines.push(`${g.group_name}: ${names.join(", ")}`);
        }
        const unit_final = base + addonsTotal;
        const baseObs = (it.observation || "").trim();
        const fullObs = [addonLines.join(" | "), baseObs].filter(Boolean).join(" — ").slice(0, 500) || null;
        return { ...it, _unit_final: unit_final, _qty: qty, _observation: fullObs };
      });
      const subtotal = enriched.reduce((s: number, it: any) => s + it._unit_final * it._qty, 0);
      const delivery_fee = Number(args.delivery_fee ?? 0);
      const total = subtotal + delivery_fee;

      const { data: order, error: oe } = await supa
        .from("orders")
        .insert({
          restaurant_id: ctx.restaurant_id,
          customer_name: String(args.customer_name).slice(0, 200),
          customer_phone: ctx.customer_phone,
          address_street: String(args.address_street),
          address_number: String(args.address_number),
          address_neighborhood: String(args.address_neighborhood),
          address_complement: args.address_complement ?? null,
          address_reference: args.address_reference ?? null,
          payment_method: String(args.payment_method),
          change_for: args.change_for ? Number(args.change_for) : null,
          total_amount: total,
          status: "pending",
          conversation_id: ctx.conversation_id,
          created_by_agent_id: ctx.agent_id,
        })
        .select("id")
        .single();
      if (oe || !order) return { success: false, output: null, error: oe?.message || "insert failed" };

      const rows = enriched.map((it: any) => ({
        order_id: order.id,
        product_name: String(it.product_name).slice(0, 200),
        quantity: it._qty,
        unit_price: it._unit_final,
        observation: it._observation,
      }));
      const { error: ie } = await supa.from("order_items").insert(rows);
      if (ie) return { success: false, output: null, error: ie.message };

      return { success: true, output: { order_id: order.id, total, subtotal, delivery_fee } };
    }

    if (name === "consultar_pedido") {
      const oid = Number(args.order_id);
      if (!Number.isFinite(oid)) return { success: false, output: null, error: "order_id inválido" };
      const { data: order } = await supa
        .from("orders")
        .select("id, status, total_amount, payment_method, created_at, customer_name")
        .eq("id", oid)
        .eq("restaurant_id", ctx.restaurant_id)
        .maybeSingle();
      if (!order) return { success: false, output: null, error: "Pedido não encontrado" };
      const { data: items } = await supa
        .from("order_items")
        .select("product_name, quantity, unit_price")
        .eq("order_id", oid);
      return { success: true, output: { ...order, itens: items ?? [] } };
    }

    if (name === "enviar_foto_produto") {
      // Resolve a lista de produtos a enviar
      const ids: string[] = Array.isArray(args?.product_ids) ? args.product_ids.slice(0, 3) : [];
      if (args?.product_id && !ids.includes(String(args.product_id))) ids.unshift(String(args.product_id));

      let prods: any[] = [];
      if (ids.length > 0) {
        const { data } = await supa.from("products")
          .select("id, name, price, image_url")
          .eq("restaurant_id", ctx.restaurant_id)
          .in("id", ids);
        prods = data ?? [];
      } else if (args?.product_name) {
        const { data } = await supa.from("products")
          .select("id, name, price, image_url")
          .eq("restaurant_id", ctx.restaurant_id)
          .ilike("name", `%${String(args.product_name)}%`)
          .limit(1);
        prods = data ?? [];
      }
      if (prods.length === 0) return { success: false, output: null, error: "Produto não encontrado" };

      const sentList: any[] = [];
      const semFoto: any[] = [];
      const number = digitsOnly(ctx.customer_phone);
      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        if (!p.image_url) { semFoto.push({ id: p.id, nome: p.name }); continue; }
        const caption = (i === 0 && args?.caption && String(args.caption).slice(0, 300)) ||
          `${p.name} — R$ ${Number(p.price).toFixed(2)}`;
        if (i > 0) await sleep(500);
        const sent = await sendWhatsAppImage(ctx.evo_server, ctx.evo_api_key, ctx.evo_instance, number, p.image_url, caption);
        if (!sent.ok) { sentList.push({ id: p.id, nome: p.name, enviado: false }); continue; }
        const waId = sent.body?.key?.id ?? sent.body?.messageId ?? null;
        await supa.from("wa_messages").insert({
          restaurant_id: ctx.restaurant_id,
          conversation_id: ctx.conversation_id,
          wa_message_id: waId,
          direction: "out",
          from_me: true,
          content_type: "image",
          text: caption,
          media_url: p.image_url,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        sentList.push({ id: p.id, nome: p.name, enviado: true });
      }
      return { success: true, output: {
        enviados: sentList,
        sem_foto: semFoto,
        sugestao: semFoto.length > 0 ? "Para os produtos sem foto, use enviar_link_produto." : null,
      }};
    }

    if (name === "enviar_link_cardapio") {
      if (!ctx.restaurant_slug) return { success: false, output: null, error: "Restaurante sem slug configurado" };
      const url = buildRestaurantUrl(ctx.restaurant_slug);
      const msg = (args?.message && String(args.message).slice(0, 300)) ||
        "Aqui está nosso cardápio completo 👇";
      const text = `${msg}\n${url}`;
      const number = digitsOnly(ctx.customer_phone);
      const sent = await sendWhatsApp(ctx.evo_server, ctx.evo_api_key, ctx.evo_instance, number, text);
      if (!sent.ok) return { success: false, output: null, error: `Falha ao enviar link (status ${sent.status})` };

      const waId = sent.body?.key?.id ?? sent.body?.messageId ?? null;
      await supa.from("wa_messages").insert({
        restaurant_id: ctx.restaurant_id,
        conversation_id: ctx.conversation_id,
        wa_message_id: waId,
        direction: "out",
        from_me: true,
        content_type: "text",
        text,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      return { success: true, output: { enviado: true, url } };
    }

    if (name === "enviar_link_produto") {
      if (!ctx.restaurant_slug) return { success: false, output: null, error: "Restaurante sem slug configurado" };
      let prod: any = null;
      if (args?.product_id) {
        const { data } = await supa.from("products")
          .select("id, name, price")
          .eq("id", String(args.product_id))
          .eq("restaurant_id", ctx.restaurant_id)
          .maybeSingle();
        prod = data;
      }
      if (!prod && args?.product_name) {
        const { data } = await supa.from("products")
          .select("id, name, price")
          .eq("restaurant_id", ctx.restaurant_id)
          .ilike("name", `%${String(args.product_name)}%`)
          .limit(1).maybeSingle();
        prod = data;
      }
      if (!prod) return { success: false, output: null, error: "Produto não encontrado" };
      const url = `${buildRestaurantUrl(ctx.restaurant_slug)}?product=${prod.id}`;
      const msg = (args?.message && String(args.message).slice(0, 300)) ||
        `Olha o ${prod.name} aqui 👇`;
      const text = `${msg}\n${url}`;
      const number = digitsOnly(ctx.customer_phone);
      const sent = await sendWhatsApp(ctx.evo_server, ctx.evo_api_key, ctx.evo_instance, number, text);
      if (!sent.ok) return { success: false, output: null, error: `Falha ao enviar link (status ${sent.status})` };
      const waId = sent.body?.key?.id ?? sent.body?.messageId ?? null;
      await supa.from("wa_messages").insert({
        restaurant_id: ctx.restaurant_id,
        conversation_id: ctx.conversation_id,
        wa_message_id: waId,
        direction: "out",
        from_me: true,
        content_type: "text",
        text,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      return { success: true, output: { enviado: true, url, produto: prod.name } };
    }

    if (name === "sugerir_complementos") {
      const base = String(args?.base_product_name || "").toLowerCase();
      const wantedCats = Array.isArray(args?.categorias) && args.categorias.length > 0
        ? args.categorias.map((c: string) => String(c).toLowerCase())
        : ["bebida", "bebidas", "sobremesa", "sobremesas", "acompanhamento", "acompanhamentos"];
      const { data: cats } = await supa
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", ctx.restaurant_id);
      const targetCatIds = (cats ?? [])
        .filter((c: any) => wantedCats.some((w: string) => String(c.name).toLowerCase().includes(w)))
        .map((c: any) => c.id);
      let q = supa
        .from("products")
        .select("id, name, price, category_id, image_url")
        .eq("restaurant_id", ctx.restaurant_id)
        .eq("is_available", true);
      if (targetCatIds.length > 0) q = q.in("category_id", targetCatIds);
      const { data: prods } = await q.limit(8);
      const catMap = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
      const sugestoes = (prods ?? [])
        .filter((p: any) => !p.name?.toLowerCase().includes(base))
        .slice(0, 3)
        .map((p: any) => ({
          id: p.id,
          nome: p.name,
          preco: Number(p.price),
          categoria: catMap.get(p.category_id) ?? "—",
          tem_foto: !!p.image_url,
        }));
      // Fallback: se não achou nada com categorias, devolve quaisquer 3 produtos diferentes do base.
      let final = sugestoes;
      if (final.length === 0) {
        const { data: anyProds } = await supa.from("products")
          .select("id, name, price, category_id, image_url")
          .eq("restaurant_id", ctx.restaurant_id)
          .eq("is_available", true)
          .limit(10);
        final = (anyProds ?? [])
          .filter((p: any) => !p.name?.toLowerCase().includes(base))
          .slice(0, 3)
          .map((p: any) => ({
            id: p.id, nome: p.name, preco: Number(p.price),
            categoria: catMap.get(p.category_id) ?? "—", tem_foto: !!p.image_url,
          }));
      }
      return { success: true, output: { base: args?.base_product_name, sugestoes: final } };
    }

    if (name === "consultar_taxa_entrega") {
      const bairro = String(args?.bairro || "").trim();
      if (!bairro) return { success: false, output: null, error: "Informe o bairro" };
      const { data: zones } = await supa
        .from("delivery_zones")
        .select("name, fee, min_order_value")
        .eq("restaurant_id", ctx.restaurant_id)
        .eq("is_active", true);
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const target = norm(bairro);
      const match = (zones ?? []).find((z: any) => norm(String(z.name)) === target)
        ?? (zones ?? []).find((z: any) => norm(String(z.name)).includes(target) || target.includes(norm(String(z.name))));
      if (match) {
        return { success: true, output: {
          bairro_encontrado: match.name,
          taxa: Number(match.fee),
          pedido_minimo: match.min_order_value ? Number(match.min_order_value) : null,
          origem: "zona_cadastrada",
        }};
      }
      // Fallback: store_config delivery_fee
      const { data: sc } = await supa
        .from("store_config")
        .select("delivery_fee, min_order_value")
        .eq("restaurant_id", ctx.restaurant_id)
        .maybeSingle();
      return { success: true, output: {
        bairro_encontrado: null,
        taxa: Number(sc?.delivery_fee ?? 0),
        pedido_minimo: sc?.min_order_value ? Number(sc.min_order_value) : null,
        origem: "padrao",
        observacao: `Bairro "${bairro}" não está cadastrado. Usando taxa padrão.`,
      }};
    }

    if (name === "consultar_historico_cliente") {
      const mem = await fetchCustomerMemory(supa, ctx.restaurant_id, ctx.customer_phone);
      return { success: true, output: mem ?? { total_pedidos: 0 } };
    }

    if (name === "repetir_pedido") {
      const variants = [ctx.customer_phone, digitsOnly(ctx.customer_phone), `+${digitsOnly(ctx.customer_phone)}`].filter(Boolean);
      let baseOrder: any = null;
      if (args?.order_id) {
        const { data } = await supa.from("orders").select("*")
          .eq("id", Number(args.order_id))
          .eq("restaurant_id", ctx.restaurant_id)
          .in("customer_phone", variants)
          .maybeSingle();
        baseOrder = data;
      } else {
        const { data } = await supa.from("orders").select("*")
          .eq("restaurant_id", ctx.restaurant_id)
          .in("customer_phone", variants)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        baseOrder = data;
      }
      if (!baseOrder) return { success: false, output: null, error: "Sem pedido anterior para repetir" };

      const { data: baseItems } = await supa.from("order_items")
        .select("product_name, quantity, unit_price, observation")
        .eq("order_id", baseOrder.id);
      if (!baseItems || baseItems.length === 0) return { success: false, output: null, error: "Pedido base sem itens" };

      const payment_method = String(args?.override_payment_method || baseOrder.payment_method);
      const change_for = args?.override_change_for !== undefined ? Number(args.override_change_for) : baseOrder.change_for;
      const street = String(args?.override_address_street || baseOrder.address_street);
      const number = String(args?.override_address_number || baseOrder.address_number);
      const neighborhood = String(args?.override_address_neighborhood || baseOrder.address_neighborhood);
      const complement = args?.override_address_complement ?? baseOrder.address_complement;
      const reference = args?.override_address_reference ?? baseOrder.address_reference;
      const delivery_fee = Number(args?.delivery_fee ?? 0);

      const subtotal = baseItems.reduce((s: number, it: any) => s + Number(it.unit_price) * Number(it.quantity), 0);
      const total = subtotal + delivery_fee;

      const { data: newOrder, error: oe } = await supa.from("orders").insert({
        restaurant_id: ctx.restaurant_id,
        customer_name: baseOrder.customer_name,
        customer_phone: ctx.customer_phone,
        address_street: street,
        address_number: number,
        address_neighborhood: neighborhood,
        address_complement: complement,
        address_reference: reference,
        payment_method,
        change_for,
        total_amount: total,
        status: "pending",
        conversation_id: ctx.conversation_id,
        created_by_agent_id: ctx.agent_id,
      }).select("id").single();
      if (oe || !newOrder) return { success: false, output: null, error: oe?.message || "insert failed" };

      const extraObs = (args?.observacao_extra || "").trim();
      const rows = baseItems.map((it: any, idx: number) => ({
        order_id: newOrder.id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        observation: idx === 0 && extraObs
          ? [it.observation, extraObs].filter(Boolean).join(" — ").slice(0, 500)
          : it.observation,
      }));
      const { error: ie } = await supa.from("order_items").insert(rows);
      if (ie) return { success: false, output: null, error: ie.message };

      return { success: true, output: {
        order_id: newOrder.id,
        baseado_em: baseOrder.id,
        total, subtotal, delivery_fee,
        itens: rows.map((r: any) => ({ nome: r.product_name, quantidade: r.quantity, preco_unit: Number(r.unit_price) })),
        endereco: { rua: street, numero: number, bairro: neighborhood },
        pagamento: payment_method,
      }};
    }

    if (name === "consultar_horario_funcionamento") {
      const { data: hours } = await supa
        .from("business_hours")
        .select("day_of_week, open_time, close_time, is_active")
        .eq("restaurant_id", ctx.restaurant_id)
        .order("day_of_week");
      const { data: sc } = await supa
        .from("store_config")
        .select("is_open, timezone")
        .eq("restaurant_id", ctx.restaurant_id)
        .maybeSingle();
      const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
      const tz = sc?.timezone || "America/Sao_Paulo";
      const agora = new Date();
      let dow = 0; let hhmm = "00:00";
      try {
        const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
        const parts = fmt.formatToParts(agora);
        const wk = parts.find((p) => p.type === "weekday")?.value || "Sun";
        const map: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
        dow = map[wk] ?? 0;
        const h = parts.find((p) => p.type === "hour")?.value || "00";
        const m = parts.find((p) => p.type === "minute")?.value || "00";
        hhmm = `${h}:${m}`;
      } catch { /* ignore tz parse errors */ }
      const hojeRow = (hours ?? []).find((h: any) => h.day_of_week === dow && h.is_active);
      const aberto_agora = !!sc?.is_open && !!hojeRow &&
        hhmm >= String(hojeRow.open_time).slice(0,5) &&
        hhmm <= String(hojeRow.close_time).slice(0,5);
      return { success: true, output: {
        aberto_agora,
        agora_local: hhmm,
        dia_hoje: dias[dow],
        timezone: tz,
        horarios: (hours ?? []).map((h: any) => ({
          dia: dias[h.day_of_week],
          ativo: !!h.is_active,
          abre: String(h.open_time).slice(0,5),
          fecha: String(h.close_time).slice(0,5),
        })),
      }};
    }

    if (name === "consultar_cupons_ativos") {
      const nowIso = new Date().toISOString();
      const { data: cps } = await supa
        .from("coupons")
        .select("code, discount_type, discount_value, min_order_value, max_uses, current_uses, expires_at")
        .eq("restaurant_id", ctx.restaurant_id)
        .eq("is_active", true);
      const valid = (cps ?? []).filter((c: any) => {
        if (c.expires_at && c.expires_at < nowIso) return false;
        if (c.max_uses != null && Number(c.current_uses ?? 0) >= Number(c.max_uses)) return false;
        return true;
      }).map((c: any) => ({
        codigo: c.code,
        tipo: c.discount_type,
        valor: Number(c.discount_value),
        pedido_minimo: c.min_order_value ? Number(c.min_order_value) : null,
        expira_em: c.expires_at,
      }));
      return { success: true, output: { total: valid.length, cupons: valid } };
    }

    if (name === "aplicar_cupom") {
      const code = String(args?.codigo || "").trim();
      const subtotal = Number(args?.subtotal);
      if (!code) return { success: false, output: null, error: "Informe o código do cupom" };
      if (!Number.isFinite(subtotal) || subtotal <= 0) return { success: false, output: null, error: "Subtotal inválido" };
      const { data: cp } = await supa
        .from("coupons")
        .select("code, discount_type, discount_value, min_order_value, max_uses, current_uses, is_active, expires_at")
        .eq("restaurant_id", ctx.restaurant_id)
        .ilike("code", code)
        .maybeSingle();
      if (!cp) return { success: true, output: { valido: false, motivo: "Cupom não encontrado" } };
      if (!cp.is_active) return { success: true, output: { valido: false, motivo: "Cupom inativo" } };
      if (cp.expires_at && new Date(cp.expires_at).getTime() < Date.now()) {
        return { success: true, output: { valido: false, motivo: "Cupom expirado" } };
      }
      if (cp.max_uses != null && Number(cp.current_uses ?? 0) >= Number(cp.max_uses)) {
        return { success: true, output: { valido: false, motivo: "Cupom esgotado" } };
      }
      if (cp.min_order_value && subtotal < Number(cp.min_order_value)) {
        return { success: true, output: { valido: false, motivo: `Pedido mínimo de R$ ${Number(cp.min_order_value).toFixed(2)} para usar este cupom` } };
      }
      let desconto = 0;
      if (cp.discount_type === "percentage") {
        desconto = subtotal * (Number(cp.discount_value) / 100);
      } else {
        desconto = Number(cp.discount_value);
      }
      desconto = Math.min(desconto, subtotal);
      const subtotal_com_desconto = Math.max(0, subtotal - desconto);
      return { success: true, output: {
        valido: true,
        codigo: cp.code,
        tipo: cp.discount_type,
        desconto: Number(desconto.toFixed(2)),
        subtotal_com_desconto: Number(subtotal_com_desconto.toFixed(2)),
        observacao: "Mencione o desconto ao cliente e some/abata na hora de criar_pedido (passe delivery_fee normal; o desconto deve reduzir o unit_price proporcionalmente ou virar uma observação no pedido).",
      }};
    }

    if (name === "consultar_base_conhecimento") {
      const pergunta = String(args?.pergunta || "").trim();
      if (!pergunta) return { success: false, output: null, error: "pergunta vazia" };
      const limit = Math.max(1, Math.min(Number(args?.limite ?? 4), 8));
      const vec = await embedQuery(pergunta);
      if (!vec) return { success: false, output: null, error: "falha ao gerar embedding" };
      const { data: matches, error } = await supa.rpc("match_agent_knowledge", {
        p_restaurant_id: ctx.restaurant_id,
        p_query_embedding: vec as any,
        p_match_count: limit,
      });
      if (error) return { success: false, output: null, error: error.message };
      const out = (matches ?? []).map((m: any) => ({
        fonte: m.source_label || m.source_type,
        relevancia: Number((m.similarity ?? 0).toFixed(3)),
        conteudo: m.content,
      }));
      return { success: true, output: { total: out.length, trechos: out } };
    }

    // ============ FASE 3 EXECUTORS ============
    if (name === "consultar_status_entrega") {
      let q = supa
        .from("orders")
        .select("id, status, total_amount, created_at, address_street, address_number, address_neighborhood, payment_method, payment_status, payment_method_online")
        .eq("restaurant_id", ctx.restaurant_id)
        .eq("customer_phone", ctx.customer_phone)
        .order("created_at", { ascending: false })
        .limit(1);
      if (args?.order_id) q = supa.from("orders").select("id, status, total_amount, created_at, address_street, address_number, address_neighborhood, payment_method, payment_status, payment_method_online").eq("id", Number(args.order_id)).eq("restaurant_id", ctx.restaurant_id).limit(1);
      const { data: rows } = await q;
      const o = (rows ?? [])[0];
      if (!o) return { success: true, output: { encontrado: false, mensagem: "Não achei nenhum pedido seu." } };
      const map: Record<string, string> = {
        pending: "Pedido recebido, aguardando confirmação da cozinha",
        accepted: "Aceito — entrando na fila da cozinha",
        preparing: "Sendo preparado agora",
        ready: "Pronto, esperando o entregador",
        delivering: "Saiu para entrega",
        delivered: "Entregue",
        completed: "Concluído",
        cancelled: "Cancelado",
      };
      return { success: true, output: {
        encontrado: true,
        order_id: o.id,
        status: o.status,
        status_amigavel: map[o.status] || o.status,
        total: Number(o.total_amount),
        criado_em: o.created_at,
        endereco: o.address_street ? `${o.address_street}, ${o.address_number ?? ''} - ${o.address_neighborhood ?? ''}` : null,
        pagamento: o.payment_method,
        pagamento_status: o.payment_status,
      } };
    }

    if (name === "atualizar_pedido") {
      const oid = Number(args?.order_id);
      if (!oid) return { success: false, output: null, error: "order_id obrigatório" };
      const { data: o } = await supa
        .from("orders")
        .select("id, status, customer_phone, restaurant_id")
        .eq("id", oid)
        .eq("restaurant_id", ctx.restaurant_id)
        .maybeSingle();
      if (!o) return { success: true, output: { atualizado: false, motivo: "Pedido não encontrado." } };
      if (o.customer_phone !== ctx.customer_phone) return { success: true, output: { atualizado: false, motivo: "Esse pedido é de outro cliente." } };
      if (!["pending", "accepted"].includes(o.status)) {
        return { success: true, output: { atualizado: false, motivo: `Pedido já está em '${o.status}', não dá mais para alterar. Chame escalar_humano se for urgente.` } };
      }
      const patch: any = {};
      if (args.observacao) patch.address_reference = String(args.observacao).slice(0, 500);
      if (args.payment_method) patch.payment_method = String(args.payment_method);
      if (Number.isFinite(Number(args.change_for))) patch.change_for = Number(args.change_for);
      if (args.address_street) patch.address_street = String(args.address_street);
      if (args.address_number) patch.address_number = String(args.address_number);
      if (args.address_neighborhood) patch.address_neighborhood = String(args.address_neighborhood);
      if (args.address_complement) patch.address_complement = String(args.address_complement);
      if (args.address_reference) patch.address_reference = String(args.address_reference);
      if (Object.keys(patch).length === 0) return { success: true, output: { atualizado: false, motivo: "Nada para atualizar." } };
      const { error } = await supa.from("orders").update(patch).eq("id", oid);
      if (error) return { success: false, output: null, error: error.message };
      return { success: true, output: { atualizado: true, campos: Object.keys(patch) } };
    }

    if (name === "cancelar_pedido") {
      const oid = Number(args?.order_id);
      if (!oid) return { success: false, output: null, error: "order_id obrigatório" };
      const { data: o } = await supa
        .from("orders")
        .select("id, status, customer_phone, total_amount, restaurant_id")
        .eq("id", oid)
        .eq("restaurant_id", ctx.restaurant_id)
        .maybeSingle();
      if (!o) return { success: true, output: { cancelado: false, motivo: "Pedido não encontrado." } };
      if (o.customer_phone !== ctx.customer_phone) return { success: true, output: { cancelado: false, motivo: "Esse pedido é de outro cliente." } };
      if (["delivered", "completed", "cancelled"].includes(o.status)) return { success: true, output: { cancelado: false, motivo: `Pedido já está '${o.status}'.` } };
      const { data: limit } = await supa
        .from("agent_safety_limits")
        .select("cancel_max_value_cents")
        .eq("restaurant_id", ctx.restaurant_id)
        .maybeSingle();
      const maxCents = Number(limit?.cancel_max_value_cents ?? 0);
      const totalCents = Math.round(Number(o.total_amount || 0) * 100);
      if (maxCents > 0 && totalCents > maxCents) {
        return { success: true, output: { cancelado: false, motivo: `Pedido acima do teto de cancelamento automático (R$ ${(maxCents/100).toFixed(2)}). Use escalar_humano.` } };
      }
      const { error } = await supa.from("orders").update({
        status: "cancelled",
      }).eq("id", oid);
      if (error) return { success: false, output: null, error: error.message };
      return { success: true, output: { cancelado: true, order_id: oid } };
    }

    if (name === "escalar_humano") {
      const motivo = String(args?.motivo || "Solicitação do cliente").slice(0, 500);
      const urgencia = String(args?.urgencia || "media");
      const { error } = await supa.from("wa_conversations")
        .update({ ai_enabled: false, status: "open" })
        .eq("id", ctx.conversation_id);
      if (error) return { success: false, output: null, error: error.message };
      await supa.from("wa_messages").insert({
        restaurant_id: ctx.restaurant_id,
        conversation_id: ctx.conversation_id,
        direction: "out",
        from_me: true,
        content_type: "text",
        text: `🔔 [ESCALADO PARA HUMANO — ${urgencia.toUpperCase()}] ${motivo}`,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      return { success: true, output: { escalado: true, mensagem_para_cliente: "Tô chamando alguém da equipe pra te atender aqui, só um instante 🙏" } };
    }

    if (name === "agendar_followup") {
      const horas = Math.max(0.25, Math.min(168, Number(args?.horas)));
      const objetivo = String(args?.objetivo || "").slice(0, 500);
      if (!objetivo) return { success: false, output: null, error: "objetivo obrigatório" };
      const next_run_at = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
      const { error } = await supa.from("ai_outreach_queue").insert({
        restaurant_id: ctx.restaurant_id,
        conversation_id: ctx.conversation_id,
        contact_id: ctx.contact_id,
        agent_id: ctx.agent_id,
        objective: objetivo,
        status: "scheduled",
        next_run_at,
        max_followups: 1,
        followup_interval_hours: Math.ceil(horas),
      });
      if (error) return { success: false, output: null, error: error.message };
      return { success: true, output: { agendado: true, dispara_em: next_run_at } };
    }

    if (name === "registrar_endereco_desconhecido") {
      const endereco = String(args?.endereco || "").trim();
      if (!endereco) return { success: false, output: null, error: "endereco obrigatório" };
      const { error } = await supa.from("unknown_address_requests").insert({
        restaurant_id: ctx.restaurant_id,
        customer_phone: ctx.customer_phone,
        raw_address: endereco.slice(0, 500),
        neighborhood: args?.bairro ? String(args.bairro).slice(0, 200) : null,
        note: args?.observacao ? String(args.observacao).slice(0, 500) : null,
        conversation_id: ctx.conversation_id,
        agent_id: ctx.agent_id,
      });
      if (error) return { success: false, output: null, error: error.message };
      return { success: true, output: {
        registrado: true,
        mensagem_para_cliente: "Anotei seu endereço aqui — ainda não temos taxa configurada pra essa região, mas vou avisar o restaurante. Quer que eu chame um humano pra confirmar se rola entrega aí?",
      } };
    }

    return { success: false, output: null, error: `tool desconhecida: ${name}` };
  } catch (e: any) {
    return { success: false, output: null, error: e?.message || "exec error" };
  }
}

// =================== AI GATEWAY CALL ===================
async function callAI(
  provider: string,
  apiKey: string,
  model: string,
  messages: any[],
  tools: any[],
  temperature: number,
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  // Lovable Gateway + OpenAI use the same OpenAI-compatible schema.
  // Gemini direct também tem endpoint OpenAI-compat na vertex/genai. Para simplicidade, exigimos OpenAI-compat.
  let endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
  if (provider === "openai") endpoint = "https://api.openai.com/v1/chat/completions";
  if (provider === "gemini") endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools, temperature, tool_choice: "auto" }),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) return { ok: false, status: res.status, data, error: typeof data === "string" ? data.slice(0, 300) : (data?.error?.message || `HTTP ${res.status}`) };
  return { ok: true, status: res.status, data };
}

// =================== EVOLUTION SEND ===================
async function evoPost(server: string, apiKey: string, path: string, bodyPayload: Record<string, any>) {
  const res = await fetch(`${normalizeUrl(server)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(bodyPayload),
  });
  const t = await res.text();
  let body: any = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { ok: res.ok, status: res.status, body, path };
}

function bodyPreview(body: any): string {
  return typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body ?? null).slice(0, 500);
}

function sendErrorMessage(result: Awaited<ReturnType<typeof evoPost>> | null): string {
  if (!result) return "A Evolution não respondeu ao envio.";
  const raw = result.body?.message ?? result.body?.error ?? result.body?.response?.message ?? result.body?.response?.error;
  const message = Array.isArray(raw) ? raw.join(" ") : raw ? String(raw) : "";
  return message || `A Evolution respondeu status ${result.status} no caminho ${result.path}: ${bodyPreview(result.body)}`;
}

async function sendWhatsApp(server: string, apiKey: string, instance: string, number: string, text: string) {
  const attempts = [
    { path: `/message/sendText/${encodeURIComponent(instance)}`, body: { number, text } },
    { path: "/send/text", body: { number, text } },
  ];

  let last: Awaited<ReturnType<typeof evoPost>> | null = null;
  for (const attempt of attempts) {
    const result = await evoPost(server, apiKey, attempt.path, attempt.body);
    if (result.ok) return result;
    last = result;
  }

  if (last) {
    console.error(`[whatsapp-bot] evolution send failed path=${last.path} status=${last.status} body=${bodyPreview(last.body)}`);
    return last;
  }
  return { ok: false, status: 0, body: { error: "send_failed" }, path: "" };
}

async function sendWhatsAppImage(
  server: string,
  apiKey: string,
  instance: string,
  number: string,
  imageUrl: string,
  caption: string,
) {
  const attempts = [
    {
      path: `/message/sendMedia/${encodeURIComponent(instance)}`,
      body: { number, mediatype: "image", media: imageUrl, caption, fileName: "produto.jpg" },
    },
    { path: "/send/image", body: { number, image: imageUrl, caption } },
  ];

  let last: Awaited<ReturnType<typeof evoPost>> | null = null;
  for (const attempt of attempts) {
    const result = await evoPost(server, apiKey, attempt.path, attempt.body);
    if (result.ok) return result;
    last = result;
  }

  if (last) {
    console.error(`[whatsapp-bot] evolution sendImage failed path=${last.path} status=${last.status} body=${bodyPreview(last.body)}`);
    return last;
  }
  return { ok: false, status: 0, body: { error: "send_image_failed" }, path: "" };
}

// =================== MAIN ===================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Only internal callers (bot-debounce-tick, evolution-webhook) may invoke this.
    // They must present the service-role key as bearer.
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer || bearer !== SERVICE_ROLE) {
      return json({ error: "unauthorized" }, 401);
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const payload = await req.json().catch(() => ({}));
    const conversation_id: string = payload?.conversation_id;
    if (!conversation_id) return json({ error: "conversation_id required" }, 400);

    // Load conversation
    const { data: conv } = await supa
      .from("wa_conversations")
      .select("id, restaurant_id, contact_id, instance_id, ai_enabled, ai_agent_id, assigned_user_id, status")
      .eq("id", conversation_id)
      .maybeSingle();
    if (!conv) return json({ error: "conv not found" }, 404);
    if (!conv.ai_enabled) return skipped("ai_disabled");
    if (conv.assigned_user_id) return skipped("human_active");

    // Resolve agent (assigned or default)
    let agent: any = null;
    if (conv.ai_agent_id) {
      const { data } = await supa.from("restaurant_agents").select("*").eq("id", conv.ai_agent_id).maybeSingle();
      agent = data;
    }
    if (!agent) {
      const { data } = await supa
        .from("restaurant_agents")
        .select("*")
        .eq("restaurant_id", conv.restaurant_id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      agent = data;
    }
    if (!agent) return skipped("no_active_agent");

    // Dedicated instance filter: if agent is bound to a specific WA instance, only handle messages from there
    if (agent.dedicated_instance_id && agent.dedicated_instance_id !== conv.instance_id) {
      return skipped("agent_not_for_this_instance");
    }

    // Daily safety limits
    const { data: limits } = await supa
      .from("agent_safety_limits")
      .select("max_tool_executions_per_day, max_messages_per_contact_per_hour")
      .eq("restaurant_id", conv.restaurant_id)
      .maybeSingle();
    if (limits?.max_tool_executions_per_day) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supa
        .from("agent_tool_executions")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", conv.restaurant_id)
        .gte("created_at", since);
      if ((count ?? 0) >= limits.max_tool_executions_per_day) {
        return skipped("daily_limit_reached");
      }
    }

    // Routing + credentials
    const { data: routing } = await supa
      .from("org_ai_routing")
      .select("provider, model, is_active")
      .eq("restaurant_id", conv.restaurant_id)
      .eq("capability", "agent_chat")
      .maybeSingle();
    const provider = routing?.is_active && routing.provider ? routing.provider : "lovable";
    const model = routing?.is_active && routing.model ? routing.model : (agent.model || "google/gemini-2.5-flash");

    let apiKey = LOVABLE_API_KEY;
    if (provider !== "lovable") {
      const { data: cred } = await supa
        .from("org_ai_credentials")
        .select("api_key_encrypted")
        .eq("restaurant_id", conv.restaurant_id)
        .eq("provider", provider)
        .maybeSingle();
      if (!cred?.api_key_encrypted) return skipped("no_credential");
      if (!ENC_KEY) return skipped("encryption_key_missing");
      const { data: dec } = await supa.rpc("decrypt_ai_credential", { p_key: ENC_KEY, p_cipher: cred.api_key_encrypted });
      if (!dec) return skipped("decrypt_failed");
      apiKey = String(dec);
    }

    // Contact + instance + reseller config
    const { data: contact } = await supa
      .from("wa_contacts")
      .select("phone_e164, name")
      .eq("id", conv.contact_id)
      .maybeSingle();
    if (!contact?.phone_e164) return skipped("no_contact");

    const { data: inst } = await supa
      .from("evolution_instances")
      .select("id, instance_name, reseller_id, status, instance_token")
      .eq("id", conv.instance_id)
      .maybeSingle();
    if (!inst || inst.status !== "connected") return skipped("instance_disconnected");

    const { data: cfg } = await supa
      .from("reseller_evolution_config")
      .select("server_url, global_api_key")
      .eq("reseller_id", inst.reseller_id)
      .maybeSingle();
    if (!cfg?.server_url || !cfg?.global_api_key) return skipped("no_evo_cfg");

    // Restaurant store config for richer system context
    const { data: store } = await supa
      .from("store_config")
      .select("name, is_open, delivery_fee, delivery_time_min, delivery_time_max, address, phone_whatsapp, min_order_value, timezone")
      .eq("restaurant_id", conv.restaurant_id)
      .maybeSingle();

    // Business hours + active coupons for prompt context
    const [{ data: hoursRows }, { data: couponsRows }] = await Promise.all([
      supa.from("business_hours")
        .select("day_of_week, open_time, close_time, is_active")
        .eq("restaurant_id", conv.restaurant_id)
        .order("day_of_week"),
      supa.from("coupons")
        .select("code, discount_type, discount_value, min_order_value, expires_at, max_uses, current_uses, is_active")
        .eq("restaurant_id", conv.restaurant_id)
        .eq("is_active", true),
    ]);
    const nowIso = new Date().toISOString();
    const activeCoupons = (couponsRows ?? []).filter((c: any) => {
      if (c.expires_at && c.expires_at < nowIso) return false;
      if (c.max_uses != null && Number(c.current_uses ?? 0) >= Number(c.max_uses)) return false;
      return true;
    });
    if (store) {
      (store as any)._business_hours = hoursRows ?? [];
      (store as any)._active_coupons = activeCoupons;
    }

    // Training examples (correções aprendidas)
    const { data: trainingRows } = await supa
      .from("agent_training_examples")
      .select("user_message, good_assistant_message, bad_assistant_message, note")
      .eq("restaurant_id", conv.restaurant_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(12);

    const { data: restRow } = await supa
      .from("restaurants")
      .select("slug")
      .eq("id", conv.restaurant_id)
      .maybeSingle();
    const restaurant_slug: string | null = restRow?.slug ?? null;
    // Evolution API v2 sends are more reliable with the global API key. The
    // per-instance token is kept only as a fallback when no global key exists.
    const evo_api_key = cfg.global_api_key || inst.instance_token;

    // Load history
    const { data: history } = await supa
      .from("wa_messages")
      .select("id, direction, text, content_type, status, created_at, media_url, media_mime")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const ordered = (history ?? []).reverse();

    // Transcrição automática de áudios inbound sem texto
    const audioMsgs = ordered.filter((m: any) =>
      m.direction === "in" && m.content_type === "audio" && (!m.text || !m.text.trim()) && (m as any).media_url
    );
    for (const am of audioMsgs.slice(-3)) { // só os 3 mais recentes pra economizar
      const transcript = await transcribeAudio((am as any).media_url, (am as any).media_mime || "audio/ogg").catch(() => null);
      if (transcript && transcript.trim()) {
        (am as any).text = `[áudio transcrito] ${transcript.trim()}`;
        await supa.from("wa_messages").update({ text: (am as any).text }).eq("id", am.id);
      }
    }

    const latestInbound = [...ordered].reverse().find((m: any) => m.direction === "in" && m.text?.trim());
    const latestOutbound = [...ordered].reverse().find((m: any) =>
      m.direction === "out" && ["sent", "delivered", "read"].includes(String(m.status || ""))
    );
    if (!latestInbound?.id) return skipped("no_inbound_message");
    if (latestOutbound?.created_at && new Date(latestOutbound.created_at) > new Date(latestInbound.created_at)) {
      return skipped("already_replied");
    }

    // ============ PROMPT-INJECTION GUARD ============
    const inboundText = String(latestInbound.text || "").toLowerCase();
    const injectionPatterns = [
      /ignore (todas )?(as )?(instru[cç][oõ]es|instructions|previous)/i,
      /esque[çc]a (suas|as) (instru[cç][oõ]es|regras)/i,
      /you are now/i,
      /system prompt/i,
      /reveal your (prompt|instructions|system)/i,
      /act as (a |an )?(developer|admin|root|superuser)/i,
      /\b100% (de )?desconto\b/i,
      /\bdesconto de 100%/i,
      /\bgr[aá]tis pra mim\b/i,
    ];
    if (injectionPatterns.some((re) => re.test(inboundText))) {
      const reply = "Posso ajudar com cardápio, pedidos, taxa e horário 🙂 Pra desconto, só com cupom oficial — quer ver os que estão ativos?";
      await sendWhatsApp(cfg.server_url, evo_api_key, inst.instance_name, digitsOnly(contact.phone_e164), reply);
      await supa.from("wa_messages").insert({
        restaurant_id: conv.restaurant_id, conversation_id: conv.id, direction: "out", from_me: true,
        content_type: "text", text: reply, status: "sent", sent_at: new Date().toISOString(),
      });
      return json({ ok: true, blocked: "prompt_injection" });
    }

    // ============ RATE LIMIT POR CONTATO ============
    const maxPerHour = Number(limits?.max_messages_per_contact_per_hour ?? 30);
    if (maxPerHour > 0) {
      const sinceHr = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: outCount } = await supa
        .from("wa_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .eq("direction", "out")
        .gte("created_at", sinceHr);
      if ((outCount ?? 0) >= maxPerHour) {
        return skipped("contact_rate_limit");
      }
    }

    const { error: claimError } = await supa.from("bot_response_claims").insert({
      conversation_id: conv.id,
      inbound_message_id: latestInbound.id,
      restaurant_id: conv.restaurant_id,
    });
    if (claimError) {
      if (claimError.code === "23505" && latestOutbound?.created_at && new Date(latestOutbound.created_at) > new Date(latestInbound.created_at)) {
        return skipped("duplicate_claim");
      }
      if (claimError.code === "23505") {
        console.warn("[whatsapp-bot] retrying previously claimed inbound with no successful outbound", latestInbound.id);
      } else {
        console.error("[whatsapp-bot] claim failed", claimError);
        return json({ ok: false, error: "claim_failed" });
      }
    }

    // Customer memory + session detection
    const memory = await fetchCustomerMemory(supa, conv.restaurant_id, contact.phone_e164).catch(() => null);
    const SESSION_GAP_MS = 6 * 60 * 60 * 1000; // 6h
    let sessaoNova = true;
    if (latestOutbound?.created_at && latestInbound?.created_at) {
      const gap = new Date(latestInbound.created_at).getTime() - new Date(latestOutbound.created_at).getTime();
      sessaoNova = gap > SESSION_GAP_MS;
    }
    const systemPrompt = buildSystemPrompt(agent, store, contact, memory, sessaoNova, trainingRows ?? []);

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...ordered
        .filter((m) =>
          m.text &&
          m.text.trim().length > 0 &&
          !(m.direction === "out" && !["sent", "delivered", "read"].includes(String(m.status || "")))
        )
        .map((m) => ({
          role: m.direction === "in" ? "user" : "assistant",
          content: m.direction === "out" ? hardenReplyText(m.text) : String(m.text).trim().slice(0, 1200),
        })),
    ];

    let allowedTools: string[] = agent.allowed_tools || [];
    if (agent.can_close_orders === false && allowedTools.length) {
      allowedTools = allowedTools.filter((t: string) => t !== "criar_pedido");
    }
    const tools = filterToolsByAllowed(allowedTools);
    const maxSteps = Math.min(Math.max(Number(agent.max_steps ?? DEFAULT_MAX_STEPS), 1), 12);
    const temperature = Number(agent.temperature ?? 0.7);

    let finalText: string | null = null;

    for (let step = 0; step < maxSteps; step++) {
      const t0 = Date.now();
      const res = await callAI(provider, apiKey, model, messages, tools, temperature);
      if (!res.ok) {
        console.error("[whatsapp-bot] AI error", res.status, res.error);
        if (res.status === 429 || res.status === 402) {
          // Silently stop; supervisor can review.
          return json({ ok: true, error: "ai_quota", status: res.status });
        }
        return json({ ok: false, error: "ai_failed" });
      }
      const choice = res.data?.choices?.[0];
      const msg = choice?.message;
      if (!msg) return json({ ok: false, error: "no_choice" });

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          const fname = tc.function?.name;
          let fargs: any = {};
          try { fargs = JSON.parse(tc.function?.arguments || "{}"); } catch { fargs = {}; }
          const exec = await execTool(supa, fname, fargs, {
            restaurant_id: conv.restaurant_id,
            contact_id: conv.contact_id,
            conversation_id: conv.id,
            agent_id: agent.id,
            customer_phone: contact.phone_e164,
            restaurant_slug,
            evo_server: cfg.server_url,
            evo_api_key,
            evo_instance: inst.instance_name,
          });
          await supa.from("agent_tool_executions").insert({
            restaurant_id: conv.restaurant_id,
            agent_id: agent.id,
            agent_name: agent.name,
            channel: "whatsapp",
            contact_id: conv.contact_id,
            conversation_id: conv.id,
            tool_name: fname,
            input: fargs,
            output: exec.output,
            success: exec.success,
            error_message: exec.error ?? null,
            duration_ms: Date.now() - t0,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(exec.success ? exec.output : { error: exec.error }),
          });
        }
        continue;
      }

      finalText = (msg.content || "").trim();
      break;
    }

    if (!finalText) return skipped("no_reply");

    // Split in bubbles, dedupe, send sequentially with small typing delay
    const number = digitsOnly(contact.phone_e164);
    const bubbles = splitBubbles(finalText, !!agent.split_messages);
    const typingDelay = Math.max(0, Math.min(Number(agent.typing_delay_ms ?? 800), 5000));
    let anyFailed = false;
    const failures: string[] = [];

    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (!b) continue;
      if (i > 0 && typingDelay > 0) await sleep(typingDelay);
      const sendRes = await sendWhatsApp(cfg.server_url, evo_api_key, inst.instance_name, number, b);
      if (!sendRes.ok) {
        anyFailed = true;
        failures.push(sendErrorMessage(sendRes));
      }
      const waId = sendRes.body?.key?.id ?? sendRes.body?.messageId ?? null;
      await supa.from("wa_messages").insert({
        restaurant_id: conv.restaurant_id,
        conversation_id: conv.id,
        wa_message_id: waId,
        direction: "out",
        from_me: true,
        content_type: "text",
        text: b,
        status: sendRes.ok ? "sent" : "failed",
        sent_at: new Date().toISOString(),
      });
    }

    if (anyFailed) {
      return json({ ok: false, sent: false, error: failures.join(" | ") || "A Evolution recusou o envio da resposta do agente.", bubbles: bubbles.length }, 502);
    }

    return json({ ok: true, sent: true, bubbles: bubbles.length });
  } catch (e: any) {
    console.error("[whatsapp-bot] fatal", e);
    return json({ error: "internal" }, 500);
  }
});