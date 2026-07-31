import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, History, Loader2, ImageOff, Eye } from 'lucide-react';
import { useEnhancementHistory, getEnhancedSignedUrl } from '@/hooks/useImageEnhancer';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BeforeAfterViewer } from './BeforeAfterViewer';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function HistoryThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getEnhancedSignedUrl(path, 60 * 60)
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path]);


  if (loading) {
    return (
      <div className="w-full aspect-square bg-muted/40 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (failed || !url) {
    return (
      <div className="w-full aspect-square bg-muted/40 flex items-center justify-center text-muted-foreground">
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return <img src={url} alt="Melhorada" className="w-full aspect-square object-cover" loading="lazy" />;
}

export function EnhancementHistory() {
  const { toast } = useToast();
  const { data, isLoading } = useEnhancementHistory();
  const [preview, setPreview] = useState<{ before: string | null; afterPath: string } | null>(null);
  const [previewAfterUrl, setPreviewAfterUrl] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (path: string, id: string) => {
    setDownloadingId(id);
    try {
      const url = await getEnhancedSignedUrl(path);
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `melhorada-${id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (e: any) {
      toast({ title: 'Erro no download', description: e.message, variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  const openPreview = async (before: string | null, afterPath: string) => {
    setPreview({ before, afterPath });
    setPreviewAfterUrl(null);
    try {
      const url = await getEnhancedSignedUrl(afterPath);
      setPreviewAfterUrl(url);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' });
      setPreview(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Histórico de melhorias
        </CardTitle>
        <CardDescription>
          Suas últimas imagens melhoradas. Clique para visualizar ou baixar novamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma imagem melhorada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {data.map((item) => (
              <div
                key={item.id}
                className="rounded-lg overflow-hidden border border-border bg-card group"
              >
                <div className="relative">
                  {item.enhanced_path ? (
                    <HistoryThumb path={item.enhanced_path} />
                  ) : (
                    <div className="w-full aspect-square bg-muted/40 flex items-center justify-center">
                      <ImageOff className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-2">
                  <p className="text-[11px] text-muted-foreground">{formatDate(item.created_at)}</p>
                  <div className="flex gap-1">
                    {item.enhanced_path && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 px-2"
                          onClick={() => openPreview(item.original_url, item.enhanced_path!)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-8 px-2"
                          onClick={() => handleDownload(item.enhanced_path!, item.id)}
                          disabled={downloadingId === item.id}
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar melhoria</DialogTitle>
          </DialogHeader>
          {!previewAfterUrl ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : preview?.before ? (
            <BeforeAfterViewer beforeUrl={preview.before} afterUrl={previewAfterUrl} />
          ) : (
            <img src={previewAfterUrl} alt="Melhorada" className="w-full h-auto rounded-lg" />
          )}
          {previewAfterUrl && (
            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  if (preview?.afterPath) await handleDownload(preview.afterPath, 'preview');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
