import { ShoppingCart, ArrowRight, Bell, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStoreConfig } from '@/hooks/useStore';

export function CartButton() {
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { data: store } = useStoreConfig();
  const tableNumber = searchParams.get('table');

  const handleTableAction = async (action: 'table_call' | 'request_bill') => {
    if (!tableNumber || !store) return;
    
    try {
      const { error } = await supabase.functions.invoke('notify-event', {
        body: { 
          event: action, 
          restaurant_id: store.restaurant_id,
          table_number: tableNumber 
        },
      });

      if (error) throw error;

      toast({
        title: action === 'table_call' ? 'Garçom chamado!' : 'Conta solicitada!',
        description: 'Um atendente virá até você em breve.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao processar pedido',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {tableNumber && (
        <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3">
          <Button
            onClick={() => handleTableAction('table_call')}
            className="h-14 w-14 rounded-full shadow-xl bg-yellow-500 hover:bg-yellow-600 text-white p-0 flex flex-col items-center justify-center gap-0.5 border-2 border-white animate-bounce-in"
          >
            <Bell className="h-5 w-5" />
            <span className="text-[9px] font-bold">Chamar</span>
          </Button>
          <Button
            onClick={() => handleTableAction('request_bill')}
            className="h-14 w-14 rounded-full shadow-xl bg-red-500 hover:bg-red-600 text-white p-0 flex flex-col items-center justify-center gap-0.5 border-2 border-white animate-bounce-in"
          >
            <ReceiptText className="h-5 w-5" />
            <span className="text-[9px] font-bold">Conta</span>
          </Button>
        </div>
      )}

      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 bg-gradient-to-t from-background via-background to-transparent pt-8">
          <Button
            onClick={() => navigate(`${basePath}/cart`)}
            variant="cart"
            size="xl"
            className="w-full animate-bounce-in shadow-xl rounded-full"
          >
            <div className="flex w-full items-center gap-4">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-xs font-bold text-primary">
                  {totalItems}
                </span>
              </div>
              
              <div className="flex flex-1 items-center justify-center gap-2">
                <ArrowRight className="h-5 w-5" />
                <span className="font-semibold">Fazer pedido</span>
              </div>
            </div>
          </Button>
        </div>
      )}
    </>
  );
}
