import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeUrl(u: string): string {
  let s = u.trim().replace(/\/+$/, "");
  s = s.replace(/\/(manager|admin|dashboard|api)(\/.*)?$/i, "");
  return s.replace(/\/+$/, "");
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function compactBody(body: any): string {
  if (!body) return "sem detalhes";
  if (typeof body === "string") return body.slice(0, 500);
  return JSON.stringify(body).slice(0, 500);
}

function evoError(resp: { status: number; body: any }, fallback: string): string {
  const raw = resp.body?.message ?? resp.body?.error ?? resp.body?.response?.message ?? resp.body?.response?.error;
  const message = Array.isArray(raw) ? raw.join(" ") : raw ? String(raw) : "";
  return message || `${fallback} A Evolution respondeu status ${resp.status}: ${compactBody(resp.body)}`;
}

async function evoFetch(url: string, apiKey: string, path: string, body: any) {
  console.log(`[evolution-send] POST ${path} body=${JSON.stringify(body).slice(0, 300)}`);
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    console.error(
      `[evolution-send] error: status=${res.status} path=${path} body=${
        typeof parsed === "string" ? parsed.slice(0, 500) : JSON.stringify(parsed).slice(0, 500)
      }`,
    );
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function evoFetchFirst(url: string, apiKey: string, attempts: Array<{ path: string; body: any }>) {
  let last: Awaited<ReturnType<typeof evoFetch>> | null = null;
  for (const attempt of attempts) {
    const result = await evoFetch(url, apiKey, attempt.path, attempt.body);
    if (result.ok) return result;
    last = result;
  }
  return last ?? { ok: false, status: 0, body: { error: "Falha ao enviar" } };
}

async function authorizeRestaurant(supaAdmin: any, userId: string, restaurantId: string): Promise<boolean> {
  const { data: adminRow } = await supaAdmin
    .from("restaurant_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (adminRow) return true;

  const { data: r } = await supaAdmin
    .from("restaurants")
    .select("reseller_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!r?.reseller_id) return false;

  const { data: res } = await supaAdmin
    .from("resellers")
    .select("id")
    .eq("user_id", userId)
    .eq("id", r.reseller_id)
    .maybeSingle();
  return !!res;
}

async function loadConfig(supaAdmin: any, resellerId: string) {
  const { data: cfg } = await supaAdmin
    .from("reseller_evolution_config")
    .select("server_url, global_api_key")
    .eq("reseller_id", resellerId)
    .maybeSingle();
  if (!cfg?.server_url || !cfg?.global_api_key) return null;
  return { url: normalizeUrl(cfg.server_url), globalKey: cfg.global_api_key };
}

async function sendByType(url: string, apiKey: string, instanceName: string, type: string, to: string, payload: Record<string, any>) {
  const phone = digitsOnly(to);
  switch (type) {
    case "text":
      return evoFetchFirst(url, apiKey, [
        { path: `/message/sendText/${encodeURIComponent(instanceName)}`, body: { number: phone, text: payload.text } },
        { path: "/send/text", body: { number: phone, text: payload.text } },
      ]);
    case "media": {
      const rawMedia = payload.url ?? payload.media;
      const mediaType = payload.type || payload.mediatype || "image";
      const isDataUrl = typeof rawMedia === "string" && rawMedia.startsWith("data:");
      const mediaPayload: Record<string, any> = {
        number: phone,
        type: mediaType,
        caption: payload.caption,
        fileName: payload.fileName || payload.filename,
      };
      if (isDataUrl) mediaPayload.media = rawMedia;
      else mediaPayload.url = rawMedia;
      if (payload.mimetype) mediaPayload.mimetype = payload.mimetype;
      return evoFetchFirst(url, apiKey, [
        { path: `/message/sendMedia/${encodeURIComponent(instanceName)}`, body: { ...mediaPayload, mediatype: mediaType, media: rawMedia } },
        { path: "/send/media", body: mediaPayload },
      ]);
    }
    case "audio": {
      const audioUrl = payload.audio || payload.url || payload.media;
      const isDataUrl = typeof audioUrl === "string" && audioUrl.startsWith("data:");
      const audioPayload: Record<string, any> = {
        number: phone,
        type: "audio",
        mimetype: payload.mimetype || "audio/ogg",
        fileName: payload.fileName || payload.filename || `audio-${Date.now()}.ogg`,
      };
      if (isDataUrl) audioPayload.media = audioUrl;
      else audioPayload.url = audioUrl;
      return evoFetchFirst(url, apiKey, [
        { path: `/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, body: { number: phone, audio: audioUrl } },
        { path: "/send/media", body: audioPayload },
      ]);
    }
    case "sticker":
      return evoFetch(url, apiKey, "/send/sticker", { number: phone, sticker: payload.sticker });
    case "location":
      return evoFetch(url, apiKey, "/send/location", {
        number: phone,
        latitude: payload.latitude,
        longitude: payload.longitude,
        name: payload.name,
        address: payload.address,
      });
    case "contact":
      return evoFetch(url, apiKey, "/send/contact", { number: phone, contact: payload.contacts || payload.contact });
    case "link":
      return evoFetch(url, apiKey, "/send/link", { number: phone, link: payload.link, text: payload.text });
    case "poll":
      return evoFetch(url, apiKey, "/send/poll", {
        number: phone,
        name: payload.name,
        selectableCount: payload.selectableCount || 1,
        values: payload.values,
      });
    case "reaction":
      return evoFetch(url, apiKey, "/send/reaction", { key: payload.key, reaction: payload.reaction });
    case "edit":
      return evoFetch(url, apiKey, "/chat/updateMessage", { number: phone, key: payload.key, text: payload.text });
    case "delete":
      return evoFetch(url, apiKey, "/chat/deleteMessageForEveryone", {
        id: payload.id,
        remoteJid: payload.remoteJid,
        fromMe: payload.fromMe ?? true,
        participant: payload.participant,
      });
    case "markRead":
      return evoFetch(url, apiKey, "/chat/markMessageAsRead", { readMessages: payload.readMessages });
    case "presence": {
      const state = String(payload.state || payload.presence || "composing");
      const isAudio = payload.isAudio === true || state === "recording";
      return evoFetch(url, apiKey, "/message/presence", { number: phone, state, isAudio });
    }
    default:
      return { ok: false, status: 400, body: { error: `Unknown type: ${type}` } };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authErr } = await supaUser.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const supaAdmin = createClient(supabaseUrl, serviceKey);
    const payload = await req.json().catch(() => ({}));
    const action: string = payload?.action;
    if (!action) return json({ error: "action required" }, 400);

    if (action === "send_direct") {
      const restaurant_id: string = payload?.restaurant_id;
      const instance_id: string | undefined = payload?.instance_id;
      const type: string = payload?.type;
      const to: string = payload?.to;
      const bodyPayload: Record<string, any> = payload?.payload;
      if (!restaurant_id || !type || !to || !bodyPayload) return json({ error: "Missing restaurant_id/type/to/payload" }, 400);
      if (!(await authorizeRestaurant(supaAdmin, user.id, restaurant_id))) return json({ error: "Forbidden" }, 403);

      let instQ = supaAdmin.from("evolution_instances").select("*").eq("restaurant_id", restaurant_id);
      if (instance_id) instQ = instQ.eq("id", instance_id);
      const { data: insts } = await instQ;
      const inst = (insts ?? [])
        .filter((i: any) => i.status === "connected")
        .sort((a: any, b: any) => Number(b.is_default) - Number(a.is_default))[0];
      if (!inst) return json({ error: "Nenhuma instância conectada disponível" }, 400);

      const cfg = await loadConfig(supaAdmin, inst.reseller_id);
      if (!cfg) return json({ error: "Servidor Evolution não configurado" }, 400);
      const resp = await sendByType(cfg.url, cfg.globalKey || inst.instance_token, inst.instance_name, type, to, bodyPayload);
      return json(resp, resp.ok ? 200 : resp.status >= 400 ? resp.status : 502);
    }

    if (action === "start_conversation") {
      const restaurant_id: string = payload?.restaurant_id;
      const instance_id: string | undefined = payload?.instance_id;
      const phoneRaw: string = (payload?.phone ?? "").toString();
      const text: string = (payload?.text ?? "").toString().trim();
      const name: string | undefined = payload?.name?.toString();
      if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);
      const phone = digitsOnly(phoneRaw);
      if (phone.length < 10 || phone.length > 15) return json({ error: "Telefone inválido" }, 400);
      if (!text) return json({ error: "text required" }, 400);
      if (text.length > 4096) return json({ error: "text too long" }, 400);
      if (!(await authorizeRestaurant(supaAdmin, user.id, restaurant_id))) return json({ error: "Forbidden" }, 403);

      let instQ = supaAdmin.from("evolution_instances").select("*").eq("restaurant_id", restaurant_id);
      if (instance_id) instQ = instQ.eq("id", instance_id);
      const { data: insts } = await instQ;
      const inst = (insts ?? [])
        .filter((i: any) => i.status === "connected")
        .sort((a: any, b: any) => Number(b.is_default) - Number(a.is_default))[0];
      if (!inst) return json({ error: "Nenhuma instância conectada disponível" }, 400);

      const cfg = await loadConfig(supaAdmin, inst.reseller_id);
      if (!cfg) return json({ error: "Servidor Evolution não configurado" }, 400);

      let contactId: string | null = null;
      const { data: existingContact } = await supaAdmin
        .from("wa_contacts")
        .select("id, name")
        .eq("restaurant_id", restaurant_id)
        .eq("phone_e164", phone)
        .maybeSingle();
      if (existingContact) {
        contactId = existingContact.id;
        if (name && !existingContact.name) await supaAdmin.from("wa_contacts").update({ name }).eq("id", contactId);
      } else {
        let linkedCustomerPhone: string | null = null;
        try {
          const { data: matchOrder } = await supaAdmin
            .from("orders")
            .select("customer_phone")
            .eq("restaurant_id", restaurant_id)
            .filter("customer_phone", "ilike", `%${phone.slice(-10)}%`)
            .limit(1)
            .maybeSingle();
          if (matchOrder?.customer_phone) linkedCustomerPhone = matchOrder.customer_phone;
        } catch (_) {}
        const { data: newContact, error: cErr } = await supaAdmin
          .from("wa_contacts")
          .insert({ restaurant_id, phone_e164: phone, name: name || null, linked_customer_phone: linkedCustomerPhone })
          .select("id")
          .single();
        if (cErr || !newContact) return json({ error: cErr?.message || "Falha ao criar contato" }, 500);
        contactId = newContact.id;
      }

      let conversationId: string | null = null;
      const { data: existingConv } = await supaAdmin
        .from("wa_conversations")
        .select("id")
        .eq("restaurant_id", restaurant_id)
        .eq("contact_id", contactId)
        .eq("instance_id", inst.id)
        .maybeSingle();
      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convErr } = await supaAdmin
          .from("wa_conversations")
          .insert({ restaurant_id, contact_id: contactId, instance_id: inst.id, status: "open" })
          .select("id")
          .single();
        if (convErr || !newConv) return json({ error: convErr?.message || "Falha ao criar conversa" }, 500);
        conversationId = newConv.id;
      }

      const resp = await sendByType(cfg.url, cfg.globalKey || inst.instance_token, inst.instance_name, "text", phone, { text });
      if (!resp.ok) return json({ error: evoError(resp, "Falha ao enviar a primeira mensagem."), response: resp.body }, 400);
      const waId = resp.body?.key?.id ?? resp.body?.messageId ?? null;
      await supaAdmin.from("wa_messages").insert({
        restaurant_id,
        conversation_id: conversationId,
        wa_message_id: waId,
        direction: "out",
        from_me: true,
        content_type: "text",
        text,
        status: "sent",
        sender_user_id: user.id,
        sent_at: new Date().toISOString(),
      });
      return json({ ok: true, conversation_id: conversationId, contact_id: contactId });
    }

    const conversation_id: string | undefined = payload?.conversation_id;
    if (!conversation_id) return json({ error: "conversation_id required" }, 400);

    const { data: conv } = await supaAdmin
      .from("wa_conversations")
      .select("id, restaurant_id, contact_id, instance_id")
      .eq("id", conversation_id)
      .maybeSingle();
    if (!conv) return json({ error: "Conversa não encontrada" }, 404);
    if (!(await authorizeRestaurant(supaAdmin, user.id, conv.restaurant_id))) return json({ error: "Forbidden" }, 403);

    const { data: inst } = await supaAdmin.from("evolution_instances").select("*").eq("id", conv.instance_id).maybeSingle();
    if (!inst) return json({ error: "Instância não encontrada" }, 404);
    if (inst.status !== "connected") return json({ error: "Instância desconectada" }, 400);

    const { data: contact } = await supaAdmin.from("wa_contacts").select("phone_e164").eq("id", conv.contact_id).maybeSingle();
    if (!contact?.phone_e164) return json({ error: "Contato sem telefone" }, 400);

    const cfg = await loadConfig(supaAdmin, inst.reseller_id);
    if (!cfg) return json({ error: "Servidor Evolution não configurado" }, 400);
    const apiKey = cfg.globalKey || inst.instance_token;
    const number = digitsOnly(contact.phone_e164);

    if (action === "send_text") {
      const text: string = (payload?.text ?? "").toString().trim();
      if (!text) return json({ error: "text required" }, 400);
      if (text.length > 4096) return json({ error: "text too long" }, 400);
      const resp = await sendByType(cfg.url, apiKey, inst.instance_name, "text", number, { text });
      if (!resp.ok) return json({ error: evoError(resp, "Falha ao enviar a mensagem."), response: resp.body }, 400);
      const waId = resp.body?.key?.id ?? resp.body?.messageId ?? null;
      const { data: inserted } = await supaAdmin.from("wa_messages").insert({
        restaurant_id: conv.restaurant_id,
        conversation_id: conv.id,
        wa_message_id: waId,
        direction: "out",
        from_me: true,
        content_type: "text",
        text,
        status: "sent",
        sender_user_id: user.id,
        sent_at: new Date().toISOString(),
      }).select("id").single();
      return json({ ok: true, id: inserted?.id });
    }

    if (action === "send_media") {
      const media_path: string = payload?.media_path;
      const mime: string = payload?.mime || "application/octet-stream";
      const filename: string = payload?.filename || "file";
      const caption: string | undefined = payload?.caption?.toString();
      const kind: string = payload?.kind || (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "document");
      if (!media_path) return json({ error: "media_path required" }, 400);
      const { data: signed, error: signErr } = await supaAdmin.storage
        .from("wa-media")
        .createSignedUrl(media_path, 60 * 60 * 24 * 7); // 7d — Meta fetches immediately
      if (signErr || !signed?.signedUrl) return json({ error: "failed to sign media" }, 500);
      const mediaUrl = signed.signedUrl;
      const resp = await sendByType(cfg.url, apiKey, inst.instance_name, kind === "audio" ? "audio" : "media", number, {
        type: kind,
        url: mediaUrl,
        caption,
        fileName: filename,
        mimetype: mime,
      });
      if (!resp.ok) return json({ error: evoError(resp, "Falha ao enviar a mídia."), response: resp.body }, 400);
      const waId = resp.body?.key?.id ?? resp.body?.messageId ?? null;
      const { data: inserted } = await supaAdmin.from("wa_messages").insert({
        restaurant_id: conv.restaurant_id,
        conversation_id: conv.id,
        wa_message_id: waId,
        direction: "out",
        from_me: true,
        content_type: kind,
        text: caption ?? null,
        media_url: mediaUrl,
        media_mime: mime,
        media_filename: filename,
        status: "sent",
        sender_user_id: user.id,
        sent_at: new Date().toISOString(),
      }).select("id").single();
      return json({ ok: true, id: inserted?.id });
    }

    if (action === "send_reaction") {
      const message_id: string = payload?.message_id;
      const emoji: string = (payload?.emoji ?? "").toString();
      if (!message_id) return json({ error: "message_id required" }, 400);
      const { data: msg } = await supaAdmin
        .from("wa_messages")
        .select("wa_message_id, from_me")
        .eq("id", message_id)
        .eq("restaurant_id", conv.restaurant_id)
        .maybeSingle();
      if (!msg?.wa_message_id) return json({ error: "Mensagem sem id externo" }, 400);
      const resp = await sendByType(cfg.url, apiKey, inst.instance_name, "reaction", number, {
        key: { remoteJid: `${number}@s.whatsapp.net`, fromMe: msg.from_me, id: msg.wa_message_id },
        reaction: emoji,
      });
      if (!resp.ok) return json({ error: resp.body?.message || resp.body?.error || "Falha na reação", response: resp.body }, 400);
      return json({ ok: true });
    }

    if (action === "set_presence") {
      const presence: string = payload?.presence || "composing";
      const resp = await sendByType(cfg.url, apiKey, inst.instance_name, "presence", number, { presence });
      return json({ ok: resp.ok });
    }

    if (action === "mark_read") {
      await supaAdmin.from("wa_conversations").update({ unread_count: 0 }).eq("id", conv.id);
      return json({ ok: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("[evolution-send] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
