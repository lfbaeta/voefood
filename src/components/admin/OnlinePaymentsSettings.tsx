import { useEffect, useState, useCallback } from 'react';
import { Loader2, CreditCard, Save, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import { supabase } from '@/integrations/supabase/client';

type Provider = 'mercado_pago' | 'asaas';

interface GatewayState {
  exists: boolean;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  accepts_pix: boolean;
  accepts_credit_card: boolean;
  public_key: string | null;
  credentials_masked: Record<string, string>;
  last_test_at: string | null;
  last_test_ok: boolean | null;
}

const PROVIDERS: { id: Provider; label: string; fields: { key: string; label: string; secret: boolean; placeholder?: string }[]; docsUrl: string }[] = [
  {
    id: 'mercado_pago',
    label: 'Mercado Pago',
    docsUrl: 'https://www.mercadopago.com.br/developers/panel/app',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true, placeholder: 'APP_USR-...' },
      { key: 'webhook_secret', label: 'Webhook Secret (assinatura)', secret: true, placeholder: 'Copie de Webhooks > Configurar notificações' },
    ],
  },
  {
    id: 'asaas',
    label: 'Asaas',
    docsUrl: 'https://www.asaas.com/customerApiAccessToken/index',
    fields: [
      { key: 'api_key', label: 'API Key', secret: true, placeholder: '$aact_...' },
      { key: 'webhook_token', label: 'Token de autenticação do webhook', secret: true, placeholder: 'Defina um token e cole no Asaas' },
    ],
  },
];

function GatewayCard({ provider, projectRef }: { provider: typeof PROVIDERS[number]; projectRef: string }) {
  const { restaurantId } = useEffectiveRestaurantId();
  const { toast } = useToast();
  const { checkDemoMode } = useDemoGuard();

  const [state, setState] = useState<GatewayState | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [publicKey, setPublicKey] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');
  const [acceptsPix, setAcceptsPix] = useState(true);
  const [acceptsCard, setAcceptsCard] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const webhookUrl = provider.id === 'mercado_pago'
    ? `https://${projectRef}.functions.supabase.co/mp-restaurant-webhook?restaurant_id=${restaurantId ?? ''}`
    : `https://${projectRef}.functions.supabase.co/asaas-restaurant-webhook?restaurant_id=${restaurantId ?? ''}`;

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('restaurant-payment-config', {
      body: { action: 'get', provider: provider.id, restaurant_id: restaurantId },
    });
    setLoading(false);
    if (error) return;
    const s = data as GatewayState;
    setState(s);
    setIsEnabled(s.is_enabled);
    setEnvironment(s.environment);
    setAcceptsPix(s.accepts_pix);
    setAcceptsCard(s.accepts_credit_card);
    setPublicKey(s.public_key || '');
  }, [restaurantId, provider.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (checkDemoMode() || !restaurantId) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('restaurant-payment-config', {
      body: {
        action: 'save',
        provider: provider.id,
        restaurant_id: restaurantId,
        is_enabled: isEnabled,
        environment,
        accepts_pix: acceptsPix,
        accepts_credit_card: acceptsCard,
        credentials: creds,
        public_key: publicKey || null,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro ao salvar', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    setCreds({});
    toast({ title: 'Configuração salva' });
    load();
  };

  const handleTest = async () => {
    if (!restaurantId) return;
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('restaurant-payment-config', {
      body: {
        action: 'test',
        provider: provider.id,
        restaurant_id: restaurantId,
        environment,
        credentials: creds,
      },
    });
    setTesting(false);
    if (error) {
      toast({ title: 'Erro no teste', description: error.message, variant: 'destructive' });
      return;
    }
    const r = data as { ok: boolean; message: string };
    toast({ title: r.ok ? 'Conexão OK' : 'Falha na conexão', description: r.message, variant: r.ok ? 'default' : 'destructive' });
    load();
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'URL copiada' });
  };

  if (loading) return <div className="border rounded-lg p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{provider.label}</h3>
          {state?.is_enabled && <Badge variant="secondary">Ativo</Badge>}
          {state?.last_test_ok === true && <Badge className="bg-green-500/15 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Testado</Badge>}
          {state?.last_test_ok === false && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro no teste</Badge>}
        </div>
        <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">Onde achar as chaves?</a>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={isEnabled} onCheckedChange={setIsEnabled} id={`enabled-${provider.id}`} />
        <Label htmlFor={`enabled-${provider.id}`}>Habilitar este gateway</Label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Ambiente</Label>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Produção</SelectItem>
              <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acceptsPix} onChange={(e) => setAcceptsPix(e.target.checked)} /> PIX</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acceptsCard} onChange={(e) => setAcceptsCard(e.target.checked)} /> Cartão</label>
        </div>
      </div>

      <div className="space-y-3">
        {provider.fields.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input
              type={f.secret ? 'password' : 'text'}
              placeholder={state?.credentials_masked?.[f.key] || f.placeholder || ''}
              value={creds[f.key] || ''}
              onChange={(e) => setCreds(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
            {state?.credentials_masked?.[f.key] && !creds[f.key] && (
              <p className="text-xs text-muted-foreground mt-1">Atual: {state.credentials_masked[f.key]} — deixe em branco para manter.</p>
            )}
          </div>
        ))}
        {provider.id === 'mercado_pago' && (
          <div>
            <Label>Public Key (opcional — necessária para cartão)</Label>
            <Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="APP_USR-..." />
          </div>
        )}
      </div>

      <div className="rounded border bg-muted/40 p-3 space-y-1">
        <p className="text-xs font-medium">URL do webhook (cole no painel do {provider.label}):</p>
        <div className="flex items-center gap-2">
          <code className="text-xs flex-1 break-all">{webhookUrl}</code>
          <Button size="sm" variant="ghost" onClick={copyWebhook}><Copy className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Testar conexão
        </Button>
      </div>
    </div>
  );
}

export function OnlinePaymentsSettings() {
  const projectRef = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID as string;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Pagamentos Online</h2>
        <p className="text-sm text-muted-foreground">Receba PIX e Cartão direto na sua conta. Configure pelo menos um gateway abaixo.</p>
      </div>
      {PROVIDERS.map(p => <GatewayCard key={p.id} provider={p} projectRef={projectRef} />)}
    </div>
  );
}
