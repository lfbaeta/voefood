import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-name, x-supabase-client-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { userId, newPassword, restaurantId } = await req.json();

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'userId e newPassword são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o chamador é super-admin
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
        JSON.stringify({ error: 'Acesso negado - Apenas revendedores ou super-admins podem resetar senhas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isSuperAdmin) {
      // Verificar se o usuário alvo é admin de um restaurante do reseller
      let targetAdminQuery = supabaseAdmin
        .from('restaurant_admins')
        .select('restaurant_id')
        .eq('user_id', userId);

      if (restaurantId) {
        targetAdminQuery = targetAdminQuery.eq('restaurant_id', restaurantId);
      }

      const { data: targetAdmins, error: targetAdminError } = await targetAdminQuery;

      if (targetAdminError) {
        console.error('Error loading target admin links:', targetAdminError);
        return new Response(
          JSON.stringify({ error: 'Erro ao verificar vínculo do usuário' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (targetAdmins && targetAdmins.length > 0) {
        const restaurantIds = targetAdmins.map((admin) => admin.restaurant_id);
        const { data: restaurants } = await supabaseAdmin
          .from('restaurants')
          .select('reseller_id')
          .in('id', restaurantIds);

        const ownsTargetRestaurant = restaurants?.some(
          (restaurant) => restaurant.reseller_id === callerReseller!.id
        );

        if (!ownsTargetRestaurant) {
          console.error('Target user restaurant does not belong to caller reseller');
          return new Response(
            JSON.stringify({ error: 'Acesso negado - Você não tem permissão para este usuário' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Usuário não encontrado ou sem vínculo com restaurante' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


    console.log('Authorization verified. Updating password for user:', userId);

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error('Error updating password:', error);
      throw new Error(error.message);
    }

    console.log('Password updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Senha atualizada com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Reset password error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
