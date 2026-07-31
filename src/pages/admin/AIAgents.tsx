import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Bot, Trash2, Star, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { DEFAULT_AGENT_PROMPT } from '@/lib/aiAgentConstants';
import { AgentEditor, type AgentDraft } from '@/components/admin/agent/AgentEditor';

type Agent = AgentDraft;

type Limits = {
  restaurant_id: string;
  max_tool_executions_per_day: number;
  max_cost_cents_per_day: number;
  cancel_max_value_cents: number;
};

const EMPTY_AGENT = (restaurantId: string): Agent => ({
  id: '',
  restaurant_id: restaurantId,
  name: 'Atendente',
  role: 'attendant',
  agent_type: 'atendente',
  objective: '',
  system_prompt: DEFAULT_AGENT_PROMPT,
  model: 'google/gemini-2.5-flash',
  temperature: 0.7,
  max_steps: 8,
  allowed_tools: [],
  is_active: true,
  is_default: false,
  tone: 'friendly',
  message_length: 'short',
  emoji_level: 'moderate',
  can_do: [],
  cannot_do: [],
  required_phrases: [],
  forbidden_phrases: [],
  trigger_keywords: [],
  trigger_phrases: [],
  typing_delay_ms: 800,
  split_messages: true,
  proactive_upsell: true,
  send_photos: true,
  dedicated_instance_id: null,
  custom_instructions: '',
  knowledge_faq: [],
  example_conversations: [],
  auto_notify_status: true,
  notify_statuses: ['pix_pending', 'accepted', 'preparing', 'delivery', 'completed', 'cancelled'],
  can_close_orders: true,
});

export default function AIAgents() {
  const { toast } = useToast();
  const { restaurantId } = useEffectiveRestaurantId();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!restaurantId) return;
    setLoading(true);
    const [{ data: ags }, { data: lim }] = await Promise.all([
      supabase.from('restaurant_agents').select('*').eq('restaurant_id', restaurantId).order('created_at'),
      supabase.from('agent_safety_limits').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
    ]);
    setAgents((ags ?? []) as unknown as Agent[]);
    setLimits(lim as Limits | null);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  function openCreate() {
    if (!restaurantId) return;
    setEditing(EMPTY_AGENT(restaurantId));
    setEditorOpen(true);
  }
  function openEdit(a: Agent) {
    setEditing({
      ...EMPTY_AGENT(a.restaurant_id),
      ...a,
      allowed_tools: a.allowed_tools ?? [],
      can_do: (a as any).can_do ?? [],
      cannot_do: (a as any).cannot_do ?? [],
      required_phrases: (a as any).required_phrases ?? [],
      forbidden_phrases: (a as any).forbidden_phrases ?? [],
      trigger_keywords: (a as any).trigger_keywords ?? [],
      trigger_phrases: (a as any).trigger_phrases ?? [],
      custom_instructions: (a as any).custom_instructions ?? '',
      knowledge_faq: Array.isArray((a as any).knowledge_faq) ? (a as any).knowledge_faq : [],
      example_conversations: Array.isArray((a as any).example_conversations) ? (a as any).example_conversations : [],
    });
    setEditorOpen(true);
  }

  async function handleSave() {
    if (!editing || !restaurantId) return;
    if (!editing.name.trim() || !editing.system_prompt.trim()) {
      toast({ title: 'Preencha nome e prompt', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: editing.name.trim(),
      role: editing.role,
      agent_type: editing.agent_type,
      objective: editing.objective,
      system_prompt: editing.system_prompt,
      model: editing.model,
      temperature: editing.temperature,
      max_steps: editing.max_steps,
      allowed_tools: editing.allowed_tools ?? [],
      is_active: editing.is_active,
      is_default: editing.is_default,
      tone: editing.tone,
      message_length: editing.message_length,
      emoji_level: editing.emoji_level,
      can_do: editing.can_do ?? [],
      cannot_do: editing.cannot_do ?? [],
      required_phrases: editing.required_phrases ?? [],
      forbidden_phrases: editing.forbidden_phrases ?? [],
      trigger_keywords: editing.trigger_keywords ?? [],
      trigger_phrases: editing.trigger_phrases ?? [],
      typing_delay_ms: editing.typing_delay_ms,
      split_messages: editing.split_messages,
      proactive_upsell: editing.proactive_upsell,
      send_photos: editing.send_photos,
      dedicated_instance_id: editing.dedicated_instance_id,
      custom_instructions: editing.custom_instructions ?? '',
      knowledge_faq: editing.knowledge_faq ?? [],
      example_conversations: editing.example_conversations ?? [],
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from('restaurant_agents').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('restaurant_agents').insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Agente salvo' });
    setEditorOpen(false);
    setEditing(null);
    load();
  }

  async function handleDelete(a: Agent) {
    const { error } = await supabase.from('restaurant_agents').delete().eq('id', a.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Agente removido' });
    load();
  }

  async function handleSetDefault(a: Agent) {
    // Limpa default atual e marca esse
    await supabase.from('restaurant_agents').update({ is_default: false }).eq('restaurant_id', restaurantId!);
    const { error } = await supabase.from('restaurant_agents').update({ is_default: true, is_active: true }).eq('id', a.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    load();
  }

  async function handleSaveLimits(next: Partial<Limits>) {
    if (!restaurantId) return;
    const payload = {
      restaurant_id: restaurantId,
      max_tool_executions_per_day: next.max_tool_executions_per_day ?? limits?.max_tool_executions_per_day ?? 5000,
      max_cost_cents_per_day: next.max_cost_cents_per_day ?? limits?.max_cost_cents_per_day ?? 50000,
      cancel_max_value_cents: next.cancel_max_value_cents ?? limits?.cancel_max_value_cents ?? 20000,
    };
    const { error } = await supabase.from('agent_safety_limits').upsert(payload, { onConflict: 'restaurant_id' });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Limites salvos' });
    setLimits(payload as Limits);
  }

  return (
    <AdminLayout title="Agentes IA">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6 text-primary" /> Agentes IA</h1>
            <p className="text-muted-foreground text-sm">
              Configure o atendente automático que responde no WhatsApp do seu restaurante.
            </p>
          </div>
          <Button onClick={openCreate} disabled={!restaurantId}>
            <Plus className="h-4 w-4 mr-2" /> Novo agente
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="font-medium">Nenhum agente configurado</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Crie um agente para que a IA comece a atender suas conversas de WhatsApp automaticamente.
              </p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Criar primeiro agente</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {agents.map((a) => (
              <Card key={a.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openEdit(a)}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <span className="truncate">{a.name}</span>
                        {a.is_default && (
                          <Badge variant="outline" className="bg-primary/10 text-primary"><Star className="h-3 w-3 mr-1" /> Padrão</Badge>
                        )}
                        {!a.is_active && <Badge variant="outline">Inativo</Badge>}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">
                        {a.model} · {a.allowed_tools?.length ? `${a.allowed_tools.length} ferramentas` : 'todas as ferramentas'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {!a.is_default && (
                      <Button size="sm" variant="ghost" title="Definir como padrão" onClick={() => handleSetDefault(a)}>
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover agente?</AlertDialogTitle>
                          <AlertDialogDescription>"{a.name}" será removido permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Limites de segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Limites de segurança</CardTitle>
            <CardDescription>Tetos diários para evitar surpresas de custo ou loops.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Execuções de ferramentas / dia</Label>
              <Input
                type="number"
                value={limits?.max_tool_executions_per_day ?? 5000}
                onChange={(e) => setLimits((p) => ({ ...(p ?? { restaurant_id: restaurantId!, max_cost_cents_per_day: 50000, cancel_max_value_cents: 20000 } as Limits), max_tool_executions_per_day: Number(e.target.value) || 0 }))}
                onBlur={(e) => handleSaveLimits({ max_tool_executions_per_day: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Orçamento diário (R$)</Label>
              <Input
                type="number" step="1"
                value={((limits?.max_cost_cents_per_day ?? 50000) / 100).toFixed(0)}
                onChange={(e) => setLimits((p) => ({ ...(p ?? { restaurant_id: restaurantId!, max_tool_executions_per_day: 5000, cancel_max_value_cents: 20000 } as Limits), max_cost_cents_per_day: Math.round((Number(e.target.value) || 0) * 100) }))}
                onBlur={(e) => handleSaveLimits({ max_cost_cents_per_day: Math.round((Number(e.target.value) || 0) * 100) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cancelamento máx s/ aprovação (R$)</Label>
              <Input
                type="number" step="1"
                value={((limits?.cancel_max_value_cents ?? 20000) / 100).toFixed(0)}
                onChange={(e) => setLimits((p) => ({ ...(p ?? { restaurant_id: restaurantId!, max_tool_executions_per_day: 5000, max_cost_cents_per_day: 50000 } as Limits), cancel_max_value_cents: Math.round((Number(e.target.value) || 0) * 100) }))}
                onBlur={(e) => handleSaveLimits({ cancel_max_value_cents: Math.round((Number(e.target.value) || 0) * 100) })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'Editar agente' : 'Novo agente'}</DialogTitle>
              <DialogDescription>Configure persona, tom, regras, humanização e ferramentas em abas.</DialogDescription>
            </DialogHeader>
            {editing && restaurantId && (
              <AgentEditor agent={editing} onChange={setEditing} restaurantId={restaurantId} />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}