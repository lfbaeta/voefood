import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, CheckCircle2, AlertCircle, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { translateSefaz } from '@/lib/sefazErrors';
import { useBusinessCapabilities } from '@/hooks/useBusinessCapabilities';
import { useStoreConfig } from '@/hooks/useStore';

interface FiscalConfig {
  restaurant_id: string;
  is_enabled: boolean;
  environment: 'homologacao' | 'producao';
  cnpj: string | null;
  ie: string | null;
  im: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  regime_tributario: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  codigo_municipio: string | null;
  csc_id: string | null;
  serie: number;
  proxima_numeracao: number;
  default_ncm: string | null;
  default_cfop: string | null;
  default_csosn: string | null;
  default_origem: string | null;
  default_cest: string | null;
  aliquota_icms: number | null;
  aliquota_pis: number | null;
  aliquota_cofins: number | null;
  focus_company_registered: boolean;
  certificado_filename: string | null;
  certificado_uploaded_at: string | null;
  certificado_expires_at: string | null;
}

const emptyCfg = (rid: string): FiscalConfig => ({
  restaurant_id: rid, is_enabled: false, environment: 'homologacao',
  cnpj: '', ie: '', im: '', razao_social: '', nome_fantasia: '',
  regime_tributario: 'simples_nacional',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '', codigo_municipio: '',
  csc_id: '', serie: 1, proxima_numeracao: 1,
  default_ncm: '21069090', default_cfop: '5102', default_csosn: '102', default_origem: '0', default_cest: '',
  aliquota_icms: 0, aliquota_pis: 0, aliquota_cofins: 0,
  focus_company_registered: false,
  certificado_filename: null, certificado_uploaded_at: null, certificado_expires_at: null,
});

export function FiscalSettings() {
  const { restaurantId } = useEffectiveRestaurantId();
  const { data: store } = useStoreConfig();
  const capabilities = useBusinessCapabilities();
  const suggestedFiscal = capabilities.suggestedFiscalType;
  const businessLabel = (store as any)?.business_type || 'restaurant';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; title: string; hint?: string; raw?: string; reference?: string } | null>(null);
  const [cfg, setCfg] = useState<FiscalConfig | null>(null);
  const [cscToken, setCscToken] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [uploadingCert, setUploadingCert] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('fiscal_config' as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      setCfg((data as any) ?? emptyCfg(restaurantId));
      setLoading(false);
    })();
  }, [restaurantId]);

  const update = (patch: Partial<FiscalConfig>) => setCfg((c) => (c ? { ...c, ...patch } : c));

  const save = async () => {
    if (!cfg || !restaurantId) return;
    setSaving(true);
    try {
      const payload: any = { ...cfg, restaurant_id: restaurantId };
      // We handle csc_token via encrypt RPC only if user typed a new one
      if (cscToken.trim()) {
        const key = 'fiscal';
        // Server-side encrypt
        const { data: enc } = await supabase.rpc('encrypt_ai_credential' as any, {
          p_key: key, p_plain: cscToken.trim(),
        });
        payload.csc_token_cipher = enc;
      }
      const { error } = await supabase
        .from('fiscal_config' as any)
        .upsert(payload, { onConflict: 'restaurant_id' });
      if (error) throw error;
      toast({ title: 'Configuração fiscal salva' });
      setCscToken('');
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const registerAtFocus = async () => {
    if (!restaurantId) return;
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-register-company', {
        body: { restaurant_id: restaurantId },
      });
      if (error) throw error;
      toast({ title: 'CNPJ cadastrado no provedor', description: 'Já pode emitir NFC-e.' });
      update({ focus_company_registered: true });
    } catch (e: any) {
      toast({ title: 'Falha ao cadastrar CNPJ', description: e.message, variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  const uploadCertificate = async () => {
    if (!restaurantId || !certFile || !certPassword.trim()) {
      toast({ title: 'Envie o arquivo (.pfx/.p12) e a senha', variant: 'destructive' });
      return;
    }
    if (certFile.size > 512 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Certificado A1 deve ter até 500KB.', variant: 'destructive' });
      return;
    }
    setUploadingCert(true);
    try {
      const buf = await certFile.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);
      const { data, error } = await supabase.functions.invoke('fiscal-upload-certificate', {
        body: {
          restaurant_id: restaurantId,
          filename: certFile.name,
          certificate_base64: base64,
          password: certPassword,
        },
      });
      if (error) throw error;
      toast({ title: 'Certificado enviado', description: data?.expires_at ? `Válido até ${new Date(data.expires_at).toLocaleDateString('pt-BR')}` : undefined });
      update({
        certificado_filename: certFile.name,
        certificado_uploaded_at: new Date().toISOString(),
        certificado_expires_at: data?.expires_at ?? null,
      });
      setCertFile(null);
      setCertPassword('');
    } catch (e: any) {
      toast({ title: 'Falha ao enviar certificado', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingCert(false);
    }
  };

  const testHomolog = async () => {
    if (!restaurantId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-test-nfce', {
        body: { restaurant_id: restaurantId },
      });
      if (error) throw error;
      if (data?.ok) {
        setTestResult({ ok: true, title: 'Teste enviado com sucesso ao ambiente de homologação', reference: data.reference });
        toast({ title: 'Teste OK', description: 'Payload aceito pela Focus NFe (homologação).' });
      } else {
        const t = translateSefaz(data?.message ?? JSON.stringify(data?.response));
        setTestResult({ ok: false, title: t.title, hint: t.hint, raw: t.raw, reference: data?.reference });
      }
    } catch (e: any) {
      const t = translateSefaz(e.message);
      setTestResult({ ok: false, title: t.title, hint: t.hint, raw: t.raw });
    } finally {
      setTesting(false);
    }
  };

  if (loading || !cfg) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Emissão de NFC-e</CardTitle>
              <CardDescription>
                Ative para emitir nota fiscal de consumidor em pedidos e mesas.
                {suggestedFiscal !== 'nfce' && (
                  <span className="block mt-1 text-amber-600">
                    Atenção: para o tipo "{businessLabel}" o modelo fiscal mais comum é <strong>{suggestedFiscal.toUpperCase()}</strong>.
                    Este módulo ainda emite apenas NFC-e.
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {cfg.focus_company_registered ? (
                <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Cadastrado</Badge>
              ) : (
                <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Não cadastrado</Badge>
              )}
              <Switch checked={cfg.is_enabled} onCheckedChange={(v) => update({ is_enabled: v })} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={cfg.environment} onValueChange={(v: any) => update({ environment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                  <SelectItem value="producao">Produção (valor fiscal real)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Série NFC-e</Label>
              <Input type="number" value={cfg.serie} onChange={(e) => update({ serie: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Próximo número</Label>
              <Input type="number" value={cfg.proxima_numeracao} onChange={(e) => update({ proxima_numeracao: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>CNPJ</Label>
              <Input value={cfg.cnpj ?? ''} onChange={(e) => update({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2"><Label>Inscrição Estadual</Label>
              <Input value={cfg.ie ?? ''} onChange={(e) => update({ ie: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Razão social</Label>
              <Input value={cfg.razao_social ?? ''} onChange={(e) => update({ razao_social: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Nome fantasia</Label>
              <Input value={cfg.nome_fantasia ?? ''} onChange={(e) => update({ nome_fantasia: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Inscrição Municipal</Label>
              <Input value={cfg.im ?? ''} onChange={(e) => update({ im: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Regime tributário</Label>
              <Select value={cfg.regime_tributario ?? 'simples_nacional'} onValueChange={(v) => update({ regime_tributario: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="simples_nacional_excesso">Simples - excesso de sublimite</SelectItem>
                  <SelectItem value="regime_normal">Regime Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Endereço fiscal</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2"><Label>CEP</Label><Input value={cfg.cep ?? ''} onChange={(e) => update({ cep: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Logradouro</Label><Input value={cfg.logradouro ?? ''} onChange={(e) => update({ logradouro: e.target.value })} /></div>
          <div className="space-y-2"><Label>Número</Label><Input value={cfg.numero ?? ''} onChange={(e) => update({ numero: e.target.value })} /></div>
          <div className="space-y-2"><Label>Complemento</Label><Input value={cfg.complemento ?? ''} onChange={(e) => update({ complemento: e.target.value })} /></div>
          <div className="space-y-2"><Label>Bairro</Label><Input value={cfg.bairro ?? ''} onChange={(e) => update({ bairro: e.target.value })} /></div>
          <div className="space-y-2"><Label>Município</Label><Input value={cfg.municipio ?? ''} onChange={(e) => update({ municipio: e.target.value })} /></div>
          <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={cfg.uf ?? ''} onChange={(e) => update({ uf: e.target.value.toUpperCase() })} /></div>
          <div className="space-y-2"><Label>Código IBGE</Label><Input value={cfg.codigo_municipio ?? ''} onChange={(e) => update({ codigo_municipio: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSC (Código de Segurança do Contribuinte)</CardTitle>
          <CardDescription>Fornecido pela SEFAZ do seu estado. Necessário para NFC-e.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>CSC ID</Label>
            <Input value={cfg.csc_id ?? ''} onChange={(e) => update({ csc_id: e.target.value })} placeholder="Ex: 000001" />
          </div>
          <div className="space-y-2"><Label>CSC Token</Label>
            <Input type="password" value={cscToken} onChange={(e) => setCscToken(e.target.value)}
              placeholder={cfg.focus_company_registered ? '••••••••••• (deixe em branco para manter)' : 'Digite o token'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Certificado digital A1</CardTitle>
              <CardDescription>Arquivo <code>.pfx</code> ou <code>.p12</code> emitido pela sua Autoridade Certificadora (Serasa, Certisign, Valid, etc.). Usado para assinar as NFC-e.</CardDescription>
            </div>
            {cfg.certificado_filename ? (
              <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Enviado</Badge>
            ) : (
              <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Não enviado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {cfg.certificado_filename && (
            <div className="text-xs text-muted-foreground space-y-0.5 rounded-md border p-3">
              <div><strong>Arquivo:</strong> {cfg.certificado_filename}</div>
              {cfg.certificado_uploaded_at && (
                <div><strong>Enviado em:</strong> {new Date(cfg.certificado_uploaded_at).toLocaleString('pt-BR')}</div>
              )}
              {cfg.certificado_expires_at && (() => {
                const exp = new Date(cfg.certificado_expires_at);
                const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const expired = days < 0;
                const soon = !expired && days <= 30;
                return (
                  <div className={expired ? 'text-destructive' : soon ? 'text-amber-600' : ''}>
                    <strong>Validade:</strong> {exp.toLocaleDateString('pt-BR')}
                    {expired ? ' (vencido — renove imediatamente)' : soon ? ` (vence em ${days} dias)` : ''}
                  </div>
                );
              })()}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Arquivo do certificado (.pfx / .p12)</Label>
              <Input
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
              {certFile && <p className="text-xs text-muted-foreground">{certFile.name} — {(certFile.size / 1024).toFixed(1)} KB</p>}
            </div>
            <div className="space-y-2">
              <Label>Senha do certificado</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                placeholder="Senha usada para gerar o A1"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={uploadCertificate} disabled={uploadingCert || !certFile || !certPassword.trim()}>
              {uploadingCert ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {cfg.certificado_filename ? 'Substituir certificado' : 'Enviar certificado'}
            </Button>
            <p className="text-xs text-muted-foreground">O arquivo e a senha são criptografados antes de serem armazenados. Nunca são exibidos novamente.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defaults fiscais dos produtos</CardTitle>
          <CardDescription>Aplicados a todos os itens da nota (padrão para restaurante Simples Nacional).</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2"><Label>NCM</Label><Input value={cfg.default_ncm ?? ''} onChange={(e) => update({ default_ncm: e.target.value })} /></div>
          <div className="space-y-2"><Label>CFOP</Label><Input value={cfg.default_cfop ?? ''} onChange={(e) => update({ default_cfop: e.target.value })} /></div>
          <div className="space-y-2"><Label>CSOSN/CST</Label><Input value={cfg.default_csosn ?? ''} onChange={(e) => update({ default_csosn: e.target.value })} /></div>
          <div className="space-y-2"><Label>Origem</Label><Input value={cfg.default_origem ?? ''} onChange={(e) => update({ default_origem: e.target.value })} /></div>
          <div className="space-y-2"><Label>CEST (opcional)</Label><Input value={cfg.default_cest ?? ''} onChange={(e) => update({ default_cest: e.target.value })} /></div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configurações
        </Button>
        <Button variant="secondary" onClick={registerAtFocus} disabled={registering || !cfg.cnpj}>
          {registering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {cfg.focus_company_registered ? 'Reenviar cadastro ao provedor' : 'Cadastrar CNPJ no provedor'}
        </Button>
        <Button variant="outline" onClick={testHomolog} disabled={testing || !cfg.cnpj}>
          {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-2" />}
          Testar em homologação
        </Button>
      </div>

      {testResult && (
        <Card className={testResult.ok ? 'border-green-600/40' : 'border-destructive/40'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {testResult.ok
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <AlertCircle className="h-4 w-4 text-destructive" />}
              {testResult.title}
            </CardTitle>
            {testResult.reference && (
              <CardDescription className="font-mono text-[11px]">ref: {testResult.reference}</CardDescription>
            )}
          </CardHeader>
          {(testResult.hint || testResult.raw) && (
            <CardContent className="space-y-2 text-sm">
              {testResult.hint && <p className="text-muted-foreground">{testResult.hint}</p>}
              {testResult.raw && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Mensagem original da SEFAZ</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px]">{testResult.raw}</pre>
                </details>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
