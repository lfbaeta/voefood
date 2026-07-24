import { Badge } from '@/components/ui/badge';
import { SubscriptionStatus, PaymentStatus } from '@/types/reseller';

interface SubscriptionBadgeProps {
  status: SubscriptionStatus;
}

interface PaymentBadgeProps {
  status: PaymentStatus;
}

const subscriptionConfig = {
  trial: { label: 'Teste', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  active: { label: 'Ativo', className: 'bg-secondary/20 text-secondary hover:bg-secondary/20' },
  suspended: { label: 'Suspenso', className: 'bg-destructive/20 text-destructive hover:bg-destructive/20' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
};

const paymentConfig = {
  pending: { label: 'Pendente', className: 'bg-primary/20 text-primary hover:bg-primary/20' },
  paid: { label: 'Pago', className: 'bg-secondary/20 text-secondary hover:bg-secondary/20' },
  overdue: { label: 'Atrasado', className: 'bg-destructive/20 text-destructive hover:bg-destructive/20' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
};

export function SubscriptionBadge({ status }: SubscriptionBadgeProps) {
  const config = subscriptionConfig[status];
  
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

export function PaymentBadge({ status }: PaymentBadgeProps) {
  const config = paymentConfig[status];
  
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
