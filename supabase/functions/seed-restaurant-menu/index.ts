import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SeedProduct {
  name: string;
  description?: string;
  price: number;
  unit_of_sale?: string;
  price_per_kg?: number | null;
  brand?: string | null;
}
interface SeedCategory {
  name: string;
  icon?: string | null;
  department?: 'kitchen' | 'bar' | null;
  products: SeedProduct[];
}

/**
 * Popula um restaurante recém-criado com categorias e produtos de exemplo
 * baseados no tipo de estabelecimento. Idempotente: não duplica se já existir
 * pelo menos 1 categoria.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return json({ error: 'unauthorized' }, 401);
    }

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: userRes } = await authed.auth.getUser();
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const restaurantId: string | undefined = body?.restaurantId;
    const seeds: SeedCategory[] | undefined = body?.seeds;
    if (!restaurantId || !Array.isArray(seeds) || seeds.length === 0) {
      return json({ error: 'invalid_payload' }, 400);
    }

    // Autorização: precisa ser admin do restaurante ou super admin
    const { data: isSuper } = await admin.rpc('has_role', { _user_id: userRes.user.id, _role: 'admin' });
    let allowed = !!isSuper;
    if (!allowed) {
      const { data: resList } = await admin
        .from('restaurants').select('id, reseller_id').eq('id', restaurantId).maybeSingle();
      if (resList?.reseller_id) {
        const { data: reseller } = await admin
          .from('resellers').select('user_id').eq('id', resList.reseller_id).maybeSingle();
        if (reseller?.user_id === userRes.user.id) allowed = true;
      }
    }
    if (!allowed) return json({ error: 'forbidden' }, 403);

    // Idempotência: se já tiver categorias, não popula
    const { count: existingCount } = await admin
      .from('categories').select('id', { head: true, count: 'exact' }).eq('restaurant_id', restaurantId);
    if ((existingCount ?? 0) > 0) {
      return json({ ok: true, skipped: 'already_populated', existing: existingCount });
    }

    let insertedCategories = 0;
    let insertedProducts = 0;

    for (let i = 0; i < seeds.length; i++) {
      const cat = seeds[i];
      const { data: catRow, error: catErr } = await admin
        .from('categories')
        .insert({
          restaurant_id: restaurantId,
          name: cat.name,
          display_order: i,
          is_active: true,
          department: cat.department || null,
        } as any)
        .select('id')
        .single();
      if (catErr || !catRow) continue;
      insertedCategories++;

      for (let j = 0; j < cat.products.length; j++) {
        const p = cat.products[j];
        const { error: prodErr } = await admin.from('products').insert({
          restaurant_id: restaurantId,
          category_id: catRow.id,
          name: p.name,
          description: p.description || null,
          price: p.price,
          unit_of_sale: p.unit_of_sale || 'unit',
          price_per_kg: p.price_per_kg ?? null,
          brand: p.brand ?? null,
          is_active: true,
          display_order: j,
        } as any);
        if (!prodErr) insertedProducts++;
      }
    }

    return json({ ok: true, insertedCategories, insertedProducts });
  } catch (e) {
    console.error('seed-restaurant-menu error', e);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
