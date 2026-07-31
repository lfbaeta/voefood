// Server-side OG renderer for restaurant menus.
// Social crawlers (WhatsApp, Facebook, Twitter, etc.) don't execute JS,
// so this function returns static HTML with per-restaurant OG tags and
// redirects real browsers to the SPA menu route.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_UA = /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|preview|fetch|skype|embed|pinterest/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractSlug(req: Request): string | null {
  const url = new URL(req.url);
  // Support both /functions/v1/menu-share/<slug> and ?slug=<slug>
  const qp = url.searchParams.get("slug");
  if (qp) return qp.trim();
  const parts = url.pathname.split("/").filter(Boolean);
  // Last segment after "menu-share"
  const idx = parts.lastIndexOf("menu-share");
  if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  return null;
}

function getOrigin(req: Request): string {
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (fwdHost && !fwdHost.includes("supabase.co")) {
    return `${proto}://${fwdHost}`;
  }
  // Fallback to production domain
  return "https://yavoxbrasildelivery.com.br";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const slug = extractSlug(req);
    const origin = getOrigin(req);
    const ua = req.headers.get("user-agent") || "";
    const isBot = BOT_UA.test(ua);

    if (!slug) {
      return new Response("Missing slug", { status: 400, headers: corsHeaders });
    }

    // URL pública do restaurante: subdomínio em produção, /r/:slug em preview.
    const originUrl = new URL(origin);
    const isPreviewOrigin =
      originUrl.hostname === "localhost" ||
      originUrl.hostname.startsWith("id-preview--") ||
      originUrl.hostname.endsWith(".lovableproject.com");
    const menuUrl = isPreviewOrigin
      ? `${origin}/r/${encodeURIComponent(slug)}`
      : `${originUrl.protocol}//${encodeURIComponent(slug)}.${originUrl.hostname}`;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Resolve restaurant_id from slug
    const { data: restaurantId, error: rErr } = await supabase.rpc(
      "get_restaurant_id_by_slug",
      { p_slug: slug }
    );

    // Defaults if we cannot resolve the store (fall back to "Cardápio Digital").
    const BUSINESS_TAGLINES: Record<string, string> = {
      restaurant: "Cardápio Digital",
      pharmacy: "Farmácia Digital",
      market: "Mercado Online",
      butcher: "Açougue Digital",
      bakery: "Padaria Digital",
      petshop: "Pet Shop Online",
      custom: "Catálogo Digital",
    };

    let tagline = "Cardápio Digital";
    let title = tagline;
    let description = "Peça online de forma rápida e fácil.";
    let image = `${origin}/placeholder.svg`;

    if (!rErr && restaurantId) {
      const { data: storeRows } = await supabase.rpc("get_public_store_config", {
        p_restaurant_id: restaurantId,
      });
      const store = Array.isArray(storeRows) ? storeRows[0] : storeRows;
      if (store) {
        const name = store.name || title;
        const businessType = (store as any).business_type || "restaurant";
        const labels = (store as any).menu_labels || {};
        tagline =
          (typeof labels.heroTagline === "string" && labels.heroTagline.trim()) ||
          BUSINESS_TAGLINES[businessType] ||
          BUSINESS_TAGLINES.restaurant;
        title = `${name} - ${tagline}`;
        description = `Peça online no ${name}. ${tagline} com entrega rápida.`;
        if (store.logo_url) image = store.logo_url;
        else if (store.cover_url) image = store.cover_url;
      }
    }

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(menuUrl)}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(title)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(menuUrl)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:secure_url" content="${escapeHtml(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<meta http-equiv="refresh" content="0; url=${escapeHtml(menuUrl)}" />
<script>window.location.replace(${JSON.stringify(menuUrl)});</script>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#fff;text-align:center;padding:24px}a{color:#60a5fa}</style>
</head>
<body>
<div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>Abrindo cardápio... <a href="${escapeHtml(menuUrl)}">Clique aqui se não for redirecionado.</a></p>
</div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": isBot
          ? "public, max-age=300, s-maxage=600"
          : "public, max-age=60",
      },
    });
  } catch (e) {
    console.error("menu-share error", e);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
