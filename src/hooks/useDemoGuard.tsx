import { toast } from '@/hooks/use-toast';

/**
 * Modo demonstração removido.
 * Mantido apenas como stub inerte para os componentes que ainda importam o hook.
 */
export function useDemoGuard() {
  const isDemoUser = false;

  const notifyBlocked = () => {
    toast({
      title: 'Ação indisponível',
      description: 'Tente novamente.',
      variant: 'destructive',
    });
  };

  const checkDemoMode = () => false;

  const guardAction = <T extends (...args: any[]) => any>(fn: T): T => fn;

  return {
    isDemoUser,
    canWrite: true,
    guardAction,
    checkDemoMode,
    notifyBlocked,
  };
}
