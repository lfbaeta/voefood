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

function maskKey(k?: string | null): string {
  if (!k) return "";
  if (k.length <= 8) return "•".repeat(k.length);
  return "•".repeat(Math.max(k.length - 4, 0)) + k.slice(-4);
}

function normalizeUrl(u: string): string {
  let s = u.trim().replace(/\/+$/, "");
  s = s.replace(/\/(manager|admin|dashboard|api)(\/.*)?$/i, "");
  return s.replace(/\/+$/, "");
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

    // Identify caller's reseller_id
    const { data: reseller, error: resErr } = await supaAdmin
      .from("resellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (resErr) throw resErr;
    if (!reseller) return json({ error: "Reseller not found" }, 403);
    const resellerId = reseller.id;

    const { action, server_url, global_api_key } = await req.json();

    if (action === "get") {
      const { data, error } = await supaAdmin
        .from("reseller_evolution_config")
        .select("server_url, global_api_key, is_configured, last_tested_at")
        .eq("reseller_id", resellerId)
        .maybeSingle();
      if (error) throw error;
      return json({
        server_url: data?.server_url ?? "",
        global_api_key_masked: maskKey(data?.global_api_key),
        has_api_key: !!data?.global_api_key,
        is_configured: !!data?.is_configured,
        last_tested_at: data?.last_tested_at ?? null,
      });
    }

    if (action === "save") {
      if (!server_url || typeof server_url !== "string") {
        return json({ error: "server_url obrigatório" }, 400);
      }
      const url = normalizeUrl(server_url);
      if (!/^https?:\/\//.test(url)) {
        return json({ error: "URL deve começar com http:// ou https://" }, 400);
      }

      // Find existing
      const { data: existing } = await supaAdmin
        .from("reseller_evolution_config")
        .select("id, global_api_key")
        .eq("reseller_id", resellerId)
        .maybeSingle();

      const keyToStore =
        typeof global_api_key === "string" && global_api_key.trim().length > 0
          ? global_api_key.trim()
          : existing?.global_api_key ?? null;

      if (!keyToStore) {
        return json({ error: "global_api_key obrigatório" }, 400);
      }

      if (existing) {
        const { error } = await supaAdmin
          .from("reseller_evolution_config")
          .update({
            server_url: url,
            global_api_key: keyToStore,
            is_configured: true,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supaAdmin
          .from("reseller_evolution_config")
          .insert({
            reseller_id: resellerId,
            server_url: url,
            global_api_key: keyToStore,
            is_configured: true,
          });
        if (error) throw error;
      }

      return json({ ok: true });
    }

    if (action === "test") {
      const { data, error } = await supaAdmin
        .from("reseller_evolution_config")
        .select("server_url, global_api_key")
        .eq("reseller_id", resellerId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.server_url || !data?.global_api_key) {
        return json({ ok: false, error: "Configure URL e API Key antes de testar" }, 400);
      }
      const url = normalizeUrl(data.server_url);

      const tryFetch = async (path: string, withKey: boolean) => {
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (withKey) headers.apikey = data.global_api_key;
          const r = await fetch(`${url}${path}`, { method: "GET", headers });
          const t = await r.text();
          return { ok: true as const, status: r.status, body: t, httpOk: r.ok };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      };

      // Evolution Go expõe /instance/all; Evolution API expõe /instance/fetchInstances.
      // Tentamos os dois e consideramos OK se qualquer um responder 2xx com apikey.
      let success = false;
      let lastStatus = 0;
      let lastBody = "";

      for (const path of ["/instance/all", "/instance/fetchInstances"]) {
        const r = await tryFetch(path, true);
        if (!r.ok) {
          return json({ ok: false, error: `Falha de rede: ${r.error}` }, 200);
        }
        lastStatus = r.status;
        lastBody = r.body;
        if (r.httpOk) { success = true; break; }
        // 401/403 indica chave inválida — não precisa testar o próximo
        if (r.status === 401 || r.status === 403) break;
      }

      if (!success) {
        let msg: string;
        if (lastStatus === 401 || lastStatus === 403) {
          msg = "API Key inválida ou sem permissão";
        } else if (lastStatus === 404) {
          msg = "URL não aponta para uma Evolution API/Evolution Go válida (endpoints /instance/all e /instance/fetchInstances retornaram 404)";
        } else if (lastStatus >= 500) {
          msg = `Servidor com erro interno (${lastStatus})`;
        } else {
          msg = `Servidor respondeu ${lastStatus}: ${lastBody.slice(0, 200)}`;
        }
        return json({ ok: false, status: lastStatus, error: msg }, 200);
      }

      await supaAdmin
        .from("reseller_evolution_config")
        .update({ last_tested_at: new Date().toISOString() })
        .eq("reseller_id", resellerId);
      return json({ ok: true, status: lastStatus });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("[evolution-config] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
