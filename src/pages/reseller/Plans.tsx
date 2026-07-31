import { ResellerLayout } from '@/components/reseller/ResellerLayout';
import { SubscriptionPlansManager } from '@/components/reseller/SubscriptionPlansManager';

export default function ResellerPlans() {
  return (
    <ResellerLayout title="Planos de Assinatura">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Planos de Assinatura</h1>
          <p className="text-muted-foreground">
            Defina os planos e preços oferecidos aos seus estabelecimentos
          </p>
        </div>
        <SubscriptionPlansManager />
      </div>
    </ResellerLayout>
  );
}
