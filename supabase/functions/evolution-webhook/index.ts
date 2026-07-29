import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logWebhookEvent } from "../_shared/evolutionTelemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function triggerBotAfterDebounce(conversationId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return;

  const task = (async () => {
    await sleep(4500);
    const res = await fetch(`${supabaseUrl}/functions/v1/bot-debounce-tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRole}`,
      },
      body: JSON.stringify({ source: "evolution-webhook", conversation_id: conversationId }),
    });
    if (!res.ok) {
      console.error("[evolution-webhook] deferred bot trigger failed", res.status, (await res.text()).slice(0, 500));
    }
  })().catch((err) => console.error("[evolution-webhook] deferred bot trigger error", err));

  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
}

function normalizeEvent(name: string | undefined): string {
  return (name || "").trim();
}

function canonicalEvent(name: string | undefined): string {
  return normalizeEvent(name).replace(/[.\-\s]+/g, "_").toUpperCase();
}

function normalizeQrString(value: any): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length <= 20) return null;

  const pipeIndex = raw.indexOf("|");
  if (pipeIndex >= 0) {
    const afterPipe = raw.slice(pipeIndex + 1).trim();
    if (afterPipe.length > 20) return afterPipe;
    const beforePipe = raw.slice(0, pipeIndex).trim();
    if (beforePipe.length > 20) return beforePipe;
  }

  return raw;
}

function extractQr(obj: any): string | null {
  if (!obj) return null;
  const normalized = normalizeQrString(obj);
  if (normalized) return normalized;
  if (typeof obj !== "object") return null;

  const candidates = [
    obj.QRCode,
    obj.qrcode,
    obj.qr,
    obj.Qr,
    obj.code,
    obj.Code,
    obj.base64,
    obj.Base64,
    obj.qr_code,
    obj?.qrcode?.base64,
    obj?.qrcode?.code,
    obj?.QRCode?.Base64,
    obj?.QRCode?.Code,
    obj?.data?.qrcode,
    obj?.data?.base64,
    obj?.data?.code,
  ];
  for (const c of candidates) {
    const found = extractQr(c);
    if (found) return found;
  }
  return null;
}

function digitsOnly(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d || null;
}

function jidToPhone(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const raw = String(jid);
  if (raw.includes("@lid") || raw.includes("@g.us")) return null;
  return digitsOnly(raw.split("@")[0].split(":")[0]);
}

function normalizePhoneJid(value: any): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.includes("@lid") || raw.includes("@g.us")) return null;
  if (raw.includes("@s.whatsapp.net")) return raw;
  const phone = digitsOnly(raw);
  if (phone && phone.length >= 10 && phone.length <= 15) return `${phone}@s.whatsapp.net`;
  return null;
}

function normalizeLidJid(value: any): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  return raw.includes("@lid") ? raw : null;
}

function extractText(msg: any): string | null {
  if (!msg) return null;
  return (
    msg?.conversation ??
    msg?.extendedTextMessage?.text ??
    msg?.imageMessage?.caption ??
    msg?.videoMessage?.caption ??
    msg?.documentMessage?.caption ??
    msg?.buttonsResponseMessage?.selectedDisplayText ??
    msg?.listResponseMessage?.title ??
    null
  );
}

function detectContentType(msg: any): string {
  if (!msg) return "text";
  if (msg.imageMessage) return "image";
  if (msg.audioMessage) return "audio";
  if (msg.videoMessage) return "video";
  if (msg.documentMessage) return "document";
  if (msg.stickerMessage) return "sticker";
  if (msg.locationMessage) return "location";
  if (msg.contactMessage || msg.contactsArrayMessage) return "contact";
  return "text";
}

function extractMedia(msg: any): { mime: string | null; filename: string | null; url: string | null } {
  const candidate = msg?.imageMessage || msg?.audioMessage || msg?.videoMessage || msg?.documentMessage || msg?.stickerMessage || null;
  if (!candidate) return { mime: null, filename: null, url: null };
  return {
    mime: candidate.mimetype ?? candidate.Mimetype ?? null,
    filename: candidate.fileName ?? candidate.FileName ?? null,
    url: candidate.url ?? candidate.URL ?? null,
  };
}

function normalizeDbStatus(status: any, fromMe: boolean): string {
  if (typeof status === "number") {
    if (status <= 0) return "pending";
    if (status === 1) return "sent";
    if (status === 2) return "delivered";
    if (status >= 3) return "read";
  }
  const s = String(status || "").toLowerCase();
  // Evolution v2 devolve "PENDING" quando apenas aceitou a mensagem na fila.
  // Não marcar como enviada até chegar SEND_MESSAGE/MESSAGES_UPDATE com ACK real.
  if (["pending", "pending_ack", "0"].includes(s) && fromMe) return "pending";
  if (["error", "failed", "send_error", "message_error", "rejected", "nack"].includes(s)) return "failed";
  if (["pending", "sent", "delivered", "read", "failed"].includes(s)) return s;
  if (["server_ack", "1"].includes(s)) return "sent";
  if (["delivery_ack", "played", "2"].includes(s)) return "delivered";
  if (["read_ack", "3", "4"].includes(s)) return "read";
  return fromMe ? "sent" : "delivered";
}

function extractStatusCandidate(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const stubValues = [
    ...(Array.isArray(obj?.messageStubParameters) ? obj.messageStubParameters : []),
    ...(Array.isArray(obj?.update?.messageStubParameters) ? obj.update.messageStubParameters : []),
    ...(Array.isArray(obj?.messageUpdate?.messageStubParameters) ? obj.messageUpdate.messageStubParameters : []),
  ].map((value) => String(value));
  // WhatsApp/Baileys NACK 463: a Evolution aceita com PENDING, mas o WhatsApp
  // rejeita a entrega logo depois. Não pode ficar como mensagem enviada.
  if (stubValues.includes("463")) return "failed";
  return obj?.status ??
    obj?.Status ??
    obj?.update?.status ??
    obj?.update?.Status ??
    obj?.messageUpdate?.status ??
    obj?.messageUpdate?.Status ??
    obj?.message?.status ??
    obj?.message?.Status ??
    obj?.data?.status ??
    obj?.data?.Status ??
    null;
}


function safeIsoFromEvolutionTs(ts: unknown): string {
  const fallback = new Date().toISOString();
  if (ts == null) return fallback;
  if (ts instanceof Date) return isNaN(ts.getTime()) ? fallback : ts.toISOString();
  if (typeof ts === "string") {
    const trimmed = ts.trim();
    if (!trimmed) return fallback;
    // ISO string
    if (/[^\d.]/.test(trimmed)) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d.toISOString();
      return fallback;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) {
      const ms = n < 1e12 ? n * 1000 : n;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? fallback : d.toISOString();
    }
    return fallback;
  }
  if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
    const ms = ts < 1e12 ? ts * 1000 : ts;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? fallback : d.toISOString();
  }
  return fallback;
}

type ParsedMessage = {
  remoteJid: string;
  lidJid?: string;
  fromMe: boolean;
  waMsgId: string | null;
  pushName: string | null;
  sentAt: string;
  text: string | null;
  contentType: string;
  media: { mime: string | null; filename: string | null; url: string | null };
  status: string;
};

function parseV2Message(m: any): ParsedMessage | null {
  if (Array.isArray(m)) return null;
  const original = m;
  m = m?.message ?? m?.data ?? m;
  if (!m?.key?.id && !m?.key?.remoteJid) return null;
  const jidCandidates = [
    m.key.remoteJid,
    m.key.remoteJidAlt,
    m.key.senderPn,
    m.key.participantPn,
    m.key.senderLid,
    m.key.participantLid,
    m.key.previousRemoteJid,
  ].filter((j: any) => typeof j === "string" && j.length > 0) as string[];
  const rawRemoteJid = String(jidCandidates[0] ?? "__status_update__");
  const fromMe = m.key.fromMe === true;
  // WhatsApp pode mandar eventos com LID. O Evolution/Baileys ainda é instável
  // enviando para @lid, então guardamos o LID só como chave alternativa e
  // normalizamos o contato para o telefone quando senderPn/participantPn existir.
  const lidJid = normalizeLidJid(rawRemoteJid) ?? jidCandidates.map(normalizeLidJid).find(Boolean) ?? undefined;
  const phoneJid = normalizePhoneJid(rawRemoteJid) ?? jidCandidates.map(normalizePhoneJid).find(Boolean) ?? undefined;
  const remoteJid = phoneJid || rawRemoteJid;
  return {
    remoteJid,
    lidJid,
    fromMe,
    waMsgId: m.key.id ?? null,
    pushName: m.pushName ?? null,
    sentAt: safeIsoFromEvolutionTs(m.messageTimestamp),
    text: extractText(m.message),
    contentType: detectContentType(m.message),
    media: extractMedia(m.message),
    status: normalizeDbStatus(extractStatusCandidate(original) ?? extractStatusCandidate(m), fromMe),
  };
}

function parseGoMessage(event: string, data: any): ParsedMessage | null {
  const info = data.Info || data.info || {};
  const message = data.Message || data.message || {};
  const sender: string = info.Sender || info.sender || info.RemoteJid || "";
  const rawRemoteJid: string = info.Chat || info.RemoteJid || sender || "";
  const fromMe: boolean = !!(info.IsFromMe ?? info.isFromMe ?? event === "SendMessage");
  const altJidCandidates = fromMe
    ? [info.RecipientAlt, info.RecipientPn, info.ChatAlt, info.recipientAlt, info.recipientPn, info.chatAlt]
    : [info.SenderAlt, info.SenderPn, info.senderAlt, info.senderPn];
  const altPhoneJid = normalizePhoneJid(rawRemoteJid) ?? altJidCandidates.map(normalizePhoneJid).find(Boolean) ?? undefined;
  const remoteJid = altPhoneJid || rawRemoteJid;
  if (!remoteJid) return null;
  const lidJid = normalizeLidJid(rawRemoteJid) ?? altJidCandidates.map(normalizeLidJid).find(Boolean) ?? undefined;

  const timestamp = info.Timestamp || info.timestamp || info.MessageTimestamp || null;
  const sentAt = safeIsoFromEvolutionTs(timestamp);

  return {
    remoteJid,
    lidJid,
    fromMe,
    waMsgId: info.ID || info.id || null,
    pushName: info.PushName || info.pushName || null,
    sentAt,
    text: extractText(message),
    contentType: detectContentType(message),
    media: extractMedia(message),
    status: normalizeDbStatus(info.Status || info.status, fromMe),
  };
}

async function processMessage(supa: any, instance: any, msg: ParsedMessage) {
  if (String(msg.remoteJid).endsWith("@g.us")) return;
  let phone = jidToPhone(msg.remoteJid);
  const lidJid = msg.lidJid ?? (String(msg.remoteJid).includes("@lid") ? String(msg.remoteJid) : null);

  if (msg.fromMe && msg.waMsgId) {
    const { data: outbound } = await supa
      .from("wa_messages")
      .select("id, status")
      .eq("wa_message_id", msg.waMsgId)
      .eq("restaurant_id", instance.restaurant_id)
      .maybeSingle();
    if (outbound) {
      const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
      const cur = rank[String(outbound.status ?? "")] ?? 0;
      const next = rank[msg.status] ?? 0;
      if (msg.status === "failed" || next > cur) {
        await supa.from("wa_messages").update({ status: msg.status }).eq("id", outbound.id);
      }
      return;
    }

    console.warn("[evolution-webhook] Ignorando eco outbound sem mensagem local correspondente", JSON.stringify({ waMsgId: msg.waMsgId, status: msg.status, remoteJid: msg.remoteJid }).slice(0, 500));
    return;
  }

  if (!phone && !lidJid) {
    if (msg.waMsgId) {
      const { data: byId } = await supa
        .from("wa_messages")
        .select("id, status")
        .eq("wa_message_id", msg.waMsgId)
        .eq("restaurant_id", instance.restaurant_id)
        .maybeSingle();
      if (byId) {
        const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
        const cur = rank[String(byId.status ?? "")] ?? 0;
        const next = rank[msg.status] ?? 0;
        if (msg.status === "failed" || next > cur) {
          await supa.from("wa_messages").update({ status: msg.status }).eq("id", byId.id);
        }
      }
    }
    return;
  }

  // Auto-heal: se mensagens estão chegando, a instância está de fato conectada.
  if (instance.status !== "connected") {
    await supa.from("evolution_instances").update({
      status: "connected",
      last_connected_at: new Date().toISOString(),
      qr_code: null,
      qr_expires_at: null,
    }).eq("id", instance.id);
    instance.status = "connected";
  }

  if (msg.waMsgId) {
    const { data: existing } = await supa
      .from("wa_messages")
      .select("id, status")
      .eq("wa_message_id", msg.waMsgId)
      .eq("restaurant_id", instance.restaurant_id)
      .maybeSingle();
    if (existing) {
      // Nunca rebaixar o status (ex.: "sent" -> "pending" no eco do Evolution)
      const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
      const cur = rank[String(existing.status ?? "")] ?? 0;
      const next = rank[msg.status] ?? 0;
      if (msg.status === "failed" || next > cur) {
        await supa.from("wa_messages").update({ status: msg.status }).eq("id", existing.id);
      }
      return;
    }
  }

  let existingContact: any = null;
  if (lidJid) {
    const { data } = await supa
      .from("wa_contacts")
      .select("id, name, phone_e164, wa_lid")
      .eq("restaurant_id", instance.restaurant_id)
      .eq("wa_lid", lidJid)
      .maybeSingle();
    existingContact = data ?? null;
  }
  if (!existingContact && phone) {
    const { data } = await supa
      .from("wa_contacts")
      .select("id, name, phone_e164, wa_lid")
      .eq("restaurant_id", instance.restaurant_id)
      .eq("phone_e164", phone)
      .maybeSingle();
    existingContact = data ?? null;
  }
  if (existingContact?.phone_e164 && lidJid && String(msg.remoteJid).includes("@lid")) {
    phone = existingContact.phone_e164;
  }
  if (!phone) return;

  let contactId = existingContact?.id;
  if (!contactId) {
    let linkedCustomerPhone: string | null = null;
    try {
      const { data: matchOrder } = await supa
        .from("orders")
        .select("customer_phone")
        .eq("restaurant_id", instance.restaurant_id)
        .filter("customer_phone", "ilike", `%${phone.slice(-10)}%`)
        .limit(1)
        .maybeSingle();
      if (matchOrder?.customer_phone) linkedCustomerPhone = matchOrder.customer_phone;
    } catch (_) {}
    const { data: ins, error: ie } = await supa
        .from("wa_contacts")
        .insert({ restaurant_id: instance.restaurant_id, phone_e164: phone, name: msg.pushName, linked_customer_phone: linkedCustomerPhone, wa_lid: lidJid ?? null })
      .select("id")
      .single();
    if (ie) {
      console.error("[webhook] contact insert", ie);
      return;
    }
    contactId = ins.id;
  } else {
    const patch: Record<string, unknown> = {};
    if (msg.pushName && !existingContact?.name) patch.name = msg.pushName;
    if (lidJid && existingContact?.wa_lid !== lidJid) patch.wa_lid = lidJid;
    if (!String(msg.remoteJid).includes("@lid") && phone && existingContact?.phone_e164 !== phone) patch.phone_e164 = phone;
    if (Object.keys(patch).length > 0) {
      await supa.from("wa_contacts").update(patch).eq("id", contactId);
    }
  }

  const { data: existingConv } = await supa
    .from("wa_conversations")
    .select("id")
    .eq("restaurant_id", instance.restaurant_id)
    .eq("contact_id", contactId)
    .eq("instance_id", instance.id)
    .maybeSingle();

  let convId = existingConv?.id;
  if (!convId) {
    const { data: convIns, error: ce } = await supa
      .from("wa_conversations")
      .insert({ restaurant_id: instance.restaurant_id, contact_id: contactId, instance_id: instance.id, status: "open" })
      .select("id")
      .single();
    if (ce) {
      console.error("[webhook] conv insert", ce);
      return;
    }
    convId = convIns.id;
  }

  // Dedupe de eco outbound sem ID (evita mensagens do agente duplicadas no chat)
  if (msg.fromMe) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let q = supa
      .from("wa_messages")
      .select("id, wa_message_id, status")
      .eq("conversation_id", convId)
      .eq("direction", "out")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    q = msg.text ? q.eq("text", msg.text) : q;
    const { data: localOut } = await q.maybeSingle();
    if (localOut) {
      const patch: Record<string, unknown> = {};
      if (!localOut.wa_message_id && msg.waMsgId) patch.wa_message_id = msg.waMsgId;
      const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
      if (msg.status === "failed" || (rank[msg.status] ?? 0) > (rank[String(localOut.status ?? "")] ?? 0)) {
        patch.status = msg.status;
      }
      if (Object.keys(patch).length > 0) {
        await supa.from("wa_messages").update(patch).eq("id", localOut.id);
      }
      return;
    }
  }

  await supa.from("wa_messages").insert({
    restaurant_id: instance.restaurant_id,
    conversation_id: convId,
    wa_message_id: msg.waMsgId,
    direction: msg.fromMe ? "out" : "in",
    from_me: msg.fromMe,
    content_type: msg.contentType,
    text: msg.text,
    media_mime: msg.media.mime,
    media_filename: msg.media.filename,
    media_url: msg.media.url,
    status: msg.status,
    sent_at: msg.sentAt,
  });

  if (!msg.fromMe) {
    const { data: convRow } = await supa
      .from("wa_conversations")
      .select("ai_enabled, assigned_user_id")
      .eq("id", convId)
      .maybeSingle();
    if (convRow?.ai_enabled && !convRow.assigned_user_id) {
      const { error: debounceError } = await supa.from("bot_debounce").upsert(
        { conversation_id: convId, restaurant_id: instance.restaurant_id, fire_at: new Date(Date.now() + 4000).toISOString() },
        { onConflict: "conversation_id" },
      );
      if (debounceError) {
        console.error("[evolution-webhook] bot debounce upsert", debounceError);
      } else {
        triggerBotAfterDebounce(convId);
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return json({ error: "missing token" }, 401);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: instance } = await supa
      .from("evolution_instances")
      .select("id, restaurant_id, instance_name, status, phone_number")
      .eq("webhook_token", token)
      .maybeSingle();

    if (!instance) return json({ error: "invalid token" }, 401);

    const payload = await req.json().catch(() => ({}));
    const event = normalizeEvent(payload?.event || payload?.Event || payload?.type || payload?.Type);
    const data = payload?.data ?? payload?.Data ?? payload;
    const eventKey = canonicalEvent(event);

    await logWebhookEvent(supa, {
      restaurant_id: instance.restaurant_id,
      instance_id: instance.id,
      instance_name: instance.instance_name,
      event: event || "unknown",
      status: "received",
      payload_summary: {
        keys: Object.keys(payload ?? {}).slice(0, 12),
        state: data?.state ?? data?.connection ?? null,
      },
    });

    if (eventKey === "CONNECTION_UPDATE" || ["Connected", "PairSuccess", "Disconnected", "LoggedOut"].includes(event)) {
      const rawState = ["Connected", "PairSuccess"].includes(event)
        ? "open"
        : ["Disconnected", "LoggedOut"].includes(event)
          ? "close"
          : (data?.state || data?.connection || payload?.state);
      const state = rawState === "open" ? "open" : rawState === "connecting" ? "connecting" : "close";
      const phone =
        jidToPhone(data?.wuid) ??
        jidToPhone(data?.instance?.wuid) ??
        jidToPhone(data?.owner) ??
        jidToPhone(data?.JID || data?.jid || data?.number) ??
        instance.phone_number;

      const status = state === "open" ? "connected" : state === "connecting" ? "waiting_qr" : "disconnected";
      await supa.from("evolution_instances").update({
        status,
        phone_number: status === "connected" ? phone : (status === "disconnected" ? null : instance.phone_number),
        ...(status === "connected" ? { last_connected_at: new Date().toISOString(), qr_code: null, qr_expires_at: null } : {}),
        ...(status === "disconnected" ? { qr_code: null, qr_expires_at: null } : {}),
      }).eq("id", instance.id);

      return json({ ok: true });
    }

    if (eventKey === "QRCODE_UPDATED" || ["QRCode", "QR", "QRCodeUpdated"].includes(event)) {
      const qr = extractQr(data) || extractQr(payload);
      if (qr) {
        await supa.from("evolution_instances").update({
          status: "waiting_qr",
          qr_code: qr,
          qr_expires_at: new Date(Date.now() + 660 * 1000).toISOString(),
        }).eq("id", instance.id);
      } else {
        console.warn("[evolution-webhook] QR event sem QR extraível", JSON.stringify(payload).slice(0, 1200));
      }
      return json({ ok: true });
    }

    if (["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE"].includes(eventKey)) {
      const messages = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : [data]);
      for (const raw of messages) {
        const parsed = parseV2Message(raw);
        if (parsed) await processMessage(supa, instance, parsed);
      }
      return json({ ok: true, processed: messages.length });
    }

    if (["Message", "SendMessage"].includes(event)) {
      const parsed = parseGoMessage(event, data);
      if (parsed) await processMessage(supa, instance, parsed);
      return json({ ok: true, processed: parsed ? 1 : 0 });
    }

    return json({ ok: true, ignored: event });
  } catch (err) {
    console.error("[evolution-webhook] error:", err);
    return json({ ok: true });
  }
});
