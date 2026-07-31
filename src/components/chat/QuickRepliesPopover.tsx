import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useQuickReplies, type QuickReply } from '@/hooks/useQuickReplies';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onSelect: (content: string) => void;
  disabled?: boolean;
}

export function QuickRepliesPopover({ onSelect, disabled }: Props) {
  const { toast } = useToast();
  const { data: replies = [], isLoading, create, update, remove } = useQuickReplies();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null);
  const [form, setForm] = useState({ shortcut: '', content: '' });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return replies;
    return replies.filter((r) => r.shortcut.toLowerCase().includes(q) || r.content.toLowerCase().includes(q));
  }, [filter, replies]);

  function openNew() {
    setEditing('new');
    setForm({ shortcut: '', content: '' });
  }
  function openEdit(r: QuickReply) {
    setEditing(r);
    setForm({ shortcut: r.shortcut, content: r.content });
  }
  async function submit() {
    if (!form.shortcut.trim() || !form.content.trim()) {
      toast({ title: 'Preencha atalho e conteúdo', variant: 'destructive' });
      return;
    }
    try {
      if (editing === 'new') {
        await create.mutateAsync(form);
      } else if (editing) {
        await update.mutateAsync({ id: editing.id, ...form });
      }
      setEditing(null);
      toast({ title: 'Resposta salva' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    }
  }
  async function handleRemove(id: string) {
    try {
      await remove.mutateAsync(id);
      toast({ title: 'Removida' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="icon" variant="ghost" disabled={disabled} title="Respostas rápidas">
            <Zap className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Input
              placeholder="Buscar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8"
            />
            <Button size="icon" variant="ghost" onClick={openNew} title="Nova">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="max-h-64">
            {isLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">
                Nenhuma resposta. Clique em + para criar.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((r) => (
                  <li key={r.id} className="p-2 hover:bg-muted/50 group">
                    <button
                      className="w-full text-left"
                      onClick={() => { onSelect(r.content); setOpen(false); }}
                    >
                      <p className="text-xs font-mono text-primary">{r.shortcut}</p>
                      <p className="text-xs text-foreground line-clamp-2">{r.content}</p>
                    </button>
                    <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(r)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemove(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Nova resposta rápida' : 'Editar resposta'}</DialogTitle>
            <DialogDescription>Use atalhos como /ola, /horario, /endereco. Digite o atalho no chat para inserir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Atalho</Label>
              <Input
                placeholder="/ola"
                value={form.shortcut}
                onChange={(e) => setForm((f) => ({ ...f, shortcut: e.target.value }))}
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={5}
                maxLength={4096}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}