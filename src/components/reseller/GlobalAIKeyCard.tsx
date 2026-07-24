import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Loader2, KeyRound, Trash2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Status = {
  configured: boolean;
  masked: string | null;
  updated_at: string | null;
};

export function GlobalAIKeyCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-global-ai-key', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setStatus(data as Status);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (apiKey.trim().length < 20) {
      toast({ title: 'Chave inválida', description: 'Cole a chave completa da OpenAI (sk-...).', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('manage-global-ai-key', {
        body: { action: 'set', api_key: apiKey.trim() },
      });
      if (error) throw error;
      toast({ title: 'Chave salva', description: 'Melhorador de imagens ativado para todos os restaurantes.' });
      setApiKey('');
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Remover a chave? O melhorador de imagens será desativado para todos os restaurantes.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('manage-global-ai-key', {
        body: { action: 'clear' },
      });
      if (error) throw error;
      toast({ title: 'Chave removida' });
      await load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          IA — Melhorador de Fotos (OpenAI)
        </CardTitle>
        <CardDescription>
          Cadastre uma chave da API da OpenAI. Ela é usada globalmente por todos os restaurantes
          para melhorar imagens de produtos (modelo <code>gpt-image-1</code>). A chave nunca é exposta ao navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : status?.configured ? (
          <Alert className="border-green-500/40 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>Chave configurada:</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded">{status.masked}</code>
              {status.updated_at && (
                <span className="text-xs text-muted-foreground">
                  atualizada em {new Date(status.updated_at).toLocaleString('pt-BR')}
                </span>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <KeyRound className="h-4 w-4" />
            <AlertDescription>
              Nenhuma chave configurada. O melhorador de imagens está desativado para todos os restaurantes.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="openai-api-key">
            {status?.configured ? 'Substituir chave' : 'Chave da OpenAI'}
          </Label>
          <div className="flex gap-2">
            <Input
              id="openai-api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              disabled={saving}
            />
            <Button onClick={handleSave} disabled={saving || apiKey.trim().length < 20}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Obtenha em{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              OpenAI Platform <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        {status?.configured && (
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleClear} disabled={saving} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Remover chave
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
