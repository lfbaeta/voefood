import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface EnhanceQuota {
  used: number;
  quota: number;
  remaining: number;
}

export interface EnhanceResult {
  enhanced_url: string;
  storage_path: string;
  quota: EnhanceQuota;
}

async function fileToBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [head, b64] = result.split(',');
      const mime = head.match(/data:(.*?);base64/)?.[1] || file.type || 'image/jpeg';
      resolve({ b64, mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useEnhancementQuota() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['ai-enhancement-quota', restaurantId],
    queryFn: async (): Promise<EnhanceQuota> => {
      if (!restaurantId) return { used: 0, quota: 0, remaining: 0 };
      const { data, error } = await supabase.rpc('get_ai_enhancement_quota', {
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        used: row?.used ?? 0,
        quota: row?.quota ?? 0,
        remaining: row?.remaining ?? 0,
      };
    },
    enabled: !!restaurantId,
  });
}

export interface EnhancementHistoryItem {
  id: string;
  original_url: string | null;
  enhanced_path: string | null;
  created_at: string;
  status: string;
}

export function useEnhancementHistory() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['ai-enhancement-history', restaurantId],
    queryFn: async (): Promise<EnhancementHistoryItem[]> => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('ai_image_enhancements')
        .select('id, original_url, enhanced_url, created_at, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        original_url: r.original_url,
        enhanced_path: r.enhanced_url,
        created_at: r.created_at,
        status: r.status,
      }));
    },
    enabled: !!restaurantId,
  });
}

export async function getEnhancedSignedUrl(path: string, expiresInSec = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from('enhanced-images')
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) throw new Error('Não foi possível gerar link de download');
  return data.signedUrl;
}


export function useImageEnhancer() {
  const { restaurantId } = useEffectiveRestaurantId();
  const queryClient = useQueryClient();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enhance(input: { file?: File; imageUrl?: string }): Promise<EnhanceResult> {
    if (!restaurantId) throw new Error('Restaurante não identificado');
    setIsEnhancing(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { restaurant_id: restaurantId };
      if (input.file) {
        const { b64, mime } = await fileToBase64(input.file);
        body.image_base64 = b64;
        body.image_mime = mime;
      } else if (input.imageUrl) {
        body.image_url = input.imageUrl;
      } else {
        throw new Error('Envie um arquivo ou URL');
      }

      const { data, error: fnError } = await supabase.functions.invoke('enhance-product-image', {
        body,
      });

      if (fnError) {
        // Try read structured error
        const ctxAny = (fnError as any).context;
        let msg = fnError.message || 'Falha ao gerar imagem';
        try {
          if (ctxAny?.text) {
            const txt = await ctxAny.text();
            const parsed = JSON.parse(txt);
            if (parsed?.error === 'quota_exceeded') {
              msg = 'Você atingiu o limite de melhorias do seu plano este mês.';
              // Força atualização da cota para refletir bloqueio na UI
              queryClient.invalidateQueries({ queryKey: ['ai-enhancement-quota', restaurantId] });
            } else if (parsed?.error === 'ai_not_configured') {
              msg = parsed.message || 'O super admin ainda não cadastrou a chave de IA.';
            } else if (parsed?.error === 'invalid_api_key') {
              msg = parsed.message || 'Chave de IA inválida. Contate o super admin.';
            } else if (parsed?.error === 'ai_credits_exhausted') {
              msg = 'Créditos de IA esgotados. Contate o administrador do sistema.';
            } else if (parsed?.error === 'rate_limited') {
              msg = 'Muitas requisições. Aguarde alguns segundos e tente novamente.';
            } else if (parsed?.error) {
              msg = parsed.error;
            }
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      queryClient.invalidateQueries({ queryKey: ['ai-enhancement-quota', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['ai-enhancement-history', restaurantId] });
      return data as EnhanceResult;

    } catch (e: any) {
      setError(e.message || 'Erro desconhecido');
      throw e;
    } finally {
      setIsEnhancing(false);
    }
  }

  return { enhance, isEnhancing, error };
}
