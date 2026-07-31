import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-name, x-supabase-client-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Verificar autenticação do chamador
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - Token de autenticação necessário' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente com token do usuário para verificar identidade
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado - Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Caller authenticated:', caller.id);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, restaurantId, isOwner } = await req.json();

    console.log('Creating admin for restaurant:', restaurantId, 'email:', email);

    if (!email || !password || !restaurantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, restaurantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o chamador é super-admin (app_role='admin')
    const { data: isSuperAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle();

    // Verificar se o chamador é reseller
    const { data: callerReseller, error: resellerError } = await supabaseAdmin
      .from('resellers')
      .select('id')
      .eq('user_id', caller.id)
      .maybeSingle();

    if (!isSuperAdmin && (resellerError || !callerReseller)) {
      console.error('Caller is neither super-admin nor reseller:', resellerError);
      return new Response(
        JSON.stringify({ error: 'Acesso negado - Apenas revendedores ou super-admins podem criar admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o restaurante existe
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, reseller_id')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      console.error('Restaurant not found:', restaurantError);
      return new Response(
        JSON.stringify({ error: 'Restaurant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Super-admin pode gerenciar qualquer restaurante; resellers só os próprios
    if (!isSuperAdmin && restaurant.reseller_id !== callerReseller?.id) {
      console.error('Restaurant does not belong to caller reseller');
      return new Response(
        JSON.stringify({ error: 'Acesso negado - Este restaurante não pertence a você' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    console.log('Authorization verified for restaurant:', restaurant.name);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      console.log('User already exists, using existing user:', existingUser.id);
      userId = existingUser.id;
      
      // Check if already admin of this restaurant
      const { data: existingAdmin } = await supabaseAdmin
        .from('restaurant_admins')
        .select('id')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      
      if (existingAdmin) {
        const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        });

        if (updatePasswordError) {
          console.error('Error updating existing admin password:', updatePasswordError);
          return new Response(
            JSON.stringify({ error: `Erro ao atualizar senha: ${updatePasswordError.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            userId,
            adminId: existingAdmin.id,
            message: 'Administrador já existia; senha atualizada com sucesso',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });

      if (updatePasswordError) {
        console.error('Error updating existing user password:', updatePasswordError);
        return new Response(
          JSON.stringify({ error: `Erro ao atualizar senha: ${updatePasswordError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new user
      console.log('Creating new user');
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
      });

      if (createUserError) {
        console.error('Error creating user:', createUserError);
        return new Response(
          JSON.stringify({ error: `Erro ao criar usuário: ${createUserError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      console.log('User created:', userId);
    }

    // Add user as restaurant admin
    const { data: adminRecord, error: adminError } = await supabaseAdmin
      .from('restaurant_admins')
      .insert({
        user_id: userId,
        restaurant_id: restaurantId,
        is_owner: isOwner || false,
      })
      .select()
      .single();

    if (adminError) {
      console.error('Error creating admin record:', adminError);
      return new Response(
        JSON.stringify({ error: `Erro ao vincular administrador: ${adminError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin created successfully:', adminRecord);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        adminId: adminRecord.id,
        message: 'Administrador criado com sucesso',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
