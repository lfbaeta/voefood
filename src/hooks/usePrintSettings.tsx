import { useCallback, useEffect, useState } from 'react';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export interface PrintSettings {
  autoPrintEnabled: boolean;
  autoPrintDelivery: boolean;
  autoPrintTable: boolean;
  autoPrintQuickSale: boolean;
  printMode: 'thermal-usb' | 'browser';
  printerWidth: 48 | 32;
  copies: 1 | 2 | 3;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  autoPrintEnabled: false,
  autoPrintDelivery: true,
  autoPrintTable: true,
  autoPrintQuickSale: true,
  printMode: 'browser',
  printerWidth: 48,
  copies: 1,
};

function storageKey(restaurantId: string | null) {
  return `print-settings:${restaurantId || 'default'}`;
}

export function loadPrintSettings(restaurantId: string | null): PrintSettings {
  if (typeof window === 'undefined') return DEFAULT_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (!raw) return DEFAULT_PRINT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PRINT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_PRINT_SETTINGS;
  }
}

export function usePrintSettings() {
  const { restaurantId } = useEffectiveRestaurantId();
  const [settings, setSettings] = useState<PrintSettings>(() =>
    loadPrintSettings(restaurantId)
  );

  useEffect(() => {
    setSettings(loadPrintSettings(restaurantId));
  }, [restaurantId]);

  const updateSettings = useCallback(
    (patch: Partial<PrintSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(storageKey(restaurantId), JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [restaurantId]
  );

  const resetSettings = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(restaurantId));
    } catch {
      // ignore
    }
    setSettings(DEFAULT_PRINT_SETTINGS);
  }, [restaurantId]);

  return { settings, updateSettings, resetSettings };
}
