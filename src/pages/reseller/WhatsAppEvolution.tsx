import { useEffect, useState } from 'react';
import { ResellerLayout } from '@/components/reseller/ResellerLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff, Server, Smartphone, Monitor, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EvolutionInstancesTab } from '@/components/reseller/EvolutionInstancesTab';

type ConfigState = {
  server_url: string;
  global_api_key_masked: string;
  has_api_key: boolean;
  is_configured: boolean;
  last_tested_at: string | null;
};

function ServerTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [show, setShow] = useState(false);
  const [cfg, setCfg] = useState<ConfigState | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('evolution-config', {
      body: { action: 'get' },
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
      return;
    }
    setCfg(data);
    setServerUrl(data?.server_url || '');
    setApiKey('');
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('evolution-config', {
      body: { action: 'save', server_url: serverUrl, global_api_key: apiKey || undefined },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Configuração salva' });
    load();
  }

  async function test() {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('evolution-config', {
      body: { action: 'test' },
    });
    setTesting(false);
    if (error || !data?.ok) {
      toast({ title: 'Falha no teste', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Conexão OK!' });
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url">URL do Evolution Go</Label>
        <Input id="url" placeholder="https://meuservidor.evogo.host" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="key">Global API Key</Label>
        <div className="relative">
          <Input
            id="key"
            type={show ? 'text' : 'password'}
            placeholder={cfg?.has_api_key ? cfg.global_api_key_masked : 'Cole sua API Key global'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {cfg?.has_api_key && (
          <p className="text-xs text-muted-foreground">Deixe em branco para manter a chave atual.</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={test} disabled={testing || !cfg?.is_configured}>
          {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Testar Conexão
        </Button>
        <Button onClick={save} disabled={saving || !serverUrl}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}

function ManagerTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    // Passing a dummy restaurant_id if we don't have one, as assertAccessTo needs it
    // But since we are in reseller context, we can pick any restaurant belonging to this reseller
    // Or just trust the proxy handles it if we pass one.
    const { data: restaurants } = await supabase.from('restaurants').select('id').limit(1);
    const rid = restaurants?.[0]?.id;

    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
      body: { action: 'fetch_server_instances', restaurant_id: rid },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    setInstances(data?.instances || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Instâncias Diretas no Servidor</h3>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
      ) : instances.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center border rounded-lg border-dashed">
          Nenhuma instância encontrada no servidor Evolution.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">Número</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instances.map((inst, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{inst.name}</td>
                  <td className="p-3">{inst.phone ? `+${inst.phone}` : '-'}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={inst.connected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}>
                      {inst.connected ? "Conectado" : "Desconectado"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppEvolution() {
  const [cfgState, setCfgState] = useState<{ is_configured: boolean } | null>(null);

  useEffect(() => {
    supabase.functions.invoke('evolution-config', { body: { action: 'get' } }).then(({ data }) => {
      if (data) setCfgState({ is_configured: !!data.is_configured });
    });
  }, []);

  return (
    <ResellerLayout title="WhatsApp / Evolution Go">
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp / Evolution Go</h1>
          <p className="text-muted-foreground">Configure o servidor global e gerencie as instâncias de cada empresa.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Servidor Evolution Go</CardTitle>
                <CardDescription>Configuração global usada por todas as empresas</CardDescription>
              </div>
            </div>
            {cfgState?.is_configured && (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Configurado
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="server">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="server"><Server className="h-4 w-4 mr-2" />Servidor</TabsTrigger>
                <TabsTrigger value="instances"><Smartphone className="h-4 w-4 mr-2" />Instâncias</TabsTrigger>
                <TabsTrigger value="manager"><Monitor className="h-4 w-4 mr-2" />Manager</TabsTrigger>
              </TabsList>
              <TabsContent value="server" className="pt-4"><ServerTab /></TabsContent>
              <TabsContent value="instances" className="pt-4"><EvolutionInstancesTab /></TabsContent>
              <TabsContent value="manager" className="pt-4"><ManagerTab /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
