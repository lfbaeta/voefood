import { useState } from 'react';
import { BellRing, ReceiptText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TableCallActionsProps {
  restaurantId: string | null | undefined;
  tableNumber: number;
}

type RequestType = 'call_waiter' | 'request_bill';

export function TableCallActions({ restaurantId, tableNumber }: TableCallActionsProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<RequestType | null>(null);

  const send = async (request: RequestType) => {
    if (!restaurantId) return;
    setPending(request);
    try {
      const { data, error } = await supabase.rpc('table_customer_request', {
        p_restaurant_id: restaurantId,
        p_table_number: tableNumber,
        p_request: request,
      });
      if (error) throw error;

      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error === 'table_not_found') {
        toast({
          title: 'Mesa não encontrada',
          description: 'Chame um atendente do estabelecimento.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: request === 'call_waiter' ? 'Garçom chamado!' : 'Conta solicitada!',
        description:
          request === 'call_waiter'
            ? 'Um atendente virá até a sua mesa em instantes.'
            : 'O atendente já foi avisado e trará a sua conta.',
      });
    } catch (err) {
      toast({
        title: 'Não foi possível enviar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Button
        variant="secondary"
        className="h-11"
        onClick={() => send('call_waiter')}
        disabled={pending !== null || !restaurantId}
      >
        {pending === 'call_waiter' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <BellRing className="h-4 w-4 mr-2" />
        )}
        Chamar garçom
      </Button>
      <Button
        className="h-11"
        onClick={() => send('request_bill')}
        disabled={pending !== null || !restaurantId}
      >
        {pending === 'request_bill' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ReceiptText className="h-4 w-4 mr-2" />
        )}
        Pedir a conta
      </Button>
    </div>
  );
}
