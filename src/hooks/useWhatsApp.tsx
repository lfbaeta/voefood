import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';

export type EvolutionInstance = {
  id: string;
  restaurant_id: string;
  reseller_id: string;
  instance_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  qr_expires_at: string | null;
  is_default: boolean;
  last_connected_at: string | null;
  created_at: string;
};

export type WaContact = {
  id: string;
  restaurant_id: string;
  phone_e164: string;
  name: string | null;
  avatar_url: string | null;
  linked_customer_phone: string | null;
};

export type WaConversation = {
  id: string;
  restaurant_id: string;
  contact_id: string;
  instance_id: string;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  updated_at: string;
};

export type WaMessage = {
  id: string;
  conversation_id: string;
  restaurant_id: string;
  direction: 'in' | 'out';
  from_me: boolean;
  content_type: string;
  text: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_filename: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  wa_message_id: string | null;
};

export function useWaInstances() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['wa-instances', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EvolutionInstance[];
    },
  });
}

export function useWaConversations() {
  const { restaurantId } = useEffectiveRestaurantId();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['wa-conversations', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from('wa_conversations').select('*').eq('restaurant_id', restaurantId!)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const ids = (convs ?? []).map((c) => c.contact_id);
      const { data: contacts } = await supabase
        .from('wa_contacts').select('*')
        .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      const map = new Map((contacts ?? []).map((c) => [c.id, c as unknown as WaContact]));
      return (convs ?? []).map((c) => ({ ...(c as unknown as WaConversation), contact: map.get(c.contact_id) ?? null }));
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`wa-conv-${restaurantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wa_conversations',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => qc.invalidateQueries({ queryKey: ['wa-conversations', restaurantId] }))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wa_contacts',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => qc.invalidateQueries({ queryKey: ['wa-conversations', restaurantId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, qc]);

  return query;
}

export function useWaMessages(conversationId: string | null) {
  const { restaurantId } = useEffectiveRestaurantId();
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId || !restaurantId) { setMessages([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('wa_messages').select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setLoading(false);
        if (!error) setMessages((data ?? []) as WaMessage[]);
      }
    })();
    const channel = supabase
      .channel(`wa-msg-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'wa_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => {
          const m = payload.new as WaMessage;
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'wa_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => prev.map((x) => (x.id === (payload.new as any).id ? (payload.new as WaMessage) : x)));
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId, restaurantId]);

  return { messages, loading };
}

export async function markConversationRead(conversationId: string) {
  await supabase.from('wa_conversations').update({ unread_count: 0 }).eq('id', conversationId);
}