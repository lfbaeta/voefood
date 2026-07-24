import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { FileText, Loader2, ExternalLink, Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { translateSefaz } from '@/lib/sefazErrors';

interface Props {
  restaurantId: string;
  orderId?: number;
  tableOrderId?: number;
}

const statusLabel: Record<string, { label: string; variant: any }> = {
  processing: { label: 'Processando', variant: 'secondary' },
  authorized: { label: 'Autorizada', variant: 'default' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'outline' },
  error: { label: 'Erro', variant: 'destructive' },
};

export function FiscalInvoiceCard({ restaurantId, orderId, tableOrderId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState('');
  const [name, setName] = useState('');

  const { data: enabled } = useQuery({
    queryKey: ['fiscal-enabled', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.rpc('has_fiscal_enabled' as any, { _restaurant_id: restaurantId });
      return !!data;
    },
  });

  const { data: invoice, refetch } = useQuery({
    queryKey: ['fiscal-invoice-for', orderId ?? `t${tableOrderId}`],
    enabled: !!restaurantId && (!!orderId || !!tableOrderId),
    queryFn: async () => {
      let q = supabase.from('fiscal_invoices' as any).select('*').eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }).limit(1);
      if (orderId) q = q.eq('order_id', orderId);
      else if (tableOrderId) q = q.eq('table_order_id', tableOrderId);
      const { data } = await q;
      return ((data as any[]) ?? [])[0] ?? null;
    },
  });

  const emit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fiscal-emit-nfce', {
        body: {
          restaurant_id: restaurantId,
          order_id: orderId, table_order_id: tableOrderId,
          cpf: cpf.trim() || undefined,
          customer_name: name.trim() || undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'NFC-e enviada ao provedor' });
      setOpen(false); setCpf(''); setName('');
      qc.invalidateQueries({ queryKey: ['fiscal-invoice-for'] });
    },
    onError: (e: any) => toast({ title: 'Falha ao emitir', description: e.message, variant: 'destructive' }),
  });

  const check = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      const { error } = await supabase.functions.invoke('fiscal-check-nfce', { body: { invoice_id: invoice.id } });
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  if (!enabled) return null;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" /> Nota Fiscal (NFC-e)
        </div>
        {invoice && (
          <Badge variant={(statusLabel[invoice.status]?.variant) ?? 'outline'}>
            {statusLabel[invoice.status]?.label ?? invoice.status}
          </Badge>
        )}
      </div>

      {invoice?.chave_acesso && (
        <div className="text-[10px] font-mono break-all text-muted-foreground">{invoice.chave_acesso}</div>
      )}
      {invoice?.rejection_message && (() => {
        const t = translateSefaz(invoice.rejection_message);
        return (
          <div className="text-xs space-y-1">
            <div className="font-medium text-destructive">{t.title}</div>
            {t.hint && <div className="text-muted-foreground">{t.hint}</div>}
          </div>
        );
      })()}

      <div className="flex flex-wrap gap-2">
        {!invoice || ['rejected', 'error'].includes(invoice.status) ? (
          <Button size="sm" onClick={() => setOpen(true)}>Emitir NFC-e</Button>
        ) : (
          <>
            {invoice.danfe_url && (
              <Button size="sm" variant="outline" asChild>
                <a href={invoice.danfe_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> DANFE</a>
              </Button>
            )}
            {invoice.xml_url && (
              <Button size="sm" variant="outline" asChild>
                <a href={invoice.xml_url} target="_blank" rel="noreferrer" download><Download className="h-3 w-3 mr-1" /> XML</a>
              </Button>
            )}
            {invoice.status === 'processing' && (
              <Button size="sm" variant="ghost" onClick={() => check.mutate()} disabled={check.isPending}>
                <RefreshCw className="h-3 w-3 mr-1" /> Verificar
              </Button>
            )}
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir NFC-e</DialogTitle>
            <DialogDescription>Informe CPF/nome se o cliente pediu na nota (opcional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>CPF do cliente</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Consumidor" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => emit.mutate()} disabled={emit.isPending}>
              {emit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
