import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { ArrowLeft, MessageCircle, Loader2, RefreshCw, MapPin, ClipboardList, CheckCircle2, AlertCircle, Clock, Scale } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { OrderStatusTracker } from '@/components/order/OrderStatusTracker';
import { useStoreConfig } from '@/hooks/useStore';
import { useOrderWithItems } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { formatAmount, type UnitOfSale } from '@/lib/units';
import { EnablePushBanner } from '@/components/notifications/EnablePushBanner';
import { CustomerNotificationList } from '@/components/notifications/CustomerNotificationList';
import { DriverTrackingCard } from '@/components/order/DriverTrackingCard';
import { DeliveryRatingCard } from '@/components/order/DeliveryRatingCard';

const OrderStatus = () => {
  const slug = useSlug(); const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const basePath = useBasePath(slug);
  const { data: store } = useStoreConfig();
  const { order, items, isLoading, error } = useOrderWithItems(Number(id));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousStatus = useRef<string | null>(null);

  // Apply theme colors dynamically
  useTheme();

  // Subscribe to realtime updates for this specific order
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-status-${id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['order', Number(id)] });
          queryClient.invalidateQueries({ queryKey: ['order-items', Number(id)] });

          const newStatus = (payload.new as any)?.status;
          previousStatus.current = newStatus;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Track initial status
  useEffect(() => {
    if (order?.status && !previousStatus.current) {
      previousStatus.current = order.status;
    }
  }, [order?.status]);

  const formatCurrency = (value: number) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const whatsappLink = store?.phone_whatsapp 
    ? `https://wa.me/55${store.phone_whatsapp}?text=${encodeURIComponent(
        `Olá! Gostaria de saber sobre meu pedido #${id}`
      )}`
    : '#';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['order', Number(id)] });
    await queryClient.invalidateQueries({ queryKey: ['order-items', Number(id)] });
    setIsRefreshing(false);
    toast.success('Pedido atualizado!');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-foreground">Pedido não encontrado</h1>
        <p className="mt-2 text-muted-foreground">Verifique o número do pedido</p>
        <Button onClick={() => navigate(basePath)} className="mt-6">
          Voltar ao Cardápio
        </Button>
      </div>
    );
  }

  const getStatusMessage = () => {
    switch (order.status) {
      case 'pending':
        return 'O restaurante está analisando seu pedido';
      case 'preparing':
        return 'Seu pedido está sendo preparado';
      case 'delivery':
        return 'Seu pedido está a caminho';
      case 'completed':
        return 'Pedido entregue com sucesso!';
      default:
        return 'Acompanhe seu pedido';
    }
  };

  return (
    <>
      <Helmet>
        <title>Pedido #{id} - {store?.name || 'Delivery'}</title>
      </Helmet>

      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-primary">
          <div className="mx-auto max-w-[1200px] flex items-center gap-3 px-4 py-4">
          <Button 
            variant="ghost" 
            size="icon" 
            aria-label="Voltar"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(basePath || '/');
              }
            }}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-primary-foreground">Pedido #{id}</h1>
            <p className="text-xs text-primary-foreground/80">
              {store?.name || 'Restaurante'}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            aria-label="Atualizar status do pedido"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          </div>
        </header>


        <div className="mx-auto max-w-[1200px] p-4 space-y-4">
          {/* Status Card */}
          <section className="rounded-2xl bg-card p-6 shadow-card">
            {(order as any).payment_status && (order as any).payment_provider && (
              <PaymentBanner
                status={(order as any).payment_status}
                onRetry={() => navigate(`${basePath}/payment/${order.id}?provider=${(order as any).payment_provider}&method=${(order as any).payment_method_online || 'pix'}`)}
              />
            )}
            {/* Clipboard illustration */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-24 relative">
                <div className="absolute inset-0 bg-primary/20 rounded-lg border-2 border-primary/40" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-8 h-3 bg-primary/60 rounded-t-md" />
                <div className="absolute top-4 left-3 right-3 space-y-1.5">
                  <div className="h-1.5 bg-primary/30 rounded" />
                  <div className="h-1.5 bg-primary/30 rounded w-3/4" />
                  <div className="h-1.5 bg-primary/30 rounded w-1/2" />
                </div>
                <div className="absolute bottom-3 right-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-xs">✓</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-muted-foreground mb-6">
              {getStatusMessage()}
            </p>

            {/* Status Tracker */}
            <OrderStatusTracker status={order.status} />
          </section>

          {order.restaurant_id && order.customer_phone && (
            <EnablePushBanner
              role="customer"
              restaurantId={order.restaurant_id}
              orderId={order.id}
              customerPhone={order.customer_phone}
              topics={['order_status', 'payment']}
              title="Receber avisos deste pedido"
              description="Notificamos você quando o status mudar."
            />
          )}

          {order.customer_phone && (
            <CustomerNotificationList orderId={order.id} customerPhone={order.customer_phone} />
          )}

          {order.customer_phone && (
            <DriverTrackingCard orderId={order.id} customerPhone={order.customer_phone} />
          )}

          {order.customer_phone && (
            <DeliveryRatingCard
              orderId={order.id}
              customerPhone={order.customer_phone}
              hasDriver={!!(order as any).assigned_driver_id}
              orderStatus={order.status}
            />
          )}





          {/* Order Details */}
          <section className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Detalhes do Pedido</h3>
            </div>
            <div className="space-y-3">
              {items?.map((item: any) => {
                const isWeight = item.unit_of_sale && item.unit_of_sale !== 'un' && item.quantity_grams;
                const isConfirmed = item.weight_status === 'confirmed';
                const isPending = item.weight_status === 'pending';
                const lineTotal = isConfirmed && item.final_unit_price !== null
                  ? Number(item.final_unit_price) * item.quantity
                  : Number(item.unit_price) * item.quantity;

                return (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                        {item.quantity}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{item.product_name}</p>
                        {isWeight && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                            <Scale className="h-3 w-3" />
                            Pedido: {formatAmount(Number(item.quantity_grams), item.unit_of_sale as UnitOfSale)}
                            {isConfirmed && item.final_quantity_grams && (
                              <> · Real: <strong className="text-foreground">{formatAmount(Number(item.final_quantity_grams), item.unit_of_sale as UnitOfSale)}</strong></>
                            )}
                            {isPending && <span className="text-warning font-medium">· valor estimado</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {isConfirmed && Number(item.final_unit_price) !== Number(item.unit_price) ? (
                        <>
                          <p className="text-[11px] text-muted-foreground line-through">
                            {formatCurrency(Number(item.unit_price) * item.quantity)}
                          </p>
                          <p className="text-sm text-primary font-medium">{formatCurrency(lineTotal)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">{formatCurrency(lineTotal)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Delivery Address */}
          <section className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-foreground">Endereço de Entrega</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-7">
              {order.address_street}, {order.address_number} - {order.address_neighborhood}
            </p>
          </section>
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <div className="mx-auto max-w-[1200px]">
            <Button
              variant="whatsapp"
              size="lg"
              className="w-full"
              asChild
            >
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" />
                Falar com o Restaurante
              </a>
            </Button>
          </div>
        </div>

      </div>

    </>
  );
};

function PaymentBanner({ status, onRetry }: { status: string; onRetry: () => void }) {
  if (status === 'paid') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        <span className="flex-1">Pagamento confirmado</span>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-sm text-yellow-700">
        <Clock className="h-4 w-4" />
        <span className="flex-1">Aguardando pagamento online</span>
        <Button size="sm" variant="outline" onClick={onRetry}>Pagar agora</Button>
      </div>
    );
  }
  if (status === 'expired' || status === 'failed') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span className="flex-1">{status === 'expired' ? 'PIX expirado' : 'Pagamento recusado'}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>
      </div>
    );
  }
  return null;
}

export default OrderStatus;
