import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Calendar, TrendingUp, Package, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useStoreConfig } from '@/hooks/useStore';
import { useOrders, useUpdateOrderStatus, Order } from '@/hooks/useOrders';
import { useOrdersRealtime } from '@/hooks/useOrdersRealtime';
import { useAdminRestaurant } from '@/hooks/useAdminRestaurant';
import { EnablePushBanner } from '@/components/notifications/EnablePushBanner';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { DraggableOrderCard } from '@/components/orders/DraggableOrderCard';
import { DroppableColumn } from '@/components/orders/DroppableColumn';
import { OrderStatsPanel } from '@/components/orders/OrderStatsPanel';
import { OrderCharts } from '@/components/orders/OrderCharts';
import { OrderCardContent } from '@/components/orders/OrderCardContent';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

type DateFilter = 'today' | 'week' | 'month' | 'all';
type OrderStatus = 'pending' | 'preparing' | 'delivery' | 'completed';

const columns: { id: OrderStatus; label: string; color: string }[] = [
  { id: 'pending', label: 'Pendentes', color: 'bg-warning/10' },
  { id: 'preparing', label: 'Em Preparo', color: 'bg-primary/10' },
  { id: 'delivery', label: 'Saiu p/ Entrega', color: 'bg-secondary/10' },
  { id: 'completed', label: 'Finalizados', color: 'bg-green-500/10' },
];

const formatCurrency = (value: number) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AdminOrders = () => {
  const { data: store } = useStoreConfig();
  const { data: orders, isLoading } = useOrders();
  const { restaurantId } = useAdminRestaurant();
  const updateStatus = useUpdateOrderStatus();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousPendingCount = useRef<number>(0);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'stats'>(() => {
    return (localStorage.getItem('orders_view_mode') as 'kanban' | 'list' | 'stats') || 'kanban';
  });
  useEffect(() => {
    localStorage.setItem('orders_view_mode', viewMode);
  }, [viewMode]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useOrdersRealtime();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    if (!orders) return;
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    if (pendingCount > previousPendingCount.current && previousPendingCount.current !== 0) {
      audioRef.current?.play().catch(() => {});
    }
    previousPendingCount.current = pendingCount;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const now = new Date();
    let start: Date, end: Date;
    switch (dateFilter) {
      case 'today': start = startOfDay(now); end = endOfDay(now); break;
      case 'week': start = startOfWeek(now, { locale: ptBR }); end = endOfWeek(now, { locale: ptBR }); break;
      case 'month': start = startOfMonth(now); end = endOfMonth(now); break;
      case 'all': return orders;
    }
    return orders.filter(order => isWithinInterval(new Date(order.created_at), { start, end }));
  }, [orders, dateFilter]);

  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const completedOrders = filteredOrders.filter(o => o.status === 'completed').length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalOrders, totalRevenue, completedOrders, avgOrderValue };
  }, [filteredOrders]);

  const ordersOverTime = useMemo(() => {
    if (!orders) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStr = format(date, 'yyyy-MM-dd');
      return {
        date: format(date, 'dd/MM'),
        pedidos: orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr).length,
        receita: orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr).reduce((sum, o) => sum + Number(o.total_amount), 0),
      };
    });
  }, [orders]);

  const paymentDistribution = useMemo(() => {
    const methods = { pix: 0, money: 0, card: 0 };
    filteredOrders.forEach(o => {
      if (methods[o.payment_method as keyof typeof methods] !== undefined) {
        methods[o.payment_method as keyof typeof methods]++;
      }
    });
    return [
      { name: 'PIX', value: methods.pix, color: '#00BFFF' },
      { name: 'Dinheiro', value: methods.money, color: '#32CD32' },
      { name: 'Cartão', value: methods.card, color: '#9370DB' },
    ].filter(item => item.value > 0);
  }, [filteredOrders]);

  const statusDistribution = useMemo(() => {
    return columns.map(col => ({
      name: col.label,
      quantidade: filteredOrders.filter(o => o.status === col.id).length,
    }));
  }, [filteredOrders]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveOrder((event.active.data.current as any)?.order as Order);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);
    if (!over) return;
    const orderId = parseInt(active.id as string);
    const newStatus = over.id as OrderStatus;
    const order = filteredOrders.find(o => o.id === orderId);
    if (order && order.status !== newStatus) {
      updateStatus.mutate({ orderId, status: newStatus });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Pedidos">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Pedidos">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      {restaurantId && (
        <div className="mb-4">
          <EnablePushBanner
            role="staff"
            restaurantId={restaurantId}
            topics={['new_order', 'payment']}
            title="Ativar notificações de novos pedidos"
            description="Alerta no celular mesmo com o navegador fechado."
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">

        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-[120px] sm:w-40">
            <Calendar className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1 sm:gap-2 ml-auto">
          <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')} className="px-2 sm:px-3" title="Blocos (Kanban)">
            <Package className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Blocos</span>
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className="px-2 sm:px-3" title="Lista (linhas)">
            <List className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Lista</span>
          </Button>
          <Button variant={viewMode === 'stats' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('stats')} className="px-2 sm:px-3">
            <TrendingUp className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Estatísticas</span>
          </Button>
        </div>
      </div>

      <OrderStatsPanel stats={stats} formatCurrency={formatCurrency} />

      {viewMode === 'stats' && (
        <OrderCharts
          ordersOverTime={ordersOverTime}
          paymentDistribution={paymentDistribution}
          statusDistribution={statusDistribution}
          formatCurrency={formatCurrency}
        />
      )}

      {viewMode === 'list' && (
        <div className="space-y-6">
          {columns.map((column) => {
            const columnOrders = filteredOrders.filter(o => o.status === column.id);
            return (
              <div key={column.id} className={`rounded-xl ${column.color} p-3 sm:p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">{column.label}</h3>
                  <span className="text-xs sm:text-sm text-muted-foreground">{columnOrders.length}</span>
                </div>
                {columnOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">Nenhum pedido</p>
                ) : (
                  <div className="divide-y divide-border rounded-lg bg-card">
                    {columnOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="font-bold text-foreground w-14 flex-shrink-0">#{order.id}</span>
                        <span className="flex-1 min-w-0 truncate text-sm text-foreground">{order.customer_name}</span>
                        <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[180px]">
                          {order.address_neighborhood || '—'}
                        </span>
                        <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                          {order.payment_method === 'pix' ? 'PIX' : order.payment_method === 'money' ? 'Dinheiro' : 'Cartão'}
                        </span>
                        <span className="font-semibold text-foreground whitespace-nowrap text-sm">
                          {formatCurrency(Number(order.total_amount))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'kanban' && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
            {columns.map((column) => {
              const columnOrders = filteredOrders.filter(o => o.status === column.id);
              return (
                <DroppableColumn key={column.id} id={column.id} color={column.color} label={column.label} count={columnOrders.length}>
                  {columnOrders.map((order) => (
                    <DraggableOrderCard key={order.id} order={order} store={store} onOpenDetails={setSelectedOrder} />
                  ))}
                  {columnOrders.length === 0 && (
                    <div className="py-8 sm:py-12 text-center">
                      <p className="text-muted-foreground text-sm">Nenhum pedido</p>
                    </div>
                  )}
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeOrder && (
              <div className="opacity-90">
                <OrderCardContent order={activeOrder} store={store} onOpenDetails={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <OrderDetailModal order={selectedOrder} open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)} />
    </AdminLayout>
  );
};

export default AdminOrders;
