export type EvolutionSendResult = {
  ok: boolean;
  status: number;
  body: any;
  path: string;
  endpoint: string;
  keySource: "global" | "instance" | "none";
  attempts: Array<{ endpoint: string; status: number; ok: boolean; keySource: string; body: any }>;
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

export function chooseEvolutionTarget(phone: string | null | undefined, lid: string | null | undefined): string {
  const lidTarget = normalizeEvolutionTarget(lid);
  if (lidTarget.includes("@lid")) return lidTarget;
  return normalizeEvolutionTarget(phone);
}

export function chooseEvolutionTargets(phone: string | null | undefined, lid: string | null | undefined): string[] {
  const phoneTarget = normalizeEvolutionTarget(phone);
  const lidTarget = normalizeEvolutionTarget(lid);
  const targets = [lidTarget, phoneTarget].filter(Boolean);
  return [...new Set(targets)];
}

export function extractEvolutionMessageId(body: any): string | null {
  return body?.key?.id ??
    body?.message?.key?.id ??
    body?.data?.key?.id ??
    body?.messageId ??
    body?.data?.messageId ??
    body?.id ??
    null;
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
  const raw = result.body?.message ??
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

export async function sendEvolutionText(
  cfg: EvolutionSendConfig,
  to: string | string[],
  text: string,
): Promise<EvolutionSendResult> {
  const numbers = (Array.isArray(to) ? to : [to]).map(normalizeEvolutionTarget).filter(Boolean);
  const uniqueNumbers = [...new Set(numbers)];
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
    if (!number.includes("@lid") && (number.length < 10 || number.length > 15)) {
      last = { ok: false, status: 400, body: { error: "Número de WhatsApp inválido após normalização.", number }, path: "", endpoint: "validate-number", keySource: "none", attempts: allAttempts };
      continue;
    }

    const endpoints = [
      { label: "v2-sendText", path: `/message/sendText/${instance}`, body: { number, text }, preferredKey: "global" as const },
      { label: "v2-sendMessage", path: `/message/sendMessage/${instance}`, body: { number, text }, preferredKey: "global" as const },
      { label: "go-send-text", path: "/send/text", body: { number, text }, preferredKey: "instance" as const },
    ];

    for (const endpoint of endpoints) {
      const keys = keyCandidates(cfg, endpoint.preferredKey);
      if (!keys.length) {
        last = { ok: false, status: 401, body: { error: "API key da Evolution ausente." }, path: endpoint.path, endpoint: endpoint.label, keySource: "none", attempts: allAttempts };
        continue;
      }

      for (const key of keys) {
        for (let retry = 1; retry <= 3; retry++) {
          const result = await postJson(cfg, endpoint.path, endpoint.body, key.value, key.source);
          result.endpoint = endpoint.label;
          allAttempts.push({ endpoint: endpoint.label, status: result.status, ok: result.ok, keySource: key.source, body: result.body });
          result.attempts = allAttempts;
          last = result;

          if (result.ok) return result;
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