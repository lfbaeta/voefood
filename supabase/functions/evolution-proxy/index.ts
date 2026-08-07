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

function normalizeUrl(u: string): string {
  return u.trim().replace(/\/$/, "");
}

function maskKey(k?: string | null): string {
  if (!k) return "(empty)";
  return k.length <= 8 ? "***" : `${k.slice(0, 5)}***${k.slice(-3)}`;
}

function normalizeQrString(value: any): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length <= 10) return null; // Increased sensitivity

  // Handle formats like "data:image/png;base64,..."
  if (raw.startsWith("data:image")) return raw;

  const pipeIndex = raw.indexOf("|");
  if (pipeIndex >= 0) {
    const afterPipe = raw.slice(pipeIndex + 1).trim();
    if (afterPipe.length > 10) return afterPipe;
    const beforePipe = raw.slice(0, pipeIndex).trim();
    if (beforePipe.length > 10) return beforePipe;
  }

  return raw;
}

function extractQr(obj: any): string | null {
  if (!obj) return null;
  
  // Direct string check
  const normalized = normalizeQrString(obj);
  if (normalized) return normalized;
  
  if (typeof obj !== "object") return null;

  // Evolution Go usually returns { qrcode: { code: "..." } } or { code: "..." }
  // Evolution API v2 usually returns { qrcode: "..." } or { base64: "..." }
  const candidates = [
    obj.qrcode,
    obj.qr,
    obj.base64,
    obj.code,
    obj.QRCode,
    obj.qr_code,
    obj.value,
    obj.qrcode?.base64,
    obj.qrcode?.code,
    obj.QRCode?.Base64,
    obj.QRCode?.Code,
    obj.data?.qrcode,
    obj.data?.qr,
    obj.data?.base64,
    obj.data?.QRCode,
    obj.data?.code,
    obj.data?.qrcode?.base64,
    obj.data?.qrcode?.code,
    obj.instance?.qrcode,
    obj.instance?.qr,
  ];

  for (const c of candidates) {
    if (c) {
      // If candidate is a string, normalize it
      if (typeof c === "string") {
        const found = normalizeQrString(c);
        if (found) return found;
      }
      // If candidate is an object, recurse once
      if (typeof c === "object") {
        const found = extractQr(c);
        if (found) return found;
      }
    }
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
    "CONTACTS_UPSERT",
  ];
  const goEvents = ["Message", "SendMessage", "Connected", "Disconnected", "QR", "PairSuccess", "LoggedOut"];

  const attempts: Array<{ label: string; path: string; init: RequestInit; tokenOverride?: string }> = [];

  // Evolution API v2 (Node) — PUT /webhook/set/{instanceName}
  if (instanceName) {
    attempts.push({
      label: "v2-name",
      path: `/webhook/set/${encodeURIComponent(instanceName)}`,
      init: {
        method: "POST",
        body: JSON.stringify({
          webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: false, events },
          url: webhookUrl,
          enabled: true,
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

  // Evolution Go usually allows setting webhook via /instance/connect or /instance/update as well
  attempts.push({
    label: "go-connect-webhook",
    path: "/instance/connect",
    init: {
      method: "POST",
      headers: { instanceId: instanceUuid },
      body: JSON.stringify({ webhookUrl, subscribe: goEvents, immediate: false }),
    },
  });

  // Global key attempt for Go
  attempts.push({
    label: "go-uuid-global",
    path: "/webhook/set",
    init: {
      method: "POST",
      headers: { instanceId: instanceUuid },
      body: JSON.stringify({ url: webhookUrl, enabled: true, subscribe: goEvents }),
    },
    tokenOverride: cfg.apiKey
  });

  // Legacy fallback
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
    const res = await evoFetch(cfg, a.path, a.init, a.tokenOverride || instanceToken);
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

// Evolution Go usa /instance/all; Evolution API v2 usa /instance/fetchInstances
async function listServerInstances(cfg: EvoCfg) {
  const paths = ["/instance/all", "/instance/fetchInstances", "/instance/list"];
  let last: any = null;
  for (const p of paths) {
    const resp = await evoFetch(cfg, p, { method: "GET" });
    last = resp;
    if (resp.ok) return resp;
    if (resp.status !== 404) return resp;
  }
  return last;
}

function getConnectionState(body: any): string | null {
  return body?.connectionStatus
    ?? body?.connection
    ?? body?.status
    ?? body?.state
    ?? body?.instance?.state
    ?? body?.instance?.status
    ?? body?.instance?.connectionStatus
    ?? body?.data?.state
    ?? body?.data?.status
    ?? body?.data?.connectionStatus
    ?? null;
}

function buildQrFetchAttempts(instanceName: string, uuid: string, instanceToken: string, cfg: EvoCfg) {
  const encodedName = encodeURIComponent(instanceName);
  const encodedUuid = encodeURIComponent(uuid);
  return [
    // Evolution Go - specific QR endpoint
    { label: "go-qr-uuid-global", path: "/instance/qr", init: { method: "GET", headers: { instanceId: uuid } }, token: cfg.apiKey },
    { label: "go-qr-uuid-token", path: "/instance/qr", init: { method: "GET", headers: { instanceId: uuid } }, token: instanceToken },
    
    // Evolution API v2 (Node)
    { label: "v2-state-name", path: `/instance/connectionState/${encodedName}`, init: { method: "GET" }, token: instanceToken },
    { label: "v2-state-name-global", path: `/instance/connectionState/${encodedName}`, init: { method: "GET" }, token: cfg.apiKey },
    { label: "v2-state-uuid", path: `/instance/connectionState/${encodedUuid}`, init: { method: "GET" }, token: instanceToken },
    
    // Info endpoints
    { label: "go-info-uuid-global", path: `/instance/${encodedUuid}`, init: { method: "GET" }, token: cfg.apiKey },
    { label: "go-info-uuid-token", path: `/instance/${encodedUuid}`, init: { method: "GET" }, token: instanceToken },
    
    // Fetchers
    { label: "v2-fetch-name", path: `/instance/fetchInstances?instanceName=${encodedName}`, init: { method: "GET" }, token: instanceToken },
    { label: "v2-fetch-name-global", path: `/instance/fetchInstances?instanceName=${encodedName}`, init: { method: "GET" }, token: cfg.apiKey },
    
    // Fallbacks
    { label: "go-qrcode-name-global", path: `/instance/${encodedName}/qrcode`, init: { method: "GET" }, token: cfg.apiKey },
    { label: "go-qrcode-uuid-global", path: `/instance/${encodedUuid}/qrcode`, init: { method: "GET" }, token: cfg.apiKey },
    { label: "go-status-name-global", path: `/instance/${encodedName}/status`, init: { method: "GET" }, token: cfg.apiKey },
    { label: "go-status-uuid-global", path: `/instance/${encodedUuid}/status`, init: { method: "GET" }, token: cfg.apiKey },
  ] as Array<{ label: string; path: string; init: RequestInit; token: string }>;
}

function shouldPollForWebhookQr(result: EvoFetchResult): boolean {
  if (!result.ok) return false;
  const qr = extractQr(result.body);
  if (qr) return false;
  return result.body == null
    || result.body?.success === true
    || result.body?.ok === true
    || result.body?.count === 0
    || String(getConnectionState(result.body) || "").toLowerCase() === "connecting";
}

function isConnectedState(body: any): boolean {
  const state = getConnectionState(body);
  return body?.connected === true
    || body?.instance?.connected === true
    || body?.data?.connected === true
    || state === "open"
    || state === "connected";
}

function safeInstanceName(name: string): string {
  // Evolution Go usually allows 3-64 chars. v2 usually 3-60.
  // We normalize to meet both.
  const normalized = name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "-") // Allow upper case just in case, though we lowercase next
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  
  if (normalized.length < 3) return `${normalized}-wa`.slice(0, 60);
  return normalized.slice(0, 60);
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

    const { data: callerAdminRole } = await supaAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isPlatformAdmin = Boolean(callerAdminRole);

    async function getConfiguredFallbackResellerId(): Promise<string | null> {
      if (callerReseller?.id) return callerReseller.id;
      if (!isPlatformAdmin) return null;

      const { data: configured } = await supaAdmin
        .from("reseller_evolution_config")
        .select("reseller_id")
        .not("server_url", "is", null)
        .not("global_api_key", "is", null)
        .limit(1)
        .maybeSingle();

      if (configured?.reseller_id) return configured.reseller_id;

      const { data: activeReseller } = await supaAdmin
        .from("resellers")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      return activeReseller?.id ?? null;
    }

    async function assertAccessTo(rid: string): Promise<string> {
      const { data: r } = await supaAdmin
        .from("restaurants")
        .select("id, reseller_id")
        .eq("id", rid)
        .maybeSingle();
      if (!r) throw new Error("forbidden");

      let resellerId = r.reseller_id as string | null;
      if (!resellerId) {
        const fallbackResellerId = await getConfiguredFallbackResellerId();
        if (!fallbackResellerId) throw new Error("restaurant_without_reseller");

        const { error: linkErr } = await supaAdmin
          .from("restaurants")
          .update({ reseller_id: fallbackResellerId })
          .eq("id", rid)
          .is("reseller_id", null);
        if (linkErr) console.warn(`[assertAccessTo] failed to link restaurant ${rid}: ${linkErr.message}`);
        resellerId = fallbackResellerId;
      }

      if (isPlatformAdmin) return resellerId;
      if (callerReseller && resellerId === callerReseller.id) return resellerId;
      const { data: a } = await supaAdmin
        .from("restaurant_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("restaurant_id", rid)
        .maybeSingle();
      if (!a) throw new Error("forbidden");
      return resellerId;
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

      let safeName = safeInstanceName(instance_name);
      // Nomes muito curtos (ex.: "oi") são válidos para o usuário: completamos com sufixo.
      if (safeName.length > 0 && safeName.length < 3) {
        safeName = `${safeName}-wa`;
      }
      if (!/^[a-z0-9-]{3,60}$/.test(safeName)) {
        return json({ error: "Nome inválido. Use ao menos 1 letra ou número (ex.: vendas, loja-centro)." }, 400);
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
      console.log(`[create_instance] -> POST /instance/create name=${safeName} token=${maskKey(generatedToken)}`);
      
      // Attempt to create instance using various common patterns
      const createAttempts: Array<{ label: string; payload: any; token: string }> = [
        { 
          label: "go-standard", 
          payload: { name: safeName, token: generatedToken }, 
          token: cfg.apiKey 
        },
        { 
          label: "v2-node", 
          payload: { 
            instanceName: safeName, 
            token: generatedToken, 
            integration: "WHATSAPP-BAILEYS", 
            qrcode: true 
          }, 
          token: cfg.apiKey 
        },
        {
          label: "go-v2-hybrid",
          payload: {
            instanceName: safeName,
            token: generatedToken,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            name: safeName
          },
          token: cfg.apiKey
        }
      ];

      let createRes: EvoFetchResult | null = null;
      for (const attempt of createAttempts) {
        const res = await evoFetch(cfg, "/instance/create", {
          method: "POST",
          body: JSON.stringify(attempt.payload),
        }, attempt.token);
        
        console.log(`[create_instance] attempt=${attempt.label} status=${res.status} ok=${res.ok}`);
        
        // Check if creation was successful (Evolution Go can return 200/201 even if structure is different)
        if (res.ok && (res.body?.data?.id || res.body?.instance?.id || res.body?.id || res.body?.success === true)) {
          createRes = res;
          break;
        }
        
        // If it's 403, we should stop and report the error (Global API Key issue)
        if (res.status === 403 || res.status === 401) {
          createRes = res;
          break;
        }
      }

      if (!createRes) {
        // Fallback to the last response if none was successful
        createRes = await evoFetch(cfg, "/instance/create", {
          method: "POST",
          body: JSON.stringify({ name: safeName, token: generatedToken }),
        }, cfg.apiKey);
      }
      console.log(`[create_instance] <- go status=${createRes.status} ok=${createRes.ok}`);

      if (!createRes.ok) {
        if (createRes.status === 401 || createRes.status === 403) {
          return json({
            ok: false,
            error: "O servidor Evolution recusou a requisição (403 Forbidden). A Global API Key configurada é inválida ou não tem permissão para criar instâncias. Verifique a URL e a API Key em Revenda → WhatsApp (Evolution) e teste a conexão.",
            response: createRes.body,
          }, 400);
        }
        return json({ ok: false, error: createRes.message || `Falha ao criar instância (status ${createRes.status})`, response: createRes.body }, 400);
      }

      const body = createRes.body ?? {};
      const created = body?.data ?? body?.instance ?? body ?? {};
      const uuid = created?.id ?? created?.instanceId ?? created?.uuid ?? null;
      const instanceToken =
        created?.token ??
        (typeof body?.hash === "string" ? body.hash : null) ??
        body?.hash?.apikey ??
        created?.hash?.apikey ??
        created?.apikey ??
        generatedToken;
      if (!uuid) {
        return json({ ok: false, error: "Servidor criou a instância mas não retornou UUID. Verifique a versão do servidor Evolution.", response: createRes.body }, 400);
      }

      const initialQr = extractQr(createRes.body);

      const { data: inserted, error: insertErr } = await supaAdmin
        .from("evolution_instances")
        .insert({
          restaurant_id,
          reseller_id: resellerId,
          instance_name: safeName,
          instance_uuid: uuid,
          instance_token: instanceToken,
          status: initialQr ? "waiting_qr" : "disconnected",
          qr_code: initialQr,
          qr_expires_at: initialQr ? new Date(Date.now() + 660 * 1000).toISOString() : null,
          webhook_token: webhookToken,
          is_default: (count ?? 0) === 0,
        })
        .select("id, webhook_token")
        .single();
      if (insertErr) throw insertErr;

      const webhookUrl = `https://hmpfoxxlaebxzakdmopj.supabase.co/functions/v1/evolution-webhook?token=${inserted.webhook_token}`;
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

      const webhookUrl = `https://hmpfoxxlaebxzakdmopj.supabase.co/functions/v1/evolution-webhook?token=${inst.webhook_token}`;

      async function checkConnectionFor(instanceName: string, instanceUuid: string, token: string): Promise<{ connected: boolean; qr: string | null }> {
        const attempts = buildQrFetchAttempts(instanceName, instanceUuid, token, cfg);

        for (const a of attempts) {
          const info = await evoFetch(cfg, a.path, a.init, a.token);
          console.log(`[connect_instance] check=${a.label} status=${info.status} ok=${info.ok}`);
          if (!info.ok) {
            // Se o servidor retornar 404/401 mas a gente sabe que ele existe (ex: acabou de criar),
            // pode ser apenas delay de propagação interna do Evolution Go.
            continue;
          }
          if (isConnectedState(info.body)) return { connected: true, qr: null };
          const qr = extractQr(info.body);
          if (qr) return { connected: false, qr };
        }

        return { connected: false, qr: null };
      }

      async function recreateMissingInstance(): Promise<{ ok: boolean; qr: string | null; error?: string; response?: any }> {
        const safeName = safeInstanceName(inst.instance_name);
        const generatedToken = crypto.randomUUID();
        console.log(`[connect_instance] recreating missing instance name=${safeName} token=${maskKey(generatedToken)}`);

        let createRes = await evoFetch(cfg, "/instance/create", {
          method: "POST",
          body: JSON.stringify({ name: safeName, token: generatedToken }),
        }, cfg.apiKey);
        console.log(`[connect_instance] recreate go status=${createRes.status} ok=${createRes.ok}`);

        if (!createRes.ok) {
          const v2Res = await evoFetch(cfg, "/instance/create", {
            method: "POST",
            body: JSON.stringify({
              instanceName: safeName,
              token: generatedToken,
              integration: "WHATSAPP-BAILEYS",
              qrcode: true,
            }),
          }, cfg.apiKey);
          console.log(`[connect_instance] recreate v2 status=${v2Res.status} ok=${v2Res.ok}`);
          if (v2Res.ok) createRes = v2Res;
          else return { ok: false, qr: null, error: v2Res.message || createRes.message || `Falha ao recriar instância (status ${v2Res.status})`, response: v2Res.body };
        }

        const body = createRes.body ?? {};
        const created = body?.data ?? body?.instance ?? body ?? {};
        const newUuid = created?.id ?? created?.instanceId ?? created?.uuid ?? null;
        const newToken =
          created?.token ??
          (typeof body?.hash === "string" ? body.hash : null) ??
          body?.hash?.apikey ??
          created?.hash?.apikey ??
          created?.apikey ??
          generatedToken;

        if (!newUuid) {
          return { ok: false, qr: null, error: "Servidor recriou a instância mas não retornou UUID.", response: createRes.body };
        }

        const newWebhookUrl = `https://hmpfoxxlaebxzakdmopj.supabase.co/functions/v1/evolution-webhook?token=${inst.webhook_token}`;
        const wh = await configureWebhook(cfg, newUuid, newToken, newWebhookUrl, safeName);
        if (!wh.ok) console.warn(`[connect_instance] webhook setup after recreate failed: ${wh.error}`);

        let qr = extractQr(createRes.body);
        await supaAdmin
          .from("evolution_instances")
          .update({
            instance_uuid: newUuid,
            instance_token: newToken,
            instance_name: safeName,
            status: qr ? "waiting_qr" : "disconnected",
            qr_code: qr,
            qr_expires_at: qr ? new Date(Date.now() + 660 * 1000).toISOString() : null,
            phone_number: null,
            last_connected_at: null,
          })
          .eq("id", inst.id);

        if (!qr) {
          const connectAgain = [
            {
              label: "recreated-go-connect-global",
              path: "/instance/connect",
              init: {
                method: "POST",
                headers: { instanceId: newUuid },
                body: JSON.stringify({ webhookUrl: newWebhookUrl, subscribe: ["ALL"], immediate: true }),
              },
              token: cfg.apiKey,
            },
            { label: "recreated-v2-connect-name", path: `/instance/connect/${encodeURIComponent(safeName)}`, init: { method: "GET" }, token: newToken },
            { label: "recreated-v2-connect-name-global", path: `/instance/connect/${encodeURIComponent(safeName)}`, init: { method: "GET" }, token: cfg.apiKey },
          ] as Array<{ label: string; path: string; init: RequestInit; token: string }>;

          for (const a of connectAgain) {
            const connectRes = await evoFetch(cfg, a.path, a.init, a.token);
            console.log(`[connect_instance] recreated attempt=${a.label} status=${connectRes.status} ok=${connectRes.ok}`);
            qr = extractQr(connectRes.body);
            if (qr || shouldPollForWebhookQr(connectRes)) break;
          }

          if (!qr) {
            for (let i = 0; i < 6; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const current = await checkConnectionFor(safeName, newUuid, newToken);
              if (current.connected) return { ok: true, qr: null, response: { connected: true } };
              if (current.qr) {
                qr = current.qr;
                break;
              }
            }
          }

          if (qr) {
            await supaAdmin
              .from("evolution_instances")
              .update({ status: "waiting_qr", qr_code: qr, qr_expires_at: new Date(Date.now() + 660 * 1000).toISOString() })
              .eq("id", inst.id);
          }
        }

        return { ok: true, qr, response: createRes.body };
      }

      if (inst.qr_code && (!inst.qr_expires_at || new Date(inst.qr_expires_at).getTime() > Date.now())) {
        await supaAdmin
          .from("evolution_instances")
          .update({ status: "waiting_qr" })
          .eq("id", inst.id);
        return json({ ok: true, qr_code: inst.qr_code, connected: false, reused_cached_qr: true });
      }

      async function checkCurrentConnection(): Promise<{ connected: boolean; qr: string | null }> {
        return checkConnectionFor(inst.instance_name, uuid, instanceToken);
      }

      try {
        const current = await checkCurrentConnection();
        if (current.connected) {
          await supaAdmin
            .from("evolution_instances")
            .update({ status: "connected", qr_code: null, qr_expires_at: null, last_connected_at: new Date().toISOString() })
            .eq("id", inst.id);
          return json({ ok: true, qr_code: null, connected: true, already_connected: true });
        }

        if (current.qr) {
          await supaAdmin
            .from("evolution_instances")
            .update({ status: "waiting_qr", qr_code: current.qr, qr_expires_at: new Date(Date.now() + 660 * 1000).toISOString() })
            .eq("id", inst.id);
          return json({ ok: true, qr_code: current.qr, connected: false, reused_server_qr: true });
        }
      } catch (e) {
        console.warn(`[connect_instance] info check failed (continuing): ${(e as Error).message}`);
      }

      await supaAdmin
        .from("evolution_instances")
        .update({ status: "waiting_qr", qr_code: null, qr_expires_at: null })
        .eq("id", inst.id);

      const connectAttempts: Array<{ label: string; path: string; init: RequestInit; token: string }> = [
        {
          label: "go-connect-uuid-global",
          path: "/instance/connect",
          init: {
            method: "POST",
            headers: { instanceId: uuid },
            body: JSON.stringify({ webhookUrl, subscribe: ["ALL"], immediate: true }),
          },
          token: cfg.apiKey,
        },
        {
          label: "go-connect-uuid-token",
          path: "/instance/connect",
          init: {
            method: "POST",
            headers: { instanceId: uuid },
            body: JSON.stringify({ webhookUrl, subscribe: ["ALL"], immediate: true }),
          },
          token: instanceToken,
        },
        {
          label: "v2-connect-name",
          path: `/instance/connect/${encodeURIComponent(inst.instance_name)}`,
          init: { method: "GET" },
          token: instanceToken,
        },
        {
          label: "v2-connect-name-global",
          path: `/instance/connect/${encodeURIComponent(inst.instance_name)}`,
          init: { method: "GET" },
          token: cfg.apiKey,
        },
        {
          label: "v2-connect-uuid",
          path: `/instance/connect/${encodeURIComponent(uuid)}`,
          init: { method: "GET" },
          token: instanceToken,
        },
        {
          label: "v2-connect-uuid-global",
          path: `/instance/connect/${encodeURIComponent(uuid)}`,
          init: { method: "GET" },
          token: cfg.apiKey,
        },
      ];

      let res: EvoFetchResult | null = null;
      const failedAttempts: Array<{ label: string; status: number; message?: string }> = [];
      for (const a of connectAttempts) {
        const attemptRes = await evoFetch(cfg, a.path, a.init, a.token);
        console.log(`[connect_instance] attempt=${a.label} path=${a.path} status=${attemptRes.status} ok=${attemptRes.ok}`);
        if (attemptRes.ok || shouldPollForWebhookQr(attemptRes)) {
          res = attemptRes;
          break;
        }
        failedAttempts.push({ label: a.label, status: attemptRes.status, message: attemptRes.message });
      }

      if (!res) {
        const postConnect = await checkCurrentConnection();
        if (postConnect.connected) {
          await supaAdmin
            .from("evolution_instances")
            .update({ status: "connected", qr_code: null, qr_expires_at: null, last_connected_at: new Date().toISOString() })
            .eq("id", inst.id);
          return json({ ok: true, qr_code: null, connected: true, already_connected: true });
        }
        if (postConnect.qr) {
          await supaAdmin
            .from("evolution_instances")
            .update({ status: "waiting_qr", qr_code: postConnect.qr, qr_expires_at: new Date(Date.now() + 660 * 1000).toISOString() })
            .eq("id", inst.id);
          return json({ ok: true, qr_code: postConnect.qr, connected: false, reused_server_qr: true });
        }

        // 404 = endpoint/instância inexistente; 401 = UUID/token órfão (instância sumiu do servidor).
        // Nos dois casos a instância local está dessincronizada: recriamos no servidor.
        if (failedAttempts.length > 0 && failedAttempts.every((a) => a.status === 404 || a.status === 401)) {
          const recreated = await recreateMissingInstance();
          if (recreated.ok) {
            const qr = recreated.qr;
            if (qr) return json({ ok: true, qr_code: qr, connected: false, recreated: true });
            return json({ ok: true, qr_code: null, connected: false, recreated: true, response: recreated.response });
          }
          console.warn(`[connect_instance] recreate failed: ${recreated.error}`);
          return json({
            ok: false,
            error: `Não foi possível recriar a instância no servidor Evolution: ${recreated.error ?? "erro desconhecido"}. Confira a URL base e a Global API Key em Revenda → WhatsApp (Evolution).`,
            attempts: failedAttempts,
          }, 400);
        }


        const last = failedAttempts[failedAttempts.length - 1];
        return json({
          ok: false,
          error: last?.message || `Evolution não retornou QR Code (status ${last?.status ?? "desconhecido"}). Verifique se a URL cadastrada aponta para a API Evolution correta e se a instância existe nesse servidor.`,
          attempts: failedAttempts,
        }, 400);
      }

      let qrString = extractQr(res.body);
      if (!qrString) {
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const current = await checkCurrentConnection();
          if (current.connected) {
            await supaAdmin
              .from("evolution_instances")
              .update({ status: "connected", qr_code: null, qr_expires_at: null, last_connected_at: new Date().toISOString() })
              .eq("id", inst.id);
            return json({ ok: true, qr_code: null, connected: true, already_connected: true });
          }
          if (current.qr) {
            qrString = current.qr;
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
      const resp = await evoFetch(cfg, "/instance/all", { method: "GET" });
      if (!resp.ok) return json({ error: resp.message || "Falha ao sincronizar", response: resp.body }, 400);

      const parsed = extractInstanceList(resp.body).map(parseInstanceFromList).filter((p) => p.name);
      const { data: dbList } = await supaAdmin
        .from("evolution_instances")
        .select("id, instance_name, instance_uuid, instance_token, webhook_token")
        .eq("restaurant_id", restaurant_id);

      let updated = 0;
      for (const inst of dbList ?? []) {
        const match = parsed.find((p) => p.name === inst.instance_name || p.uuid === inst.instance_uuid);
        if (!match) continue;
        const webhookUrl = `https://hmpfoxxlaebxzakdmopj.supabase.co/functions/v1/evolution-webhook?token=${inst.webhook_token}`;
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

    if (action === "fetch_server_instances") {
      const resellerId = await assertAccessTo(restaurant_id!); // restaurant_id can be dummy if platform admin
      const cfg = await getCfgForReseller(resellerId);
      const resp = await evoFetch(cfg, "/instance/all", { method: "GET" });
      if (!resp.ok) return json({ error: resp.message || "Falha ao buscar instâncias", response: resp.body }, 400);

      const parsed = extractInstanceList(resp.body).map(parseInstanceFromList).filter((p) => p.name);
      return json({ instances: parsed });
    }

    if (action === "delete_server_instance") {
      const resellerId = await assertAccessTo(restaurant_id!);
      const cfg = await getCfgForReseller(resellerId);

      const uuid = (payload as any).instance_uuid as string | undefined;
      const instanceName = instance_name || uuid;
      if (!instanceName) return json({ error: "instance_name required" }, 400);

      // 1. Delete from Evolution Server (try name and uuid, v2 + Go patterns)
      const ids = [...new Set([instanceName, uuid].filter(Boolean) as string[])];
      const attempts: Array<{ path: string; method: string; headers?: Record<string, string> }> = [];
      for (const id of ids) {
        const e = encodeURIComponent(id);
        attempts.push(
          { path: `/instance/delete/${e}`, method: "DELETE" },
          { path: "/instance/delete", method: "DELETE", headers: { instanceId: id } },
          { path: `/instance/logout/${e}`, method: "DELETE" },
          { path: `/instance/${e}`, method: "DELETE" },
          { path: `/instance/delete/${e}`, method: "POST" },
        );
      }

      let lastErr: string | undefined;
      let success = false;

      console.log(`[delete_server_instance] deleting "${instanceName}" (uuid=${uuid ?? "?"}) at ${cfg.url}`);

      for (const a of attempts) {
        const res = await evoFetch(cfg, a.path, { method: a.method, headers: a.headers });
        console.log(`[delete_server_instance] ${a.method} ${a.path} -> ${res.status}`);
        if (res.ok) { success = true; break; }
        lastErr = res.message;
      }

      // 2. Delete from Database if exists
      const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      for (const id of ids) {
        await supaAdmin.from("evolution_instances").delete().eq("instance_name", id);
        if (isUuid(id)) await supaAdmin.from("evolution_instances").delete().eq("instance_uuid", id);
      }


      if (!success) return json({ error: lastErr || "Falha ao apagar no servidor Evolution" }, 400);
      return json({ ok: true });
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

      const webhookUrl = `https://hmpfoxxlaebxzakdmopj.supabase.co/functions/v1/evolution-webhook?token=${inst.webhook_token}`;
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
    if (msg === "restaurant_without_reseller") {
      return json({ error: "Restaurante sem revendedor vinculado. Acesse pelo superadmin ou vincule este restaurante a um revendedor antes de criar a conexão." }, 400);
    }
    console.error("[evolution-proxy] error:", err);
    return json({ error: msg || "Internal server error" }, 500);
  }
});
