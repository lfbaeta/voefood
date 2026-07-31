import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// One-shot helper to provision a demo reseller + demo restaurant + restaurant admin.
// Idempotent: if records exist, reuses them.
//
// SECURITY: this function creates auth users and links them to restaurants using the
// service role. It MUST only be callable by a super-admin (app_role = 'admin').
// Without this check, any anonymous visitor could reset demo passwords, or worse,
// hijack an existing restaurant by passing its slug.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate caller: must be authenticated AND have app_role = 'admin'
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isSuper } = await userClient.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (isSuper !== true) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const resellerEmail: string = body.resellerEmail || 'demo.reseller@servenahora.com';
    const restaurantAdminEmail: string = body.adminEmail || 'demo.admin@servenahora.com';
    const resellerSlug: string = body.resellerSlug || 'demo';
    const restaurantSlug: string = body.restaurantSlug || 'restaurante-demo';
    const restaurantName: string = body.restaurantName || 'Restaurante Demo';
    const resellerName: string = body.resellerName || 'Revendedor Demo';
    const companyName: string = body.companyName || 'Demo Showcase';

    // Passwords must be provided by the caller. We never fall back to a hardcoded default
    // so a leaked/known default cannot be used to log into demo accounts.
    const resellerPassword: string | undefined = body.resellerPassword;
    const restaurantAdminPassword: string | undefined = body.adminPassword;
    if (!resellerPassword || !restaurantAdminPassword) {
      return new Response(JSON.stringify({ error: 'resellerPassword and adminPassword are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resellerPassword.length < 10 || restaurantAdminPassword.length < 10) {
      return new Response(JSON.stringify({ error: 'passwords must be at least 10 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    async function ensureUser(email: string, password: string) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === email);
      if (existing) {
        await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        return existing.id;
      }
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw new Error('createUser: ' + error.message);
      return data.user!.id;
    }

    // 1) Reseller user + record
    const resellerUserId = await ensureUser(resellerEmail, resellerPassword);

    let { data: reseller } = await admin
      .from('resellers')
      .select('*')
      .eq('user_id', resellerUserId)
      .maybeSingle();

    if (!reseller) {
      const { data, error } = await admin
        .from('resellers')
        .insert({
          user_id: resellerUserId,
          name: resellerName,
          email: resellerEmail,
          company_name: companyName,
          slug: resellerSlug,
          is_active: true,
          landing_page_enabled: false,
        })
        .select()
        .single();
      if (error) throw new Error('reseller insert: ' + error.message);
      reseller = data;
    }

    // 2) Restaurant tied to that reseller.
    // If a restaurant with the given slug already exists AND belongs to a different reseller,
    // ABORT — never silently reassign ownership.
    let { data: restaurant } = await admin
      .from('restaurants')
      .select('*')
      .eq('slug', restaurantSlug)
      .maybeSingle();

    if (!restaurant) {
      const { data, error } = await admin
        .from('restaurants')
        .insert({
          reseller_id: reseller!.id,
          slug: restaurantSlug,
          name: restaurantName,
          is_active: true,
          subscription_status: 'active',
          monthly_fee: 0,
          trial_days: 0,
          owner_name: 'Demo Admin',
          contact_email: restaurantAdminEmail,
        })
        .select()
        .single();
      if (error) throw new Error('restaurant insert: ' + error.message);
      restaurant = data;
    } else if (restaurant.reseller_id !== reseller!.id) {
      return new Response(
        JSON.stringify({
          error: 'restaurant slug already belongs to another reseller — refusing to reassign',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3) Restaurant admin user + link
    const adminUserId = await ensureUser(restaurantAdminEmail, restaurantAdminPassword);

    const { data: existingLink } = await admin
      .from('restaurant_admins')
      .select('id')
      .eq('user_id', adminUserId)
      .eq('restaurant_id', restaurant!.id)
      .maybeSingle();

    if (!existingLink) {
      const { error } = await admin.from('restaurant_admins').insert({
        user_id: adminUserId,
        restaurant_id: restaurant!.id,
        is_owner: true,
      });
      if (error) throw new Error('admin link: ' + error.message);
    }

    // 4) Minimal store_config so the storefront works
    const { data: cfg } = await admin
      .from('store_config')
      .select('id')
      .eq('restaurant_id', restaurant!.id)
      .maybeSingle();
    if (!cfg) {
      await admin.from('store_config').insert({
        restaurant_id: restaurant!.id,
        name: restaurantName,
        is_open: true,
        delivery_fee: 0,
        delivery_fee_mode: 'fixed',
        min_order_value: 0,
        delivery_time_min: 30,
        delivery_time_max: 45,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        reseller: { id: reseller!.id, email: resellerEmail, slug: reseller!.slug },
        restaurant: { id: restaurant!.id, slug: restaurant!.slug, name: restaurant!.name },
        restaurantAdmin: { email: restaurantAdminEmail },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('setup-demo-account error', e);
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
