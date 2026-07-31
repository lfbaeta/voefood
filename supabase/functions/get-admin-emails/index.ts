import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verificar se o chamador é reseller
    const { data: callerReseller, error: resellerError } = await supabaseAdmin
      .from('resellers')
      .select('id')
      .eq('user_id', caller.id)
      .maybeSingle();

    if (resellerError || !callerReseller) {
      console.error('Caller is not a reseller:', resellerError);
      return new Response(
        JSON.stringify({ error: 'Acesso negado - Apenas revendedores podem acessar emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userIds } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ emails: {} }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching emails for user IDs:', userIds);

    // Buscar apenas admins de restaurantes do reseller
    const { data: allowedAdmins } = await supabaseAdmin
      .from('restaurant_admins')
      .select('user_id, restaurants!inner(reseller_id)')
      .in('user_id', userIds);

    // Filtrar apenas os que pertencem ao reseller
    const allowedUserIds = new Set(
      allowedAdmins
        ?.filter((admin: any) => admin.restaurants?.reseller_id === callerReseller.id)
        .map((admin: any) => admin.user_id) || []
    );

    // Fetch users from auth.users
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    // Create a map of user_id -> email (apenas para usuários permitidos)
    const emailMap: Record<string, string> = {};
    
    for (const userId of userIds) {
      // Só retorna email se o usuário é permitido OU se é o próprio reseller
      if (allowedUserIds.has(userId) || userId === caller.id) {
        const user = usersData?.users?.find(u => u.id === userId);
        if (user?.email) {
          emailMap[userId] = user.email;
        }
      }
    }

    console.log('Filtered email map (only allowed users):', Object.keys(emailMap).length, 'emails');

    return new Response(
      JSON.stringify({ emails: emailMap }),
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
