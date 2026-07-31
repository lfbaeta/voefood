import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from '@/hooks/useAdminRestaurant';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type CashMovementType = 'sangria' | 'reforco' | 'despesa' | 'recebimento';

export interface CashSession {
  id: string;
  restaurant_id: string;
  opened_by: string;
  opened_at: string;
  opening_amount: number;
  opening_notes: string | null;
  closed_by: string | null;
  closed_at: string | null;
  counted_amounts: Record<string, number> | null;
  expected_amounts: Record<string, number> | null;
  difference: number | null;
  closing_notes: string | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface CashMovement {
  id: string;
  session_id: string;
  restaurant_id: string;
  type: CashMovementType;
  amount: number;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface CashSessionSummary {
  opening_amount: number;
  sales_by_method: Record<string, number>;
  movements: Partial<Record<CashMovementType, number>>;
  sales_total: number;
  reforco_total: number;
  sangria_total: number;
  despesa_total: number;
  recebimento_total: number;
  session_id: string;
  opened_at: string;
  end_at: string;
  status: 'open' | 'closed';
}

export function useOpenCashSession() {
  const { restaurantId } = useAdminRestaurant();

  return useQuery({
    queryKey: ['cash-session-open', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase.rpc('get_open_cash_session', {
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      return ((data as unknown as CashSession[])?.[0] ?? null) as CashSession | null;
    },
    enabled: !!restaurantId,
    staleTime: 15_000,
  });
}

export function useCashSessionMovements(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: ['cash-movements', sessionId],
    queryFn: async () => {
      if (!sessionId) return [] as CashMovement[];
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CashMovement[];
    },
    enabled: !!sessionId,
  });
}

export function useCashSessionSummary(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: ['cash-summary', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase.rpc('get_cash_session_summary', {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return data as unknown as CashSessionSummary;
    },
    enabled: !!sessionId,
    staleTime: 10_000,
  });
}

export function useRecentCashSessions(limit = 20) {
  const { restaurantId } = useAdminRestaurant();
  return useQuery({
    queryKey: ['cash-sessions-recent', restaurantId, limit],
    queryFn: async () => {
      if (!restaurantId) return [] as CashSession[];
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('opened_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as CashSession[];
    },
    enabled: !!restaurantId,
  });
}

export function useOpenCash() {
  const qc = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { opening_amount: number; opening_notes?: string }) => {
      if (!restaurantId) throw new Error('Restaurante não identificado');
      if (!user) throw new Error('Sessão expirada');
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          restaurant_id: restaurantId,
          opened_by: user.id,
          opening_amount: params.opening_amount,
          opening_notes: params.opening_notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CashSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-session-open'] });
      qc.invalidateQueries({ queryKey: ['cash-sessions-recent'] });
      toast.success('Caixa aberto');
    },
    onError: (e: any) => {
      toast.error(e?.message?.includes('one_open') || e?.code === '23505'
        ? 'Já existe um caixa aberto para este restaurante.'
        : (e?.message || 'Erro ao abrir caixa'));
    },
  });
}

export function useAddCashMovement() {
  const qc = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      session_id: string;
      type: CashMovementType;
      amount: number;
      description?: string;
    }) => {
      if (!restaurantId) throw new Error('Restaurante não identificado');
      if (!user) throw new Error('Sessão expirada');
      const { error } = await supabase.from('cash_movements').insert({
        session_id: params.session_id,
        restaurant_id: restaurantId,
        type: params.type,
        amount: params.amount,
        description: params.description || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['cash-movements', vars.session_id] });
      qc.invalidateQueries({ queryKey: ['cash-summary', vars.session_id] });
      toast.success('Movimentação registrada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao registrar movimentação'),
  });
}

export function useCloseCash() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      session_id: string;
      counted_amounts: Record<string, number>;
      expected_amounts: Record<string, number>;
      difference: number;
      closing_notes?: string;
    }) => {
      if (!user) throw new Error('Sessão expirada');
      const { error } = await supabase
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          counted_amounts: params.counted_amounts,
          expected_amounts: params.expected_amounts,
          difference: params.difference,
          closing_notes: params.closing_notes || null,
        })
        .eq('id', params.session_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-session-open'] });
      qc.invalidateQueries({ queryKey: ['cash-sessions-recent'] });
      toast.success('Caixa fechado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao fechar caixa'),
  });
}
