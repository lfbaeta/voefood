import { useState } from 'react';
import {
  Clock,
  ChefHat,
  CheckCircle,
  Loader2,
  Truck,
  UtensilsCrossed,
  Bell,
  AlarmClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { KitchenItem, useKitchenItemMutations } from '@/hooks/useKitchenItems';
import { cn } from '@/lib/utils';

export interface KitchenTicket {
  key: string;
  order_type: 'table' | 'delivery';
  table_number: number | null;
  table_name: string | null;
  order_id: number | null;
  customer_name?: string;
  waiter_name: string | null;
  ordered_at: string;
  items: KitchenItem[];
}

interface KitchenTicketCardProps {
  ticket: KitchenTicket;
  /** minutes after which the ticket is considered late */
  lateAfterMinutes?: number;
  now: number;
}

export function KitchenTicketCard({ ticket, lateAfterMinutes = 15, now }: KitchenTicketCardProps) {
  const { updateItemStatus } = useKitchenItemMutations();
  const [busy, setBusy] = useState<string | null>(null);

  const elapsedMs = now - new Date(ticket.ordered_at).getTime();
  const minutes = Math.max(0, Math.floor(elapsedMs / 60000));
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000) % 60);

  const isLate = minutes >= lateAfterMinutes;
  const isWarning = !isLate && minutes >= Math.round(lateAfterMinutes * 0.6);

  const pending = ticket.items.filter((i) => i.status === 'pending');
  const preparing = ticket.items.filter((i) => i.status === 'preparing');
  const ready = ticket.items.filter((i) => i.status === 'ready');

  const totalUnits = ticket.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const bulkUpdate = (items: KitchenItem[], status: 'preparing' | 'ready' | 'delivered') =>
    Promise.all(
      items.map((i) => updateItemStatus(i.id, status, i.order_type, i.order_id || undefined))
    );

  const timeClasses = isLate
    ? 'bg-destructive text-destructive-foreground'
    : isWarning
      ? 'bg-primary text-primary-foreground'
      : 'bg-muted text-muted-foreground';

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden border-2 transition-all',
        isLate ? 'border-destructive shadow-lg' : isWarning ? 'border-primary/60' : 'border-border'
      )}
    >
      {/* Ticket header */}
      <div className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {ticket.order_type === 'table' ? (
            <>
              <UtensilsCrossed className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-lg font-bold text-foreground">
                {ticket.table_name || `Mesa ${ticket.table_number ?? '-'}`}
              </span>
            </>
          ) : (
            <>
              <Truck className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-lg font-bold text-foreground">
                Pedido #{ticket.order_id}
              </span>
            </>
          )}
        </div>
        <Badge className={cn('shrink-0 gap-1 text-sm font-bold tabular-nums', timeClasses)}>
          {isLate ? <AlarmClock className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {minutes}:{String(seconds).padStart(2, '0')}
        </Badge>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {ticket.items.length} {ticket.items.length === 1 ? 'item' : 'itens'} · {totalUnits} un.
          </span>
          {ticket.waiter_name && <span>Garçom: {ticket.waiter_name}</span>}
          {ticket.customer_name && <span>Cliente: {ticket.customer_name}</span>}
        </div>

        <Separator />

        {/* Items */}
        <ul className="flex-1 space-y-2">
          {ticket.items.map((item) => {
            const itemBusy = busy === item.id;
            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-lg border p-2',
                  item.status === 'ready' && 'border-primary/40 bg-primary/5',
                  item.status === 'preparing' && 'border-border bg-muted/40'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-tight text-foreground">
                      <span className="mr-1 text-lg font-bold">{item.quantity}x</span>
                      {item.product_name}
                    </p>
                    {item.observation && (
                      <p className="mt-1 rounded bg-muted px-2 py-1 text-xs text-foreground">
                        Obs: {item.observation}
                      </p>
                    )}
                  </div>
                  <Badge variant={item.status === 'ready' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                    {item.status === 'pending' && 'Pendente'}
                    {item.status === 'preparing' && 'Preparando'}
                    {item.status === 'ready' && 'Pronto'}
                  </Badge>
                </div>

                <div className="mt-2 flex gap-2">
                  {item.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!!busy}
                      onClick={() =>
                        run(item.id, () =>
                          updateItemStatus(item.id, 'preparing', item.order_type, item.order_id || undefined)
                        )
                      }
                    >
                      {itemBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ChefHat className="mr-1 h-4 w-4" />Preparar</>}
                    </Button>
                  )}
                  {item.status === 'preparing' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!!busy}
                      onClick={() =>
                        run(item.id, () =>
                          updateItemStatus(item.id, 'ready', item.order_type, item.order_id || undefined)
                        )
                      }
                    >
                      {itemBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="mr-1 h-4 w-4" />Pronto</>}
                    </Button>
                  )}
                  {item.status === 'ready' && item.order_type === 'table' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      disabled={!!busy}
                      onClick={() => run(item.id, () => updateItemStatus(item.id, 'delivered', 'table'))}
                    >
                      {itemBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Bell className="mr-1 h-4 w-4" />Entregue</>}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Ticket-level actions */}
        <div className="flex flex-col gap-2">
          {pending.length > 0 && (
            <Button
              className="w-full py-5 text-base"
              disabled={!!busy}
              onClick={() => run('bulk-prep', () => bulkUpdate(pending, 'preparing'))}
            >
              {busy === 'bulk-prep' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ChefHat className="mr-2 h-5 w-5" />
                  Iniciar comanda ({pending.length})
                </>
              )}
            </Button>
          )}
          {preparing.length > 0 && (
            <Button
              variant="secondary"
              className="w-full py-5 text-base"
              disabled={!!busy}
              onClick={() => run('bulk-ready', () => bulkUpdate(preparing, 'ready'))}
            >
              {busy === 'bulk-ready' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Tudo pronto ({preparing.length})
                </>
              )}
            </Button>
          )}
          {ready.length > 0 && ticket.order_type === 'table' && pending.length === 0 && preparing.length === 0 && (
            <Button
              variant="outline"
              className="w-full py-5 text-base"
              disabled={!!busy}
              onClick={() => run('bulk-delivered', () => bulkUpdate(ready, 'delivered'))}
            >
              {busy === 'bulk-delivered' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Bell className="mr-2 h-5 w-5" />
                  Entregar comanda
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
