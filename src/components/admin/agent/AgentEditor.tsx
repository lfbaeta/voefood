import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, Send, Bot, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChipsInput } from './ChipsInput';
import { KnowledgeBaseTab } from './KnowledgeBaseTab';
import { TrainingCorrectionsTab } from './TrainingCorrectionsTab';
import { VersionsTab } from './VersionsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { SafetyTab } from './SafetyTab';
import {
  AI_MODEL_OPTIONS, AI_TOOL_CATALOG, AGENT_TYPE_OPTIONS,
  TONE_OPTIONS, MESSAGE_LENGTH_OPTIONS, EMOJI_LEVEL_OPTIONS,
  CAN_DO_PRESETS, CANNOT_DO_PRESETS, FORBIDDEN_PHRASES_PRESETS,
} from '@/lib/aiAgentConstants';

export type AgentDraft = {
  id: string;
  restaurant_id: string;
  name: string;
  role: string;
  agent_type: string;
  objective: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_steps: number;
  allowed_tools: string[];
  is_active: boolean;
  is_default: boolean;
  tone: string;
  message_length: string;
  emoji_level: string;
  can_do: string[];
  cannot_do: string[];
  required_phrases: string[];
  forbidden_phrases: string[];
  trigger_keywords: string[];
  trigger_phrases: string[];
  typing_delay_ms: number;
  split_messages: boolean;
  proactive_upsell: boolean;
  send_photos: boolean;
  dedicated_instance_id: string | null;
  custom_instructions: string;
  knowledge_faq: Array<{ question: string; answer: string }>;
  example_conversations: Array<{ user: string; assistant: string }>;
  auto_notify_status: boolean;
  notify_statuses: string[];
  can_close_orders: boolean;
};

interface Props {
  agent: AgentDraft;
  onChange: (next: AgentDraft) => void;
  restaurantId: string;
}

export function AgentEditor({ agent, onChange, restaurantId }: Props) {
  const { toast } = useToast();
  const [instances, setInstances] = useState<Array<{ id: string; instance_name: string; status: string }>>([]);
  const [generating, setGenerating] = useState<null | 'objective' | 'system_prompt'>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('evolution_instances').select('id, instance_name, status').eq('restaurant_id', restaurantId);
      setInstances((data ?? []) as any);
    })();
  }, [restaurantId]);

  function patch(p: Partial<AgentDraft>) { onChange({ ...agent, ...p }); }

  async function generate(field: 'objective' | 'system_prompt') {
    setGenerating(field);
    try {
      const { data: rest } = await supabase.from('restaurants').select('name').eq('id', restaurantId).maybeSingle();
      const { data, error } = await supabase.functions.invoke('generate-agent-prompt', {
        body: { tipo: agent.agent_type, nome_restaurante: rest?.name || '', descricao: agent.objective || agent.name, field },
      });
      if (error || !data?.text) {
        toast({ title: 'Não consegui gerar', description: (data as any)?.error || error?.message, variant: 'destructive' });
      } else {
        patch({ [field]: data.text } as any);
        toast({ title: 'Prompt gerado com IA' });
      }
    } finally {
      setGenerating(null);
    }
  }

  return (
    <Tabs defaultValue="identity" className="w-full">
      <TabsList className="w-full overflow-x-auto flex justify-start no-scrollbar h-auto flex-nowrap">
        <TabsTrigger value="identity">Identidade</TabsTrigger>
        <TabsTrigger value="objective">Objetivo</TabsTrigger>
        <TabsTrigger value="rules">Regras</TabsTrigger>
        <TabsTrigger value="tone">Tom</TabsTrigger>
        <TabsTrigger value="training">Treinamento</TabsTrigger>
        <TabsTrigger value="knowledge">Conhecimento</TabsTrigger>
        <TabsTrigger value="corrections">Correções</TabsTrigger>
        <TabsTrigger value="human">Humanização</TabsTrigger>
        <TabsTrigger value="tools">Ferramentas</TabsTrigger>
        <TabsTrigger value="channels">Canais</TabsTrigger>
        <TabsTrigger value="versions">Versões</TabsTrigger>
        <TabsTrigger value="safety">Segurança</TabsTrigger>
        <TabsTrigger value="analytics">Desempenho</TabsTrigger>
        <TabsTrigger value="test">Testar</TabsTrigger>
      </TabsList>

      {/* IDENTIDADE */}
      <TabsContent value="identity" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label>Tipo de Agente</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AGENT_TYPE_OPTIONS.map((t) => {
              const active = agent.agent_type === t.value;
              return (
                <button key={t.value} type="button" onClick={() => patch({ agent_type: t.value })}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="text-2xl">{t.emoji}</div>
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground">{t.description}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nome do agente</Label>
            <Input value={agent.name} onChange={(e) => patch({ name: e.target.value })} placeholder="ex: Ana, Atendente" />
          </div>
          <div className="space-y-2">
            <Label>Modelo de IA</Label>
            <Select value={agent.model} onValueChange={(v) => patch({ model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AI_MODEL_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Switch checked={agent.is_active} onCheckedChange={(v) => patch({ is_active: v })} />
            <Label>Ativo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={agent.is_default} onCheckedChange={(v) => patch({ is_default: v })} />
            <Label>Padrão</Label>
          </div>
        </div>
      </TabsContent>

      {/* OBJETIVO */}
      <TabsContent value="objective" className="space-y-4 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Objetivo Principal</Label>
            <Button type="button" size="sm" variant="ghost" disabled={!!generating} onClick={() => generate('objective')}>
              {generating === 'objective' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />} Otimizar
            </Button>
          </div>
          <Textarea rows={4} value={agent.objective} onChange={(e) => patch({ objective: e.target.value })}
            placeholder="Ex: Receber clientes no WhatsApp, tirar pedidos rápido, oferecer upsell e fechar o pedido confirmando endereço e pagamento." />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Prompt da Persona</Label>
            <Button type="button" size="sm" variant="ghost" disabled={!!generating} onClick={() => generate('system_prompt')}>
              {generating === 'system_prompt' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />} Gerar com IA
            </Button>
          </div>
          <Textarea rows={14} value={agent.system_prompt} onChange={(e) => patch({ system_prompt: e.target.value })}
            className="font-mono text-xs" placeholder="Você é o atendente virtual do {RESTAURANTE}..." />
          <p className="text-xs text-muted-foreground">Use <code>{'{RESTAURANTE}'}</code> para o nome do estabelecimento.</p>
        </div>
      </TabsContent>

      {/* REGRAS */}
      <TabsContent value="rules" className="space-y-5 pt-4">
        <div className="space-y-2">
          <Label>O que o agente PODE fazer</Label>
          <ChipsInput value={agent.can_do} onChange={(v) => patch({ can_do: v })}
            placeholder="Ex: Sugerir bebida com pizza" presets={CAN_DO_PRESETS} />
        </div>
        <div className="space-y-2">
          <Label>O que o agente NÃO PODE fazer</Label>
          <ChipsInput value={agent.cannot_do} onChange={(v) => patch({ cannot_do: v })}
            placeholder="Ex: Falar de preço fora do cardápio" presets={CANNOT_DO_PRESETS} />
        </div>
        <div className="space-y-2 pt-2 border-t">
          <Label>Palavras-chave de gatilho</Label>
          <p className="text-xs text-muted-foreground">Quando o cliente disser alguma destas, este agente assume a conversa.</p>
          <ChipsInput value={agent.trigger_keywords} onChange={(v) => patch({ trigger_keywords: v })} placeholder="ex: cardápio, pedido, entrega" />
        </div>
      </TabsContent>

      {/* TOM */}
      <TabsContent value="tone" className="space-y-4 pt-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Estilo de Tom</Label>
            <Select value={agent.tone} onValueChange={(v) => patch({ tone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TONE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tamanho das mensagens</Label>
            <Select value={agent.message_length} onValueChange={(v) => patch({ message_length: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MESSAGE_LENGTH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nível de Emoji</Label>
            <Select value={agent.emoji_level} onValueChange={(v) => patch({ emoji_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EMOJI_LEVEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <Label>Frases obrigatórias</Label>
          <ChipsInput value={agent.required_phrases} onChange={(v) => patch({ required_phrases: v })} placeholder="Ex: Vai querer beber alguma coisa?" />
        </div>
        <div className="space-y-2">
          <Label>Frases proibidas</Label>
          <ChipsInput value={agent.forbidden_phrases} onChange={(v) => patch({ forbidden_phrases: v })}
            placeholder="Ex: Como posso ajudar?" presets={FORBIDDEN_PHRASES_PRESETS} />
        </div>
      </TabsContent>

      {/* TREINAMENTO */}
      <TabsContent value="training" className="space-y-5 pt-4">
        <div className="space-y-2">
          <Label>Instruções personalizadas</Label>
          <p className="text-xs text-muted-foreground">
            Escreva como o restaurante quer que o agente se comporte. Esse texto é injetado direto no prompt — use para regras específicas, jargões, promoções da semana, etc.
          </p>
          <Textarea
            rows={8}
            value={agent.custom_instructions || ''}
            onChange={(e) => patch({ custom_instructions: e.target.value })}
            placeholder={`Ex:
- Sempre se referir ao cliente como "chefia".
- Na sexta à noite, sugerir a promo "Combo Sextou" (R$ 49,90).
- Se perguntarem sobre glúten, dizer que o pão é convencional.
- Não vendemos bebida alcoólica antes das 17h.`}
          />
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label>Base de conhecimento (FAQ)</Label>
              <p className="text-xs text-muted-foreground">Perguntas frequentes que o agente deve saber responder do jeito do restaurante.</p>
            </div>
            <Button type="button" size="sm" variant="outline"
              onClick={() => patch({ knowledge_faq: [...(agent.knowledge_faq || []), { question: '', answer: '' }] })}>
              + Adicionar
            </Button>
          </div>
          <div className="space-y-3">
            {(agent.knowledge_faq || []).map((qa, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">FAQ #{idx + 1}</span>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive h-7"
                    onClick={() => patch({ knowledge_faq: agent.knowledge_faq.filter((_, i) => i !== idx) })}>
                    Remover
                  </Button>
                </div>
                <Input
                  value={qa.question}
                  onChange={(e) => {
                    const next = [...agent.knowledge_faq];
                    next[idx] = { ...next[idx], question: e.target.value };
                    patch({ knowledge_faq: next });
                  }}
                  placeholder="Pergunta — ex: Vocês entregam no bairro X?"
                />
                <Textarea
                  rows={2}
                  value={qa.answer}
                  onChange={(e) => {
                    const next = [...agent.knowledge_faq];
                    next[idx] = { ...next[idx], answer: e.target.value };
                    patch({ knowledge_faq: next });
                  }}
                  placeholder="Resposta — ex: Sim, entregamos no bairro X com taxa de R$ 7,00."
                />
              </div>
            ))}
            {(agent.knowledge_faq || []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma pergunta cadastrada ainda.</p>
            )}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label>Exemplos de conversa</Label>
              <p className="text-xs text-muted-foreground">Mostre ao agente como você gostaria que ele respondesse em situações reais (few-shot).</p>
            </div>
            <Button type="button" size="sm" variant="outline"
              onClick={() => patch({ example_conversations: [...(agent.example_conversations || []), { user: '', assistant: '' }] })}>
              + Adicionar
            </Button>
          </div>
          <div className="space-y-3">
            {(agent.example_conversations || []).map((ex, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Exemplo #{idx + 1}</span>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive h-7"
                    onClick={() => patch({ example_conversations: agent.example_conversations.filter((_, i) => i !== idx) })}>
                    Remover
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={ex.user}
                  onChange={(e) => {
                    const next = [...agent.example_conversations];
                    next[idx] = { ...next[idx], user: e.target.value };
                    patch({ example_conversations: next });
                  }}
                  placeholder="Cliente disse — ex: oi, tem aquele x-tudo ainda?"
                />
                <Textarea
                  rows={3}
                  value={ex.assistant}
                  onChange={(e) => {
                    const next = [...agent.example_conversations];
                    next[idx] = { ...next[idx], assistant: e.target.value };
                    patch({ example_conversations: next });
                  }}
                  placeholder="Agente responde — ex: Salve! Tem sim 🔥 Quer com batata e refri pra fechar o combo?"
                />
              </div>
            ))}
            {(agent.example_conversations || []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum exemplo cadastrado ainda.</p>
            )}
          </div>
        </div>
      </TabsContent>

      {/* HUMANIZAÇÃO */}
      <TabsContent value="human" className="space-y-5 pt-4">
        <div className="flex items-start justify-between gap-3 p-3 border rounded-lg">
          <div>
            <Label>Quebrar resposta em várias bolhas</Label>
            <p className="text-xs text-muted-foreground">Soa mais humano. Modelo usa <code>---</code> como separador.</p>
          </div>
          <Switch checked={agent.split_messages} onCheckedChange={(v) => patch({ split_messages: v })} />
        </div>
        <div className="space-y-2">
          <Label>Atraso entre bolhas: {agent.typing_delay_ms}ms</Label>
          <Input type="range" min={0} max={3000} step={100} value={agent.typing_delay_ms}
            onChange={(e) => patch({ typing_delay_ms: Number(e.target.value) })} />
        </div>
        <div className="flex items-start justify-between gap-3 p-3 border rounded-lg">
          <div>
            <Label>Sugerir complementos proativamente</Label>
            <p className="text-xs text-muted-foreground">Oferece bebida/sobremesa quando o cliente escolhe o prato.</p>
          </div>
          <Switch checked={agent.proactive_upsell} onCheckedChange={(v) => patch({ proactive_upsell: v })} />
        </div>
        <div className="flex items-start justify-between gap-3 p-3 border rounded-lg">
          <div>
            <Label>Enviar fotos quando pedido</Label>
            <p className="text-xs text-muted-foreground">Se o cliente pedir foto, manda a imagem do produto.</p>
          </div>
          <Switch checked={agent.send_photos} onCheckedChange={(v) => patch({ send_photos: v })} />
        </div>

        {/* AUTOMAÇÃO */}
        <div className="pt-4 border-t space-y-3">
          <Label className="text-sm font-semibold">🤖 Automação de vendas e atendimento</Label>

          <div className="flex items-start justify-between gap-3 p-3 border rounded-lg">
            <div>
              <Label>Fechar pedidos automaticamente</Label>
              <p className="text-xs text-muted-foreground">
                Deixa o agente confirmar itens, endereço, cupom e criar o pedido no sistema sem passar por um humano.
              </p>
            </div>
            <Switch checked={agent.can_close_orders} onCheckedChange={(v) => patch({ can_close_orders: v })} />
          </div>

          <div className="p-3 border rounded-lg space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label>Avisar cliente por WhatsApp em cada status</Label>
                <p className="text-xs text-muted-foreground">
                  Sempre que o pedido mudar de status, o agente envia a mensagem correspondente (usa os templates configurados em <em>Mensagens WhatsApp</em>).
                </p>
              </div>
              <Switch checked={agent.auto_notify_status} onCheckedChange={(v) => patch({ auto_notify_status: v })} />
            </div>
            {agent.auto_notify_status && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {[
                  { k: 'pix_pending', label: '💠 PIX pendente' },
                  { k: 'accepted', label: '✅ Aceito / em preparo' },
                  { k: 'delivery', label: '🛵 Saiu para entrega' },
                  { k: 'completed', label: '🎉 Finalizado' },
                  { k: 'cancelled', label: '❌ Cancelado' },
                ].map((s) => {
                  const checked = agent.notify_statuses?.includes(s.k) ?? false;
                  return (
                    <label key={s.k} className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded hover:bg-muted/40">
                      <Checkbox checked={checked} onCheckedChange={(v) => {
                        const set = new Set(agent.notify_statuses ?? []);
                        if (v) set.add(s.k); else set.delete(s.k);
                        patch({ notify_statuses: Array.from(set) });
                      }} />
                      <span>{s.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
          <div className="space-y-2">
            <Label>Temperatura ({agent.temperature.toFixed(1)})</Label>
            <Input type="range" min={0} max={1} step={0.1} value={agent.temperature}
              onChange={(e) => patch({ temperature: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Máx passos do loop</Label>
            <Input type="number" min={1} max={20} value={agent.max_steps} onChange={(e) => patch({ max_steps: Number(e.target.value) || 1 })} />
          </div>
        </div>
      </TabsContent>

      {/* FERRAMENTAS */}
      <TabsContent value="tools" className="space-y-3 pt-4">
        <p className="text-xs text-muted-foreground">Vazio = todas habilitadas. Marque para restringir.</p>
        <div className="grid sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto p-3 border rounded-lg">
          {AI_TOOL_CATALOG.map((t) => {
            const checked = agent.allowed_tools?.includes(t.name);
            return (
              <label key={t.name} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                <Checkbox checked={checked} onCheckedChange={(v) => {
                  const set = new Set(agent.allowed_tools ?? []);
                  if (v) set.add(t.name); else set.delete(t.name);
                  patch({ allowed_tools: Array.from(set) });
                }} />
                <div className="text-xs">
                  <div className="font-medium flex items-center gap-1">{t.label}
                    <Badge variant="outline" className="text-[10px] py-0 h-4">F{t.phase}</Badge>
                  </div>
                  <div className="text-muted-foreground">{t.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </TabsContent>

      {/* CANAIS */}
      <TabsContent value="channels" className="space-y-4 pt-4">
        <div className="p-3 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-2">
          <Label className="flex items-center gap-2">📱 Conexão WhatsApp dedicada</Label>
          <p className="text-xs text-muted-foreground">Se selecionada, este agente <strong>só</strong> responderá mensagens desta conexão.</p>
          <Select value={agent.dedicated_instance_id || 'any'} onValueChange={(v) => patch({ dedicated_instance_id: v === 'any' ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Qualquer conexão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">🌐 Qualquer conexão (padrão)</SelectItem>
              {instances.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.instance_name} {i.status === 'connected' ? '🟢' : '🔴'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      {/* TESTAR */}
      <TabsContent value="test" className="pt-4">
        <PlaygroundTab agent={agent} restaurantId={restaurantId} />
      </TabsContent>

      {/* CONHECIMENTO (RAG) */}
      <TabsContent value="knowledge">
        <KnowledgeBaseTab restaurantId={restaurantId} />
      </TabsContent>

      {/* CORREÇÕES (few-shot) */}
      <TabsContent value="corrections">
        <TrainingCorrectionsTab restaurantId={restaurantId} agentId={agent.id || null} />
      </TabsContent>

      {/* VERSÕES */}
      <TabsContent value="versions">
        <VersionsTab restaurantId={restaurantId} agent={agent} onRestore={(snap) => onChange(snap)} />
      </TabsContent>

      {/* SEGURANÇA + PROATIVIDADE */}
      <TabsContent value="safety">
        <SafetyTab restaurantId={restaurantId} />
      </TabsContent>

      {/* DESEMPENHO */}
      <TabsContent value="analytics">
        <AnalyticsTab restaurantId={restaurantId} agentId={agent.id || null} />
      </TabsContent>
    </Tabs>
  );
}

function PlaygroundTab({ agent, restaurantId }: { agent: AgentDraft; restaurantId: string }) {
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<Array<{ role: 'user' | 'assistant'; bubbles: string[] }>>([]);
  const [input, setInput] = useState('');
  const [traces, setTraces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const nextMsgs = [...msgs, { role: 'user' as const, bubbles: [text] }];
    setMsgs(nextMsgs);
    setLoading(true);
    try {
      const flat = nextMsgs.flatMap((m) => m.bubbles.map((b) => ({ role: m.role, content: b })));
      const { data, error } = await supabase.functions.invoke('agent-playground', {
        body: { agent, restaurant_id: restaurantId, messages: flat },
      });
      if (error || (data as any)?.error) {
        toast({ title: 'Erro no playground', description: (data as any)?.error || error?.message, variant: 'destructive' });
      } else {
        setMsgs((m) => [...m, { role: 'assistant', bubbles: (data as any).bubbles || [] }]);
        setTraces((data as any).traces || []);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-3">
      <Card className="p-3 space-y-3 bg-muted/30">
        <div className="min-h-[280px] max-h-[420px] overflow-y-auto space-y-3 p-1">
          {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Comece a conversa para testar o agente sem enviar pro WhatsApp real.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {m.role === 'assistant' && <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Bot className="h-4 w-4 text-primary" /></div>}
              <div className="flex flex-col gap-1 max-w-[80%]">
                {m.bubbles.map((b, j) => (
                  <div key={j} className={`text-sm px-3 py-2 rounded-2xl whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-background border rounded-bl-sm'}`}>{b}</div>
                ))}
              </div>
              {m.role === 'user' && <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4" /></div>}
            </div>
          ))}
          {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> O agente está pensando…</div>}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Digite como se fosse o cliente…" />
          <Button onClick={send} disabled={loading}><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
      <Card className="p-3 text-xs space-y-2 max-h-[480px] overflow-y-auto">
        <div className="font-semibold flex items-center justify-between">Tools executadas <Badge variant="outline">{traces.length}</Badge></div>
        {traces.length === 0 && <p className="text-muted-foreground">Sem chamadas ainda.</p>}
        {traces.map((t, i) => (
          <div key={i} className="border rounded p-2 space-y-1">
            <div className="font-mono text-[11px] text-primary">{t.tool}</div>
            <div className="text-[10px] text-muted-foreground"><strong>in:</strong> {JSON.stringify(t.input)}</div>
            <div className="text-[10px] text-muted-foreground line-clamp-3"><strong>out:</strong> {JSON.stringify(t.output)}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}