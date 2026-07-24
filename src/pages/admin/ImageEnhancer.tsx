import { useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Upload, Loader2, Download, RefreshCw, ImageIcon, AlertCircle } from 'lucide-react';
import { useImageEnhancer, useEnhancementQuota } from '@/hooks/useImageEnhancer';
import { BeforeAfterViewer } from '@/components/admin/BeforeAfterViewer';
import { EnhancementHistory } from '@/components/admin/EnhancementHistory';

import { useToast } from '@/hooks/use-toast';

export default function ImageEnhancer() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const { enhance, isEnhancing } = useImageEnhancer();
  const { data: quota, isLoading: quotaLoading } = useEnhancementQuota();

  const canGenerate = (quota?.remaining ?? 0) > 0;

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem.', variant: 'destructive' });
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast({ title: 'Muito grande', description: 'Máximo 15MB.', variant: 'destructive' });
      return;
    }
    setFile(f);
    setBeforeUrl(URL.createObjectURL(f));
    setAfterUrl(null);
  };

  const handleEnhance = async () => {
    if (!file) return;
    try {
      const res = await enhance({ file });
      setAfterUrl(res.enhanced_url);
      toast({ title: 'Imagem melhorada!', description: 'Confira o resultado abaixo.' });
    } catch (e: any) {
      toast({ title: 'Falhou', description: e.message, variant: 'destructive' });
    }
  };

  const handleDownload = async () => {
    if (!afterUrl) return;
    const a = document.createElement('a');
    a.href = afterUrl;
    a.download = `melhorada-${Date.now()}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setFile(null);
    setBeforeUrl(null);
    setAfterUrl(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <AdminLayout title="Melhorar Fotos">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Melhorar Fotos com IA
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Envie uma foto amadora do seu produto e a IA vai deixá-la com aparência profissional —
              mantendo todos os elementos originais, apenas melhorando iluminação, cores e texturas.
            </p>
          </div>
          {!quotaLoading && quota && (
            <Badge variant={canGenerate ? 'default' : 'secondary'} className="text-sm px-3 py-1.5">
              {quota.used} / {quota.quota} melhorias este mês
            </Badge>
          )}
        </div>

        {!quotaLoading && quota && quota.quota === 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Seu plano não inclui melhorias de imagem.</p>
                <p className="text-muted-foreground">
                  Entre em contato com seu revendedor para fazer upgrade do plano.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!quotaLoading && quota && quota.quota > 0 && quota.remaining === 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  Limite mensal atingido ({quota.used}/{quota.quota} melhorias).
                </p>
                <p className="text-muted-foreground">
                  Novas melhorias serão liberadas no início do próximo mês. Para aumentar o limite,
                  entre em contato com seu revendedor para fazer upgrade do plano.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>1. Envie sua foto</CardTitle>
            <CardDescription>Formatos: PNG, JPG. Máximo 15MB.</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {!beforeUrl ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full h-56 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground"
              >
                <Upload className="h-10 w-10" />
                <span className="text-sm font-medium">Clique para enviar</span>
                <span className="text-xs">ou arraste uma imagem aqui</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-border bg-muted/30 max-h-96">
                  <img src={beforeUrl} alt="Original" className="w-full h-auto max-h-96 object-contain" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Trocar imagem
                  </Button>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {beforeUrl && (
          <Card>
            <CardHeader>
              <CardTitle>2. Gere a versão melhorada</CardTitle>
              <CardDescription>
                A IA leva em média 20-40 segundos. Cada geração consome 1 melhoria do seu plano.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                size="lg"
                onClick={handleEnhance}
                disabled={isEnhancing || !canGenerate}
                className="w-full sm:w-auto"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Melhorando com IA...
                  </>
                ) : afterUrl ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Gerar de novo
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Melhorar com IA
                  </>
                )}
              </Button>

              {afterUrl && (
                <div className="pt-4 space-y-4 border-t">
                  <BeforeAfterViewer beforeUrl={beforeUrl} afterUrl={afterUrl} />
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar imagem melhorada
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <EnhancementHistory />
      </div>

    </AdminLayout>
  );
}
