import { Loader2 } from 'lucide-react';
import { ResellerLayout } from '@/components/reseller/ResellerLayout';
import { MercadoPagoConfig } from '@/components/reseller/MercadoPagoConfig';
import { useCurrentReseller } from '@/hooks/useReseller';

function MercadoPagoContent() {
  const { data: reseller, isLoading, refetch } = useCurrentReseller();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reseller) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Mercado Pago</h1>
        <p className="text-muted-foreground">
          Configure a integração para automatizar cobranças de assinaturas
        </p>
      </div>
      <MercadoPagoConfig reseller={reseller as any} onUpdate={refetch} />
    </div>
  );
}

export default function ResellerMercadoPago() {
  return (
    <ResellerLayout title="Mercado Pago">
      <MercadoPagoContent />
    </ResellerLayout>
  );
}
