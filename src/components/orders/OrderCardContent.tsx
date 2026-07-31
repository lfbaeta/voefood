import { Loader2, GripVertical, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrderItems, useUpdateOrderStatus, Order } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderCardContentProps {
  order: Order;
  store: any;
  onOpenDetails: (order: Order) => void;
  dragListeners?: any;
}

const formatCurrency = (value: number) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getPaymentLabel = (order: Order) => {
  switch (order.payment_method) {
    case 'pix': return '💠 PIX';
    case 'money': return `💵 Troco p/ R$ ${order.change_for || ''}`;
    case 'card': return '💳 Levar Máquina';
    default: return order.payment_method;
  }
};

const getNextStatus = (status: Order['status']): Order['status'] | null => {
  const flow: Record<string, Order['status']> = {
    pending: 'preparing',
    preparing: 'delivery',
    delivery: 'completed',
  };
  return flow[status] || null;
};

const getNextStatusLabel = (status: Order['status']) => {
  const labels: Record<string, string> = {
    pending: 'Aceitar',
    preparing: 'Despachar',
    delivery: 'Finalizar',
  };
  return labels[status];
};

export function OrderCardContent({ order, store, onOpenDetails, dragListeners }: OrderCardContentProps) {
  const { data: items } = useOrderItems(order.id);
  const updateStatus = useUpdateOrderStatus();

  const sendWhatsAppMessage = async (e: React.MouseEvent, messageType: 'pix' | 'accepted' | 'preparing' | 'delivery' | 'completed') => {
    e.stopPropagation();
    
    const { data: orderItems } = await import('@/integrations/supabase/client').then(m => 
      m.supabase.from('order_items').select('*').eq('order_id', order.id)
    );
    
    const itemsList = orderItems?.map(item => {
      let line = `${formatCurrency(item.unit_price * item.quantity)} ${item.quantity}x ${item.product_name}`;
      if (item.observation) line += `\n   📝 ${item.observation}`;
      return line;
    }).join('\n') || '';

    const subtotal = orderItems?.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0;
    const deliveryFee = order.total_amount - subtotal;
    
    const paymentLabels: Record<string, string> = {
      pix: 'Pix Online',
      money: `Dinheiro (Troco para R$ ${order.change_for || 'não informado'})`,
      card: 'Cartão na entrega'
    };
    const paymentLabel = paymentLabels[order.payment_method] || order.payment_method;
    
    const addressParts = [
      order.address_street,
      order.address_number ? `Nº ${order.address_number}` : '',
      order.address_complement || '',
      order.address_neighborhood
    ].filter(Boolean).join(', ');
    
    const now = new Date();
    const deliveryMin = new Date(now.getTime() + (store?.delivery_time_min || 30) * 60000);
    const deliveryMax = new Date(now.getTime() + (store?.delivery_time_max || 45) * 60000);
    const deliveryTime = `${deliveryMin.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${deliveryMax.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    const paymentStatus = order.payment_method === 'pix' 
      ? 'Já recebemos seu pagamento. ✅' 
      : 'Pagamento na entrega.';

    const defaultMessages = {
      pix: `Oi, {nome}! Seu pedido de {total} está aguardando o pagamento; para finalizar, basta copiar a chave Pix que vou enviar logo abaixo. 😊\n\n💠 *Chave Pix ({tipo_chave}):*\n{chave_pix}`,
      accepted: `Olá {nome}, seu pedido foi confirmado e está sendo preparado 🥰\n\n*Pedido: #{pedido}*\n---------------------------------------\n📦 *Produtos*\n{produtos}\n---------------------------------------\n{subtotal} Total dos produtos\n{taxa_entrega} Taxa de entrega\n*{total} Total*\n\nForma de pagamento: {forma_pagamento}\n{status_pagamento}\n---------------------------------------\n👤 Nome: {nome}\n📍 Bairro: {bairro}\n🏠 Rua: {rua}\n🔢 Número: {numero}\n{complemento}🕐 Previsão de entrega: {previsao}\n\nObrigado pela preferência 😉`,
      preparing: `Olá {nome}! 👨‍🍳\n\nSeu pedido #{pedido} está sendo preparado com muito carinho!\n\nEm breve sairá para entrega! 🚀`,
      delivery: `Olá, {nome}! 🛵\n\nSeu pedido #{pedido} saiu para entrega!\n\nEm breve chegará até você! 📍`,
      completed: `Olá {nome}! 🎉\n\nSeu pedido #{pedido} foi entregue com sucesso!\n\nObrigado pela preferência! ❤️\nEsperamos você novamente em breve!`,
    };
    
    const storeMessages = {
      pix: store?.pix_message,
      accepted: store?.msg_order_accepted,
      preparing: store?.msg_order_preparing,
      delivery: store?.msg_order_delivery,
      completed: store?.msg_order_completed,
    };
    
    const template = storeMessages[messageType] || defaultMessages[messageType];
    
    const message = template
      .replace(/{nome}/g, order.customer_name)
      .replace(/{pedido}/g, String(order.id))
      .replace(/{total}/g, formatCurrency(order.total_amount))
      .replace(/{subtotal}/g, formatCurrency(subtotal))
      .replace(/{taxa_entrega}/g, formatCurrency(deliveryFee))
      .replace(/{chave_pix}/g, store?.pix_key || '')
      .replace(/{tipo_chave}/g, store?.pix_key_type || 'Chave')
      .replace(/{produtos}/g, itemsList)
      .replace(/{forma_pagamento}/g, paymentLabel)
      .replace(/{status_pagamento}/g, paymentStatus)
      .replace(/{bairro}/g, order.address_neighborhood || '')
      .replace(/{rua}/g, order.address_street || '')
      .replace(/{numero}/g, order.address_number || '')
      .replace(/{complemento}/g, order.address_complement ? `🏷️ Complemento: ${order.address_complement}\n` : '')
      .replace(/{endereco}/g, addressParts)
      .replace(/{previsao}/g, deliveryTime);
    
    const phoneNumber = order.customer_phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    const newWindow = window.open(whatsappUrl, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = whatsappUrl;
    }
  };

  const handleStatusUpdate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = getNextStatus(order.status);
    if (next) {
      updateStatus.mutate({ orderId: order.id, status: next });
    }
  };

  const isCompleted = order.status === 'completed';

  return (
    <div className="rounded-xl bg-card p-3 sm:p-4 shadow-card animate-slide-up min-w-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" onClick={() => onOpenDetails(order)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {dragListeners && (
            <div {...dragListeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-base sm:text-lg text-foreground">#{order.id}</p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{order.customer_name}</p>
            {isCompleted && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(order.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        </div>
        <Badge variant={order.payment_method as any} className="text-[10px] sm:text-xs flex-shrink-0 whitespace-nowrap">
          {getPaymentLabel(order)}
        </Badge>
      </div>

      <div className="space-y-1 mb-3 text-sm">
        {items?.map((item) => (
          <div key={item.id}>
            <span className="text-foreground">{item.quantity}x {item.product_name}</span>
            {item.observation && <p className="text-xs text-warning">📝 {item.observation}</p>}
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold text-foreground">{formatCurrency(order.total_amount)}</span>
        </div>

        {!isCompleted && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              {order.status === 'pending' && order.payment_method === 'pix' && (
                <Button variant="whatsapp" size="sm" className="flex-1 text-xs" onClick={(e) => sendWhatsAppMessage(e, 'pix')}>💠 PIX</Button>
              )}
              {order.status === 'pending' && (
                <Button variant="whatsapp" size="sm" className="flex-1 text-xs" onClick={(e) => sendWhatsAppMessage(e, 'accepted')}>✅ Aceito</Button>
              )}
              {order.status === 'delivery' && (
                <Button variant="whatsapp" size="sm" className="flex-1 text-xs" onClick={(e) => sendWhatsAppMessage(e, 'delivery')}>🛵 Entrega</Button>
              )}
            </div>
            
            {getNextStatus(order.status) && (
              <Button size="sm" className="w-full" onClick={handleStatusUpdate} disabled={updateStatus.isPending}>
                {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : getNextStatusLabel(order.status)}
              </Button>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="space-y-2">
            <Button variant="whatsapp" size="sm" className="w-full text-xs" onClick={(e) => sendWhatsAppMessage(e, 'completed')}>🎉 Agradecer</Button>
            <div className="flex items-center justify-center gap-1.5 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Entregue</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
