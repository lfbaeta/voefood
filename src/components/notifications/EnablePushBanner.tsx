import { Bell, BellOff, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePushNotifications, isIOS, isStandalonePWA } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

interface EnablePushBannerProps {
  role: 'staff' | 'customer';
  restaurantId: string;
  topics: string[];
  orderId?: number;
  customerPhone?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function EnablePushBanner({
  role,
  restaurantId,
  topics,
  orderId,
  customerPhone,
  title = 'Ativar notificações',
  description = 'Receba um alerta no seu celular mesmo com o app fechado.',
  className,
}: EnablePushBannerProps) {
  const { supported, isSubscribed, loading, subscribe, unsubscribe, blocked, permission } = usePushNotifications();
  const { toast } = useToast();

  if (blocked) return null;

  // iOS user without installed PWA: show install hint instead of button.
  if (isIOS() && !isStandalonePWA()) {
    return (
      <Alert className={className}>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Para receber notificações no iPhone, toque em <b>Compartilhar → Adicionar à Tela de Início</b> e abra o app pelo ícone.
        </AlertDescription>
      </Alert>
    );
  }

  if (!supported) return null;

  const handleClick = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast({ title: 'Notificações desativadas' });
      } else {
        await subscribe({ role, restaurantId, topics, orderId, customerPhone });
        toast({ title: 'Notificações ativadas!' });
      }
    } catch (e: any) {
      toast({ title: 'Não foi possível ativar', description: e?.message, variant: 'destructive' });
    }
  };

  if (permission === 'denied') {
    return (
      <Alert variant="destructive" className={className}>
        <BellOff className="h-4 w-4" />
        <AlertDescription>
          Notificações bloqueadas. Ative nas configurações do navegador para este site.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border bg-card p-3 ${className || ''}`}>
      <div className="flex items-start gap-2 min-w-0">
        <Bell className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button size="sm" onClick={handleClick} disabled={loading} variant={isSubscribed ? 'outline' : 'default'}>
        {isSubscribed ? 'Desativar' : 'Ativar'}
      </Button>
    </div>
  );
}
