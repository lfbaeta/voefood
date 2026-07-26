import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH = 25;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: due, error } = await supa.rpc("claim_due_bot_debounce", { p_limit: BATCH });

    if (error) {
      console.error("[debounce-tick] select", error);
      return new Response(JSON.stringify({ error: "select_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const items = due ?? [];
    if (items.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let processed = 0;
    for (const it of items) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-bot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ conversation_id: it.conversation_id }),
        });
        const text = await res.text();
        if (!res.ok) {
          console.error("[debounce-tick] whatsapp-bot failed", it.conversation_id, res.status, text.slice(0, 800));
        } else {
          try {
            const body = text ? JSON.parse(text) : null;
            if (body?.skipped || body?.sent === false || body?.error) {
              console.warn("[debounce-tick] whatsapp-bot result", it.conversation_id, JSON.stringify(body).slice(0, 800));
            }
          } catch {
            if (text) console.warn("[debounce-tick] whatsapp-bot non-json result", it.conversation_id, text.slice(0, 800));
          }
        }
        processed++;
      } catch (e) {
        console.error("[debounce-tick] invoke fail", it.conversation_id, e);
      }
    }
    return new Response(JSON.stringify({ ok: true, processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[debounce-tick] fatal", e);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});