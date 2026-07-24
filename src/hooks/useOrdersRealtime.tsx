import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from './useAdminRestaurant';
import { useToast } from '@/hooks/use-toast';
import { useStoreConfig } from './useStore';
import { autoPrintOrder } from '@/lib/autoPrint';
import { loadDepartmentLookups, resolveDepartmentByProduct, DEPARTMENT_LABELS, Department } from '@/lib/departmentRouting';

export function useOrdersRealtime() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  const { toast } = useToast();
  const { data: store } = useStoreConfig();

  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });

          // Show toast for new orders
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            toast({
              title: '🔔 Novo pedido!',
              description: `Pedido #${newOrder.id} de ${newOrder.customer_name}`,
            });

            // Auto-print delivery order — one ticket per department
            try {
              const { data: items } = await supabase
                .from('order_items')
                .select('product_id, product_name, quantity, unit_price, observation, addons_snapshot, pizza_flavors, pizza_border')
                .eq('order_id', newOrder.id);

              const { productMap, categoryMap } = await loadDepartmentLookups(restaurantId);

              const grouped: Record<Department, any[]> = { kitchen: [], bar: [] };
              (items || []).forEach((it: any) => {
                const dep = resolveDepartmentByProduct(it.product_id, productMap, categoryMap);
                grouped[dep].push(it);
              });

              const buildLine = (it: any) => {
                const flavors: any[] = Array.isArray(it.pizza_flavors) ? it.pizza_flavors : [];
                const border = it.pizza_border || null;
                const addons: any[] = Array.isArray(it.addons_snapshot) ? it.addons_snapshot : [];
                const details: string[] = [];
                if (flavors.length) {
                  details.push(`Sabor${flavors.length > 1 ? 'es' : ''}: ${flavors.map((f: any) => f.name).join(' / ')}`);
                }
                if (border?.name) details.push(`Borda: ${border.name}`);
                return {
                  name: it.product_name,
                  quantity: it.quantity,
                  unitPrice: Number(it.unit_price),
                  observation: it.observation || undefined,
                  addons: addons.map((a: any) => ({ label: a.option_name || a.label, price: Number(a.price || 0) })),
                  details: details.length ? details : undefined,
                };
              };

              for (const dep of Object.keys(grouped) as Department[]) {
                const depItems = grouped[dep];
                if (depItems.length === 0) continue;
                await autoPrintOrder({
                  restaurantId,
                  trigger: 'delivery',
                  dedupeId: `${newOrder.id}-${dep}`,
                  data: {
                    orderNumber: newOrder.id,
                    orderType: 'delivery',
                    departmentLabel: DEPARTMENT_LABELS[dep],
                    customerName: newOrder.customer_name,
                    customerPhone: newOrder.customer_phone,
                    address: newOrder.address_street
                      ? {
                          street: newOrder.address_street,
                          number: newOrder.address_number || '',
                          neighborhood: newOrder.address_neighborhood || '',
                          complement: newOrder.address_complement || undefined,
                          reference: newOrder.address_reference || undefined,
                        }
                      : undefined,
                    items: depItems.map(buildLine),
                    subtotal: Number(newOrder.total_amount) - Number(newOrder.delivery_fee || 0),
                    deliveryFee: Number(newOrder.delivery_fee || 0),
                    total: Number(newOrder.total_amount),
                    paymentMethod: newOrder.payment_method,
                    changeFor: newOrder.change_for ? Number(newOrder.change_for) : undefined,
                    createdAt: new Date(newOrder.created_at),
                    storeInfo: {
                      name: store?.name || '',
                      logoUrl: store?.logo_url,
                      address: store?.address,
                      phone: store?.phone_whatsapp,
                    },
                  },
                });
              }
            } catch (err) {
              console.error('[useOrdersRealtime] auto print failed:', err);
            }
          }

          // Show toast for status updates
          if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as { id: number; status: string };
            const oldOrder = payload.old as { status: string };

            if (updatedOrder.status !== oldOrder.status) {
              const statusLabels: Record<string, string> = {
                pending: 'Pendente',
                preparing: 'Em preparo',
                delivery: 'Saiu para entrega',
                completed: 'Finalizado',
                cancelled: 'Cancelado',
              };

              toast({
                title: `Pedido #${updatedOrder.id} atualizado`,
                description: `Status: ${statusLabels[updatedOrder.status] || updatedOrder.status}`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, queryClient, toast, store]);
}
