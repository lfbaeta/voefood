import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ArrowRight, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentReseller } from '@/hooks/useReseller';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useResellerRestaurants } from '@/hooks/useReseller';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
  action: string;
  path: string;
}

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { data: reseller } = useCurrentReseller();
  const { data: plans } = useSubscriptionPlans();
  const { data: restaurants } = useResellerRestaurants();

  const items = useMemo<ChecklistItem[]>(() => {
    const profileDone = !!(reseller?.name && reseller?.company_name && reseller?.phone);
    const brandingDone = !!(reseller?.primary_color && reseller?.secondary_color);
    const landingDone = !!(reseller?.landing_page_enabled && reseller?.slug);
    const plansDone = (plans?.length || 0) > 0;
    const mpDone = !!(reseller as any)?.mp_integration_enabled;
    const restaurantsDone = (restaurants?.length || 0) > 0;

    return [
      {
        id: 'profile',
        label: 'Complete seu perfil',
        description: 'Nome, empresa e telefone de contato',
        done: profileDone,
        action: 'Preencher',
        path: '/reseller/settings',
      },
      {
        id: 'branding',
        label: 'Personalize as cores',
        description: 'Defina as cores primária e secundária da sua marca',
        done: brandingDone,
        action: 'Configurar',
        path: '/reseller/settings',
      },
      {
        id: 'landing',
        label: 'Ative sua landing page',
        description: 'Configure a página pública com seu slug',
        done: landingDone,
        action: 'Ativar',
        path: '/reseller/settings',
      },
      {
        id: 'plans',
        label: 'Crie planos de assinatura',
        description: 'Cadastre ao menos um plano para seus estabelecimentos',
        done: plansDone,
        action: 'Criar plano',
        path: '/reseller/plans',
      },
      {
        id: 'mercadopago',
        label: 'Configure o Mercado Pago',
        description: 'Habilite cobranças automáticas de mensalidades',
        done: mpDone,
        action: 'Configurar',
        path: '/reseller/mercadopago',
      },
      {
        id: 'restaurants',
        label: 'Cadastre o primeiro estabelecimento',
        description: 'Comece a vender adicionando um restaurante',
        done: restaurantsDone,
        action: 'Cadastrar',
        path: '/reseller/restaurants',
      },
    ];
  }, [reseller, plans, restaurants]);

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const progress = Math.round((completed / total) * 100);

  if (completed === total) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Configuração inicial</CardTitle>
              <CardDescription>
                Complete as pendências abaixo para começar a operar
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">
              {completed} de {total} concluídas
            </p>
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        </div>
        <Progress value={progress} className="mt-3" />
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              item.done ? 'bg-muted/40 border-transparent' : 'hover:bg-muted/40'
            )}
          >
            {item.done ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium',
                  item.done && 'line-through text-muted-foreground'
                )}
              >
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
            </div>
            {!item.done && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(item.path)}
              >
                {item.action}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
