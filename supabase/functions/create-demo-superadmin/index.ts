import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// One-shot idempotent provisioning of a demo super-admin (app_role='admin')
// that also has admin access to the existing "Restaurante Seu Zé" demo restaurant.
// Safe to re-run: if the auth user already exists, we do NOT reset its password.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Auth: caller must already be a super-admin (app_role='admin')
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await authed.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userRes.user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const email = 'demo@peddi.online';
    const password = 'DemoPeddi2026!';
    const demoRestaurantSlug = 'restaurante-seu-ze';

    // 1) Find demo restaurant
    const { data: restaurant, error: rErr } = await admin
      .from('restaurants')
      .select('id, slug, name, reseller_id')
      .eq('slug', demoRestaurantSlug)
      .maybeSingle();
    if (rErr) throw new Error('lookup restaurant: ' + rErr.message);
    if (!restaurant) {
      return new Response(
        JSON.stringify({ error: 'demo restaurant not found (expected slug=restaurante-seu-ze)' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2) Ensure auth user
    let userId: string;
    let created = false;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) {
      userId = existing.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error('createUser: ' + error.message);
      userId = data.user!.id;
      created = true;
    }

    // 3) Grant app_role='admin' (super admin)
    const { error: roleErr } = await admin
      .from('user_roles')
      .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });
    if (roleErr) throw new Error('grant admin role: ' + roleErr.message);

    // 3b) Ensure reseller record so demo user can access /reseller dashboard
    const { data: existingReseller } = await admin
      .from('resellers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!existingReseller) {
      const { error: resErr } = await admin.from('resellers').insert({
        user_id: userId,
        name: 'Demo Super Admin',
        email,
        company_name: 'Peddi Demo',
        is_active: true,
      });
      if (resErr) throw new Error('create reseller: ' + resErr.message);
    }

    // 4) Link as restaurant admin (owner) of the demo restaurant so /admin works
    const { data: existingLink } = await admin
      .from('restaurant_admins')
      .select('id')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurant.id)
      .maybeSingle();
    if (!existingLink) {
      const { error: linkErr } = await admin.from('restaurant_admins').insert({
        user_id: userId,
        restaurant_id: restaurant.id,
        is_owner: true,
      });
      if (linkErr) throw new Error('restaurant_admin link: ' + linkErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        credentials: { email, password: created ? password : '(unchanged — user already existed)' },
        restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
        access: {
          admin_panel: `https://${restaurant.slug}.peddi.online/admin`,
          storefront: `https://${restaurant.slug}.peddi.online/`,
          login: `https://${restaurant.slug}.peddi.online/auth`,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('create-demo-superadmin error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
