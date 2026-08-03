import { lazy, ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-ts";

/**
 * Wraps React.lazy so a stale/missing chunk (after a new deploy) triggers
 * a single hard reload instead of a blank screen.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const module = await factory();
      window.sessionStorage.removeItem(RELOAD_KEY);
      return module;
    } catch (error) {
      const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
      // Only reload once per 10s to avoid infinite loops on real errors.
      if (Date.now() - last > 10000) {
        window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Never resolves; page is reloading.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
