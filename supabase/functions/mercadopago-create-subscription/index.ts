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

    // Verify authentication
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
    const { restaurantId, payerEmail, resellerId } = await req.json();

    if (!restaurantId || !payerEmail || !resellerId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: restaurantId, payerEmail, resellerId' }),
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

    // Get reseller's Mercado Pago credentials
    const { data: reseller, error: resellerError } = await supabaseClient
      .from('resellers')
      .select('mp_access_token, mp_integration_enabled')
      .eq('id', resellerId)
      .single();

    if (resellerError || !reseller) {
      return new Response(
        JSON.stringify({ error: 'Reseller not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reseller.mp_integration_enabled || !reseller.mp_access_token) {
      return new Response(
        JSON.stringify({ error: 'Mercado Pago integration not configured for this reseller' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify restaurant belongs to this reseller
    const { data: restaurant, error: restaurantError } = await supabaseClient
      .from('restaurants')
      .select('id, name, monthly_fee, slug, reseller_id')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      return new Response(
        JSON.stringify({ error: 'Restaurant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (restaurant.reseller_id !== resellerId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Restaurant does not belong to this reseller' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine back_url from request referer or published domain
    const referer = req.headers.get('referer') || req.headers.get('origin') || '';
    const backUrlBase = referer ? new URL(referer).origin : 'https://documentacaodewl.lovable.app';

    const subscriptionData = {
      reason: `Assinatura - ${restaurant.name}`,
      external_reference: restaurant.id,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: Number(restaurant.monthly_fee),
        currency_id: 'BRL'
      },
      back_url: `${backUrlBase}/reseller/restaurants/${restaurant.id}`,
      status: 'pending'
    };

    console.log('Creating Mercado Pago subscription:', subscriptionData);

    const mpResult = await safeMpFetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${reseller.mp_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });

    console.log('Mercado Pago response:', mpResult.data);

    if (!mpResult.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription in Mercado Pago', details: mpResult.data }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update restaurant with subscription info
    const { error: updateError } = await supabaseClient
      .from('restaurants')
      .update({
        mp_subscription_id: mpResult.data.id,
        mp_payer_email: payerEmail,
        mp_init_point: mpResult.data.init_point,
        mp_subscription_status: mpResult.data.status
      })
      .eq('id', restaurantId);

    if (updateError) {
      console.error('Error updating restaurant:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update restaurant with subscription info' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: mpResult.data.id,
        initPoint: mpResult.data.init_point,
        status: mpResult.data.status
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