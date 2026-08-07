import { useState } from 'react';
import { Restaurant } from '@/types/reseller';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store, Calendar, CreditCard, ExternalLink, Settings, MoreVertical, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStoreOpenStatus } from '@/hooks/useStoreOpenStatus';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onManage: (id: string) => void;
}

const statusConfig = {
  trial: { label: 'Período de Teste', variant: 'secondary' as const },
  active: { label: 'Ativo', variant: 'default' as const },
  suspended: { label: 'Suspenso', variant: 'destructive' as const },
  cancelled: { label: 'Cancelado', variant: 'outline' as const },
};

export function RestaurantCard({ restaurant, onView, onEdit, onManage }: RestaurantCardProps) {
  const status = statusConfig[restaurant.subscription_status];
  const { isOpen, isLoading: isLoadingStatus } = useStoreOpenStatus(restaurant.id);
  const { user } = useAuth();
  const [isAccessing, setIsAccessing] = useState(false);

  const handleManage = async () => {
    if (!user) return;
    setIsAccessing(true);
    try {
      // 1. Check if the restaurant requires password for reseller access
      const { data: config } = await supabase
        .from('store_config')
        .select('auth_password_required')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();
      
      const requiresPassword = config?.auth_password_required ?? true;
      const targetUrl = `${window.location.protocol}//${restaurant.slug}.${window.location.host}/admin`;

      if (requiresPassword) {
        // Just redirect to auth
        window.open(`${window.location.protocol}//${restaurant.slug}.${window.location.host}/auth`, '_blank');
      } else {
        // MAGIC LOGIN: Get a session transfer token or just redirect to admin if permissions allow 
        // For simplicity and since RLS allows reseller, we can try to redirect to admin directly
        // The App will check roles and allow access because the reseller session is valid globally (Supabase cookies)
        window.open(targetUrl, '_blank');
      }
    } catch (err) {
      console.error('Error accessing restaurant:', err);
      onManage(restaurant.id);
    } finally {
      setIsAccessing(false);
    }
  };
  
  const trialDaysRemaining = restaurant.subscription_status === 'trial' && restaurant.subscription_start_date
    ? Math.max(0, restaurant.trial_days - Math.floor(
        (Date.now() - new Date(restaurant.subscription_start_date).getTime()) / (1000 * 60 * 60 * 24)
      ))
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{restaurant.name}</h3>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">/{restaurant.slug}</p>
                {!isLoadingStatus && (
                  <Badge variant={isOpen ? 'open' : 'closed'} className="text-xs">
                    {isOpen ? 'Aberto' : 'Fechado'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(restaurant.id)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(restaurant.id)}>
                <Settings className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleManage} disabled={isAccessing}>
                <Store className="h-4 w-4 mr-2" />
                {isAccessing ? 'Acessando...' : 'Acessar painel'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>
            {status.label}
          </Badge>
          {restaurant.subscription_status === 'trial' && trialDaysRemaining > 0 && (
            <Badge variant="outline">
              {trialDaysRemaining} dias restantes
            </Badge>
          )}
          {!restaurant.is_active && (
            <Badge variant="outline" className="text-destructive border-destructive">
              Inativo
            </Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span>R$ {restaurant.monthly_fee.toFixed(2)}/mês</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {restaurant.subscription_start_date 
                ? format(new Date(restaurant.subscription_start_date), 'dd/MM/yyyy', { locale: ptBR })
                : 'N/A'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onView(restaurant.id)}
          >
            Ver detalhes
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            onClick={handleManage}
            disabled={isAccessing}
          >
            {isAccessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Acessar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
