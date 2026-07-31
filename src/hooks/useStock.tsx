import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export type StockUnit = 'un' | 'kg' | 'g' | 'L' | 'ml';

export interface StockItem {
  id: string;
  restaurant_id: string;
  name: string;
  sku: string | null;
  unit: StockUnit;
  category: string | null;
  current_qty: number;
  min_qty: number;
  max_qty: number | null;
  average_cost: number;
  last_cost: number;
  is_active: boolean;
  notes: string | null;
}

export interface Supplier {
  id: string;
  restaurant_id: string;
  name: string;
  document: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface StockMovement {
  id: string;
  restaurant_id: string;
  stock_item_id: string | null;
  product_id: string | null;
  type: 'entrada_compra' | 'saida_venda' | 'ajuste' | 'perda' | 'producao' | 'transferencia';
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  restaurant_id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  purchase_date: string;
  total_amount: number;
  status: 'draft' | 'received' | 'cancelled';
  received_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  stock_item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface ProductRecipe {
  id: string;
  restaurant_id: string;
  product_id: string;
  stock_item_id: string;
  quantity: number;
  unit: StockUnit;
}

// ============ STOCK ITEMS ============
export function useStockItems() {
  const { restaurantId, isLoading } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['stock-items', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from('stock_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as StockItem[];
    },
    enabled: !isLoading && !!restaurantId,
  });
}

export function useUpsertStockItem() {
  const qc = useQueryClient();
  const { restaurantId } = useEffectiveRestaurantId();
  return useMutation({
    mutationFn: async (input: Partial<StockItem> & { name: string }) => {
      const payload = { ...input, restaurant_id: restaurantId };
      const { data, error } = await (supabase as any)
        .from('stock_items')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as StockItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-items'] }),
  });
}

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('stock_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-items'] }),
  });
}

export function useRegisterMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      stock_item_id: string;
      type: 'entrada_compra' | 'ajuste' | 'perda' | 'producao' | 'transferencia';
      quantity: number;
      unit_cost?: number;
      notes?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('register_stock_movement', {
        p_stock_item_id: input.stock_item_id,
        p_type: input.type,
        p_quantity: input.quantity,
        p_unit_cost: input.unit_cost ?? 0,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

// ============ MOVEMENTS ============
export function useStockMovements(limit = 200) {
  const { restaurantId, isLoading } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['stock-movements', restaurantId, limit],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from('stock_movements')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
    enabled: !isLoading && !!restaurantId,
  });
}

// ============ SUPPLIERS ============
export function useSuppliers() {
  const { restaurantId, isLoading } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['suppliers', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from('suppliers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
    enabled: !isLoading && !!restaurantId,
  });
}

export function useUpsertSupplier() {
  const qc = useQueryClient();
  const { restaurantId } = useEffectiveRestaurantId();
  return useMutation({
    mutationFn: async (input: Partial<Supplier> & { name: string }) => {
      const payload = { ...input, restaurant_id: restaurantId };
      const { data, error } = await (supabase as any).from('suppliers').upsert(payload).select().single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

// ============ PURCHASES ============
export function usePurchases() {
  const { restaurantId, isLoading } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['purchases', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from('purchases')
        .select('*, purchase_items(*)')
        .eq('restaurant_id', restaurantId)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Purchase & { purchase_items: PurchaseItem[] })[];
    },
    enabled: !isLoading && !!restaurantId,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  const { restaurantId } = useEffectiveRestaurantId();
  return useMutation({
    mutationFn: async (input: {
      supplier_id?: string | null;
      invoice_number?: string;
      purchase_date: string;
      notes?: string;
      items: { stock_item_id: string; quantity: number; unit_cost: number }[];
    }) => {
      const total = input.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const { data: purchase, error } = await (supabase as any)
        .from('purchases')
        .insert({
          restaurant_id: restaurantId,
          supplier_id: input.supplier_id ?? null,
          invoice_number: input.invoice_number ?? null,
          purchase_date: input.purchase_date,
          total_amount: total,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.items.length) {
        const rows = input.items.map((i) => ({
          purchase_id: purchase.id,
          stock_item_id: i.stock_item_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          total_cost: i.quantity * i.unit_cost,
        }));
        const { error: itErr } = await (supabase as any).from('purchase_items').insert(rows);
        if (itErr) throw itErr;
      }
      return purchase as Purchase;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  });
}

export function useReceivePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('receive_purchase', { p_purchase_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('purchases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  });
}

// ============ RECIPES ============
export function useProductRecipes(productId?: string) {
  const { restaurantId, isLoading } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['product-recipes', restaurantId, productId ?? 'all'],
    queryFn: async () => {
      if (!restaurantId) return [];
      let q = (supabase as any)
        .from('product_recipes')
        .select('*')
        .eq('restaurant_id', restaurantId);
      if (productId) q = q.eq('product_id', productId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProductRecipe[];
    },
    enabled: !isLoading && !!restaurantId,
  });
}

export function useUpsertRecipe() {
  const qc = useQueryClient();
  const { restaurantId } = useEffectiveRestaurantId();
  return useMutation({
    mutationFn: async (input: Omit<ProductRecipe, 'id' | 'restaurant_id'> & { id?: string }) => {
      const payload = { ...input, restaurant_id: restaurantId };
      const { data, error } = await (supabase as any)
        .from('product_recipes')
        .upsert(payload, { onConflict: 'product_id,stock_item_id' })
        .select()
        .single();
      if (error) throw error;
      return data as ProductRecipe;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-recipes'] }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('product_recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-recipes'] }),
  });
}

// ============ LOW STOCK ============
export function useLowStockItems() {
  const { restaurantId, isLoading } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['low-stock', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any).rpc('get_low_stock_items', {
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; current_qty: number; min_qty: number; unit: string }[];
    },
    enabled: !isLoading && !!restaurantId,
  });
}
