import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CheckoutRequest {
  resellerId: string;
  planId: string;
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  businessType?: string;
}

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { resellerId, planId, name, email, phone, businessName, businessType }: CheckoutRequest = await req.json();

    if (!resellerId || !planId || !name || !email) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: resellerId, planId, name, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating checkout for lead:', { resellerId, planId, name, email });

    // Get reseller's Mercado Pago credentials
    const { data: reseller, error: resellerError } = await supabaseClient
      .from('resellers')
      .select('id, mp_access_token, mp_integration_enabled, company_name, name')
      .eq('id', resellerId)
      .single();

    if (resellerError || !reseller) {
      return new Response(
        JSON.stringify({ error: 'Revendedor não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reseller.mp_integration_enabled || !reseller.mp_access_token) {
      return new Response(
        JSON.stringify({ error: 'Integração com Mercado Pago não configurada para este revendedor' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('id, name, monthly_fee, setup_fee, trial_days, description')
      .eq('id', planId)
      .eq('reseller_id', resellerId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update lead record
    const { data: existingLead } = await supabaseClient
      .from('landing_page_leads')
      .select('id')
      .eq('email', email)
      .eq('reseller_id', resellerId)
      .single();

    let leadId: string;

    if (existingLead) {
      await supabaseClient
        .from('landing_page_leads')
        .update({
          name, phone,
          business_name: businessName,
          business_type: businessType,
          plan_id: planId,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLead.id);
      leadId = existingLead.id;
    } else {
      const { data: newLead, error: insertError } = await supabaseClient
        .from('landing_page_leads')
        .insert({
          reseller_id: resellerId,
          plan_id: planId,
          name, email, phone,
          business_name: businessName,
          business_type: businessType,
          status: 'pending'
        })
        .select('id')
        .single();

      if (insertError || !newLead) {
        return new Response(
          JSON.stringify({ error: 'Erro ao criar lead' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      leadId = newLead.id;
    }

    const setupFee = plan.setup_fee || 0;
    const monthlyFee = plan.monthly_fee || 0;
    const totalAmount = setupFee + monthlyFee;

    if (totalAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valor do plano inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine back_url from request referer or published domain
    const referer = req.headers.get('referer') || req.headers.get('origin') || '';
    const backUrlBase = referer ? new URL(referer).origin : 'https://documentacaodewl.lovable.app';

    const preferenceData = {
      items: [
        {
          id: plan.id,
          title: `Assinatura ${plan.name}`,
          description: plan.description || `Plano ${plan.name} - ${reseller.company_name || reseller.name}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: totalAmount
        }
      ],
      payer: {
        name,
        email,
        phone: phone ? { number: phone.replace(/\D/g, '') } : undefined
      },
      external_reference: `lead_${leadId}`,
      back_urls: {
        success: `${backUrlBase}/?payment=success&lead=${leadId}`,
        failure: `${backUrlBase}/?payment=failure&lead=${leadId}`,
        pending: `${backUrlBase}/?payment=pending&lead=${leadId}`
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      statement_descriptor: (reseller.company_name || reseller.name || 'Assinatura').substring(0, 22),
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    console.log('Creating Mercado Pago preference:', JSON.stringify(preferenceData, null, 2));

    const mpResult = await safeMpFetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${reseller.mp_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceData)
    });

    console.log('Mercado Pago response:', JSON.stringify(mpResult.data, null, 2));

    if (!mpResult.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar pagamento no Mercado Pago', 
          details: mpResult.data.message || mpResult.data.error 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabaseClient
      .from('landing_page_leads')
      .update({
        mp_payment_id: mpResult.data.id,
        mp_payment_status: 'pending',
        notes: `Preferência criada: ${mpResult.data.id}`
      })
      .eq('id', leadId);

    return new Response(
      JSON.stringify({
        success: true,
        leadId,
        preferenceId: mpResult.data.id,
        initPoint: mpResult.data.init_point,
        sandboxInitPoint: mpResult.data.sandbox_init_point,
        totalAmount,
        planName: plan.name
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