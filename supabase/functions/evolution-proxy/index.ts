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

interface EvoCfg {
  url: string;
  apiKey: string;
}

type EvoFetchResult = {
  ok: boolean;
  status: number;
  body: any;
  message?: string;
  isJson?: boolean;
};

function evoErrorMessage(result: EvoFetchResult | null, fallbackStatus = 0): string {
  const status = result?.status ?? fallbackStatus;
  const body = result?.body;
  const rawMessage = result?.message ?? body?.message ?? body?.error;
  const message = Array.isArray(rawMessage) ? rawMessage.join(" ") : rawMessage ? String(rawMessage) : "";
  return message || `Falha ao criar instância (status ${status})`;
}

function normalizeUrl(u: string): string {
  let s = u.trim().replace(/\/+$/, "");
  // Strip common panel/admin suffixes that users paste by mistake.
  s = s.replace(/\/(manager|admin|dashboard|api)(\/.*)?$/i, "");
  return s.replace(/\/+$/, "");
}

function maskKey(k?: string | null): string {
  if (!k) return "(empty)";
  return k.length <= 8 ? "***" : `${k.slice(0, 5)}***${k.slice(-3)}`;
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
    obj.qrcode,
    obj.qr,
    obj.base64,
    obj.code,
    obj.QRCode,
    obj.qr_code,
    obj?.qrcode?.base64,
    obj?.qrcode?.code,
    obj?.QRCode?.Base64,
    obj?.QRCode?.Code,
    obj?.data?.qrcode,
    obj?.data?.qr,
    obj?.data?.base64,
    obj?.data?.QRCode,
    obj?.data?.code,
    obj?.data?.qrcode?.base64,
    obj?.data?.qrcode?.code,
    obj?.instance?.qrcode,
    obj?.instance?.qr,
  ];

  for (const c of candidates) {
    const found = extractQr(c);
    if (found) return found;
  }
  return null;
}

async function evoFetch(
  cfg: EvoCfg,
  path: string,
  init: RequestInit = {},
  instanceToken?: string | null,
): Promise<EvoFetchResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: instanceToken || cfg.apiKey,
    ...((init.headers as Record<string, string>) ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, { ...init, headers });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      message: `Falha ao conectar em ${cfg.url}: ${(err as Error).message}`,
    };
  }

  const text = await res.text();
  let body: any;
  let isJson = false;
  try {
    body = text ? JSON.parse(text) : null;
    isJson = true;
  } catch {
    body = text;
  }

  let message: string | undefined;
  if (!res.ok) {
    if (!isJson && typeof body === "string") {
      message = `Servidor respondeu ${res.status}: ${body.slice(0, 200)}`;
    } else if (isJson && body?.message) {
      message = String(body.message);
    } else if (isJson && body?.error) {
      message = String(body.error);
    } else {
      message = `HTTP ${res.status}`;
    }
  }

  return { ok: res.ok, status: res.status, body, message, isJson };
}

async function configureWebhook(
  cfg: EvoCfg,
  instanceUuid: string,
  instanceToken: string | null | undefined,
  webhookUrl: string,
  instanceName?: string | null,
): Promise<{ ok: boolean; error?: string; status?: number; response?: any }> {
  if (!instanceToken) {
    return { ok: false, error: "Token da instância ausente. Recrie ou sincronize a instância." };
  }

  console.log(`[configureWebhook] uuid=${instanceUuid} name=${instanceName ?? "?"} apikey=${maskKey(instanceToken)}`);

  const events = [
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "SEND_MESSAGE",
    "CONNECTION_UPDATE",
    "QRCODE_UPDATED",
  ];

  const goEvents = ["Message", "SendMessage", "Connected", "Disconnected", "QR", "PairSuccess", "LoggedOut"];

  const attempts: Array<{ label: string; path: string; init: RequestInit }> = [];

  // Evolution API v2.2+ — POST /webhook/set/{instanceName} com payload aninhado
  if (instanceName) {
    attempts.push({
      label: "v2-name-nested",
      path: `/webhook/set/${encodeURIComponent(instanceName)}`,
      init: {
        method: "POST",
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events,
          },
        }),
      },
    });
    // Evolution API v2.0/2.1 — payload plano
    attempts.push({
      label: "v2-name",
      path: `/webhook/set/${encodeURIComponent(instanceName)}`,
      init: {
        method: "POST",
        body: JSON.stringify({
          url: webhookUrl,
          enabled: true,
          webhookByEvents: false,
          webhookBase64: false,
          events,
        }),
      },
    });
  }


  // Evolution Go — POST /webhook/set with header instanceId
  attempts.push({
    label: "go-uuid",
    path: "/webhook/set",
    init: {
      method: "POST",
      headers: { instanceId: instanceUuid },
      body: JSON.stringify({ url: webhookUrl, enabled: true, subscribe: goEvents, events: goEvents }),
    },
  });

  // Legacy fallback — POST /instance/connect with webhookUrl
  attempts.push({
    label: "legacy-connect",
    path: "/instance/connect",
    init: {
      method: "POST",
      headers: { instanceId: instanceUuid },
      body: JSON.stringify({ webhookUrl, subscribe: ["ALL"], immediate: false }),
    },
  });

  let last: EvoFetchResult | null = null;
  for (const a of attempts) {
    const res = await evoFetch(cfg, a.path, a.init, instanceToken);
    console.log(`[configureWebhook] attempt=${a.label} path=${a.path} status=${res.status} ok=${res.ok}`);
    if (res.ok) return { ok: true, status: res.status, response: res.body };
    last = res;
  }

  return {
    ok: false,
    status: last?.status,
    error: last?.message || `Falha ao configurar webhook (status ${last?.status}).`,
    response: last?.body,
  };
}

function parseInstanceFromList(item: any) {
  const name: string = item?.name || item?.instanceName || item?.instance?.instanceName || "";
  const uuid: string | null = item?.id ?? item?.instanceId ?? item?.uuid ?? item?.instance?.id ?? null;
  const token: string | null = item?.token ?? item?.apikey ?? item?.hash?.apikey ?? item?.instance?.token ?? null;
  const jid: string | null = item?.jid ?? item?.owner ?? item?.ownerJid ?? item?.wuid ?? null;
  const phoneRaw = jid ? String(jid).split("@")[0].split(":")[0] : (item?.number ?? item?.phoneNumber ?? null);
  const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, "") : null;
  const qrcode = extractQr(item?.qrcode ?? item?.qr ?? item);
  const connected =
    item?.connected === true ||
    item?.connectionStatus === "open" ||
    item?.state === "open" ||
    item?.status === "open" ||
    item?.instance?.state === "open";
  const status = connected ? "connected" : (qrcode ? "waiting_qr" : "disconnected");
  return { name, uuid, token, phone, qrcode, connected, status };
}

function extractInstanceList(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.instances)) return body.instances;
  return [];
}

function safeInstanceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
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
    const { action, restaurant_id, instance_id, instance_name } = payload as {
      action: string;
      restaurant_id?: string;
      instance_id?: string;
      instance_name?: string;
    };
    if (!action) return json({ error: "action required" }, 400);

    const { data: callerReseller } = await supaAdmin
      .from("resellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    async function assertAccessTo(rid: string): Promise<string> {
      const { data: r } = await supaAdmin
        .from("restaurants")
        .select("id, reseller_id")
        .eq("id", rid)
        .maybeSingle();
      if (!r?.reseller_id) throw new Error("forbidden");
      if (callerReseller && r.reseller_id === callerReseller.id) return r.reseller_id;
      const { data: a } = await supaAdmin
        .from("restaurant_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("restaurant_id", rid)
        .maybeSingle();
      if (!a) throw new Error("forbidden");
      return r.reseller_id;
    }

    async function getCfgForReseller(resellerId: string): Promise<EvoCfg> {
      const { data } = await supaAdmin
        .from("reseller_evolution_config")
        .select("server_url, global_api_key")
        .eq("reseller_id", resellerId)
        .maybeSingle();
      if (!data?.server_url || !data?.global_api_key) {
        throw new Error("Configure o servidor Evolution antes de gerenciar instâncias");
      }
      return { url: normalizeUrl(data.server_url), apiKey: data.global_api_key };
    }

    async function getRestaurantLimit(rid: string): Promise<number> {
      const { data: r } = await supaAdmin
        .from("restaurants")
        .select("plan_id")
        .eq("id", rid)
        .maybeSingle();
      if (!r?.plan_id) return 1;
      const { data: plan } = await supaAdmin
        .from("subscription_plans")
        .select("wa_instances_limit")
        .eq("id", r.plan_id)
        .maybeSingle();
      return plan?.wa_instances_limit || 1;
    }

    if (action === "list_instances") {
      if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);
      await assertAccessTo(restaurant_id);

      const { data: instances, error } = await supaAdmin
        .from("evolution_instances")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      return json({ instances, limit: await getRestaurantLimit(restaurant_id) });
    }

    if (action === "create_instance") {
      if (!restaurant_id || !instance_name) return json({ error: "restaurant_id and instance_name required" }, 400);
      const resellerId = await assertAccessTo(restaurant_id);
      const cfg = await getCfgForReseller(resellerId);

      const safeName = safeInstanceName(instance_name);
      if (!/^[a-z0-9-]{3,60}$/.test(safeName)) {
        return json({ error: "Nome inválido. Use letras, números e hífens (3 a 60 caracteres)." }, 400);
      }

      const { count } = await supaAdmin
        .from("evolution_instances")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant_id);
      const limit = await getRestaurantLimit(restaurant_id);
      if ((count ?? 0) >= limit) {
        return json({ error: `Limite de instâncias atingido (${limit}). Faça upgrade do plano.` }, 400);
      }

      const { data: dup } = await supaAdmin
        .from("evolution_instances")
        .select("id")
        .eq("restaurant_id", restaurant_id)
        .eq("instance_name", safeName)
        .maybeSingle();
      if (dup) return json({ error: "Já existe uma instância com esse nome." }, 400);

      const webhookToken = crypto.randomUUID().replace(/-/g, "");
      const generatedToken = crypto.randomUUID();

      // Try Evolution Go first ({name, token}), then Evolution API v2 ({instanceName, token, qrcode, integration}).
      const createAttempts: Array<{ label: string; body: Record<string, unknown> }> = [
        { label: "go", body: { name: safeName, token: generatedToken } },
        {
          label: "v2",
          body: {
            instanceName: safeName,
            token: generatedToken,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          },
        },
      ];

      let createRes: EvoFetchResult | null = null;
      const failedAttempts: string[] = [];
      for (const attempt of createAttempts) {
        console.log(`[create_instance] -> POST /instance/create variant=${attempt.label} name=${safeName} token=${maskKey(generatedToken)}`);
        createRes = await evoFetch(cfg, "/instance/create", {
          method: "POST",
          body: JSON.stringify(attempt.body),
        });
        console.log(`[create_instance] <- variant=${attempt.label} status=${createRes.status} ok=${createRes.ok}`);
        if (createRes.ok) break;
        failedAttempts.push(`${attempt.label}: ${evoErrorMessage(createRes, createRes.status)}`);
      }

      if (!createRes || !createRes.ok) {
        const status = createRes?.status ?? 0;
        let hint = "";
        if (status === 404) {
          hint = " Verifique se a URL do servidor Evolution está correta (sem barra final, sem /manager) e se aponta para uma instalação Evolution Go ou Evolution API v2.";
        } else if (status === 401 || status === 403) {
          hint = " Verifique a Global API Key configurada no servidor.";
        }
        return json({
          ok: false,
          error: `${evoErrorMessage(createRes, status)}${hint}`,
          response: createRes?.body,
          attempts: failedAttempts,
        });
      }

      const created = createRes.body?.data ?? createRes.body?.instance ?? createRes.body ?? {};
      const uuid =
        created?.id ??
        created?.instanceId ??
        created?.uuid ??
        created?.instance?.instanceId ??
        created?.instance?.id ??
        null;
      const instanceToken =
        created?.token ??
        created?.hash?.apikey ??
        created?.apikey ??
        created?.hash ??
        generatedToken;
      if (!uuid) {
        return json({ ok: false, error: "Servidor criou a instância mas não retornou UUID. Verifique a versão do Evolution Go/API.", response: createRes.body }, 400);
      }

      const { data: inserted, error: insertErr } = await supaAdmin
        .from("evolution_instances")
        .insert({
          restaurant_id,
          reseller_id: resellerId,
          instance_name: safeName,
          instance_uuid: uuid,
          instance_token: instanceToken,
          status: "disconnected",
          webhook_token: webhookToken,
          is_default: (count ?? 0) === 0,
        })
        .select("id, webhook_token")
        .single();
      if (insertErr) throw insertErr;

      const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?token=${inserted.webhook_token}`;
      const wh = await configureWebhook(cfg, uuid, instanceToken, webhookUrl, safeName);
      if (!wh.ok) console.warn(`[create_instance] webhook setup failed: ${wh.error}`);

      return json({
        ok: true,
        instance_id: inserted.id,
        webhook_configured: wh.ok,
        webhook_error: wh.ok ? undefined : wh.error,
      });
    }

    if (action === "connect_instance") {
      if (!instance_id) return json({ error: "instance_id required" }, 400);
      const { data: inst, error: ie } = await supaAdmin
        .from("evolution_instances")
        .select("*")
        .eq("id", instance_id)
        .maybeSingle();
      if (ie) throw ie;
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      await assertAccessTo(inst.restaurant_id);
      const cfg = await getCfgForReseller(inst.reseller_id);

      const uuid: string | null = inst.instance_uuid || null;
      const instanceToken: string | null = inst.instance_token || null;
      if (!uuid || !instanceToken) {
        return json({ error: "Instância sem UUID ou token. Recrie ou sincronize a instância." }, 400);
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?token=${inst.webhook_token}`;

      // Check current connection state (try v2 then Go)
      try {
        let info = await evoFetch(
          cfg,
          `/instance/connectionState/${encodeURIComponent(inst.instance_name)}`,
          { method: "GET" },
          instanceToken,
        );
        if (!info.ok) {
          info = await evoFetch(cfg, `/instance/${encodeURIComponent(uuid)}`, { method: "GET" }, instanceToken);
        }
        const state =
          info?.body?.instance?.state ??
          info?.body?.state ??
          info?.body?.connectionStatus ??
          info?.body?.connection ??
          info?.body?.status ??
          null;
        if (info.ok && (state === "open" || info?.body?.connected === true)) {
          await supaAdmin
            .from("evolution_instances")
            .update({ status: "connected", qr_code: null, qr_expires_at: null, last_connected_at: new Date().toISOString() })
            .eq("id", inst.id);
          return json({ ok: true, qr_code: null, connected: true, already_connected: true });
        }
      } catch (e) {
        console.warn(`[connect_instance] info check failed (continuing): ${(e as Error).message}`);
      }

      await supaAdmin
        .from("evolution_instances")
        .update({ status: "waiting_qr", qr_code: null, qr_expires_at: null })
        .eq("id", inst.id);

      // Try Evolution API v2 first: GET /instance/connect/{instanceName}
      const connectAttempts: Array<{ label: string; path: string; init: RequestInit }> = [
        {
          label: "v2-name",
          path: `/instance/connect/${encodeURIComponent(inst.instance_name)}`,
          init: { method: "GET" },
        },
        {
          label: "go-uuid",
          path: "/instance/connect",
          init: {
            method: "POST",
            headers: { instanceId: uuid },
            body: JSON.stringify({ webhookUrl, subscribe: ["ALL"], immediate: true }),
          },
        },
      ];

      let res: EvoFetchResult | null = null;
      const failed: string[] = [];
      for (const a of connectAttempts) {
        console.log(`[connect_instance] -> ${a.init.method} ${a.path} variant=${a.label}`);
        res = await evoFetch(cfg, a.path, a.init, instanceToken);
        console.log(`[connect_instance] <- variant=${a.label} status=${res.status} ok=${res.ok}`);
        if (res.ok) break;
        failed.push(`${a.label}: ${res.message || res.status}`);
      }

      if (!res || !res.ok) {
        return json({ ok: false, error: res?.message || `Erro ${res?.status ?? 0}`, response: res?.body, attempts: failed }, 400);
      }

      let qrString = extractQr(res.body);
      if (!qrString) {
        for (let i = 0; i < 4; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          let info = await evoFetch(
            cfg,
            `/instance/connectionState/${encodeURIComponent(inst.instance_name)}`,
            { method: "GET" },
            instanceToken,
          );
          if (!info.ok) {
            info = await evoFetch(cfg, `/instance/${encodeURIComponent(uuid)}`, { method: "GET" }, instanceToken);
          }
          const state =
            info?.body?.instance?.state ??
            info?.body?.state ??
            info?.body?.connectionStatus ??
            info?.body?.connection ??
            info?.body?.status ??
            null;
          if (info.ok && (state === "open" || info?.body?.connected === true)) {
            await supaAdmin
              .from("evolution_instances")
              .update({ status: "connected", qr_code: null, qr_expires_at: null, last_connected_at: new Date().toISOString() })
              .eq("id", inst.id);
            return json({ ok: true, qr_code: null, connected: true, already_connected: true });
          }
          // Also try v2 connect again to refresh QR
          const retry = await evoFetch(
            cfg,
            `/instance/connect/${encodeURIComponent(inst.instance_name)}`,
            { method: "GET" },
            instanceToken,
          );
          const found = extractQr(retry?.body) || extractQr(info?.body);
          if (found) {
            qrString = found;
            break;
          }
        }
      }

      if (qrString) {
        await supaAdmin
          .from("evolution_instances")
          .update({ status: "waiting_qr", qr_code: qrString, qr_expires_at: new Date(Date.now() + 660 * 1000).toISOString() })
          .eq("id", inst.id);
      }

      return json({ ok: true, qr_code: qrString, connected: false, response: res.body });
    }


    if (action === "disconnect_instance") {
      if (!instance_id) return json({ error: "instance_id required" }, 400);
      const { data: inst } = await supaAdmin.from("evolution_instances").select("*").eq("id", instance_id).maybeSingle();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      await assertAccessTo(inst.restaurant_id);
      const cfg = await getCfgForReseller(inst.reseller_id);

      const uuid = inst.instance_uuid;
      const instanceToken = inst.instance_token;
      if (!uuid || !instanceToken) return json({ ok: false, error: "Instância sem UUID/token. Solicite sincronização." }, 400);

      const res = await evoFetch(cfg, "/instance/disconnect", { method: "POST", headers: { instanceId: uuid } }, instanceToken);
      await supaAdmin
        .from("evolution_instances")
        .update({ status: "disconnected", qr_code: null, qr_expires_at: null })
        .eq("id", inst.id);

      if (!res.ok) return json({ ok: false, error: res.message || `Erro ${res.status} ao pausar sessão`, response: res.body }, 400);
      return json({ ok: true });
    }

    if (action === "logout_instance") {
      if (!instance_id) return json({ error: "instance_id required" }, 400);
      const { data: inst } = await supaAdmin.from("evolution_instances").select("*").eq("id", instance_id).maybeSingle();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      await assertAccessTo(inst.restaurant_id);
      const cfg = await getCfgForReseller(inst.reseller_id);

      const uuid = inst.instance_uuid;
      const instanceToken = inst.instance_token;
      if (!uuid || !instanceToken) return json({ ok: false, error: "Instância sem UUID/token. Solicite sincronização." }, 400);
      const res = await evoFetch(cfg, "/instance/logout", { method: "DELETE", headers: { instanceId: uuid } }, instanceToken);
      await supaAdmin
        .from("evolution_instances")
        .update({ status: "disconnected", phone_number: null, qr_code: null, qr_expires_at: null, last_connected_at: null })
        .eq("id", inst.id);
      if (!res.ok) return json({ ok: false, error: res.message || `Erro ${res.status} ao desvincular`, response: res.body }, 400);
      return json({ ok: true });
    }

    if (action === "delete_instance") {
      if (!instance_id) return json({ error: "instance_id required" }, 400);
      const { data: inst } = await supaAdmin.from("evolution_instances").select("*").eq("id", instance_id).maybeSingle();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      await assertAccessTo(inst.restaurant_id);
      const cfg = await getCfgForReseller(inst.reseller_id);

      if (inst.instance_uuid) {
        await evoFetch(cfg, `/instance/delete/${encodeURIComponent(inst.instance_uuid)}`, { method: "DELETE" }).catch(() => null);
      } else if (inst.instance_name) {
        await evoFetch(cfg, `/instance/delete/${encodeURIComponent(inst.instance_name)}`, { method: "DELETE" }).catch(() => null);
      }
      await supaAdmin.from("evolution_instances").delete().eq("id", inst.id);
      return json({ ok: true });
    }

    if (action === "set_default") {
      if (!instance_id) return json({ error: "instance_id required" }, 400);
      const { data: inst } = await supaAdmin
        .from("evolution_instances")
        .select("restaurant_id")
        .eq("id", instance_id)
        .maybeSingle();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      await assertAccessTo(inst.restaurant_id);

      await supaAdmin.from("evolution_instances").update({ is_default: false }).eq("restaurant_id", inst.restaurant_id);
      await supaAdmin.from("evolution_instances").update({ is_default: true }).eq("id", instance_id);
      return json({ ok: true });
    }

    if (action === "sync_instances") {
      if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);
      const resellerId = await assertAccessTo(restaurant_id);
      const cfg = await getCfgForReseller(resellerId);
      // Evolution API v2 usa /instance/fetchInstances; Evolution Go usa /instance/all
      const listPaths = ["/instance/fetchInstances", "/instance/all"];
      let resp: Awaited<ReturnType<typeof evoFetch>> | null = null;
      const listErrors: string[] = [];
      for (const p of listPaths) {
        const r = await evoFetch(cfg, p, { method: "GET" });
        if (r.ok) { resp = r; break; }
        listErrors.push(`${p}: ${r.message || r.status}`);
      }
      if (!resp) {
        return json({ ok: false, error: `Falha ao sincronizar (${listErrors.join(" | ")})` }, 200);
      }

      const parsed = extractInstanceList(resp.body).map(parseInstanceFromList).filter((p) => p.name);

      const { data: dbList } = await supaAdmin
        .from("evolution_instances")
        .select("id, instance_name, instance_uuid, instance_token, webhook_token")
        .eq("restaurant_id", restaurant_id);

      let updated = 0;
      for (const inst of dbList ?? []) {
        const match = parsed.find((p) => p.name === inst.instance_name || p.uuid === inst.instance_uuid);
        if (!match) continue;
        const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?token=${inst.webhook_token}`;
        if (match.uuid && (match.token || inst.instance_token)) {
          await configureWebhook(cfg, match.uuid, match.token || inst.instance_token, webhookUrl, inst.instance_name);
        }
        const { error } = await supaAdmin
          .from("evolution_instances")
          .update({
            status: match.status,
            phone_number: match.phone,
            instance_uuid: match.uuid ?? inst.instance_uuid,
            instance_token: match.token ?? inst.instance_token,
            qr_code: match.connected ? null : match.qrcode,
            qr_expires_at: !match.connected && match.qrcode ? new Date(Date.now() + 660 * 1000).toISOString() : null,
            last_connected_at: match.connected ? new Date().toISOString() : null,
          })
          .eq("id", inst.id);
        if (!error) updated++;
      }
      return json({ ok: true, synced: parsed.length, updated });
    }

    if (action === "reconfigure_webhook") {
      if (!instance_id) return json({ error: "instance_id required" }, 400);
      const { data: inst } = await supaAdmin
        .from("evolution_instances")
        .select("*")
        .eq("id", instance_id)
        .maybeSingle();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      await assertAccessTo(inst.restaurant_id);
      const cfg = await getCfgForReseller(inst.reseller_id);

      if (!inst.instance_uuid || !inst.instance_token) {
        return json({ ok: false, error: "Instância sem UUID/token. Faça 'Sincronizar' primeiro." }, 400);
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?token=${inst.webhook_token}`;
      const wh = await configureWebhook(cfg, inst.instance_uuid, inst.instance_token, webhookUrl, inst.instance_name);
      if (!wh.ok) {
        return json({ ok: false, error: wh.error || "Falha ao registrar webhook", response: wh.response }, 400);
      }
      return json({ ok: true, webhook_url: webhookUrl });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "forbidden") return json({ error: "Forbidden" }, 403);
    console.error("[evolution-proxy] error:", err);
    return json({ error: msg || "Internal server error" }, 500);
  }
});
