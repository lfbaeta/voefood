import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from './useAdminRestaurant';

export interface NotificationRow {
  id: string;
  restaurant_id: string;
  audience: 'staff' | 'customer';
  event_type: string;
  title: string;
  body: string;
  url: string | null;
  order_id: number | null;
  table_order_id: number | null;
  customer_phone: string | null;
  data: any;
  read_at: string | null;
  created_at: string;
}

// ---------- STAFF ----------

export function useStaffNotifications(limit = 50) {
  const { restaurantId } = useAdminRestaurant();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', 'staff', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('audience', 'staff')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`notif-staff-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', 'staff', restaurantId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, queryClient]);

  return query;
}

export function useMarkStaffNotificationRead() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'staff', restaurantId] });
    },
  });
}

export function useMarkAllStaffNotificationsRead() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  return useMutation({
    mutationFn: async () => {
      if (!restaurantId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId)
        .eq('audience', 'staff')
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'staff', restaurantId] });
    },
  });
}

// ---------- CUSTOMER ----------

export function useCustomerNotifications(orderId?: number, customerPhone?: string | null) {
  const queryClient = useQueryClient();
  const enabled = !!orderId && !!customerPhone;

  const query = useQuery({
    queryKey: ['notifications', 'customer', orderId, customerPhone],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_customer_notifications', {
        p_order_id: orderId!,
        p_customer_phone: customerPhone!,
      });
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`notif-customer-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', 'customer', orderId, customerPhone] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, customerPhone, queryClient]);

  return query;
}

export function useMarkCustomerNotificationRead(orderId?: number, customerPhone?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!orderId || !customerPhone) return;
      const { error } = await supabase.rpc('mark_customer_notification_read', {
        p_notification_id: id,
        p_order_id: orderId,
        p_customer_phone: customerPhone,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'customer', orderId, customerPhone] });
    },
  });
}

export function useMarkAllCustomerNotificationsRead(orderId?: number, customerPhone?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!orderId || !customerPhone) return;
      const { error } = await supabase.rpc('mark_customer_notifications_all_read', {
        p_order_id: orderId,
        p_customer_phone: customerPhone,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'customer', orderId, customerPhone] });
    },
  });
}
