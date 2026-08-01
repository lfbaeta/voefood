import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const body = await req.json();
  if (body.lookup) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = (data?.users ?? []).filter((u) => u.email === body.lookup);
    return new Response(JSON.stringify({ found: found.map((u) => ({ id: u.id, email: u.email })) }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { userId, email, password } = body;
  const payload: Record<string, unknown> = { password, email_confirm: true };
  if (email) payload.email = email;
  const { data, error } = await admin.auth.admin.updateUserById(userId, payload);
  return new Response(
    JSON.stringify({ ok: !error, error: error ? JSON.stringify(error) : null, id: data?.user?.id }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
