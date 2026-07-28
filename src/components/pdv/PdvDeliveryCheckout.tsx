import { useMemo, useState } from 'react';
import { ArrowLeft, Banknote, CreditCard, QrCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateOrder } from '@/hooks/useOrders';
import { useStoreConfig } from '@/hooks/useStore';
import { PdvCartItem, formatBRLCurrency } from './PdvSaleScreen';
import { toast } from 'sonner';

interface PdvDeliveryCheckoutProps {
  items: PdvCartItem[];
  onBack: () => void;
  onSuccess: () => void;
}

const paymentMethods = [
  { id: 'money', label: 'Dinheiro', icon: Banknote },
  { id: 'card', label: 'Cartão', icon: CreditCard },
  { id: 'pix', label: 'PIX', icon: QrCode },
] as const;

export function PdvDeliveryCheckout({ items, onBack, onSuccess }: PdvDeliveryCheckoutProps) {
  const { data: store } = useStoreConfig();
  const createOrder = useCreateOrder();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(String(store?.delivery_fee ?? 0));
  const [payment, setPayment] = useState<'money' | 'card' | 'pix'>('money');
  const [changeFor, setChangeFor] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.totalPrice, 0), [items]);
  const fee = Number(String(deliveryFee).replace(',', '.')) || 0;
  const total = subtotal + fee;

  const canSubmit = name.trim() && phone.trim() && street.trim() && number.trim() && neighborhood.trim();

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Preencha os dados do cliente e endereço');
      return;
    }
    setSaving(true);
    try {
      await createOrder.mutateAsync({
        order: {
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          address_street: street.trim(),
          address_number: number.trim(),
          address_neighborhood: neighborhood.trim(),
          address_complement: complement.trim() || null,
          total_amount: total,
          payment_method: payment,
          change_for: payment === 'money' && changeFor ? Number(changeFor.replace(',', '.')) : null,
        },
        items: items.map((item) => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice + item.addons.reduce((s, a) => s + a.price, 0),
          observation: [item.addons.map((a) => a.optionName).join(', '), item.observation]
            .filter(Boolean)
            .join(' - '),
        })),
      });
      toast.success('Pedido de delivery criado!');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar pedido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery</h1>
          <p className="text-muted-foreground">Dados do cliente e entrega</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pdv-name">Nome do cliente</Label>
              <Input id="pdv-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdv-phone">WhatsApp / Telefone</Label>
              <Input id="pdv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pdv-street">Rua</Label>
              <Input id="pdv-street" value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdv-number">Número</Label>
              <Input id="pdv-number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdv-neighborhood">Bairro</Label>
              <Input
                id="pdv-neighborhood"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pdv-complement">Complemento / Referência</Label>
              <Input id="pdv-complement" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdv-fee">Taxa de entrega (R$)</Label>
              <Input id="pdv-fee" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <RadioGroup value={payment} onValueChange={(v) => setPayment(v as typeof payment)} className="grid grid-cols-3 gap-2">
              {paymentMethods.map((m) => (
                <label
                  key={m.id}
                  htmlFor={`pay-${m.id}`}
                  className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:border-primary"
                >
                  <RadioGroupItem value={m.id} id={`pay-${m.id}`} />
                  <m.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {payment === 'money' && (
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="pdv-change">Troco para (R$)</Label>
              <Input id="pdv-change" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} />
            </div>
          )}
        </Card>

        <Card className="p-4 h-fit space-y-3">
          <h2 className="font-semibold text-foreground">Resumo</h2>
          <div className="space-y-1 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="text-muted-foreground">
                  {item.quantity}x {item.productName}
                </span>
                <span>{formatBRLCurrency(item.totalPrice)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 text-sm flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatBRLCurrency(subtotal)}</span>
          </div>
          <div className="text-sm flex justify-between">
            <span className="text-muted-foreground">Entrega</span>
            <span>{formatBRLCurrency(fee)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatBRLCurrency(total)}</span>
          </div>
          <Button className="w-full" size="lg" disabled={saving} onClick={handleSubmit}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Finalizar pedido
          </Button>
        </Card>
      </div>
    </div>
  );
}
