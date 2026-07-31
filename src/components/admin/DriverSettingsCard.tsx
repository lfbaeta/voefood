import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Zap, Hand } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { useToast } from '@/hooks/use-toast';

const client: any = supabase;

export function DriverSettingsCard() {
  const { restaurantId } = useEffectiveRestaurantId();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState({
    driver_assignment_mode: 'manual',
    driver_auto_timeout_seconds: 60,
    driver_max_radius_km: 10,
    driver_default_commission: 5,
    driver_public_tracking_enabled: true,
    driver_customer_rating_enabled: true,
  });

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await client.rpc('get_driver_settings', { p_restaurant_id: restaurantId });
      if (!error && data?.[0]) setCfg({ ...cfg, ...data[0] });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    const { error } = await client.rpc('update_driver_settings', {
      p_restaurant_id: restaurantId,
      p_mode: cfg.driver_assignment_mode,
      p_timeout: cfg.driver_auto_timeout_seconds,
      p_radius: cfg.driver_max_radius_km,
      p_commission: cfg.driver_default_commission,
      p_public_tracking: cfg.driver_public_tracking_enabled,
      p_customer_rating: cfg.driver_customer_rating_enabled,
    });
    setSaving(false);
    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    else toast({ title: 'Configurações salvas' });
  };

  if (loading) {
    return (
      <Card className="mb-6"><CardContent className="py-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </CardContent></Card>
    );
  }

  const isAuto = cfg.driver_assignment_mode === 'auto';

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {isAuto ? <Zap className="h-4 w-4 text-primary" /> : <Hand className="h-4 w-4" />}
          Como os entregadores são chamados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Modo de atribuição</Label>
            <Select
              value={cfg.driver_assignment_mode}
              onValueChange={(v) => setCfg({ ...cfg, driver_assignment_mode: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual — você escolhe no pedido</SelectItem>
                <SelectItem value="auto">Automático — sistema atribui o mais próximo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {isAuto
                ? 'Ao receber o pedido (ou quando aceito), o entregador disponível mais próximo é atribuído automaticamente.'
                : 'Você atribui o entregador manualmente no card do pedido (botão "Sugerir" também disponível).'}
            </p>
          </div>
          <div>
            <Label>Tempo máximo de resposta (seg)</Label>
            <Input
              type="number" min={10} max={600}
              value={cfg.driver_auto_timeout_seconds}
              onChange={(e) => setCfg({ ...cfg, driver_auto_timeout_seconds: Number(e.target.value) })}
              disabled={!isAuto}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se o entregador não aceitar nesse tempo, o pedido é liberado para o próximo.
            </p>
          </div>
          <div>
            <Label>Raio máximo de atuação (km)</Label>
            <Input
              type="number" step="0.5" min={0.5} max={100}
              value={cfg.driver_max_radius_km}
              onChange={(e) => setCfg({ ...cfg, driver_max_radius_km: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Comissão padrão por entrega (R$)</Label>
            <Input
              type="number" step="0.01" min={0}
              value={cfg.driver_default_commission}
              onChange={(e) => setCfg({ ...cfg, driver_default_commission: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Rastreamento público pelo cliente</p>
            <p className="text-xs text-muted-foreground">Mostra o entregador no mapa na página de status do pedido.</p>
          </div>
          <Switch
            checked={cfg.driver_public_tracking_enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, driver_public_tracking_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Avaliação da entrega pelo cliente</p>
            <p className="text-xs text-muted-foreground">Cliente avalia o entregador (1-5 estrelas) após concluído.</p>
          </div>
          <Switch
            checked={cfg.driver_customer_rating_enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, driver_customer_rating_enabled: v })}
          />
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Como funciona o fluxo</p>
          <p>1. Entregador entra em <code className="font-mono">/entregador</code>, faz login com PIN e abre o turno — GPS começa a atualizar.</p>
          <p>2. Pedido chega. No modo automático, o sistema atribui na hora; no manual você clica em "Sugerir" ou escolhe da lista.</p>
          <p>3. Entregador vê o pedido, aceita → retira na loja → sai para entrega → marca entregue. Cliente acompanha em tempo real.</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
