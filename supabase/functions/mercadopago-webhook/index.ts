import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// HMAC signature verification for Mercado Pago webhooks
async function verifyWebhookSignature(
  supabaseClient: any,
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string
): Promise<boolean> {
  if (!xSignature || !xRequestId) {
    console.error('Missing signature headers - rejecting unsigned webhook');
    return false;
  }

  try {
    const signatureParts = xSignature.split(',');
    const timestampPart = signatureParts.find(p => p.startsWith('ts='));
    const hashPart = signatureParts.find(p => p.startsWith('v1='));
    
    if (!timestampPart || !hashPart) {
      console.error('Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedHash = hashPart.split('=')[1];

    // Check timestamp freshness (15 minutes)
    const webhookTime = parseInt(timestamp) * 1000;
    const now = Date.now();
    if (now - webhookTime > 15 * 60 * 1000) {
      console.error('Webhook timestamp too old');
      return false;
    }

    const { data: resellers, error } = await supabaseClient
      .from('resellers')
      .select('mp_webhook_secret')
      .eq('mp_integration_enabled', true)
      .not('mp_webhook_secret', 'is', null);

    if (error || !resellers || resellers.length === 0) {
      console.error('No resellers with webhook secrets configured - rejecting');
      return false;
    }

    for (const reseller of resellers) {
      if (!reseller.mp_webhook_secret) continue;
      const manifestString = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;
      const expectedHash = createHmac('sha256', reseller.mp_webhook_secret)
        .update(manifestString)
        .digest('hex');

      if (expectedHash === receivedHash) {
        console.log('Webhook signature verified successfully');
        return true;
      }
    }

    console.error('No matching webhook secret found for signature');
    return false;
  } catch (err) {
    console.error('Error verifying webhook signature:', err);
    return false;
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

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const { type, data } = body;

    if (!type || !data?.id) {
      return new Response(
        JSON.stringify({ message: 'Invalid payload' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify webhook signature
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    
    const isValidSignature = await verifyWebhookSignature(
      supabaseClient, xSignature, xRequestId, data.id.toString()
    );

    if (!isValidSignature) {
      console.error('Invalid webhook signature - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'subscription_preapproval') {
      await handleSubscriptionEvent(supabaseClient, data.id);
    }
    if (type === 'payment') {
      await handlePaymentEvent(supabaseClient, data.id);
    }
    if (type === 'merchant_order') {
      await handleMerchantOrderEvent(supabaseClient, data.id);
    }

    return new Response(
      JSON.stringify({ message: 'Webhook processed successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSubscriptionEvent(supabaseClient: any, subscriptionId: string) {
  console.log('Processing subscription event:', subscriptionId);

  const { data: restaurant, error: restaurantError } = await supabaseClient
    .from('restaurants')
    .select('id, reseller_id, mp_subscription_id')
    .eq('mp_subscription_id', subscriptionId)
    .single();

  if (restaurantError || !restaurant) {
    console.error('Restaurant not found for subscription:', subscriptionId);
    return;
  }

  const { data: reseller } = await supabaseClient
    .from('resellers')
    .select('mp_access_token')
    .eq('id', restaurant.reseller_id)
    .single();

  if (!reseller?.mp_access_token) {
    console.error('Reseller or access token not found');
    return;
  }

  const mpResult = await safeMpFetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
    headers: { 'Authorization': `Bearer ${reseller.mp_access_token}` }
  });

  if (!mpResult.ok) {
    console.error('Failed to fetch subscription from MP');
    return;
  }

  const subscription = mpResult.data;
  let subscriptionStatus: string;
  let isActive = true;

  switch (subscription.status) {
    case 'authorized': subscriptionStatus = 'active'; isActive = true; break;
    case 'paused': subscriptionStatus = 'suspended'; isActive = false; break;
    case 'cancelled': subscriptionStatus = 'cancelled'; isActive = false; break;
    case 'pending': subscriptionStatus = 'trial'; isActive = true; break;
    default: subscriptionStatus = 'suspended'; isActive = false;
  }

  await supabaseClient
    .from('restaurants')
    .update({ subscription_status: subscriptionStatus, is_active: isActive, mp_subscription_status: subscription.status })
    .eq('id', restaurant.id);

  console.log(`Restaurant ${restaurant.id} updated: status=${subscriptionStatus}, active=${isActive}`);
}

async function handlePaymentEvent(supabaseClient: any, paymentId: string) {
  console.log('Processing payment event:', paymentId);

  const { data: existingPayment } = await supabaseClient
    .from('subscription_payments')
    .select('id')
    .eq('mp_payment_id', paymentId)
    .single();

  if (existingPayment) {
    console.log('Payment already processed');
    return;
  }

  const { data: resellers } = await supabaseClient
    .from('resellers')
    .select('id, mp_access_token')
    .eq('mp_integration_enabled', true)
    .not('mp_access_token', 'is', null);

  if (!resellers || resellers.length === 0) return;

  for (const reseller of resellers) {
    const mpResult = await safeMpFetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${reseller.mp_access_token}` }
    });

    if (!mpResult.ok) continue;

    const payment = mpResult.data;
    const externalReference = payment.external_reference || '';

    if (externalReference.startsWith('lead_')) {
      await handleLeadPayment(supabaseClient, payment, externalReference.replace('lead_', ''));
      break;
    }

    const { data: restaurant } = await supabaseClient
      .from('restaurants')
      .select('id, reseller_id')
      .eq('id', externalReference)
      .single();

    if (!restaurant) continue;

    let paymentStatus: string;
    switch (payment.status) {
      case 'approved': paymentStatus = 'paid'; break;
      case 'pending': case 'in_process': paymentStatus = 'pending'; break;
      case 'rejected': case 'cancelled': paymentStatus = 'cancelled'; break;
      default: paymentStatus = 'pending';
    }

    await supabaseClient
      .from('subscription_payments')
      .insert({
        restaurant_id: restaurant.id,
        amount: payment.transaction_amount,
        payment_date: payment.status === 'approved' ? payment.date_approved : null,
        due_date: payment.date_created,
        status: paymentStatus,
        payment_method: payment.payment_method_id,
        mp_payment_id: paymentId,
        mp_external_reference: payment.external_reference,
        notes: `Pagamento automático via Mercado Pago`
      });

    if (payment.status === 'approved') {
      await supabaseClient
        .from('restaurants')
        .update({ subscription_status: 'active', is_active: true })
        .eq('id', restaurant.id);
    }

    break;
  }
}

async function handleLeadPayment(supabaseClient: any, payment: any, leadId: string) {
  console.log('Processing lead payment:', leadId, payment.status);

  const leadUpdate: any = {
    mp_payment_id: payment.id?.toString(),
    mp_payment_status: payment.status,
    updated_at: new Date().toISOString()
  };

  if (payment.status === 'approved') {
    leadUpdate.status = 'converted';
    leadUpdate.notes = `Pagamento aprovado em ${new Date().toLocaleString('pt-BR')}. Método: ${payment.payment_method_id}`;
  } else if (payment.status === 'pending' || payment.status === 'in_process') {
    leadUpdate.status = 'pending';
    leadUpdate.notes = `Pagamento pendente. Método: ${payment.payment_method_id}`;
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    leadUpdate.status = 'lost';
    leadUpdate.notes = `Pagamento ${payment.status}.`;
  }

  await supabaseClient
    .from('landing_page_leads')
    .update(leadUpdate)
    .eq('id', leadId);

  if (payment.status === 'approved') {
    await createRestaurantFromLead(supabaseClient, leadId, payment);
  }
}

async function createRestaurantFromLead(supabaseClient: any, leadId: string, payment: any) {
  console.log('Auto-creating restaurant from lead:', leadId);

  try {
    const { data: lead, error: leadError } = await supabaseClient
      .from('landing_page_leads')
      .select('*, subscription_plans(*)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return;
    }

    // Validate payment amount matches plan price (setup_fee for initial payment)
    const plan = lead.subscription_plans;
    if (plan) {
      const expectedAmount = plan.setup_fee || plan.monthly_fee || 0;
      if (expectedAmount > 0 && payment.transaction_amount !== undefined) {
        const tolerance = 0.01;
        if (Math.abs(payment.transaction_amount - expectedAmount) > tolerance) {
          console.error(`Payment amount mismatch: expected ${expectedAmount}, got ${payment.transaction_amount}`);
          await supabaseClient.from('landing_page_leads')
            .update({ notes: `${lead.notes || ''}\nPagamento rejeitado: valor incorreto (esperado: ${expectedAmount}, recebido: ${payment.transaction_amount})`, updated_at: new Date().toISOString() })
            .eq('id', leadId);
          return;
        }
      }
    }

    const { data: existingRestaurant } = await supabaseClient
      .from('restaurants')
      .select('id')
      .eq('contact_email', lead.email)
      .eq('reseller_id', lead.reseller_id)
      .maybeSingle();

    if (existingRestaurant) {
      console.log('Restaurant already exists for this email:', existingRestaurant.id);
      await supabaseClient
        .from('landing_page_leads')
        .update({ notes: `${lead.notes || ''}\nRestaurante já existente: ${existingRestaurant.id}`, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      return;
    }

    const baseSlug = (lead.business_name || lead.name || 'restaurante')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let slugCounter = 1;
    let slugExists = true;
    while (slugExists) {
      const { data: existingSlug } = await supabaseClient
        .from('restaurants').select('id').eq('slug', slug).maybeSingle();
      if (!existingSlug) slugExists = false;
      else { slug = `${baseSlug}-${slugCounter}`; slugCounter++; }
    }

    const trialDays = plan?.trial_days || 14;
    const monthlyFee = plan?.monthly_fee || 0;
    const setupFee = plan?.setup_fee || 0;

    const subscriptionStartDate = new Date().toISOString();
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + trialDays);

    const { data: restaurant, error: restaurantError } = await supabaseClient
      .from('restaurants')
      .insert({
        name: lead.business_name || lead.name,
        slug, reseller_id: lead.reseller_id, plan_id: lead.plan_id,
        owner_name: lead.name, contact_email: lead.email, phone: lead.phone,
        monthly_fee: monthlyFee, setup_fee: setupFee, trial_days: trialDays,
        subscription_status: 'active', subscription_start_date: subscriptionStartDate,
        subscription_end_date: subscriptionEndDate.toISOString(), is_active: true
      })
      .select().single();

    if (restaurantError) {
      console.error('Error creating restaurant:', restaurantError);
      await supabaseClient.from('landing_page_leads')
        .update({ notes: `${lead.notes || ''}\nErro ao criar restaurante.`, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      return;
    }

    console.log('Restaurant created:', restaurant.id);

    await supabaseClient.from('store_config').insert({
      restaurant_id: restaurant.id, name: restaurant.name,
      phone_whatsapp: lead.phone, is_open: true
    });

    const businessHours = [];
    for (let day = 0; day <= 6; day++) {
      businessHours.push({
        restaurant_id: restaurant.id, day_of_week: day,
        open_time: '08:00', close_time: '22:00',
        is_active: day >= 1 && day <= 5
      });
    }
    await supabaseClient.from('business_hours').insert(businessHours);

    const tempPassword = generateTempPassword();
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === lead.email);

    let userId: string;
    let userCreated = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createUserError } = await supabaseClient.auth.admin.createUser({
        email: lead.email, password: tempPassword, email_confirm: true
      });

      if (createUserError) {
        console.error('Error creating user:', createUserError);
        await supabaseClient.from('landing_page_leads')
          .update({ notes: `${lead.notes || ''}\nRestaurante criado (${restaurant.id}), mas erro ao criar usuário.`, updated_at: new Date().toISOString() })
          .eq('id', leadId);
        return;
      }
      userId = newUser.user.id;
      userCreated = true;
    }

    await supabaseClient.from('restaurant_admins').insert({
      user_id: userId, restaurant_id: restaurant.id, is_owner: true
    });

    // Send password reset email instead of storing temp password in notes
    if (userCreated) {
      const { error: resetError } = await supabaseClient.auth.admin.generateLink({
        type: 'recovery',
        email: lead.email,
      });
      if (resetError) {
        console.error('Failed to send password reset email:', resetError);
      }
    }

    const successNote = userCreated
      ? `Restaurante criado automaticamente!\nID: ${restaurant.id}\nSlug: ${slug}\nEmail de redefinição de senha enviado.`
      : `Restaurante criado automaticamente!\nID: ${restaurant.id}\nSlug: ${slug}\n(Usuário já existia)`;

    await supabaseClient.from('landing_page_leads')
      .update({ notes: `${lead.notes || ''}\n\n${successNote}`, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    console.log('Restaurant creation complete:', { restaurantId: restaurant.id, slug, userId, userCreated });

  } catch (error) {
    console.error('Unexpected error in createRestaurantFromLead:', error);
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function handleMerchantOrderEvent(supabaseClient: any, orderId: string) {
  console.log('Processing merchant order event:', orderId);

  const { data: resellers } = await supabaseClient
    .from('resellers')
    .select('id, mp_access_token')
    .eq('mp_integration_enabled', true)
    .not('mp_access_token', 'is', null);

  if (!resellers || resellers.length === 0) return;

  for (const reseller of resellers) {
    const mpResult = await safeMpFetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${reseller.mp_access_token}` }
    });

    if (!mpResult.ok) continue;

    const order = mpResult.data;
    const externalReference = order.external_reference || '';

    if (externalReference.startsWith('lead_') && order.payments?.length > 0) {
      for (const payment of order.payments) {
        if (payment.status === 'approved') {
          const paymentResult = await safeMpFetch(`https://api.mercadopago.com/v1/payments/${payment.id}`, {
            headers: { 'Authorization': `Bearer ${reseller.mp_access_token}` }
          });
          if (paymentResult.ok) {
            await handleLeadPayment(supabaseClient, paymentResult.data, externalReference.replace('lead_', ''));
          }
        }
      }
    }
    break;
  }
}
