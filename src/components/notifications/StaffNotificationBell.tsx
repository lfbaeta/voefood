import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  useStaffNotifications,
  useMarkStaffNotificationRead,
  useMarkAllStaffNotificationsRead,
  type NotificationRow,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const EVENT_ICON: Record<string, string> = {
  new_order: '🛒',
  order_status: '🔄',
  payment: '💰',
  table_call: '🛎️',
};

function relative(ts: string) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

export function StaffNotificationBell() {
  const { data: notifications = [] } = useStaffNotifications(50);
  const markRead = useMarkStaffNotificationRead();
  const markAll = useMarkAllStaffNotificationsRead();
  const navigate = useNavigate();

  const unread = notifications.filter((n) => !n.read_at).length;

  const handleClick = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.url) navigate(n.url);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo em dia'}
            </p>
          </div>
          {unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[420px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma notificação ainda</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex gap-3',
                      !n.read_at && 'bg-primary/5',
                    )}
                  >
                    <div className="text-xl leading-none pt-0.5">
                      {EVENT_ICON[n.event_type] || '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm truncate', !n.read_at && 'font-semibold')}>
                          {n.title}
                        </p>
                        {!n.read_at && (
                          <Badge variant="default" className="h-1.5 w-1.5 rounded-full p-0 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{relative(n.created_at)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
