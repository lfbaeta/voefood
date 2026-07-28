import { useMemo, useState } from 'react';
import { ArrowLeft, Bike, Store, Utensils, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTablesWithOrders } from '@/hooks/useTables';
import { useTableOrderMutations } from '@/hooks/useTableOrders';
import { PdvCartItem, formatBRLCurrency } from './PdvSaleScreen';
import { toast } from 'sonner';

export type PdvOrderType = 'counter' | 'table' | 'delivery';

interface PdvOrderTypeScreenProps {
  items: PdvCartItem[];
  onBack: () => void;
  onSelectCounter: () => void;
  onSelectDelivery: () => void;
  onTableSuccess: () => void;
}

export function PdvOrderTypeScreen({
  items,
  onBack,
  onSelectCounter,
  onSelectDelivery,
  onTableSuccess,
}: PdvOrderTypeScreenProps) {
  const [mode, setMode] = useState<PdvOrderType | null>(null);
  const [sending, setSending] = useState(false);
  const { tables } = useTablesWithOrders();
  const { openTable, addItem } = useTableOrderMutations();

  const total = useMemo(() => items.reduce((sum, i) => sum + i.totalPrice, 0), [items]);

  const sendToTable = async (tableId: string, currentOrderId: number | null) => {
    setSending(true);
    try {
      let orderId = currentOrderId;
      if (!orderId) {
        const order = await openTable.mutateAsync({ tableId, customerCount: 1, waiterName: 'PDV' });
        orderId = order.id;
      }
      for (const item of items) {
        const addonsText = item.addons.map((a) => a.optionName).join(', ');
        const observation = [addonsText, item.observation].filter(Boolean).join(' - ');
        await addItem.mutateAsync({
          orderId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice + item.addons.reduce((s, a) => s + a.price, 0),
          observation: observation || undefined,
        });
      }
      toast.success('Itens enviados para a mesa!');
      onTableSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para a mesa');
    } finally {
      setSending(false);
    }
  };

  const options = [
    {
      id: 'counter' as const,
      title: 'Balcão',
      description: 'Cliente retira no balcão e paga agora',
      icon: Store,
      action: onSelectCounter,
    },
    {
      id: 'table' as const,
      title: 'Mesa',
      description: 'Enviar os itens para uma mesa aberta',
      icon: Utensils,
      action: () => setMode('table'),
    },
    {
      id: 'delivery' as const,
      title: 'Delivery',
      description: 'Entrega no endereço do cliente',
      icon: Bike,
      action: onSelectDelivery,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tipo de Entrega</h1>
          <p className="text-muted-foreground">
            {items.length} item(ns) • Total {formatBRLCurrency(total)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {options.map((opt) => (
          <button key={opt.id} onClick={opt.action} disabled={sending} className="text-left">
            <Card
              className={cn(
                'p-6 h-full transition-all hover:border-primary hover:shadow-md',
                mode === opt.id && 'border-primary shadow-md',
              )}
            >
              <opt.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground">{opt.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
            </Card>
          </button>
        ))}
      </div>

      {mode === 'table' && (
        <Card className="p-4">
          <h2 className="font-semibold text-foreground mb-3">Escolha a mesa</h2>
          <ScrollArea className="max-h-[40vh]">
            {tables.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma mesa cadastrada. Cadastre em "Gerenciar".
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-1">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    disabled={sending}
                    onClick={() => sendToTable(table.id, table.current_order_id)}
                    className="p-4 rounded-xl border bg-card text-left transition-all hover:border-primary hover:shadow-md disabled:opacity-60"
                  >
                    <p className="font-bold text-foreground">Mesa {table.number}</p>
                    {table.name && <p className="text-xs text-muted-foreground">{table.name}</p>}
                    <Badge variant={table.status === 'available' ? 'outline' : 'default'} className="mt-2">
                      {table.status === 'available' ? 'Livre' : 'Ocupada'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          {sending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando itens...
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
