import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, resellerId, config } = await req.json();
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Verify caller owns this reseller
    const { data: reseller, error: resellerError } = await supabaseAdmin
      .from('resellers')
      .select('id, user_id')
      .eq('id', resellerId)
      .eq('user_id', caller.id)
      .single();

    if (resellerError || !reseller) {
      return new Response(
        JSON.stringify({ error: 'Reseller not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get') {
      // Return MP config with masked secrets
      const { data, error } = await supabaseAdmin
        .from('resellers')
        .select('mp_access_token, mp_public_key, mp_webhook_secret, mp_integration_enabled')
        .eq('id', resellerId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          mp_access_token_set: !!data.mp_access_token,
          mp_access_token_masked: data.mp_access_token 
            ? data.mp_access_token.substring(0, 12) + '...' + data.mp_access_token.slice(-4) 
            : '',
          mp_public_key: data.mp_public_key || '',
          mp_webhook_secret_set: !!data.mp_webhook_secret,
          mp_integration_enabled: data.mp_integration_enabled || false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!config) {
        return new Response(
          JSON.stringify({ error: 'Missing config' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, unknown> = {
        mp_integration_enabled: config.mp_integration_enabled ?? false,
      };

      // Only update secrets if they are provided (non-empty)
      if (config.mp_access_token !== undefined && config.mp_access_token !== '') {
        updateData.mp_access_token = config.mp_access_token;
      }
      if (config.mp_public_key !== undefined) {
        updateData.mp_public_key = config.mp_public_key || null;
      }
      if (config.mp_webhook_secret !== undefined && config.mp_webhook_secret !== '') {
        updateData.mp_webhook_secret = config.mp_webhook_secret;
      }

      // Allow clearing secrets explicitly
      if (config.mp_access_token === null) updateData.mp_access_token = null;
      if (config.mp_webhook_secret === null) updateData.mp_webhook_secret = null;

      const { error } = await supabaseAdmin
        .from('resellers')
        .update(updateData)
        .eq('id', resellerId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('manage-mp-config error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
