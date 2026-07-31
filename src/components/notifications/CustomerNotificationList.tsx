import { Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  useCustomerNotifications,
  useMarkCustomerNotificationRead,
  useMarkAllCustomerNotificationsRead,
  type NotificationRow,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface CustomerNotificationListProps {
  orderId: number;
  customerPhone: string;
}

const EVENT_ICON: Record<string, string> = {
  order_status: '🔄',
  payment: '💰',
};

function relative(ts: string) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

export function CustomerNotificationList({ orderId, customerPhone }: CustomerNotificationListProps) {
  const { data: notifications = [], isLoading } = useCustomerNotifications(orderId, customerPhone);
  const markRead = useMarkCustomerNotificationRead(orderId, customerPhone);
  const markAll = useMarkAllCustomerNotificationsRead(orderId, customerPhone);

  const unread = notifications.filter((n) => !n.read_at).length;

  if (isLoading) return null;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Notificações</h3>
          {unread > 0 && (
            <span className="text-xs bg-destructive text-destructive-foreground rounded-full px-2 py-0.5">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} className="text-xs">
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Marcar todas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Você verá aqui os avisos deste pedido.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[360px] overflow-y-auto">
          {notifications.map((n: NotificationRow) => (
            <li
              key={n.id}
              onClick={() => !n.read_at && markRead.mutate(n.id)}
              className={cn(
                'rounded-lg border p-3 flex gap-3 cursor-pointer transition-colors',
                !n.read_at ? 'bg-primary/5 border-primary/30' : 'bg-background',
              )}
            >
              <div className="text-xl leading-none pt-0.5">
                {EVENT_ICON[n.event_type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !n.read_at && 'font-semibold')}>{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{relative(n.created_at)}</p>
              </div>
              {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
