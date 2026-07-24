import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, Copy, CheckCircle2, QrCode, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStoreConfig } from '@/hooks/useStore';
import { useTheme } from '@/hooks/useTheme';
import { useRestaurantTracking } from '@/hooks/useRestaurantTracking';
import { trackPurchase } from '@/lib/tracking';
import { CreditCardForm, type CardPayload } from '@/components/payment/CreditCardForm';
import { useRestaurantPaymentMethods } from '@/hooks/useRestaurantPaymentMethods';

type Provider = 'mercado_pago' | 'asaas';
type Method = 'pix' | 'credit_card';

export default function OnlinePayment() {
  const slug = useSlug(); const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: store } = useStoreConfig();
  useTheme();
  useRestaurantTracking();
  const { data: methods } = useRestaurantPaymentMethods();

  const provider = params.get('provider') as Provider;
  const method = (params.get('method') || 'pix') as Method;
  const basePath = useBasePath(slug);

  const [creating, setCreating] = useState(true);
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed' | 'expired'>('pending');
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixImage, setPixImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const trackedRef = useRef(false);
  const expiredCheckedRef = useRef(false);

  const orderId = Number(id);
  const isCard = method === 'credit_card';
  const providerCfg = methods?.find(m => m.provider === provider);

  // cria cobrança PIX automaticamente; cartão aguarda submit do formulário
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId || !provider || isCard) {
        setCreating(false);
        return;
      }
      setCreating(true);
      const { data, error } = await supabase.functions.invoke('create-order-payment', {
        body: { order_id: orderId, provider, method },
      });
      if (cancelled) return;
      setCreating(false);
      if (error || (data as any)?.error) {
        setErrorMsg((data as any)?.error || error?.message || 'Erro ao iniciar pagamento');
        return;
      }
      const d = data as any;
      if (d.status === 'paid') setStatus('paid');
      if (d.pix_qr_code) setPixCode(d.pix_qr_code);
      if (d.pix_qr_code_base64) setPixImage(d.pix_qr_code_base64);
      if (d.expires_at) setExpiresAt(d.expires_at);
    })();
    return () => { cancelled = true; };
  }, [orderId, provider, method, isCard]);

  // busca o total ao montar (para mostrar valor no formulário de cartão)
  useEffect(() => {
    if (!orderId || !isCard) return;
    supabase.rpc('get_order_payment_status' as any, { p_order_id: orderId }).then(({ data }) => {
      const row = (data as any[])?.[0];
      if (row) setAmount(Number(row.total_amount || 0));
    });
  }, [orderId, isCard]);

  const handleCardSubmit = async (card: CardPayload, payer: { email: string }) => {
    setCardSubmitting(true);
    setErrorMsg(null);
    const body: any = {
      order_id: orderId, provider, method: 'credit_card',
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
    if (d.status === 'paid') setStatus('paid');
    else if (d.status === 'failed') setStatus('failed');
    else toast({ title: 'Pagamento em análise', description: 'Você receberá uma confirmação em instantes.' });
  };

  // polling de status
  useEffect(() => {
    if (!orderId || status === 'paid' || status === 'failed') return;
    const interval = setInterval(async () => {
      const { data, error } = await supabase.rpc('get_order_payment_status' as any, { p_order_id: orderId });
      if (error) return;
      const row = (data as any[])?.[0];
      if (!row) return;
      setAmount(Number(row.total_amount || 0));
      if (row.payment_pix_expires_at) setExpiresAt(row.payment_pix_expires_at);
      if (row.payment_status === 'paid') {
        setStatus('paid');
        if (!trackedRef.current) {
          trackedRef.current = true;
          try {
            const s: any = store || {};
            trackPurchase({ orderId, value: Number(row.total_amount || 0), gadsId: s.google_ads_id, gadsConversionLabel: s.google_ads_conversion_label_purchase });
          } catch {}
        }
      } else if (row.payment_status === 'failed' || row.payment_status === 'expired') {
        setStatus(row.payment_status);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [orderId, status, store]);

  // tick local para countdown de expiração
  useEffect(() => {
    if (status !== 'pending' || !expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status, expiresAt]);

  // ao expirar localmente, dispara reconciliação para marcar `expired` no banco
  useEffect(() => {
    if (status !== 'pending' || !expiresAt) return;
    const expMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expMs)) return;
    if (now >= expMs && !expiredCheckedRef.current) {
      expiredCheckedRef.current = true;
      supabase.functions.invoke('check-order-payment', { body: { order_id: orderId } }).catch(() => {});
    }
  }, [now, expiresAt, status, orderId]);

  const remainingLabel = (() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return 'expirado';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  })();

  const copyCode = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    toast({ title: 'Código PIX copiado' });
  };

  const goToOrder = () => navigate(`${basePath}/order/${orderId}`);

  if (status === 'paid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
        <p className="text-muted-foreground mt-2">Pedido #{orderId} recebido.</p>
        <Button className="mt-6" onClick={goToOrder}>Acompanhar pedido</Button>
      </div>
    );
  }

  if (status === 'expired' || status === 'failed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">{status === 'expired' ? 'PIX expirado' : 'Pagamento não aprovado'}</h1>
        <p className="text-muted-foreground mt-2">Você pode gerar um novo código.</p>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={goToOrder}>Ver pedido</Button>
          <Button onClick={() => window.location.reload()}>{isCard ? 'Tentar novamente' : 'Gerar novo PIX'}</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Pagamento {isCard ? 'no cartão' : 'PIX'} - {store?.name || 'Delivery'}</title></Helmet>
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-40 flex items-center gap-3 bg-background px-4 py-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate(`${basePath}/checkout`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{isCard ? 'Pague com cartão' : 'Pague com PIX'}</h1>
        </header>

        <div className="p-4 space-y-4 max-w-md mx-auto">
          {creating && !isCard && (
            <div className="flex flex-col items-center gap-2 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando QR Code…</p>
            </div>
          )}

          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
              <p className="text-sm">{errorMsg}</p>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" onClick={goToOrder}>Voltar</Button>
                {isCard && <Button onClick={() => setErrorMsg(null)}>Tentar de novo</Button>}
              </div>
            </div>
          )}

          {isCard && !errorMsg && (
            <CreditCardForm
              provider={provider}
              publicKey={providerCfg?.public_key || null}
              amount={amount}
              payerEmail=""
              onSubmit={handleCardSubmit}
              submitting={cardSubmitting}
            />
          )}

          {pixImage && (
            <div className="bg-card rounded-xl p-6 text-center space-y-4 shadow-card">
              <div className="flex justify-center">
                <img src={`data:image/png;base64,${pixImage}`} alt="QR Code PIX" className="w-64 h-64" />
              </div>
              {remainingLabel && (
                <div className="text-sm text-muted-foreground">Expira em <span className="font-mono font-semibold text-foreground">{remainingLabel}</span></div>
              )}
              <p className="text-sm text-muted-foreground">Escaneie no app do seu banco ou copie o código abaixo:</p>
              <div className="bg-muted rounded-lg p-3 text-xs break-all">{pixCode}</div>
              <Button onClick={copyCode} className="w-full" variant="outline">
                <Copy className="h-4 w-4 mr-2" /> Copiar código PIX
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Aguardando pagamento…
              </div>
            </div>
          )}

          {!creating && !pixImage && !errorMsg && (
            <div className="text-center py-12 text-muted-foreground">
              <QrCode className="h-10 w-10 mx-auto mb-2" />
              Pagamento não disponível.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
