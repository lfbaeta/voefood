import { useEffect, useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const STORAGE_PREFIX = 'delivery_rated_';

interface Props {
  orderId: number;
  customerPhone: string;
  hasDriver: boolean;
  orderStatus: string;
}

export function DeliveryRatingCard({ orderId, customerPhone, hasDriver, orderStatus }: Props) {
  const key = `${STORAGE_PREFIX}${orderId}`;
  const [submitted, setSubmitted] = useState(() => !!localStorage.getItem(key));
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSubmitted(!!localStorage.getItem(key));
  }, [key]);

  if (!hasDriver) return null;
  if (orderStatus !== 'completed') return null;

  if (submitted) {
    return (
      <section className="rounded-2xl bg-card p-4 shadow-card flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <p className="text-sm text-muted-foreground">Obrigado pela sua avaliação!</p>
      </section>
    );
  }

  const submit = async () => {
    if (stars < 1) {
      toast.error('Selecione ao menos 1 estrela');
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc('submit_delivery_rating', {
        p_order_id: orderId,
        p_customer_phone: customerPhone,
        p_stars: stars,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;
      localStorage.setItem(key, '1');
      setSubmitted(true);
      toast.success('Avaliação enviada!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar avaliação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-4 shadow-card space-y-3">
      <div>
        <h3 className="font-semibold text-foreground">Como foi sua entrega?</h3>
        <p className="text-xs text-muted-foreground">Sua opinião ajuda o restaurante a melhorar.</p>
      </div>
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover || stars) >= n;
          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setStars(n)}
              className="p-1"
              aria-label={`${n} estrelas`}
            >
              <Star className={`h-8 w-8 transition ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
            </button>
          );
        })}
      </div>
      <Textarea
        placeholder="Comentário (opcional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={2}
      />
      <Button className="w-full" onClick={submit} disabled={saving || stars < 1}>
        Enviar avaliação
      </Button>
    </section>
  );
}
