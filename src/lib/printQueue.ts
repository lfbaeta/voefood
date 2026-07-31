import { supabase } from '@/integrations/supabase/client';
import type { PrintOrderData } from '@/utils/thermalPrinter';
import { loadDepartmentLookups, splitItemsByDepartment, DEPARTMENT_LABELS, type Department } from '@/lib/departmentRouting';

export type PrintSource = 'delivery' | 'table' | 'quick_sale' | 'reprint' | 'test';
export type StationRole = 'all' | 'kitchen' | 'bar' | 'cashier';

interface StorePrintPrefs {
  auto_print_enabled: boolean;
  auto_print_delivery: boolean;
  auto_print_table: boolean;
  auto_print_quick_sale: boolean;
  print_split_by_department: boolean;
  print_default_copies: number;
}

const prefsCache = new Map<string, { at: number; prefs: StorePrintPrefs }>();
const CACHE_MS = 15_000;

async function getStorePrefs(restaurantId: string): Promise<StorePrintPrefs | null> {
  const hit = prefsCache.get(restaurantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.prefs;
  const { data, error } = await supabase
    .from('store_config')
    .select('auto_print_enabled, auto_print_delivery, auto_print_table, auto_print_quick_sale, print_split_by_department, print_default_copies')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  const prefs: StorePrintPrefs = {
    auto_print_enabled: !!(data as any).auto_print_enabled,
    auto_print_delivery: (data as any).auto_print_delivery !== false,
    auto_print_table: (data as any).auto_print_table !== false,
    auto_print_quick_sale: (data as any).auto_print_quick_sale !== false,
    print_split_by_department: (data as any).print_split_by_department !== false,
    print_default_copies: Number((data as any).print_default_copies) || 1,
  };
  prefsCache.set(restaurantId, { at: Date.now(), prefs });
  return prefs;
}

export function invalidatePrintPrefsCache(restaurantId?: string) {
  if (restaurantId) prefsCache.delete(restaurantId);
  else prefsCache.clear();
}

function shouldTrigger(prefs: StorePrintPrefs, source: PrintSource): boolean {
  if (source === 'reprint' || source === 'test') return true;
  if (!prefs.auto_print_enabled) return false;
  if (source === 'delivery') return prefs.auto_print_delivery;
  if (source === 'table') return prefs.auto_print_table;
  if (source === 'quick_sale') return prefs.auto_print_quick_sale;
  return false;
}

export interface EnqueueParams {
  restaurantId: string;
  source: PrintSource;
  sourceId: string | number;
  stationRole?: StationRole;
  payload: PrintOrderData;
  /** Extra key portion to dedupe departmental tickets. */
  suffix?: string;
}

/** Enqueue a single print job (respects auto-print prefs unless source=reprint/test). */
export async function enqueuePrintJob(params: EnqueueParams): Promise<{ enqueued: boolean; skipped?: string; id?: string }> {
  const { restaurantId, source, sourceId, payload, suffix } = params;
  const stationRole: StationRole = params.stationRole || 'all';

  const prefs = await getStorePrefs(restaurantId);
  if (!prefs) return { enqueued: false, skipped: 'no_prefs' };
  if (!shouldTrigger(prefs, source)) return { enqueued: false, skipped: 'disabled' };

  const dedupe = `${source}:${sourceId}:${stationRole}${suffix ? ':' + suffix : ''}`;

  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      restaurant_id: restaurantId,
      source,
      source_id: String(sourceId),
      station_role: stationRole,
      dedupe_key: dedupe,
      payload: payload as any,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (error) {
    // 23505 = unique violation → already enqueued
    if ((error as any).code === '23505') return { enqueued: false, skipped: 'duplicate' };
    console.error('[printQueue] insert failed', error);
    return { enqueued: false, skipped: 'error' };
  }
  return { enqueued: true, id: (data as any)?.id };
}

/**
 * Enqueue a print job split per department (kitchen/bar).
 * Falls back to a single 'all' job when there is no item detail or
 * split_by_department is disabled.
 */
export async function enqueuePrintJobSplit(params: EnqueueParams & { itemsForRouting?: Array<{ product_id?: string | null }> }) {
  const prefs = await getStorePrefs(params.restaurantId);
  if (!prefs) return;
  if (!shouldTrigger(prefs, params.source)) return;

  const routing = params.itemsForRouting;
  if (!prefs.print_split_by_department || !routing?.length) {
    await enqueuePrintJob(params);
    return;
  }

  const { productMap, categoryMap } = await loadDepartmentLookups(params.restaurantId);
  const buckets = splitItemsByDepartment(
    routing.map((r, idx) => ({ __idx: idx, ...r })) as any,
    (r: any) => r.product_id,
    productMap,
    categoryMap
  );

  for (const dep of Object.keys(buckets) as Department[]) {
    const idxs = (buckets[dep] as any[]).map((r) => r.__idx);
    if (!idxs.length) continue;
    const subset = idxs.map((i) => (params.payload.items as any)[i]);
    await enqueuePrintJob({
      ...params,
      stationRole: dep,
      suffix: dep,
      payload: {
        ...params.payload,
        departmentLabel: DEPARTMENT_LABELS[dep],
        items: subset,
      },
    });
  }
}
