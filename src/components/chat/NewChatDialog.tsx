import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { EvolutionInstance } from '@/hooks/useWhatsApp';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  restaurantId: string;
  instances: EvolutionInstance[];
  onCreated?: (conversationId: string) => void;
  defaultPhone?: string;
  defaultName?: string;
  defaultText?: string;
}

export function NewChatDialog({
  open, onOpenChange, restaurantId, instances, onCreated,
  defaultPhone, defaultName, defaultText,
}: NewChatDialogProps) {
  const { toast } = useToast();
  const connected = instances.filter((i) => i.status === 'connected');
  const defaultInstance = connected.find((i) => i.is_default)?.id ?? connected[0]?.id ?? '';
  const [instanceId, setInstanceId] = useState(defaultInstance);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setInstanceId(defaultInstance);
      setPhone(defaultPhone ?? '');
      setName(defaultName ?? '');
      setText(defaultText ?? '');
    }
  }, [open, defaultInstance, defaultPhone, defaultName, defaultText]);

  async function submit() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast({ title: 'Telefone inválido', description: 'Inclua DDD e número (com DDI se internacional).', variant: 'destructive' });
      return;
    }
    if (!text.trim()) {
      toast({ title: 'Mensagem obrigatória', description: 'Escreva a primeira mensagem.', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke('evolution-send', {
      body: {
        action: 'start_conversation',
        restaurant_id: restaurantId,
        instance_id: instanceId || undefined,
        phone: digits,
        name: name.trim() || undefined,
        text: text.trim(),
      },
    });
    setSending(false);
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Conversa iniciada' });
    onOpenChange(false);
    if (data?.conversation_id) onCreated?.(data.conversation_id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar nova conversa</DialogTitle>
          <DialogDescription>Envie a primeira mensagem para um número de WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {connected.length === 0 ? (
            <p className="text-sm text-destructive">Nenhuma instância conectada. Conecte uma na aba Conexões.</p>
          ) : connected.length > 1 && (
            <div className="space-y-1.5">
              <Label>Instância</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {connected.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.instance_name}{i.is_default ? ' (padrão)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Telefone (com DDD)</Label>
            <Input
              placeholder="ex.: 11999998888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nome (opcional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem inicial</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4096}
              rows={4}
              placeholder="Olá! Em que posso ajudar?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={submit} disabled={sending || connected.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}