import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';
import { getDeviceFingerprint, getDeviceLabel } from '@/lib/printFingerprint';
import type { StationRole } from '@/lib/printQueue';

export interface PrintStation {
  id: string;
  restaurant_id: string;
  name: string;
  device_fingerprint: string;
  role: StationRole;
  paper_width: 32 | 48;
  copies: 1 | 2 | 3;
  is_active: boolean;
  last_seen_at: string | null;
}

const isSerialAvailable = () => {
  try {
    if (typeof window === 'undefined') return false;
    if (window.self !== window.top) return false;
    return 'serial' in navigator;
  } catch {
    return false;
  }
};

/** Manages the local device's registration as a print station and lists all stations of the restaurant. */
export function usePrintStation() {
  const { restaurantId } = useEffectiveRestaurantId();
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [thisStation, setThisStation] = useState<PrintStation | null>(null);
  const fp = useRef(getDeviceFingerprint());
  const label = useRef(getDeviceLabel());

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('print_stations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true });
    const list = (data as any) || [];
    setStations(list);
    setThisStation(list.find((s: PrintStation) => s.device_fingerprint === fp.current) || null);
  }, [restaurantId]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime updates
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`print-stations-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_stations', filter: `restaurant_id=eq.${restaurantId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, reload]);

  const register = useCallback(async (opts: { role: StationRole; paper_width?: 32 | 48; copies?: 1 | 2 | 3; name?: string }) => {
    if (!restaurantId) return null;
    const payload = {
      restaurant_id: restaurantId,
      device_fingerprint: fp.current,
      role: opts.role,
      paper_width: opts.paper_width || 48,
      copies: opts.copies || 1,
      name: opts.name || label.current,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('print_stations')
      .upsert(payload as any, { onConflict: 'restaurant_id,device_fingerprint,role' })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    await reload();
    return data as any as PrintStation;
  }, [restaurantId, reload]);

  const remove = useCallback(async (id: string) => {
    await supabase.from('print_stations').delete().eq('id', id);
    await reload();
  }, [reload]);

  const heartbeat = useCallback(async (id: string) => {
    await supabase.from('print_stations').update({ last_seen_at: new Date().toISOString() }).eq('id', id);
  }, []);

  return {
    stations,
    thisStation,
    fingerprint: fp.current,
    deviceLabel: label.current,
    isSerialAvailable: isSerialAvailable(),
    register,
    remove,
    heartbeat,
    reload,
  };
}
