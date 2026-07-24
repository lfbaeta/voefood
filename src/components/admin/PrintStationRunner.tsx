/**
 * PrintStationRunner
 * -------------------
 * Mounted once inside AdminLayout. If the current device is registered as a
 * print station for the current restaurant, it subscribes to print_jobs and
 * consumes them (Web Serial or browser fallback).
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { usePrintStation } from '@/hooks/usePrintStation';
import { generateReceiptBytes, printReceiptBrowser, type PrintOrderData } from '@/utils/thermalPrinter';

const HEARTBEAT_MS = 30_000;
const MAX_ATTEMPTS = 3;

async function writeToSerial(port: any, bytes: Uint8Array) {
  const writer = port.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

export function PrintStationRunner() {
  const { restaurantId } = useEffectiveRestaurantId();
  const { stations, thisStation, heartbeat } = usePrintStation();

  // Cached open serial ports per role
  const portsRef = useRef<Record<string, any>>({});

  // Heartbeat
  useEffect(() => {
    if (!thisStation) return;
    heartbeat(thisStation.id);
    const t = setInterval(() => heartbeat(thisStation.id), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [thisStation, heartbeat]);

  useEffect(() => {
    if (!restaurantId || !thisStation) return;

    const myRoles = new Set(stations.filter((s) => s.device_fingerprint === thisStation.device_fingerprint).map((s) => s.role));

    // For each role I own, try to attach a previously-authorized serial port silently
    (async () => {
      if (!(navigator as any).serial) return;
      try {
        const authorized: any[] = await (navigator as any).serial.getPorts();
        // First-come mapping: 1st port -> 'all' role, remaining -> kitchen/bar/cashier
        const roleOrder = ['all', 'kitchen', 'bar', 'cashier'].filter((r) => myRoles.has(r as any));
        for (let i = 0; i < roleOrder.length && i < authorized.length; i++) {
          try {
            if (!authorized[i].readable) {
              await authorized[i].open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
            }
            portsRef.current[roleOrder[i]] = authorized[i];
          } catch (err) {
            console.warn('[PrintStationRunner] port open failed', err);
          }
        }
      } catch {
        // ignore
      }
    })();

    let cancelled = false;

    async function processJob(job: any) {
      if (cancelled) return;
      const targetRoles = new Set<string>();
      targetRoles.add(job.station_role);
      // 'all' catches everything if this station is 'all'
      const canHandle =
        myRoles.has('all') || myRoles.has(job.station_role) ||
        (job.station_role === 'all' && (myRoles.has('kitchen') || myRoles.has('bar') || myRoles.has('cashier')));
      if (!canHandle) return;

      // Try to claim atomically
      const { data: claimed } = await supabase.rpc('claim_print_job', { p_job_id: job.id, p_station_id: thisStation!.id });
      if (!claimed) return;

      const payload = job.payload as PrintOrderData;
      const width = (thisStation!.paper_width || 48) as 32 | 48;
      const copies = Math.max(1, Math.min(3, thisStation!.copies || 1));

      let lastError: string | null = null;
      const port = portsRef.current[job.station_role] || portsRef.current['all'];

      for (let c = 0; c < copies; c++) {
        try {
          if (port?.writable) {
            const bytes = generateReceiptBytes(payload, width);
            await writeToSerial(port, bytes);
          } else {
            printReceiptBrowser(payload);
          }
        } catch (err: any) {
          lastError = String(err?.message || err);
          console.error('[PrintStationRunner] print failed', err);
          // fallback to browser once
          try { printReceiptBrowser(payload); } catch (_) { /* ignore */ }
          break;
        }
      }

      if (lastError && job.attempts + 1 < MAX_ATTEMPTS) {
        await supabase.from('print_jobs').update({ status: 'pending', last_error: lastError }).eq('id', job.id);
      } else if (lastError) {
        await supabase.from('print_jobs').update({ status: 'failed', last_error: lastError }).eq('id', job.id);
      } else {
        await supabase.from('print_jobs').update({ status: 'done', printed_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
      }
    }

    // Pick up any pending jobs left on mount
    (async () => {
      const { data } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);
      for (const job of data || []) await processJob(job);
    })();

    const ch = supabase
      .channel(`print-jobs-${restaurantId}-${thisStation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'print_jobs', filter: `restaurant_id=eq.${restaurantId}` },
        (p) => { processJob(p.new); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'print_jobs', filter: `restaurant_id=eq.${restaurantId}` },
        (p) => {
          const n: any = p.new;
          if (n.status === 'pending' && n.attempts < MAX_ATTEMPTS) processJob(n);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [restaurantId, thisStation, stations]);

  return null;
}
