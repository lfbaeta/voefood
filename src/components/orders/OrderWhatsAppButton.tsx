import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useWaInstances } from '@/hooks/useWhatsApp';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { useToast } from '@/hooks/use-toast';
import { NewChatDialog } from '@/components/chat/NewChatDialog';

interface Props {
  customerName: string;
  customerPhone: string;
  orderId: number;
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

function digitsOnly(s: string) { return s.replace(/\D/g, ''); }

export function OrderWhatsAppButton({ customerName, customerPhone, orderId, variant = 'outline', className }: Props) {
  const { restaurantId } = useEffectiveRestaurantId();
  const { data: instances = [] } = useWaInstances();
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasConnected = instances.some((i) => i.status === 'connected');

  async function handleClick() {
    if (!restaurantId) return;
    if (!hasConnected) {
      toast({ title: 'Sem instância conectada', description: 'Conecte uma na aba Conexões.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const phone = digitsOnly(customerPhone);
    if (phone.length < 10) {
      setLoading(false);
      toast({ title: 'Telefone inválido', variant: 'destructive' });
      return;
    }
    // Look for existing contact + conversation
    const { data: contact } = await supabase
      .from('wa_contacts').select('id')
      .eq('restaurant_id', restaurantId)
      .eq('phone_e164', phone).maybeSingle();
    if (contact) {
      const { data: conv } = await supabase
        .from('wa_conversations').select('id')
        .eq('restaurant_id', restaurantId)
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1).maybeSingle();
      if (conv) {
        setLoading(false);
        navigate(`${basePath}/admin/chat?c=${conv.id}`);
        return;
      }
    }
    setLoading(false);
    setDialogOpen(true);
  }

  return (
    <>
      <Button variant={variant} onClick={handleClick} disabled={loading} className={className}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
        WhatsApp
      </Button>
      {restaurantId && (
        <NewChatDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          restaurantId={restaurantId}
          instances={instances}
          defaultPhone={digitsOnly(customerPhone)}
          defaultName={customerName}
          defaultText={`Olá ${customerName.split(' ')[0]}! Sobre seu pedido #${orderId}...`}
          onCreated={(id) => navigate(`${basePath}/admin/chat?c=${id}`)}
        />
      )}
    </>
  );
}