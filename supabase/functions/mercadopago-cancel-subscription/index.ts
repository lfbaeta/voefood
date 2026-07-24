import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function safeMpFetch(url: string, options: RequestInit): Promise<{ data: any; ok: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const contentType = response.headers.get('Content-Type') || '';
    
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON response from Mercado Pago:', text.substring(0, 500));
      data = { error: 'Mercado Pago returned non-JSON response', status: response.status };
    }
    
    return { data, ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Authentication required' }),
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
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const { restaurantId, resellerId } = await req.json();

    if (!restaurantId || !resellerId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: restaurantId, resellerId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is the reseller owner
    const { data: callerReseller } = await supabaseClient
      .from('resellers')
      .select('id')
      .eq('user_id', caller.id)
      .eq('id', resellerId)
      .maybeSingle();

    if (!callerReseller) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Not authorized for this reseller' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: reseller } = await supabaseClient
      .from('resellers')
      .select('mp_access_token')
      .eq('id', resellerId)
      .single();

    if (!reseller?.mp_access_token) {
      return new Response(
        JSON.stringify({ error: 'Reseller not found or MP not configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: restaurant } = await supabaseClient
      .from('restaurants')
      .select('mp_subscription_id, reseller_id')
      .eq('id', restaurantId)
      .single();

    if (!restaurant?.mp_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Restaurant not found or no subscription' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (restaurant.reseller_id !== resellerId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Restaurant does not belong to this reseller' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpResult = await safeMpFetch(
      `https://api.mercadopago.com/preapproval/${restaurant.mp_subscription_id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${reseller.mp_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'cancelled' })
      }
    );

    console.log('Mercado Pago cancel response:', mpResult.data);

    if (!mpResult.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to cancel subscription', details: mpResult.data }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabaseClient
      .from('restaurants')
      .update({
        subscription_status: 'cancelled',
        is_active: false,
        mp_subscription_status: 'cancelled'
      })
      .eq('id', restaurantId);

    return new Response(
      JSON.stringify({ success: true, message: 'Subscription cancelled' }),
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