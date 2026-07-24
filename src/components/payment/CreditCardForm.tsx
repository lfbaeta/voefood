import { useEffect, useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type Provider = 'mercado_pago' | 'asaas';

export interface CardPayload {
  // Mercado Pago
  token?: string;
  payment_method_id?: string;
  // Asaas (cartão "raw" — Asaas tokeniza no backend)
  raw?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  installments: number;
  holder_name: string;
  holder_doc: string;
}

interface Props {
  provider: Provider;
  publicKey: string | null;
  amount: number;
  payerEmail: string;
  onSubmit: (card: CardPayload, payer: { email: string }) => Promise<void> | void;
  submitting?: boolean;
}

function loadMpSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).MercadoPago) return resolve();
    const existing = document.querySelector('script[data-mp-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar SDK MP')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.async = true;
    s.setAttribute('data-mp-sdk', '1');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar SDK MP'));
    document.head.appendChild(s);
  });
}

function onlyDigits(v: string) { return v.replace(/\D/g, ''); }
function formatCard(v: string) { return onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); }
function formatExpiry(v: string) {
  const d = onlyDigits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
function formatDoc(v: string) { return onlyDigits(v).slice(0, 14); }

export function CreditCardForm({ provider, publicKey, amount, payerEmail: initialEmail, onSubmit, submitting }: Props) {
  const { toast } = useToast();
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [doc, setDoc] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [installments, setInstallments] = useState(1);
  const [tokenizing, setTokenizing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (provider !== 'mercado_pago') { setSdkReady(true); return; }
    if (!publicKey) { setSdkReady(false); return; }
    loadMpSdk().then(() => setSdkReady(true)).catch(() => setSdkReady(false));
  }, [provider, publicKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = onlyDigits(number);
    const [mm, yy] = expiry.split('/');
    if (digits.length < 13) return toast({ title: 'Número do cartão inválido', variant: 'destructive' });
    if (!name.trim()) return toast({ title: 'Informe o titular', variant: 'destructive' });
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) return toast({ title: 'Validade inválida', variant: 'destructive' });
    if (cvc.length < 3) return toast({ title: 'CVV inválido', variant: 'destructive' });
    if (doc.length < 11) return toast({ title: 'CPF/CNPJ inválido', variant: 'destructive' });
    if (!email) return toast({ title: 'Informe seu e-mail', variant: 'destructive' });

    setTokenizing(true);
    try {
      if (provider === 'mercado_pago') {
        if (!publicKey || !(window as any).MercadoPago) {
          throw new Error('SDK do Mercado Pago não disponível');
        }
        const mp = new (window as any).MercadoPago(publicKey);
        const tokenRes = await mp.createCardToken({
          cardNumber: digits,
          cardholderName: name,
          cardExpirationMonth: mm,
          cardExpirationYear: `20${yy}`,
          securityCode: cvc,
          identificationType: doc.length > 11 ? 'CNPJ' : 'CPF',
          identificationNumber: doc,
        });
        if (!tokenRes?.id) throw new Error('Não foi possível tokenizar o cartão');

        // detecta bandeira
        let payment_method_id: string | undefined;
        try {
          const bins = await mp.getPaymentMethods({ bin: digits.slice(0, 8) });
          payment_method_id = bins?.results?.[0]?.id;
        } catch {}

        await onSubmit({
          token: tokenRes.id,
          payment_method_id,
          installments,
          holder_name: name,
          holder_doc: doc,
        }, { email });
      } else {
        await onSubmit({
          raw: {
            holderName: name,
            number: digits,
            expiryMonth: mm,
            expiryYear: `20${yy}`,
            ccv: cvc,
          },
          installments,
          holder_name: name,
          holder_doc: doc,
        }, { email });
      }
    } catch (err: any) {
      const msg = err?.message || err?.cause?.[0]?.description || 'Erro ao processar cartão';
      toast({ title: 'Falha no pagamento', description: msg, variant: 'destructive' });
    } finally {
      setTokenizing(false);
    }
  };

  if (provider === 'mercado_pago' && !publicKey) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
        Este restaurante ainda não cadastrou a Public Key do Mercado Pago. Pagamento por cartão indisponível.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CreditCard className="h-4 w-4" /> Cartão de crédito
      </div>

      <div>
        <Label>Número do cartão</Label>
        <Input inputMode="numeric" placeholder="0000 0000 0000 0000" value={number} onChange={(e) => setNumber(formatCard(e.target.value))} />
      </div>
      <div>
        <Label>Nome impresso no cartão</Label>
        <Input placeholder="Como está no cartão" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Validade (MM/AA)</Label>
          <Input inputMode="numeric" placeholder="MM/AA" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} maxLength={5} />
        </div>
        <div>
          <Label>CVV</Label>
          <Input inputMode="numeric" placeholder="123" value={cvc} onChange={(e) => setCvc(onlyDigits(e.target.value).slice(0, 4))} maxLength={4} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CPF/CNPJ do titular</Label>
          <Input inputMode="numeric" value={doc} onChange={(e) => setDoc(formatDoc(e.target.value))} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Parcelas</Label>
        <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 6, 10, 12].map(n => (
              <SelectItem key={n} value={String(n)}>
                {n}x de R$ {(amount / n).toFixed(2).replace('.', ',')} {n === 1 ? '(sem juros)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || tokenizing || (provider === 'mercado_pago' && !sdkReady)}>
        {(submitting || tokenizing) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Pagar R$ {amount.toFixed(2).replace('.', ',')}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Pagamento processado por {provider === 'mercado_pago' ? 'Mercado Pago' : 'Asaas'}. Seus dados não são armazenados no restaurante.
      </p>
    </form>
  );
}