export type EvolutionSendResult = {
  ok: boolean;
  status: number;
  body: any;
  path: string;
  endpoint: string;
  keySource: "global" | "instance" | "none";
  attempts: Array<{ endpoint: string; target?: string; status: number; ok: boolean; keySource: string; body: any }>;
};

export type EvolutionSendConfig = {
  serverUrl: string;
  globalApiKey?: string | null;
  instanceToken?: string | null;
  instanceName: string;
  instanceUuid?: string | null;
  debug?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalizeEvolutionUrl(value: string): string {
  let url = String(value || "").trim().replace(/\/+$/, "");
  url = url.replace(/\/(manager|admin|dashboard|api)(\/.*)?$/i, "");
  return url.replace(/\/+$/, "");
}

export function digitsOnly(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeEvolutionTarget(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@lid")) return raw.split(":")[0];
  if (raw.includes("@s.whatsapp.net")) return digitsOnly(raw.split("@")[0]);
  return digitsOnly(raw);
}

function normalizeEvolutionSendTarget(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@lid")) return raw.split(":")[0];
  if (raw.includes("@s.whatsapp.net")) {
    const phone = digitsOnly(raw.split("@")[0]);
    return phone ? `${phone}@s.whatsapp.net` : raw;
  }
  return digitsOnly(raw);
}

function toPhoneJid(value: string | null | undefined): string {
  const phone = normalizeEvolutionTarget(value);
  if (!phone || phone.includes("@lid") || phone.length < 10 || phone.length > 15) return "";
  return `${phone}@s.whatsapp.net`;
}

export function chooseEvolutionTarget(phone: string | null | undefined, lid: string | null | undefined): string {
  const phoneJid = toPhoneJid(phone);
  if (phoneJid) return phoneJid;
  const lidTarget = normalizeEvolutionSendTarget(lid);
  if (lidTarget.includes("@lid")) return lidTarget;
  return normalizeEvolutionSendTarget(phone);
}


export function chooseEvolutionTargets(phone: string | null | undefined, lid: string | null | undefined): string[] {
  const lidTarget = normalizeEvolutionSendTarget(lid);
  const phoneJidTarget = toPhoneJid(phone);
  const phoneTarget = normalizeEvolutionSendTarget(phone);
  // O JID de telefone é o destino confiável. O LID fica por último porque a
  // Evolution pode ter capturado o LID do próprio dono da instância (eco
  // fromMe), o que faz a mensagem "enviar" com 201 e nunca chegar no cliente.
  const targets = [phoneJidTarget, phoneTarget, lidTarget].filter(Boolean);
  return [...new Set(targets)];
}


export function extractEvolutionMessageId(body: any): string | null {
  return body?.key?.id ??
    body?.message?.key?.id ??
    body?.data?.key?.id ??
    body?.response?.key?.id ??
    body?.response?.data?.key?.id ??
    body?.messageId ??
    body?.data?.messageId ??
    body?.response?.messageId ??
    body?.response?.data?.messageId ??
    body?.id ??
    null;
}

export function getEvolutionOutgoingStatus(body: any): "pending" | "sent" | "delivered" | "read" | "failed" {
  const raw = String(
    body?.status ??
    body?.message?.status ??
    body?.data?.status ??
    body?.key?.status ??
    "",
  ).toLowerCase();

  if (["pending", "pending_ack"].includes(raw)) return "pending";
  if (["sent", "server_ack"].includes(raw)) return "sent";
  if (["delivered", "delivery_ack", "played"].includes(raw)) return "delivered";
  if (["read", "read_ack"].includes(raw)) return "read";
  if (["failed", "error"].includes(raw)) return "failed";
  return "pending";
}

function isOnlyQueuedByEvolution(body: any): boolean {
  return getEvolutionOutgoingStatus(body) === "pending";
}

function asPendingFailure(result: EvolutionSendResult): EvolutionSendResult {
  const remoteJid = result.body?.key?.remoteJid ?? result.body?.data?.key?.remoteJid ?? null;
  const messageId = result.body?.key?.id ?? result.body?.data?.key?.id ?? null;
  return {
    ...result,
    ok: false,
    body: {
      error: "A Evolution aceitou a mensagem, mas deixou em PENDING e não confirmou entrega ao celular.",
      evolution_status: "PENDING",
      key: result.body?.key ?? result.body?.data?.key ?? null,
      remoteJid,
      messageId,
      response: result.body,
    },
  };
}

function bodyPreview(body: any, limit = 1200): string {
  if (body == null) return "sem body";
  if (typeof body === "string") return body.slice(0, limit);
  try {
    return JSON.stringify(body).slice(0, limit);
  } catch {
    return String(body).slice(0, limit);
  }
}

export function formatEvolutionError(result: EvolutionSendResult | null, fallback = "A Evolution recusou o envio."): string {
  if (!result) return "A Evolution não respondeu ao envio.";
  const raw = result.body?.error ??
    result.body?.message ??
    result.body?.error ??
    result.body?.response?.message ??
    result.body?.response?.error ??
    result.body?.data?.message ??
    result.body?.data?.error;
  const message = Array.isArray(raw) ? raw.join(" ") : raw ? String(raw) : "";
  return message || `${fallback} Status ${result.status} em ${result.endpoint || result.path}: ${bodyPreview(result.body, 500)}`;
}

function isTransient(status: number): boolean {
  return status === 0 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function keyCandidates(cfg: EvolutionSendConfig, preferred: "global" | "instance") {
  const candidates = preferred === "instance"
    ? [
        { source: "instance" as const, value: cfg.instanceToken },
        { source: "global" as const, value: cfg.globalApiKey },
      ]
    : [
        { source: "global" as const, value: cfg.globalApiKey },
        { source: "instance" as const, value: cfg.instanceToken },
      ];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const value = String(candidate.value || "").trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }) as Array<{ source: "global" | "instance"; value: string }>;
}

async function postJson(
  cfg: EvolutionSendConfig,
  path: string,
  body: Record<string, unknown>,
  key: string,
  keySource: "global" | "instance",
): Promise<EvolutionSendResult> {
  const url = `${normalizeEvolutionUrl(cfg.serverUrl)}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
    instance: cfg.instanceName,
    instanceName: cfg.instanceName,
  };
  if (cfg.instanceUuid) headers.instanceId = cfg.instanceUuid;

  console.log("=========================");
  console.log("ENVIANDO PARA EVOLUTION");
  console.log(`Número: ${body.number ?? ""}`);
  console.log(`Instância: ${cfg.instanceName}`);
  console.log(`Endpoint: ${path}`);
  console.log(`Mensagem: ${String(body.text ?? body.caption ?? "").slice(0, 500)}`);
  console.log("=========================");
  if (cfg.debug) {
    console.log(`[evolution-debug] request=${JSON.stringify({ url, method: "POST", headers: { ...headers, apikey: "***", Authorization: "Bearer ***" }, body }).slice(0, 2000)}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (error) {
    console.error("=========================");
    console.error("ERRO EVOLUTION");
    console.error("Código: 0");
    console.error(`Mensagem: ${(error as Error).message}`);
    console.error(`Stack: ${(error as Error).stack ?? "sem stack"}`);
    console.error("=========================");
    return { ok: false, status: 0, body: { error: (error as Error).message }, path, endpoint: path, keySource, attempts: [] };
  }

  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  console.log("=========================");
  console.log("RESPOSTA DA EVOLUTION");
  console.log(`Status HTTP: ${response.status}`);
  console.log(`Body: ${bodyPreview(parsed)}`);
  console.log("=========================");

  if (!response.ok) {
    const errorResult = { ok: false, status: response.status, body: parsed, path, endpoint: path, keySource, attempts: [] };
    console.error("=========================");
    console.error("ERRO EVOLUTION");
    console.error(`Código: ${response.status}`);
    console.error(`Mensagem: ${formatEvolutionError(errorResult)}`);
    console.error("Stack: sem exception HTTP");
    console.error("=========================");
  }

  return { ok: response.ok, status: response.status, body: parsed, path, endpoint: path, keySource, attempts: [] };
}

// Variações de número brasileiro (com/sem o 9 extra em celulares).
export function brazilPhoneVariants(phone: string): string[] {
  const digits = digitsOnly(phone);
  const out = new Set<string>([digits]);
  if (digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9 && rest.startsWith("9")) out.add(`55${ddd}${rest.slice(1)}`);
    if (rest.length === 8) out.add(`55${ddd}9${rest}`);
  }
  return [...out].filter((n) => n.length >= 10 && n.length <= 15);
}

/**
 * Pergunta à Evolution qual é o JID real do número (endpoint whatsappNumbers).
 * Sem isso, a Evolution v2 aceita o envio com 201/PENDING e nunca entrega
 * quando o JID informado não corresponde ao registrado no WhatsApp.
 */
export async function resolveEvolutionJid(
  cfg: EvolutionSendConfig,
  phone: string | null | undefined,
): Promise<string | null> {
  const variants = brazilPhoneVariants(String(phone || ""));
  if (!variants.length) return null;
  const instance = encodeURIComponent(cfg.instanceName);
  const keys = keyCandidates(cfg, "global");
  for (const key of keys) {
    for (const path of [`/chat/whatsappNumbers/${instance}`, `/chat/whatsappNumbers`]) {
      try {
        const res = await fetch(`${normalizeEvolutionUrl(cfg.serverUrl)}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key.value,
            Authorization: `Bearer ${key.value}`,
            instance: cfg.instanceName,
          },
          body: JSON.stringify({ numbers: variants }),
        });
        const text = await res.text();
        let parsed: any = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        if (!res.ok) continue;
        const list: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
        const hit = list.find((item) => item?.exists === true || item?.exists === "true");
        const jid = String(hit?.jid ?? hit?.number ?? "").trim();
        console.log(`[evolution-resolve] variants=${variants.join(",")} jid=${jid || "none"}`);
        if (jid) {
          return jid.includes("@") ? jid : `${digitsOnly(jid)}@s.whatsapp.net`;
        }
      } catch (error) {
        console.log(`[evolution-resolve] falhou em ${path}: ${(error as Error).message}`);
      }
    }
  }
  return null;
}

export async function sendEvolutionText(
  cfg: EvolutionSendConfig,
  to: string | string[],
  text: string,
): Promise<EvolutionSendResult> {
  const numbers = (Array.isArray(to) ? to : [to]).map(normalizeEvolutionSendTarget).filter(Boolean);
  let uniqueNumbers = [...new Set(numbers)];

  // Resolve o JID real antes de tentar qualquer envio "às cegas".
  const phoneSeed = uniqueNumbers.find((n) => !n.includes("@lid"));
  if (phoneSeed) {
    const resolved = await resolveEvolutionJid(cfg, phoneSeed.split("@")[0]);
    if (resolved) {
      const resolvedPhone = normalizeEvolutionTarget(resolved);
      uniqueNumbers = [...new Set([resolvedPhone, resolved, ...uniqueNumbers].filter(Boolean))];
    }
  }

  if (!uniqueNumbers.length) {

    return {
      ok: false,
      status: 400,
      body: { error: "Número de WhatsApp inválido após normalização.", number: "" },
      path: "",
      endpoint: "",
      keySource: "none",
      attempts: [],
    };
  }

  const instance = encodeURIComponent(cfg.instanceName);
  const allAttempts: EvolutionSendResult["attempts"] = [];
  let last: EvolutionSendResult | null = null;

  for (const number of uniqueNumbers) {
    const phonePart = number.includes("@s.whatsapp.net") ? digitsOnly(number.split("@")[0]) : number;
    if (!number.includes("@lid") && (phonePart.length < 10 || phonePart.length > 15)) {
      last = { ok: false, status: 400, body: { error: "Número de WhatsApp inválido após normalização.", number }, path: "", endpoint: "validate-number", keySource: "none", attempts: allAttempts };
      continue;
    }

    const endpoints = [
      { label: "v2-sendText", path: `/message/sendText/${instance}`, body: { number, text }, preferredKey: "global" as const },
      { label: "v2-sendMessage", path: `/message/sendMessage/${instance}`, body: { number, text }, preferredKey: "global" as const },
      { label: "go-send-text", path: "/send/text", body: { number, text }, preferredKey: "instance" as const },
    ];
    let queuedOnlyForTarget = false;

    for (const endpoint of endpoints) {
      if (queuedOnlyForTarget) break;
      const keys = keyCandidates(cfg, endpoint.preferredKey);
      if (!keys.length) {
        last = { ok: false, status: 401, body: { error: "API key da Evolution ausente." }, path: endpoint.path, endpoint: endpoint.label, keySource: "none", attempts: allAttempts };
        continue;
      }

      for (const key of keys) {
        for (let retry = 1; retry <= 3; retry++) {
          const result = await postJson(cfg, endpoint.path, endpoint.body, key.value, key.source);
          result.endpoint = endpoint.label;
          const queuedOnly = result.ok && isOnlyQueuedByEvolution(result.body);
          allAttempts.push({ endpoint: endpoint.label, target: number, status: result.status, ok: result.ok && !queuedOnly, keySource: key.source, body: result.body });
          result.attempts = allAttempts;
          last = queuedOnly ? asPendingFailure(result) : result;
          last.attempts = allAttempts;

          if (result.ok && !queuedOnly) return result;
          if (queuedOnly) {
            console.warn(`[evolution-send] ${endpoint.label} target=${number} returned PENDING only; trying next fallback before reporting success.`);
            queuedOnlyForTarget = true;
            break;
          }
          if (!isTransient(result.status) || retry === 3) break;
          await sleep(600 * retry);
        }

        if (last && [401, 403].includes(last.status)) continue;
        if (last && ![404, 400, 422].includes(last.status)) break;
      }
    }
  }

  return last ?? { ok: false, status: 0, body: { error: "Falha ao enviar para Evolution." }, path: "", endpoint: "", keySource: "none", attempts: allAttempts };
}