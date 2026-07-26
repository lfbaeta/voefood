import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chooseEvolutionTargets, digitsOnly, formatEvolutionError, normalizeEvolutionUrl, sendEvolutionText } from "../_shared/evolutionSend.ts";
import { logSendAttempt } from "../_shared/evolutionTelemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function canAccess(supaAdmin: any, userId: string, restaurantId: string): Promise<boolean> {
  const { data: admin } = await supaAdmin
    .from("restaurant_admins").select("id").eq("restaurant_id", restaurantId).eq("user_id", userId).maybeSingle();
  if (admin) return true;
  const { data: r } = await supaAdmin.from("restaurants").select("reseller_id").eq("id", restaurantId).maybeSingle();
  if (!r?.reseller_id) return false;
  const { data: res } = await supaAdmin
    .from("resellers").select("id").eq("id", r.reseller_id).eq("user_id", userId).maybeSingle();
  return !!res;
}

async function fetchRemoteWebhook(serverUrl: string, apiKey: string, instanceName: string) {
  const base = normalizeEvolutionUrl(serverUrl);
  const paths = [
    `/webhook/find/${encodeURIComponent(instanceName)}`,
    `/instance/webhook/${encodeURIComponent(instanceName)}`,
  ];
  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      });
      const text = await res.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (res.ok && body) {
        const node = body?.webhook ?? body?.data ?? body;
        return {
          reachable: true,
          path,
          enabled: node?.enabled ?? node?.Enabled ?? (node?.url ? true : false),
          url: node?.url ?? node?.Url ?? node?.webhook?.url ?? null,
          events: node?.events ?? node?.Events ?? null,
          raw_status: res.status,
        };
      }
    } catch (_) { /* tenta próximo path */ }
  }
  return { reachable: false, path: null, enabled: false, url: null, events: null, raw_status: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const supaUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await supaUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const payload = await req.json().catch(() => ({}));
    const restaurantId: string = payload?.restaurant_id;
    const action: string = payload?.action || "status";
    if (!restaurantId) return json({ error: "restaurant_id required" }, 400);
    if (!(await canAccess(supa, user.id, restaurantId))) return json({ error: "forbidden" }, 403);

    const { data: instances } = await supa
      .from("evolution_instances")
      .select("id, instance_name, status, phone_number, is_default, reseller_id, webhook_token, instance_token, instance_uuid, last_connected_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: true });

    const resellerId = instances?.[0]?.reseller_id
      ?? (await supa.from("restaurants").select("reseller_id").eq("id", restaurantId).maybeSingle()).data?.reseller_id;

    const { data: cfg } = resellerId
      ? await supa.from("reseller_evolution_config").select("server_url, global_api_key, is_configured, last_tested_at").eq("reseller_id", resellerId).maybeSingle()
      : { data: null as any };

    const serverUrl = cfg?.server_url ? normalizeEvolutionUrl(cfg.server_url) : null;
    const globalKey = cfg?.global_api_key ?? null;
    const expectedWebhookBase = `${SUPABASE_URL}/functions/v1/evolution-webhook`;

    if (action === "test_send") {
      const to = String(payload?.to || "").trim();
      const instanceId = payload?.instance_id as string | undefined;
      if (!to) return json({ error: "to required" }, 400);
      const inst = (instances ?? []).find((i: any) => (instanceId ? i.id === instanceId : i.status === "connected")) ?? instances?.[0];
      if (!inst) return json({ error: "Nenhuma instância encontrada." }, 400);
      if (!serverUrl || !globalKey) return json({ error: "Evolution não configurada." }, 400);

      const text = String(payload?.text || "✅ Teste de envio do painel (health check).");
      const toDigits = digitsOnly(to);
      const { data: knownContact } = toDigits
        ? await supa
            .from("wa_contacts")
            .select("phone_e164, wa_lid")
            .eq("restaurant_id", restaurantId)
            .or(`phone_e164.eq.${toDigits},phone_e164.ilike.%${toDigits.slice(-10)}%`)
            .order("updated_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle()
        : { data: null as any };
      const targets = knownContact?.phone_e164 || knownContact?.wa_lid
        ? chooseEvolutionTargets(knownContact.phone_e164 ?? to, knownContact.wa_lid)
        : to;
      const result = await sendEvolutionText({
        serverUrl,
        globalApiKey: globalKey,
        instanceToken: inst.instance_token,
        instanceName: inst.instance_name,
        instanceUuid: inst.instance_uuid,
      }, targets, text);

      await logSendAttempt(supa, {
        restaurant_id: restaurantId,
        instance_id: inst.id,
        instance_name: inst.instance_name,
        source: "health-test",
        target: Array.isArray(targets) ? targets.join(",") : targets,
        preview: text,
        result,
      });

      return json({
        ok: result.ok,
        status: result.status,
        endpoint: result.endpoint,
        error: result.ok ? null : formatEvolutionError(result),
        attempts: result.attempts,
      });
    }

    // ===== status =====
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: lastEvents }, { data: recentEvents }, { data: recentAttempts }] = await Promise.all([
      supa.from("evolution_webhook_events").select("event, created_at, instance_name")
        .eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(20),
      supa.from("evolution_webhook_events").select("event, created_at")
        .eq("restaurant_id", restaurantId).gte("created_at", since).limit(1000),
      supa.from("evolution_send_attempts").select("ok, error, created_at, source, endpoint, http_status")
        .eq("restaurant_id", restaurantId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    ]);

    const eventCounts: Record<string, number> = {};
    for (const e of recentEvents ?? []) eventCounts[e.event] = (eventCounts[e.event] ?? 0) + 1;

    const attempts = recentAttempts ?? [];
    const failed = attempts.filter((a: any) => !a.ok);

    const instanceReports = [] as any[];
    for (const inst of instances ?? []) {
      const remote = serverUrl && globalKey
        ? await fetchRemoteWebhook(serverUrl, globalKey, inst.instance_name)
        : { reachable: false, path: null, enabled: false, url: null, events: null, raw_status: 0 };
      const expectedUrl = inst.webhook_token ? `${expectedWebhookBase}?token=${inst.webhook_token}` : null;
      instanceReports.push({
        id: inst.id,
        instance_name: inst.instance_name,
        status: inst.status,
        phone_number: inst.phone_number,
        is_default: inst.is_default,
        last_connected_at: inst.last_connected_at,
        webhook: {
          ...remote,
          expected_url: expectedUrl,
          matches: !!(remote.url && expectedUrl && String(remote.url).split("?")[0] === expectedWebhookBase),
          token_configured: !!inst.webhook_token,
        },
      });
    }

    const lastEventAt = lastEvents?.[0]?.created_at ?? null;
    const lastFailure = failed[0] ?? null;
    const lastSuccess = attempts.find((a: any) => a.ok) ?? null;

    const webhookHealthy = instanceReports.some((i) => i.webhook.reachable && i.webhook.enabled && i.webhook.matches);
    const sendHealthy = attempts.length === 0 ? null : failed.length / attempts.length < 0.5;

    return json({
      generated_at: new Date().toISOString(),
      config: {
        configured: !!cfg?.is_configured && !!serverUrl,
        server_url: serverUrl,
        last_tested_at: cfg?.last_tested_at ?? null,
        expected_webhook_base: expectedWebhookBase,
      },
      instances: instanceReports,
      webhook: {
        healthy: webhookHealthy,
        last_event_at: lastEventAt,
        events_24h: recentEvents?.length ?? 0,
        event_counts_24h: eventCounts,
        recent: lastEvents ?? [],
      },
      sending: {
        healthy: sendHealthy,
        attempts_24h: attempts.length,
        failures_24h: failed.length,
        last_success_at: lastSuccess?.created_at ?? null,
        last_failure: lastFailure ? { at: lastFailure.created_at, error: lastFailure.error, endpoint: lastFailure.endpoint, http_status: lastFailure.http_status } : null,
      },
    });
  } catch (e) {
    console.error("[evolution-health] fatal", e);
    return json({ error: "internal" }, 500);
  }
});
