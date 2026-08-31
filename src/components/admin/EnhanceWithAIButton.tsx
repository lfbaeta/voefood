import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { useImageEnhancer, useEnhancementQuota } from '@/hooks/useImageEnhancer';
import { BeforeAfterViewer } from './BeforeAfterViewer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';

interface EnhanceWithAIButtonProps {
  imageUrl: string | null | undefined;
  onEnhanced?: (newUrl: string) => void;
  disabled?: boolean;
}

/**
 * Botão "Melhorar com IA" para uso dentro do formulário de produto.
 * Ao clicar, chama a edge function passando a URL da imagem atual,
 * mostra o antes/depois em um dialog, e permite salvar como nova
 * imagem do produto (upload no bucket product-images).
 */
export function EnhanceWithAIButton({ imageUrl, onEnhanced, disabled }: EnhanceWithAIButtonProps) {
  const { toast } = useToast();
  const { restaurantId } = useEffectiveRestaurantId();
  const { enhance, isEnhancing } = useImageEnhancer();
  const { data: quota } = useEnhancementQuota();
  const [open, setOpen] = useState(false);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canUse = !!imageUrl && !disabled && (quota?.remaining ?? 0) > 0;

  const handleClick = async () => {
    if (!imageUrl) {
      toast({ title: 'Envie uma imagem primeiro', variant: 'destructive' });
      return;
    }
    if ((quota?.remaining ?? 0) <= 0) {
      toast({
        title: 'Limite atingido',
        description: 'Você já usou todas as melhorias do seu plano este mês.',
        variant: 'destructive',
      });
      return;
    }
    setOpen(true);
    setAfterUrl(null);
    try {
      const res = await enhance({ imageUrl });
      setAfterUrl(res.enhanced_url);
    } catch (e: any) {
      toast({ title: 'Falhou', description: e.message, variant: 'destructive' });
      setOpen(false);
    }
  };

  const handleSave = async () => {
    if (!afterUrl) return;
    setSaving(true);
    try {
      // Faz download da imagem melhorada e re-upload no bucket product-images
      const res = await fetch(afterUrl);
      if (!res.ok) throw new Error('Falha ao baixar imagem melhorada');
      const blob = await res.blob();
      if (!restaurantId) throw new Error('Restaurante não identificado');
      const filename = `${restaurantId}/enhanced-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(filename, blob, { contentType: 'image/png', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(filename);
      onEnhanced?.(pub.publicUrl);
      toast({ title: 'Imagem substituída!' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!canUse || isEnhancing}
        className="gap-2"
      >
        {isEnhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Melhorar com IA
        {quota && quota.quota > 0 && (
          <span className="text-xs opacity-70">({quota.remaining} restantes)</span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !isEnhancing && !saving && setOpen(v)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Melhorar imagem com IA
            </DialogTitle>
            <DialogDescription>
              Compare o antes e depois. Se gostar, substitua a imagem do produto.
            </DialogDescription>
          </DialogHeader>

          {isEnhancing || !afterUrl ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando imagem melhorada... (20-40s)</p>
            </div>
          ) : (
            <div className="space-y-4">
              {imageUrl && <BeforeAfterViewer beforeUrl={imageUrl} afterUrl={afterUrl} />}
              <div className="flex justify-end gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Usar esta imagem
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
