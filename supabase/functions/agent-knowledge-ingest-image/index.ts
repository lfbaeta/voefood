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
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EMBED_MODEL = "openai/text-embedding-3-small";
const VISION_MODEL = "google/gemini-2.5-flash";
const CHUNK_SIZE = 900;

function chunkText(text: string): string[] {
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const paragraphs = clean.split(/\n{2,}/);
  const out: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length <= CHUNK_SIZE) buf = buf ? buf + "\n\n" + p : p;
    else {
      if (buf) out.push(buf);
      if (p.length <= CHUNK_SIZE) buf = p;
      else {
        for (let i = 0; i < p.length; i += CHUNK_SIZE - 120) out.push(p.slice(i, i + CHUNK_SIZE));
        buf = "";
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data?.data || []).map((d: any) => d.embedding);
}

async function ocrImage(imageDataUrl: string): Promise<string> {
  const prompt = `Você é um extrator de conhecimento para o assistente de um restaurante.
Descreva de forma detalhada e estruturada TUDO que estiver visível na imagem: nomes de produtos, preços, tamanhos, ingredientes, promoções, regras, horários, endereços, avisos.
Não invente. Se não estiver visível, não escreva. Devolva texto corrido em português.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content || "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const restaurant_id = String(body?.restaurant_id || "");
    const source_label = String(body?.source_label || "Imagem").slice(0, 200);
    const storage_path = String(body?.storage_path || "");
    if (!restaurant_id || !storage_path) return json({ error: "missing restaurant_id or storage_path" }, 400);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const [{ data: isAdmin }, { data: isReseller }] = await Promise.all([
      supa.rpc("is_admin_of_restaurant", { _user_id: user.id, _restaurant_id: restaurant_id }),
      supa.rpc("is_reseller", { _user_id: user.id }),
    ]);
    if (!isAdmin && !isReseller) return json({ error: "forbidden" }, 403);

    // Baixa a imagem via storage e converte para data url
    const { data: file, error: dlErr } = await supa.storage.from("agent-knowledge").download(storage_path);
    if (dlErr || !file) return json({ error: "download failed" }, 500);
    const mime = file.type || "image/jpeg";
    const buf = new Uint8Array(await file.arrayBuffer());
    // base64
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:${mime};base64,${b64}`;

    const extracted = await ocrImage(dataUrl);
    if (!extracted || extracted.length < 20) return json({ error: "empty_extraction" }, 400);

    const chunks = chunkText(extracted);
    if (chunks.length === 0) return json({ error: "empty content" }, 400);
    if (chunks.length > 80) return json({ error: "conteúdo muito grande" }, 400);

    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const vecs = await embedBatch(chunks.slice(i, i + 16));
      embeddings.push(...vecs);
    }

    // URL assinada para auditoria
    const { data: signed } = await supa.storage.from("agent-knowledge").createSignedUrl(storage_path, 60 * 60 * 24 * 365);

    const rows = chunks.map((c, i) => ({
      restaurant_id,
      source_type: "image",
      source_label,
      content: c,
      embedding: embeddings[i] as any,
      metadata: { chunk_index: i, total: chunks.length, storage_path, image_url: signed?.signedUrl ?? null },
    }));

    const { error: ie, data: inserted } = await supa
      .from("agent_knowledge_chunks")
      .insert(rows)
      .select("id");
    if (ie) return json({ error: ie.message }, 500);

    return json({ ok: true, inserted: inserted?.length ?? 0, chunks: chunks.length });
  } catch (e: any) {
    console.error("[agent-knowledge-ingest-image] fatal", e);
    return json({ error: e?.message || "internal" }, 500);
  }
});
