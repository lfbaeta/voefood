import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from './useAdminRestaurant';
import { useParams } from 'react-router-dom';
import { useSlug } from '@/hooks/useSlug';
import { useAuth } from './useAuth';

export interface StoreConfig {
  id: string;
  name: string;
  phone_whatsapp: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_open: boolean;
  delivery_fee: number;
  delivery_fee_mode: 'fixed' | 'zones';
  min_order_value: number;
  address: string | null;
  delivery_time_min: number;
  delivery_time_max: number;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  foreground_color: string | null;
  button_text_color: string | null;
  pwa_name: string | null;
  pwa_short_name: string | null;
  pix_message: string | null;
  msg_order_accepted: string | null;
  msg_order_preparing: string | null;
  msg_order_delivery: string | null;
  msg_order_completed: string | null;
  restaurant_id: string | null;
  timezone: string | null;
  business_type?: string | null;
  menu_labels?: Record<string, string> | null;
  auth_password_required?: boolean;
}

// Campos adicionais opcionais usados pelo módulo de tracking.
// Mantidos fora da interface principal para não quebrar usos existentes,
// mas leitura/escrita funcionam normalmente via Supabase.
export interface StoreConfigTracking {
  meta_pixel_id?: string | null;
  meta_capi_token?: string | null;
  meta_test_event_code?: string | null;
  google_ads_id?: string | null;
  google_ads_conversion_label_purchase?: string | null;
  google_analytics_id?: string | null;
  tracking_enabled?: boolean | null;
}

// Tipo para a VIEW pública (sem campos sensíveis)
export interface StoreConfigPublic {
  id: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  is_open: boolean;
  delivery_fee: number;
  delivery_fee_mode: string | null;
  min_order_value: number;
  delivery_time_min: number | null;
  delivery_time_max: number | null;
  address: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  foreground_color: string | null;
  button_text_color: string | null;
  pwa_name: string | null;
  pwa_short_name: string | null;
  msg_order_accepted: string | null;
  msg_order_preparing: string | null;
  msg_order_delivery: string | null;
  msg_order_completed: string | null;
  restaurant_id: string | null;
  timezone: string | null;
}

export function useStoreConfig() {
  const { restaurantId } = useAdminRestaurant();
  const slug = useSlug();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['store-config', restaurantId, slug, user?.id],
    queryFn: async () => {
      // Se admin logado, usa a tabela completa
      if (restaurantId && user) {
        const { data, error } = await supabase
          .from('store_config')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;
        
        return {
          ...data,
          delivery_fee_mode: (data.delivery_fee_mode || 'fixed') as 'fixed' | 'zones',
          delivery_time_min: data.delivery_time_min || 30,
          delivery_time_max: data.delivery_time_max || 45,
        } as StoreConfig;
      }
      
      // Para usuários públicos, usa RPC para acessar dados públicos
      if (slug) {
        // Primeiro busca o restaurant_id pelo slug via RPC
        const { data: restaurantIdResult, error: slugError } = await supabase
          .rpc('get_restaurant_id_by_slug', { p_slug: slug });
        
        if (slugError || !restaurantIdResult) return null;

        const { data: configResult, error } = await supabase
          .rpc('get_public_store_config', { p_restaurant_id: restaurantIdResult });

        if (error) throw error;
        if (!configResult || configResult.length === 0) return null;
        
        const data = configResult[0];
        
        // Retorna como StoreConfig com campos sensíveis como null (phone_whatsapp now included in RPC)
        return {
          ...data,
          pix_key: null,
          pix_key_type: null,
          pix_message: null,
          delivery_fee_mode: (data.delivery_fee_mode || 'fixed') as 'fixed' | 'zones',
          delivery_time_min: data.delivery_time_min || 30,
          delivery_time_max: data.delivery_time_max || 45,
        } as StoreConfig;
      }
      
      return null;
    },
    enabled: !!restaurantId || !!slug,
  });
}

export function useUpdateStoreConfig() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  
  return useMutation({
    mutationFn: async ({ id, ...update }: Partial<StoreConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('store_config')
        .update(update)
        .eq('id', id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nenhum registro atualizado — verifique suas permissões para este restaurante.');
      }
      return data[0] as StoreConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-config'] });
    },
  });
}
