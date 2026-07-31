/**
 * Thin compatibility wrapper — keeps existing call sites unchanged while
 * routing everything through the DB-backed print queue.
 * See src/lib/printQueue.ts and src/components/admin/PrintStationRunner.tsx.
 */
import { enqueuePrintJob } from '@/lib/printQueue';
import type { PrintOrderData } from '@/utils/thermalPrinter';

export type AutoPrintTrigger = 'delivery' | 'table' | 'quick_sale';

export async function autoPrintOrder(params: {
  restaurantId: string | null;
  trigger: AutoPrintTrigger;
  data: PrintOrderData;
  dedupeId?: string | number;
}): Promise<void> {
  const { restaurantId, trigger, data, dedupeId } = params;
  if (!restaurantId) return;
  try {
    await enqueuePrintJob({
      restaurantId,
      source: trigger,
      sourceId: dedupeId ?? data.orderNumber,
      // if caller already labelled a department (from useOrdersRealtime split),
      // send straight to that station; otherwise leave as 'all'.
      stationRole:
        data.departmentLabel?.toUpperCase() === 'COZINHA'
          ? 'kitchen'
          : data.departmentLabel?.toUpperCase() === 'BAR'
            ? 'bar'
            : 'all',
      suffix: data.departmentLabel || undefined,
      payload: data,
    });
  } catch (err) {
    console.error('[autoPrintOrder] enqueue failed:', err);
  }
}
