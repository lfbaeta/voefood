import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, RotateCcw, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AgentDraft } from './AgentEditor';

type Version = { id: string; label: string | null; snapshot: any; created_at: string };

export function VersionsTab({
  restaurantId, agent, onRestore,
}: { restaurantId: string; agent: AgentDraft; onRestore: (snap: AgentDraft) => void }) {
  const { toast } = useToast();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!agent.id) { setVersions([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('restaurant_agent_versions')
      .select('id, label, snapshot, created_at')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setVersions((data ?? []) as Version[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [agent.id]);

  async function snapshot() {
    if (!agent.id) {
      toast({ title: 'Salve o agente primeiro', description: 'Versões só podem ser criadas depois de salvar.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('restaurant_agent_versions').insert({
      restaurant_id: restaurantId,
      agent_id: agent.id,
      label: label.trim() || `v${new Date().toLocaleString('pt-BR')}`,
      snapshot: agent as any,
    });
    setSaving(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setLabel('');
    toast({ title: 'Versão salva' });
    load();
  }

  function restore(v: Version) {
    const snap = v.snapshot as AgentDraft;
    onRestore({ ...snap, id: agent.id, restaurant_id: agent.restaurant_id });
    toast({ title: 'Versão restaurada no editor', description: 'Lembre de clicar em Salvar para aplicar.' });
  }

  async function remove(id: string) {
    await supabase.from('restaurant_agent_versions').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-5 pt-4">
      <div className="p-3 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Salvar versão atual</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Tire um snapshot completo do agente antes de mexer numa promo, no prompt ou em regras. Você pode restaurar a qualquer momento.
        </p>
        <div className="flex gap-2">
          <Input placeholder="Nome da versão (ex: Antes do Sextou)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={snapshot} disabled={saving || !agent.id}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Histórico</Label>
          <Badge variant="outline">{versions.length}</Badge>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {agent.id ? 'Nenhuma versão salva ainda.' : 'Salve o agente para começar a versionar.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {versions.map((v) => (
              <div key={v.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{v.label}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(v.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => restore(v)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(v.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}