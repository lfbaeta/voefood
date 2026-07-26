import { useEffect, useState } from 'react';
import { ResellerLayout } from '@/components/reseller/ResellerLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Bot, Key, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useResellerRestaurants } from '@/hooks/useReseller';

type Routing = {
  id?: string;
  restaurant_id: string;
  capability: string;
  provider: 'lovable' | 'openai' | 'gemini';
  model: string;
  is_active: boolean;
};

const MODELS_BY_PROVIDER: Record<string, Array<{ value: string; label: string }>> = {
  lovable: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'openai/gpt-5', label: 'GPT-5' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
  gemini: [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
};

export default function AIRouting() {
  const { toast } = useToast();
  const { data: restaurants = [] } = useResellerRestaurants();
  const [restaurantId, setRestaurantId] = useState('');
  const [routing, setRouting] = useState<Routing | null>(null);
  const [credProviders, setCredProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyDialog, setKeyDialog] = useState<'openai' | 'gemini' | null>(null);
  const [keyValue, setKeyValue] = useState('');

  useEffect(() => {
    if (!restaurantId && restaurants[0]) setRestaurantId(restaurants[0].id);
  }, [restaurants, restaurantId]);

  async function load() {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('org_ai_routing')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('capability', 'agent_chat')
      .maybeSingle();
    setRouting(
      (data as Routing) ?? {
        restaurant_id: restaurantId,
        capability: 'agent_chat',
        provider: 'lovable',
        model: 'google/gemini-2.5-flash',
        is_active: true,
      },
    );

    const { data: credRes } = await supabase.functions.invoke('manage-ai-credential', {
      body: { action: 'status', restaurant_id: restaurantId, provider: 'openai' },
    });
    setCredProviders((credRes?.providers ?? []).map((p: any) => p.provider));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  async function handleSave() {
    if (!routing || !restaurantId) return;
    setSaving(true);
    const payload = { ...routing, restaurant_id: restaurantId, capability: 'agent_chat' };
    const { error } = await supabase
      .from('org_ai_routing')
      .upsert(payload, { onConflict: 'restaurant_id,capability' });
    setSaving(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Roteamento salvo' });
    load();
  }

  async function handleSaveKey() {
    if (!keyDialog || !keyValue.trim() || !restaurantId) return;
    const { data, error } = await supabase.functions.invoke('manage-ai-credential', {
      body: { action: 'set', restaurant_id: restaurantId, provider: keyDialog, api_key: keyValue.trim() },
    });
    if (error || data?.error) {
      let detail = data?.error || error?.message;
      try {
        const ctx = (error as any)?.context;
        if (ctx?.text) {
          const raw = await ctx.text();
          const parsed = JSON.parse(raw);
          detail = parsed?.error || raw || detail;
        }
      } catch { /* ignore */ }
      toast({ title: 'Erro', description: detail, variant: 'destructive' });
      return;
    }
    toast({ title: 'Chave salva' });
    setKeyDialog(null); setKeyValue(''); load();
  }


  async function handleClearKey(provider: 'openai' | 'gemini') {
    const { error } = await supabase.functions.invoke('manage-ai-credential', {
      body: { action: 'clear', restaurant_id: restaurantId, provider },
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Chave removida' });
    load();
  }

  const needsCred = routing && (routing.provider === 'openai' || routing.provider === 'gemini');
  const hasCred = routing && credProviders.includes(routing.provider);

  return (
    <ResellerLayout title="Roteador IA">
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6 text-primary" /> Roteador de IA</h1>
          <p className="text-muted-foreground text-sm">Escolha qual provider e modelo de IA cada estabelecimento deve usar.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estabelecimento</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={restaurantId} onValueChange={setRestaurantId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {restaurants.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : routing ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Provider e modelo (chat do agente)</CardTitle>
                <CardDescription>"Lovable" é o padrão e não exige chave externa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={routing.provider}
                      onValueChange={(v: any) => setRouting({ ...routing, provider: v, model: MODELS_BY_PROVIDER[v][0].value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lovable">Lovable AI (padrão)</SelectItem>
                        <SelectItem value="openai">OpenAI (chave própria)</SelectItem>
                        <SelectItem value="gemini">Google Gemini (chave própria)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Select value={routing.model} onValueChange={(v) => setRouting({ ...routing, model: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(MODELS_BY_PROVIDER[routing.provider] ?? []).map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar roteamento
                  </Button>
                </div>
              </CardContent>
            </Card>

            {needsCred && (
              <Card className={!hasCred ? 'border-amber-500/50' : ''}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4" /> Chave de API ({routing.provider})
                    {hasCred ? <Badge className="bg-emerald-500/15 text-emerald-700">Configurada</Badge>
                             : <Badge className="bg-amber-500/15 text-amber-700">Necessária</Badge>}
                  </CardTitle>
                  <CardDescription>
                    A chave fica criptografada no banco e é usada apenas pelo backend; nunca é exposta ao painel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => { setKeyDialog(routing.provider as any); setKeyValue(''); }}>
                    <Key className="h-4 w-4 mr-2" /> {hasCred ? 'Substituir chave' : 'Adicionar chave'}
                  </Button>
                  {hasCred && (
                    <Button variant="ghost" className="text-destructive" onClick={() => handleClearKey(routing.provider as any)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remover
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        ) : null}

        <Dialog open={!!keyDialog} onOpenChange={(o) => { if (!o) { setKeyDialog(null); setKeyValue(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chave de API ({keyDialog})</DialogTitle>
              <DialogDescription>Cole abaixo a chave secreta do provider. Ela será criptografada antes de salvar.</DialogDescription>
            </DialogHeader>
            <Input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={keyDialog === 'openai' ? 'sk-...' : 'AIza...'}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setKeyDialog(null); setKeyValue(''); }}>Cancelar</Button>
              <Button onClick={handleSaveKey} disabled={keyValue.trim().length < 8}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResellerLayout>
  );
}