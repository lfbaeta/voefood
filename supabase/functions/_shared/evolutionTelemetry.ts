import { formatEvolutionError } from "./evolutionSend.ts";

type AnyClient = { from: (t: string) => any };

export type SendAttemptLog = {
  restaurant_id?: string | null;
  instance_id?: string | null;
  instance_name?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  order_id?: number | null;
  source: string;
  target?: string | null;
  preview?: string | null;
  result: any;
};

/** Registra a tentativa de envio (best-effort, nunca lança). */
export async function logSendAttempt(supa: AnyClient, log: SendAttemptLog): Promise<void> {
  try {
    const result = log.result ?? {};
    await supa.from("evolution_send_attempts").insert({
      restaurant_id: log.restaurant_id ?? null,
      instance_id: log.instance_id ?? null,
      instance_name: log.instance_name ?? null,
      conversation_id: log.conversation_id ?? null,
      message_id: log.message_id ?? null,
      order_id: log.order_id ?? null,
      source: log.source,
      target: Array.isArray(log.target) ? log.target.join(",") : (log.target ?? null),
      endpoint: result.endpoint ?? result.path ?? null,
      http_status: typeof result.status === "number" ? result.status : null,
      key_source: result.keySource ?? null,
      ok: !!result.ok,
      error: result.ok ? null : formatEvolutionError(result as any).slice(0, 1000),
      preview: (log.preview ?? "").slice(0, 300) || null,
      attempts: Array.isArray(result.attempts)
        ? result.attempts.map((a: any) => ({
            endpoint: a.endpoint,
            target: a.target,
            status: a.status,
            ok: a.ok,
            keySource: a.keySource,
          }))
        : null,
    });
  } catch (err) {
    console.error("[evolution-telemetry] logSendAttempt failed", err);
  }
}

export type WebhookEventLog = {
  restaurant_id?: string | null;
  instance_id?: string | null;
  instance_name?: string | null;
  event: string;
  status?: string;
  conversation_id?: string | null;
  wa_message_id?: string | null;
  direction?: string | null;
  error?: string | null;
  payload_summary?: Record<string, unknown> | null;
};

/** Registra a chegada de um webhook da Evolution (best-effort, nunca lança). */
export async function logWebhookEvent(supa: AnyClient, log: WebhookEventLog): Promise<void> {
  try {
    await supa.from("evolution_webhook_events").insert({
      restaurant_id: log.restaurant_id ?? null,
      instance_id: log.instance_id ?? null,
      instance_name: log.instance_name ?? null,
      event: log.event || "unknown",
      status: log.status ?? "received",
      conversation_id: log.conversation_id ?? null,
      wa_message_id: log.wa_message_id ?? null,
      direction: log.direction ?? null,
      error: log.error ? String(log.error).slice(0, 1000) : null,
      payload_summary: log.payload_summary ?? null,
    });
  } catch (err) {
    console.error("[evolution-telemetry] logWebhookEvent failed", err);
  }
}
