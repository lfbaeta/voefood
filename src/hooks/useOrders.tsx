import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from './useAdminRestaurant';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_complement: string | null;
  address_reference: string | null;
  total_amount: number;
  status: 'pending' | 'preparing' | 'delivery' | 'completed' | 'cancelled';
  payment_method: 'money' | 'card' | 'pix';
  change_for: number | null;
  created_at: string;
  updated_at: string;
  restaurant_id?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  observation: string | null;
  unit_of_sale?: 'un' | 'kg' | 'g' | 'L' | 'ml';
  quantity_grams?: number | null;
  final_quantity_grams?: number | null;
  final_unit_price?: number | null;
  weight_status?: 'fixed' | 'pending' | 'confirmed';
}

export interface CreateOrderData {
  customer_name: string;
  customer_phone: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_complement?: string | null;
  address_reference?: string | null;
  total_amount: number;
  payment_method: 'money' | 'card' | 'pix';
  change_for?: number | null;
  restaurant_id?: string | null;
  convenience_fee?: number | null;
}

export interface CreateOrderItemData {
  order_id: number;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  observation?: string | null;
  unit_of_sale?: 'un' | 'kg' | 'g' | 'L' | 'ml';
  quantity_grams?: number | null;
  addons_snapshot?: Array<{ label: string; price: number }> | null;
  pizza_flavors?: Array<{ name: string; price: number }> | null;
  pizza_border?: { name: string; price: number } | null;
}

export function useOrders() {
  const { restaurantId } = useAdminRestaurant();

  return useQuery({
    queryKey: ['orders', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!restaurantId,
  });
}

export function useOrderItems(orderId: number) {
  return useQuery({
    queryKey: ['order-items', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!orderId,
  });
}

export function useOrderWithItems(orderId: number) {
  const { restaurantId, isLoading: idLoading } = useEffectiveRestaurantId();

  const orderQuery = useQuery({
    queryKey: ['order', orderId, restaurantId],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('id', orderId);
      
      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data as Order;
    },
    enabled: !!orderId && !idLoading,
  });

  const itemsQuery = useOrderItems(orderId);

  return {
    order: orderQuery.data,
    items: itemsQuery.data,
    isLoading: orderQuery.isLoading || itemsQuery.isLoading,
    error: orderQuery.error || itemsQuery.error,
  };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { restaurantId, isLoading: idLoading, slug } = useEffectiveRestaurantId();

  return useMutation({
    mutationFn: async ({ order, items }: { order: CreateOrderData; items: Omit<CreateOrderItemData, 'order_id'>[] }) => {
      if (idLoading) {
        throw new Error('Carregando informações do restaurante. Tente novamente.');
      }

      const effectiveId = order.restaurant_id || restaurantId;
      
      if (!effectiveId) {
        if (slug) {
          throw new Error(`Restaurante "${slug}" não encontrado. Verifique se o endereço está correto.`);
        } else {
          throw new Error('Nenhum restaurante configurado. Acesse o sistema pelo link correto do restaurante.');
        }
      }

      const { data: newOrderId, error: rpcError } = await supabase.rpc('create_customer_order', {
        p_restaurant_id: effectiveId,
        p_customer_name: order.customer_name,
        p_customer_phone: order.customer_phone,
        p_address_street: order.address_street ?? '',
        p_address_number: order.address_number ?? '',
        p_address_neighborhood: order.address_neighborhood ?? '',
        p_address_complement: order.address_complement ?? null,
        p_address_reference: order.address_reference ?? null,
        p_total_amount: order.total_amount,
        p_payment_method: order.payment_method,
        p_change_for: order.change_for ?? null,
        p_convenience_fee: order.convenience_fee ?? 0,
        p_items: items.map(item => ({
          product_id: (item as any).product_id ?? null,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          observation: item.observation || '',
          unit_of_sale: item.unit_of_sale || 'un',
          quantity_grams: item.quantity_grams ?? null,
          addons_snapshot: item.addons_snapshot ?? null,
          pizza_flavors: item.pizza_flavors ?? null,
          pizza_border: item.pizza_border ?? null,
        })),
      } as any);

      if (rpcError) {
        if ((rpcError.message || '').includes('store_closed')) {
          throw new Error('A loja está fechada no momento e não está recebendo pedidos.');
        }
        throw rpcError;
      }

      // Fire-and-forget push notification to staff about the new order.
      supabase.functions.invoke('notify-event', {
        body: { event: 'new_order', order_id: newOrderId },
      }).catch((e) => console.warn('[notify-event new_order]', e));

      return { id: newOrderId, restaurant_id: effectiveId } as unknown as Order;

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: Order['status'] }) => {
      if (!restaurantId) {
        throw new Error('Restaurant ID não encontrado');
      }

      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('restaurant_id')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;
      if (existingOrder.restaurant_id !== restaurantId) {
        throw new Error('Unauthorized: Order does not belong to this restaurant');
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) throw error;

      // Fire-and-forget push to the customer about the new status.
      supabase.functions.invoke('notify-event', {
        body: { event: 'order_status', order_id: orderId },
      }).catch((e) => console.warn('[notify-event order_status]', e));

      return data as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
