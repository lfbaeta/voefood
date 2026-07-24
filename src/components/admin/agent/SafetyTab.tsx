import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type SafetyRow = {
  restaurant_id: string;
  max_tool_executions_per_day: number | null;
  max_cost_cents_per_day: number | null;
  cancel_max_value_cents: number | null;
  max_messages_per_contact_per_hour: number | null;
  nps_after_delivery_enabled: boolean;
  nps_delay_minutes: number | null;
  abandoned_followup_enabled: boolean;
  abandoned_followup_minutes: number | null;
};

const DEFAULTS: SafetyRow = {
  restaurant_id: '',
  max_tool_executions_per_day: 500,
  max_cost_cents_per_day: 1000,
  cancel_max_value_cents: 5000,
  max_messages_per_contact_per_hour: 30,
  nps_after_delivery_enabled: false,
  nps_delay_minutes: 40,
  abandoned_followup_enabled: false,
  abandoned_followup_minutes: 30,
};

export function SafetyTab({ restaurantId }: { restaurantId: string }) {
  const { toast } = useToast();
  const [row, setRow] = useState<SafetyRow>({ ...DEFAULTS, restaurant_id: restaurantId });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('agent_safety_limits')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (data) setRow({ ...DEFAULTS, ...data, restaurant_id: restaurantId });
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from('agent_safety_limits').upsert(row, { onConflict: 'restaurant_id' });
      if (error) throw error;
      toast({ title: 'Salvo', description: 'Limites e proatividade atualizados.' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;

  const num = (v: any) => (v === '' ? null : Number(v));

  return (
    <div className="space-y-4 pt-2">
      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Limites de segurança</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Máx. de chamadas de tools por dia (restaurante)</Label>
            <Input type="number" value={row.max_tool_executions_per_day ?? ''} onChange={(e) => setRow({ ...row, max_tool_executions_per_day: num(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label>Máx. mensagens p/ mesmo contato por hora</Label>
            <Input type="number" value={row.max_messages_per_contact_per_hour ?? ''} onChange={(e) => setRow({ ...row, max_messages_per_contact_per_hour: num(e.target.value) })} />
            <p className="text-xs text-muted-foreground">Evita um único cliente esgotar o agente. 0 = sem limite.</p>
          </div>
          <div className="space-y-1">
            <Label>Teto p/ cancelamento automático (centavos)</Label>
            <Input type="number" value={row.cancel_max_value_cents ?? ''} onChange={(e) => setRow({ ...row, cancel_max_value_cents: num(e.target.value) })} />
            <p className="text-xs text-muted-foreground">Pedidos acima exigem humano.</p>
          </div>
          <div className="space-y-1">
            <Label>Teto de custo IA por dia (centavos)</Label>
            <Input type="number" value={row.max_cost_cents_per_day ?? ''} onChange={(e) => setRow({ ...row, max_cost_cents_per_day: num(e.target.value) })} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Mensagens proativas</div>
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <div className="text-sm">NPS após entrega</div>
            <p className="text-xs text-muted-foreground">Agente pergunta como foi alguns minutos depois do pedido sair como entregue.</p>
          </div>
          <Switch checked={row.nps_after_delivery_enabled} onCheckedChange={(v) => setRow({ ...row, nps_after_delivery_enabled: v })} />
        </div>
        {row.nps_after_delivery_enabled && (
          <div className="space-y-1 max-w-xs">
            <Label>Minutos após "entregue"</Label>
            <Input type="number" min={5} max={240} value={row.nps_delay_minutes ?? 40} onChange={(e) => setRow({ ...row, nps_delay_minutes: num(e.target.value) })} />
          </div>
        )}
        <div className="flex items-center justify-between border-b pb-3 pt-2">
          <div>
            <div className="text-sm">Cutucar pedido abandonado</div>
            <p className="text-xs text-muted-foreground">Se o cliente sumiu no meio do atendimento por X minutos, o agente manda uma mensagem leve.</p>
          </div>
          <Switch checked={row.abandoned_followup_enabled} onCheckedChange={(v) => setRow({ ...row, abandoned_followup_enabled: v })} />
        </div>
        {row.abandoned_followup_enabled && (
          <div className="space-y-1 max-w-xs">
            <Label>Minutos sem resposta</Label>
            <Input type="number" min={10} max={240} value={row.abandoned_followup_minutes ?? 30} onChange={(e) => setRow({ ...row, abandoned_followup_minutes: num(e.target.value) })} />
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}