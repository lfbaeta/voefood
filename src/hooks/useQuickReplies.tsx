import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';

export type QuickReply = {
  id: string;
  restaurant_id: string;
  shortcut: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export function useQuickReplies() {
  const { restaurantId } = useEffectiveRestaurantId();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['wa-quick-replies', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_quick_replies').select('*')
        .eq('restaurant_id', restaurantId!)
        .order('shortcut', { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuickReply[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['wa-quick-replies', restaurantId] });

  const create = useMutation({
    mutationFn: async (input: { shortcut: string; content: string }) => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const shortcut = input.shortcut.startsWith('/') ? input.shortcut : `/${input.shortcut}`;
      const { error } = await supabase.from('wa_quick_replies').insert({
        restaurant_id: restaurantId,
        shortcut: shortcut.toLowerCase().replace(/\s+/g, ''),
        content: input.content,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; shortcut: string; content: string }) => {
      const shortcut = input.shortcut.startsWith('/') ? input.shortcut : `/${input.shortcut}`;
      const { error } = await supabase.from('wa_quick_replies').update({
        shortcut: shortcut.toLowerCase().replace(/\s+/g, ''),
        content: input.content,
      }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wa_quick_replies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...list, create, update, remove };
}