import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, GraduationCap, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Example = {
  id: string;
  user_message: string;
  good_assistant_message: string;
  bad_assistant_message: string | null;
  note: string | null;
  is_active: boolean;
};

export function TrainingCorrectionsTab({ restaurantId, agentId }: { restaurantId: string; agentId: string | null }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Example[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ user_message: '', good_assistant_message: '', bad_assistant_message: '', note: '' });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('agent_training_examples')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    setItems((data ?? []) as Example[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  async function add() {
    if (!draft.user_message.trim() || !draft.good_assistant_message.trim()) {
      toast({ title: 'Preencha pergunta e resposta correta', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('agent_training_examples').insert({
      restaurant_id: restaurantId,
      agent_id: agentId || null,
      user_message: draft.user_message.trim(),
      good_assistant_message: draft.good_assistant_message.trim(),
      bad_assistant_message: draft.bad_assistant_message.trim() || null,
      note: draft.note.trim() || null,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setDraft({ user_message: '', good_assistant_message: '', bad_assistant_message: '', note: '' });
    toast({ title: 'Correção aprendida' });
    load();
  }

  async function toggleActive(ex: Example) {
    await supabase.from('agent_training_examples').update({ is_active: !ex.is_active }).eq('id', ex.id);
    load();
  }
  async function remove(id: string) {
    await supabase.from('agent_training_examples').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-5 pt-4">
      <div className="p-3 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Ensinar pelo erro (correção)</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Cole o que o cliente disse, como o agente <strong>errou</strong> (opcional) e como ele <strong>deveria</strong> ter respondido. As 12 correções mais recentes são injetadas no prompt como referência forte.
        </p>
        <Textarea rows={2} placeholder="Cliente disse — ex: tem opção sem glúten?"
          value={draft.user_message} onChange={(e) => setDraft({ ...draft, user_message: e.target.value })} />
        <Textarea rows={2} placeholder="Como o agente respondeu ERRADO (opcional)"
          value={draft.bad_assistant_message} onChange={(e) => setDraft({ ...draft, bad_assistant_message: e.target.value })} />
        <Textarea rows={3} placeholder="Como ele DEVERIA ter respondido"
          value={draft.good_assistant_message} onChange={(e) => setDraft({ ...draft, good_assistant_message: e.target.value })} />
        <Input placeholder="Motivo / nota interna (opcional)"
          value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        <div className="flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-2" /> Salvar correção</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Correções salvas</Label>
          <Badge variant="outline">{items.length}</Badge>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma correção salva ainda.</p>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {items.map((ex) => (
              <div key={ex.id} className={`border rounded-lg p-3 space-y-1 text-xs ${ex.is_active ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p><span className="text-muted-foreground">Cliente:</span> {ex.user_message}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={ex.is_active} onCheckedChange={() => toggleActive(ex)} />
                    <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => remove(ex.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {ex.bad_assistant_message && (
                  <p className="text-destructive"><span className="text-muted-foreground">Errou:</span> {ex.bad_assistant_message}</p>
                )}
                <p className="text-primary"><span className="text-muted-foreground">Certo:</span> {ex.good_assistant_message}</p>
                {ex.note && <p className="text-muted-foreground italic">{ex.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}