import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/fiscalCors.ts';

// Best-effort ASN.1 scan to find the certificate's notAfter date without
// requiring node-forge. If parsing fails, we still store the certificate and
// return expires_at = null so the UI can show a warning.
function tryExtractExpiry(base64: string): string | null {
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dates: Date[] = [];
    for (let i = 0; i < bytes.length - 15; i++) {
      // UTCTime tag 0x17, length 0x0D (13 bytes: YYMMDDHHMMSSZ)
      if (bytes[i] === 0x17 && bytes[i + 1] === 0x0d) {
        const s = new TextDecoder().decode(bytes.slice(i + 2, i + 15));
        if (/^\d{12}Z$/.test(s)) {
          const yy = parseInt(s.slice(0, 2), 10);
          const year = yy >= 50 ? 1900 + yy : 2000 + yy;
          const d = new Date(Date.UTC(
            year,
            parseInt(s.slice(2, 4), 10) - 1,
            parseInt(s.slice(4, 6), 10),
            parseInt(s.slice(6, 8), 10),
            parseInt(s.slice(8, 10), 10),
            parseInt(s.slice(10, 12), 10),
          ));
          if (!isNaN(d.getTime())) dates.push(d);
        }
      }
      // GeneralizedTime tag 0x18, length 0x0F (15 bytes: YYYYMMDDHHMMSSZ)
      if (bytes[i] === 0x18 && bytes[i + 1] === 0x0f) {
        const s = new TextDecoder().decode(bytes.slice(i + 2, i + 17));
        if (/^\d{14}Z$/.test(s)) {
          const d = new Date(Date.UTC(
            parseInt(s.slice(0, 4), 10),
            parseInt(s.slice(4, 6), 10) - 1,
            parseInt(s.slice(6, 8), 10),
            parseInt(s.slice(8, 10), 10),
            parseInt(s.slice(10, 12), 10),
            parseInt(s.slice(12, 14), 10),
          ));
          if (!isNaN(d.getTime())) dates.push(d);
        }
      }
    }
    if (dates.length === 0) return null;
    // notAfter is typically the largest future-ish date in the file
    const future = dates.filter((d) => d.getTime() > Date.now() - 365 * 24 * 3600 * 1000);
    const pick = (future.length ? future : dates).sort((a, b) => b.getTime() - a.getTime())[0];
    return pick.toISOString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const restaurant_id: string | undefined = body?.restaurant_id;
    const filename: string | undefined = body?.filename;
    const certificate_base64: string | undefined = body?.certificate_base64;
    const password: string | undefined = body?.password;

    if (!restaurant_id || !filename || !certificate_base64 || !password) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (certificate_base64.length > 900_000) {
      return new Response(JSON.stringify({ error: 'Certificate too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/\.(pfx|p12)$/i.test(filename)) {
      return new Response(JSON.stringify({ error: 'Envie um arquivo .pfx ou .p12' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await admin.rpc('is_admin_of_restaurant', {
      _user_id: userId, _restaurant_id: restaurant_id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = 'fiscal';
    const [{ data: certEnc, error: e1 }, { data: pwdEnc, error: e2 }] = await Promise.all([
      admin.rpc('encrypt_ai_credential', { p_key: key, p_plain: certificate_base64 }),
      admin.rpc('encrypt_ai_credential', { p_key: key, p_plain: password }),
    ]);
    if (e1 || e2 || !certEnc || !pwdEnc) {
      throw new Error('Falha ao criptografar');
    }

    const expiresAt = tryExtractExpiry(certificate_base64);

    const { error: upErr } = await admin
      .from('fiscal_config')
      .upsert({
        restaurant_id,
        certificado_cipher: certEnc,
        certificado_password_cipher: pwdEnc,
        certificado_filename: filename,
        certificado_uploaded_at: new Date().toISOString(),
        certificado_expires_at: expiresAt,
      }, { onConflict: 'restaurant_id' });
    if (upErr) throw upErr;

    await admin.from('fiscal_events').insert({
      restaurant_id,
      event_type: 'upload_certificate',
      user_id: userId,
      payload: { filename, expires_at: expiresAt, size_b64: certificate_base64.length },
    });

    return new Response(JSON.stringify({ ok: true, expires_at: expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fiscal-upload-certificate error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
