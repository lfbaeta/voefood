import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verificar se é o primeiro reseller (setup inicial) ou se há autenticação
    const { count: resellerCount } = await supabaseAdmin
      .from('resellers')
      .select('*', { count: 'exact', head: true });

    const isFirstReseller = !resellerCount || resellerCount === 0;

    // Se não é o primeiro reseller, exigir autenticação de admin/superadmin
    if (!isFirstReseller) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Não autorizado - Apenas o setup inicial pode criar revendedores sem autenticação' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !caller) {
        return new Response(
          JSON.stringify({ error: 'Não autorizado - Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se caller é um reseller existente (para criar sub-resellers no futuro)
      const { data: existingReseller } = await supabaseAdmin
        .from('resellers')
        .select('id')
        .eq('user_id', caller.id)
        .maybeSingle();

      if (!existingReseller) {
        return new Response(
          JSON.stringify({ error: 'Acesso negado - Apenas revendedores podem criar novos revendedores' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { name, email, password, companyName, phone } = await req.json();

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Nome, email e senha são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Creating new reseller user:', email, isFirstReseller ? '(first reseller - setup)' : '(authorized creation)');

    // Create user in Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError) {
      console.error('Error creating user:', userError);
      throw new Error(userError.message);
    }

    if (!userData.user) {
      throw new Error('Erro ao criar usuário');
    }

    console.log('User created successfully:', userData.user.id);

    // Create reseller record
    const { data: resellerData, error: resellerError } = await supabaseAdmin
      .from('resellers')
      .insert({
        user_id: userData.user.id,
        name,
        email,
        phone: phone || null,
        company_name: companyName || null,
        is_active: true,
      })
      .select()
      .single();

    if (resellerError) {
      console.error('Error creating reseller:', resellerError);
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      throw new Error('Erro ao criar registro de revendedor');
    }

    console.log('Reseller created successfully:', resellerData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Revendedor criado com sucesso',
        resellerId: resellerData.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Create reseller error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request', code: 'INTERNAL_ERROR' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
