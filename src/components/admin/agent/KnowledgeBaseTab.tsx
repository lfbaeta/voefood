import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, BookOpen, ImagePlus, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Chunk = {
  id: string;
  source_label: string | null;
  source_type: string;
  content: string;
  created_at: string;
  metadata: any;
};

export function KnowledgeBaseTab({ restaurantId }: { restaurantId: string }) {
  const { toast } = useToast();
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [imgLabel, setImgLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('agent_knowledge_chunks')
      .select('id, source_label, source_type, content, created_at, metadata')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(200);
    setChunks((data ?? []) as Chunk[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  async function ingest() {
    if (!text.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('agent-knowledge-ingest', {
      body: { restaurant_id: restaurantId, source_label: label.trim() || 'Sem título', source_type: 'manual', text },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro ao indexar', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: `${(data as any).inserted} blocos indexados` });
    setText(''); setLabel('');
    load();
  }

  async function ingestImages(files: FileList) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) {
          toast({ title: 'Imagem muito grande', description: `${file.name} passa de 8MB`, variant: 'destructive' });
          continue;
        }
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${restaurantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('agent-knowledge').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          toast({ title: `Falha ao enviar ${file.name}`, description: upErr.message, variant: 'destructive' });
          continue;
        }
        const { data, error } = await supabase.functions.invoke('agent-knowledge-ingest-image', {
          body: {
            restaurant_id: restaurantId,
            storage_path: path,
            source_label: imgLabel.trim() || file.name,
          },
        });
        if (error || (data as any)?.error) {
          toast({ title: `Erro ao ler ${file.name}`, description: (data as any)?.error || error?.message, variant: 'destructive' });
          continue;
        }
        toast({ title: `${file.name}: ${(data as any).inserted} blocos indexados` });
      }
      setImgLabel('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('agent_knowledge_chunks').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    load();
  }

  const grouped = chunks.reduce((acc: Record<string, Chunk[]>, c) => {
    const k = c.source_label || '(sem rótulo)';
    (acc[k] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-5 pt-4">
      <div className="p-3 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Ensinar o agente com texto</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Cole aqui qualquer texto: cardápio detalhado, manual de atendimento, política de troca, descrição de promoções, FAQ avançada.
          O agente vai indexar e usar via busca semântica quando o cliente perguntar algo específico.
        </p>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Título — ex: Política de devolução / Manual atendimento" />
        <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Cole o conteúdo aqui. Pode ser longo — vamos quebrar em blocos automaticamente." />
        <div className="flex justify-end">
          <Button onClick={ingest} disabled={saving || !text.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Indexar conteúdo
          </Button>
        </div>
      </div>

      <div className="p-3 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Ensinar o agente com imagem</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie fotos do cardápio impresso, tabelas de preço, folhetos, quadros com regras. A IA lê a imagem, extrai o conteúdo em texto e indexa igual ao treino por texto.
        </p>
        <Input value={imgLabel} onChange={(e) => setImgLabel(e.target.value)} placeholder="Título — ex: Cardápio impresso / Tabela promoções" />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => e.target.files && ingestImages(e.target.files)} />
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
            Enviar imagens
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Conhecimento indexado</Label>
          <Badge variant="outline">{chunks.length} blocos</Badge>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : chunks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nada indexado ainda. Cole um texto ou envie uma imagem acima.</p>
        ) : (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([label, items]) => {
              const isImage = items[0]?.source_type === 'image';
              const imgUrl = items[0]?.metadata?.image_url;
              return (
                <div key={label} className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/50 text-sm font-medium flex items-center justify-between gap-2">
                    <span className="truncate flex items-center gap-1">
                      {isImage && <span>🖼️</span>}{label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isImage && imgUrl && (
                        <a href={imgUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Ver imagem
                        </a>
                      )}
                      <Badge variant="outline" className="text-[10px]">{items.length} bloco(s)</Badge>
                    </div>
                  </div>
                  <div className="divide-y">
                    {items.map((c) => (
                      <div key={c.id} className="p-3 text-xs space-y-2">
                        <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{c.content}</p>
                        <div className="flex justify-end">
                          <Button size="sm" variant="ghost" className="text-destructive h-7"
                            onClick={() => remove(c.id)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Remover bloco
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
