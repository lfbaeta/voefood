import { useEffect, useRef, useState } from 'react';
import { Loader2, Copy, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreditCardForm, type CardPayload } from '@/components/payment/CreditCardForm';

type Provider = 'mercado_pago' | 'asaas';
type Method = 'pix' | 'credit_card';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  provider: Provider;
  method: Method;
  amount: number;
  publicKey: string | null;
  onPaid: () => void;
  onPendingAnalysis?: () => void;
}

export function OnlinePaymentDialog({
  open, onOpenChange, orderId, provider, method, amount, publicKey, onPaid, onPendingAnalysis,
}: Props) {
  const { toast } = useToast();
  const isCard = method === 'credit_card';

  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed' | 'expired'>('pending');
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixImage, setPixImage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cardSubmitting, setCardSubmitting] = useState(false);

  const paidHandledRef = useRef(false);
  const expiredCheckedRef = useRef(false);

  // reset quando abre
  useEffect(() => {
    if (!open) return;
    setStatus('pending');
    setPixCode(null);
    setPixImage(null);
    setExpiresAt(null);
    setErrorMsg(null);
    paidHandledRef.current = false;
    expiredCheckedRef.current = false;
  }, [open, orderId, method]);

  // cria cobrança PIX automaticamente
  useEffect(() => {
    if (!open || isCard || !orderId || !provider) return;
    let cancelled = false;
    (async () => {
      setCreating(true);
      const { data, error } = await supabase.functions.invoke('create-order-payment', {
        body: { order_id: orderId, provider, method: 'pix' },
      });
      if (cancelled) return;
      setCreating(false);
      const d = data as any;
      if (error || d?.error) {
        setErrorMsg(d?.error || error?.message || 'Erro ao iniciar pagamento');
        return;
      }
      if (d.status === 'paid') setStatus('paid');
      if (d.pix_qr_code) setPixCode(d.pix_qr_code);
      if (d.pix_qr_code_base64) setPixImage(d.pix_qr_code_base64);
      if (d.expires_at) setExpiresAt(d.expires_at);
    })();
    return () => { cancelled = true; };
  }, [open, isCard, orderId, provider]);

  // polling
  useEffect(() => {
    if (!open || !orderId || status === 'paid' || status === 'failed') return;
    const interval = setInterval(async () => {
      const { data, error } = await supabase.rpc('get_order_payment_status' as any, { p_order_id: orderId });
      if (error) return;
      const row = (data as any[])?.[0];
      if (!row) return;
      if (row.payment_pix_expires_at) setExpiresAt(row.payment_pix_expires_at);
      if (row.payment_status === 'paid') setStatus('paid');
      else if (row.payment_status === 'failed' || row.payment_status === 'expired') setStatus(row.payment_status);
    }, 3000);
    return () => clearInterval(interval);
  }, [open, orderId, status]);

  // tick local
  useEffect(() => {
    if (!open || status !== 'pending' || !expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, status, expiresAt]);

  // reconciliação ao expirar
  useEffect(() => {
    if (status !== 'pending' || !expiresAt) return;
    const expMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expMs)) return;
    if (now >= expMs && !expiredCheckedRef.current) {
      expiredCheckedRef.current = true;
      supabase.functions.invoke('check-order-payment', { body: { order_id: orderId } }).catch(() => {});
    }
  }, [now, expiresAt, status, orderId]);

  // dispara onPaid uma única vez
  useEffect(() => {
    if (status === 'paid' && !paidHandledRef.current) {
      paidHandledRef.current = true;
      // pequeno delay pra mostrar o check
      const t = setTimeout(() => onPaid(), 800);
      return () => clearTimeout(t);
    }
  }, [status, onPaid]);

  const handleCardSubmit = async (card: CardPayload, payer: { email: string }) => {
    setCardSubmitting(true);
    setErrorMsg(null);
    const body: any = {
      order_id: orderId,
      provider,
      method: 'credit_card',
      payer: { email: payer.email, doc: card.holder_doc, name: card.holder_name },
    };
    if (card.token) {
      body.card = { token: card.token, installments: card.installments, payment_method_id: card.payment_method_id, holder_name: card.holder_name, holder_doc: card.holder_doc };
    } else if (card.raw) {
      body.card_raw = { ...card.raw, installments: card.installments, holder_doc: card.holder_doc };
    }
    const { data, error } = await supabase.functions.invoke('create-order-payment', { body });
    setCardSubmitting(false);
    const d = data as any;
    if (error || d?.error) {
      setErrorMsg(d?.error || error?.message || 'Pagamento recusado');
      return;
    }
    if (d.status === 'paid') {
      setStatus('paid');
    } else if (d.status === 'failed') {
      setStatus('failed');
    } else {
      toast({ title: 'Pagamento em análise', description: 'Você receberá uma confirmação em instantes.' });
      onPendingAnalysis?.();
    }
  };

  const copyCode = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    toast({ title: 'Código PIX copiado' });
  };

  const remainingLabel = (() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return 'expirado';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  })();

  const handleOpenChange = (next: boolean) => {
    if (!next && status === 'pending' && !errorMsg) {
      const ok = window.confirm('Fechar agora cancela esta tela de pagamento. O pedido fica pendente até você pagar. Deseja sair?');
      if (!ok) return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCard ? 'Pague com cartão' : 'Pague com PIX'}</DialogTitle>
        </DialogHeader>

        {status === 'paid' && (
          <div className="flex flex-col items-center text-center py-8">
            <CheckCircle2 className="h-14 w-14 text-green-500 mb-3" />
            <p className="font-semibold">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground mt-1">Redirecionando…</p>
          </div>
        )}

        {(status === 'expired' || status === 'failed') && (
          <div className="flex flex-col items-center text-center py-6">
            <XCircle className="h-14 w-14 text-destructive mb-3" />
            <p className="font-semibold">{status === 'expired' ? 'PIX expirado' : 'Pagamento não aprovado'}</p>
            <p className="text-sm text-muted-foreground mt-1">Você pode tentar novamente.</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button onClick={() => {
                setStatus('pending');
                setErrorMsg(null);
                setPixCode(null);
                setPixImage(null);
                setExpiresAt(null);
                expiredCheckedRef.current = false;
              }}>
                {isCard ? 'Tentar de novo' : 'Gerar novo PIX'}
              </Button>
            </div>
          </div>
        )}

        {status === 'pending' && (
          <div className="space-y-4">
            {creating && !isCard && (
              <div className="flex flex-col items-center gap-2 py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code…</p>
              </div>
            )}

            {errorMsg && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                <p className="text-sm">{errorMsg}</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                  <Button onClick={() => setErrorMsg(null)}>Tentar de novo</Button>
                </div>
              </div>
            )}

            {isCard && !errorMsg && (
              <CreditCardForm
                provider={provider}
                publicKey={publicKey}
                amount={amount}
                payerEmail=""
                onSubmit={handleCardSubmit}
                submitting={cardSubmitting}
              />
            )}

            {pixImage && (
              <div className="bg-card rounded-xl p-4 text-center space-y-3">
                <div className="flex justify-center">
                  <img src={`data:image/png;base64,${pixImage}`} alt="QR Code PIX" className="w-56 h-56" />
                </div>
                {remainingLabel && (
                  <div className="text-sm text-muted-foreground">Expira em <span className="font-mono font-semibold text-foreground">{remainingLabel}</span></div>
                )}
                <p className="text-xs text-muted-foreground">Escaneie no app do seu banco ou copie o código:</p>
                <div className="bg-muted rounded-lg p-2 text-[11px] break-all">{pixCode}</div>
                <Button onClick={copyCode} className="w-full" variant="outline">
                  <Copy className="h-4 w-4 mr-2" /> Copiar código PIX
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Aguardando pagamento…
                </div>
              </div>
            )}

            {!creating && !pixImage && !errorMsg && !isCard && (
              <div className="text-center py-10 text-muted-foreground">
                <QrCode className="h-10 w-10 mx-auto mb-2" />
                Pagamento não disponível.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}