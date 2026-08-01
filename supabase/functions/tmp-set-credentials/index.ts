import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { userId, email, password } = await req.json();
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    email,
    password,
    email_confirm: true,
  });
  return new Response(JSON.stringify({ ok: !error, error: error?.message, id: data?.user?.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
