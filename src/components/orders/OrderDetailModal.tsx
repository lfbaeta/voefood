import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, User, CreditCard, Clock, Printer, RefreshCw, Scale } from 'lucide-react';
import { useOrderItems, Order, type OrderItem } from '@/hooks/useOrders';
import { useStoreConfig } from '@/hooks/useStore';
import { PrintReceiptButton } from '@/components/pdv/PrintReceiptButton';
import { OrderWhatsAppButton } from '@/components/orders/OrderWhatsAppButton';
import { WeightAdjustModal } from '@/components/orders/WeightAdjustModal';
import { PrintOrderData } from '@/utils/thermalPrinter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { formatAmount, type UnitOfSale } from '@/lib/units';
import { FiscalInvoiceCard } from '@/components/admin/FiscalInvoiceCard';
import { OrderDriverAssign } from '@/components/orders/OrderDriverAssign';

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-primary/20 text-primary' },
  preparing: { label: 'Em Preparo', color: 'bg-blue-100 text-blue-800' },
  delivery: { label: 'Saiu p/ Entrega', color: 'bg-purple-100 text-purple-800' },
  completed: { label: 'Finalizado', color: 'bg-secondary/20 text-secondary' },
};

const paymentConfig: Record<string, { label: string; icon: string }> = {
  pix: { label: 'PIX', icon: '💠' },
  money: { label: 'Dinheiro', icon: '💵' },
  card: { label: 'Cartão', icon: '💳' },
};

export function OrderDetailModal({ order, open, onOpenChange }: OrderDetailModalProps) {
  const { data: items } = useOrderItems(order?.id ?? null);
  const { data: store } = useStoreConfig();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<OrderItem | null>(null);

  const hasPendingWeight = items?.some((i: any) => i.weight_status === 'pending');
  const hasWeightItems = items?.some((i: any) => i.weight_status && i.weight_status !== 'fixed');

  const paymentStatus = (order as any)?.payment_status as string | undefined;
  const paymentProvider = (order as any)?.payment_provider as string | undefined;

  const handleCheckPayment = async () => {
    if (!order) return;
    setChecking(true);
    const { data, error } = await supabase.functions.invoke('check-order-payment', { body: { order_id: order.id } });
    setChecking(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro ao verificar', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    const s = (data as any)?.status;
    toast({ title: 'Status atualizado', description: `Pagamento: ${s}` });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const formatCurrency = (value: number) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getPrintData = (): PrintOrderData | null => {
    if (!order || !items) return null;
    
    return {
      orderNumber: order.id,
      orderType: 'delivery',
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      address: {
        street: order.address_street,
        number: order.address_number,
        neighborhood: order.address_neighborhood,
        complement: order.address_complement || undefined,
      },
      items: items.map((item: any) => {
        const flavors: any[] = Array.isArray(item.pizza_flavors) ? item.pizza_flavors : [];
        const border = item.pizza_border || null;
        const addons: any[] = Array.isArray(item.addons_snapshot) ? item.addons_snapshot : [];
        const details: string[] = [];
        if (flavors.length) details.push(`Sabor${flavors.length > 1 ? 'es' : ''}: ${flavors.map((f: any) => f.name).join(' / ')}`);
        if (border?.name) details.push(`Borda: ${border.name}`);
        return {
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          observation: item.observation || undefined,
          addons: addons.map((a: any) => ({ label: a.option_name, price: Number(a.price || 0) })),
          details: details.length ? details : undefined,
        };
      }),
      subtotal: items.reduce((sum, item) => sum + (item.quantity * Number(item.unit_price)), 0),
      deliveryFee: Number((order as any).delivery_fee || 0),
      total: Number(order.total_amount),
      paymentMethod: paymentConfig[order.payment_method]?.label || order.payment_method,
      changeFor: order.change_for ? Number(order.change_for) : undefined,
      createdAt: new Date(order.created_at),
      storeInfo: {
        name: store?.name || '',
        logoUrl: store?.logo_url,
        address: store?.address,
        phone: store?.phone_whatsapp,
      },
    };
  };

  const printData = getPrintData();

  if (!order) return null;

  const status = statusConfig[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
  const payment = paymentConfig[order.payment_method] || { label: order.payment_method, icon: '💰' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="text-xl">Pedido #{order.id}</DialogTitle>
            <div className="flex items-center gap-2">
              {hasPendingWeight && (
                <Badge className="bg-warning/20 text-warning border border-warning/30 gap-1">
                  <Scale className="h-3 w-3" /> Aguardando pesagem
                </Badge>
              )}
              <Badge className={status.color}>{status.label}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">CLIENTE</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{order.customer_phone}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delivery Address */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">ENDEREÇO DE ENTREGA</h3>
            <div className="flex gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  {order.address_street}, {order.address_number}
                </p>
                {order.address_complement && (
                  <p className="text-sm text-muted-foreground">{order.address_complement}</p>
                )}
                <p className="text-sm text-muted-foreground">{order.address_neighborhood}</p>
                {order.address_reference && (
                  <p className="text-sm text-muted-foreground italic">
                    Ref: {order.address_reference}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <OrderDriverAssign
            orderId={order.id}
            currentDriverId={(order as any).assigned_driver_id || null}
            currentDriverStatus={(order as any).driver_status || null}
          />

          <Separator />

          {/* Order Items */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">ITENS DO PEDIDO</h3>
            <div className="space-y-3">
              {items?.map((item: any) => {
                const isWeightItem = item.unit_of_sale && item.unit_of_sale !== 'un' && item.quantity_grams;
                const isConfirmed = item.weight_status === 'confirmed';
                const isPending = item.weight_status === 'pending';
                const lineTotal = isConfirmed && item.final_unit_price !== null
                  ? Number(item.final_unit_price) * item.quantity
                  : Number(item.unit_price) * item.quantity;

                return (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {item.quantity}x {item.product_name}
                        </p>
                        {isWeightItem && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <Scale className="h-3 w-3 inline mr-1" />
                            Pedido: {formatAmount(Number(item.quantity_grams), item.unit_of_sale as UnitOfSale)}
                            {isConfirmed && item.final_quantity_grams && (
                              <> · Real: <strong className="text-foreground">{formatAmount(Number(item.final_quantity_grams), item.unit_of_sale as UnitOfSale)}</strong></>
                            )}
                          </p>
                        )}
                        {Array.isArray(item.pizza_flavors) && item.pizza_flavors.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Sabor{item.pizza_flavors.length > 1 ? 'es' : ''}: {item.pizza_flavors.map((f: any) => f.name).join(' / ')}
                          </p>
                        )}
                        {item.pizza_border?.name && (
                          <p className="text-xs text-muted-foreground mt-0.5">Borda: {item.pizza_border.name}</p>
                        )}
                        {Array.isArray(item.addons_snapshot) && item.addons_snapshot.map((a: any) => (
                          <p key={a.option_id} className="text-xs text-muted-foreground mt-0.5">
                            + {a.option_name}{Number(a.price) > 0 ? ` (${formatCurrency(Number(a.price))})` : ''}
                          </p>
                        ))}
                        {item.observation && (
                          <p className="text-xs text-warning">📝 {item.observation}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {isConfirmed && Number(item.final_unit_price) !== Number(item.unit_price) ? (
                          <>
                            <p className="text-xs text-muted-foreground line-through">
                              {formatCurrency(Number(item.unit_price) * item.quantity)}
                            </p>
                            <p className="font-medium text-primary">{formatCurrency(lineTotal)}</p>
                          </>
                        ) : (
                          <p className="font-medium">{formatCurrency(lineTotal)}</p>
                        )}
                      </div>
                    </div>
                    {isWeightItem && (
                      <div className="flex items-center justify-between gap-2 pl-1">
                        {isPending ? (
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                            Aguardando pesagem
                          </Badge>
                        ) : isConfirmed ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                            ✓ Peso confirmado
                          </Badge>
                        ) : <span />}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setAdjustingItem(item as OrderItem)}
                        >
                          <Scale className="h-3 w-3 mr-1" />
                          {isConfirmed ? 'Reajustar' : 'Ajustar peso'}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Payment Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">PAGAMENTO</h3>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>
                {payment.icon} {payment.label}
              </span>
              {order.payment_method === 'money' && order.change_for && (
                <span className="text-muted-foreground">
                  (Troco p/ {formatCurrency(order.change_for)})
                </span>
              )}
            </div>
            {paymentProvider && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status online: </span>
                  <Badge variant={paymentStatus === 'paid' ? 'default' : 'secondary'}>{paymentStatus || 'pending'}</Badge>
                  <span className="text-xs text-muted-foreground ml-2">via {paymentProvider}</span>
                </div>
                <Button size="sm" variant="outline" onClick={handleCheckPayment} disabled={checking}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${checking ? 'animate-spin' : ''}`} />
                  Verificar
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Total */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(order.total_amount)}
              </span>
            </div>
          </div>

          {/* Print Button */}
          {printData && (
            <PrintReceiptButton 
              orderData={printData} 
              variant="outline"
              className="w-full"
            />
          )}
          <OrderWhatsAppButton
            customerName={order.customer_name}
            customerPhone={order.customer_phone}
            orderId={order.id}
            variant="outline"
            className="w-full"
          />
          {order.restaurant_id && (
            <FiscalInvoiceCard restaurantId={order.restaurant_id} orderId={order.id} />
          )}
        </div>
      </DialogContent>

      <WeightAdjustModal
        item={adjustingItem}
        open={!!adjustingItem}
        onOpenChange={(o) => { if (!o) setAdjustingItem(null); }}
      />
    </Dialog>
  );
}
