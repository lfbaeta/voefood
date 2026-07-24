import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ENHANCE_PROMPT =
  "Subtly enhance this real food/product photograph so it looks like a well-taken photo — NOT a CGI render, NOT a 3D model, NOT a stock image. " +
  "CRITICAL REALISM RULES: keep the photo looking like a REAL PHOTOGRAPH of the SAME real food. " +
  "Preserve exactly: the same ingredients, same portions, same plate/container, same composition, same camera angle, same imperfections (crumbs, sauce drips, uneven edges, natural asymmetry). " +
  "Do NOT smooth, polish, or 'perfect' the food. Do NOT make it look glossy, waxy, plastic, rubbery, or artificially shiny. Do NOT add fake steam, fake garnishes, fake ingredients, or extra items. Do NOT restyle or re-plate the food. Do NOT change proportions or shapes. " +
  "Only gently improve: exposure and white balance (make it look naturally lit, not overexposed), slight increase in sharpness and detail on real textures already present, mild noise reduction, and — only if the current background is distracting/messy — replace it with a simple, softly out-of-focus neutral surface (plain wood, linen, or matte tabletop) that matches the original lighting direction. " +
  "The final image must still clearly look like an amateur-friendly, honest, appetizing REAL photo of the exact same dish — just cleaner and better lit. If in doubt, change less.";


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function urlToBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
  const mime = res.headers.get('content-type') || 'image/jpeg';
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, mime };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await authed.auth.getUser();
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const restaurant_id: string = String(body.restaurant_id || '');
    const image_url: string | undefined = body.image_url ? String(body.image_url) : undefined;
    const image_base64: string | undefined = body.image_base64 ? String(body.image_base64) : undefined;
    const image_mime: string = String(body.image_mime || 'image/jpeg');

    if (!restaurant_id) return json({ error: 'restaurant_id required' }, 400);
    if (!image_url && !image_base64) return json({ error: 'image required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isAdminRestaurant } = await admin.rpc('is_admin_of_restaurant', {
      _user_id: userId, _restaurant_id: restaurant_id,
    });
    if (!isAdminRestaurant) return json({ error: 'forbidden' }, 403);

    // Cota
    const { data: quotaRows, error: quotaErr } = await admin.rpc('get_ai_enhancement_quota', {
      p_restaurant_id: restaurant_id,
    });
    if (quotaErr) {
      console.error('quota rpc failed', quotaErr);
      return json({ error: 'internal' }, 500);
    }
    const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
    if (!quota || (quota.remaining ?? 0) <= 0) {
      return json({
        error: 'quota_exceeded',
        used: quota?.used ?? 0,
        quota: quota?.quota ?? 0,
        remaining: 0,
      }, 429);
    }

    // Busca chave OpenAI global (cadastrada pelo super admin)
    const { data: globalCfg } = await admin
      .from('global_ai_config')
      .select('openai_api_key')
      .eq('id', true)
      .maybeSingle();
    const OPENAI_API_KEY = globalCfg?.openai_api_key;
    if (!OPENAI_API_KEY) {
      return json({
        error: 'ai_not_configured',
        message: 'O super admin ainda não cadastrou a chave da OpenAI. Configure em Configurações do Reseller.',
      }, 503);
    }

    // Prepara imagem (bytes + mime)
    let imgBytes: Uint8Array;
    let imgMime: string;
    if (image_base64) {
      imgBytes = b64ToBytes(image_base64);
      imgMime = image_mime;
    } else {
      const r = await urlToBytes(image_url!);
      imgBytes = r.bytes;
      imgMime = r.mime;
    }

    // Chama OpenAI Images Edit (gpt-image-1) via multipart/form-data
    const ext = imgMime.includes('png') ? 'png' : imgMime.includes('webp') ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', ENHANCE_PROMPT);
    form.append('size', '1024x1024');
    form.append('quality', 'medium'); // qualidade padrão (fixa)
    form.append('n', '1');
    form.append('image', new Blob([imgBytes], { type: imgMime }), `input.${ext}`);

    const gwRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      console.error('openai failed', gwRes.status, errText);
      await admin.from('ai_image_enhancements').insert({
        restaurant_id, user_id: userId, original_url: image_url ?? null,
        prompt_used: ENHANCE_PROMPT, status: 'failed',
        error_message: `openai ${gwRes.status}`,
      });
      if (gwRes.status === 401) return json({ error: 'invalid_api_key', message: 'Chave da OpenAI inválida. Contate o super admin.' }, 502);
      if (gwRes.status === 429) return json({ error: 'rate_limited', message: 'Limite de requisições da OpenAI atingido. Tente novamente em instantes.' }, 429);
      if (gwRes.status === 402 || errText.includes('insufficient_quota')) {
        return json({ error: 'ai_credits_exhausted', message: 'Créditos da OpenAI esgotados. Contate o super admin.' }, 402);
      }
      return json({ error: 'ai_generation_failed', details: errText.slice(0, 500) }, 502);
    }

    const gwJson = await gwRes.json();
    const outB64: string | undefined = gwJson?.data?.[0]?.b64_json;
    if (!outB64) {
      console.error('no image in openai response', JSON.stringify(gwJson).slice(0, 500));
      await admin.from('ai_image_enhancements').insert({
        restaurant_id, user_id: userId, original_url: image_url ?? null,
        prompt_used: ENHANCE_PROMPT, status: 'failed',
        error_message: 'no image in response',
      });
      return json({ error: 'no_image_returned' }, 502);
    }

    // Upload PNG para bucket enhanced-images
    const bytes = b64ToBytes(outB64);
    const filename = `${restaurant_id}/${crypto.randomUUID()}.png`;
    const { error: upErr } = await admin.storage
      .from('enhanced-images')
      .upload(filename, bytes, { contentType: 'image/png', upsert: false });
    if (upErr) {
      console.error('upload failed', upErr);
      return json({ error: 'upload_failed' }, 500);
    }

    const { data: signed } = await admin.storage
      .from('enhanced-images')
      .createSignedUrl(filename, 60 * 60 * 24);

    const enhanced_url = signed?.signedUrl ?? null;

    await admin.from('ai_image_enhancements').insert({
      restaurant_id, user_id: userId,
      original_url: image_url ?? null,
      enhanced_url: filename,
      prompt_used: ENHANCE_PROMPT,
      status: 'success',
    });

    const { data: quotaRows2 } = await admin.rpc('get_ai_enhancement_quota', {
      p_restaurant_id: restaurant_id,
    });
    const q2 = Array.isArray(quotaRows2) ? quotaRows2[0] : quotaRows2;

    return json({
      enhanced_url,
      storage_path: filename,
      quota: { used: q2?.used ?? 0, quota: q2?.quota ?? 0, remaining: q2?.remaining ?? 0 },
    });
  } catch (e: any) {
    console.error('enhance-product-image error', e);
    return json({ error: 'internal' }, 500);
  }
});
