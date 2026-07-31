import { useEffect } from 'react';
import { useStoreConfig } from './useStore';

/**
 * Injeta dinamicamente os scripts do Meta Pixel e Google Ads/GA4
 * com base nos IDs configurados em store_config para o restaurante atual.
 *
 * - Idempotente: cada pixel é injetado uma única vez por sessão.
 * - Respeita `tracking_enabled = false` (não injeta nada).
 * - Dispara PageView automaticamente quando o pixel termina de carregar.
 */
export function useRestaurantTracking() {
  const { data: store } = useStoreConfig();

  const metaId = (store as any)?.meta_pixel_id as string | null | undefined;
  const gadsId = (store as any)?.google_ads_id as string | null | undefined;
  const ga4Id = (store as any)?.google_analytics_id as string | null | undefined;
  const enabled = (store as any)?.tracking_enabled !== false;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (!window.__peddiLoadedPixels) window.__peddiLoadedPixels = {};

    // Meta Pixel
    if (metaId && window.__peddiLoadedPixels.meta !== metaId) {
      (function (f: any, b: any, e: string, v: string) {
        if (f.fbq) return;
        const n: any = (f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = '2.0';
        n.queue = [];
        const t = b.createElement(e) as HTMLScriptElement;
        t.async = true;
        t.src = v;
        const s = b.getElementsByTagName(e)[0];
        s.parentNode!.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq?.('init', metaId);
      window.fbq?.('track', 'PageView');
      window.__peddiLoadedPixels.meta = metaId;
    }

    // Google Ads / GA4 (mesma tag gtag.js)
    const gtagPrimaryId = gadsId || ga4Id;
    if (gtagPrimaryId && window.__peddiLoadedPixels.gads !== gtagPrimaryId) {
      const existing = document.querySelector(`script[data-gtag="${gtagPrimaryId}"]`);
      if (!existing) {
        const s = document.createElement('script');
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${gtagPrimaryId}`;
        s.setAttribute('data-gtag', gtagPrimaryId);
        document.head.appendChild(s);
      }
      window.dataLayer = window.dataLayer || [];
      // gtag precisa ser uma função tradicional para receber `arguments`
      window.gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
      window.gtag('js', new Date());
      if (gadsId) window.gtag('config', gadsId);
      if (ga4Id && ga4Id !== gadsId) window.gtag('config', ga4Id);
      window.__peddiLoadedPixels.gads = gtagPrimaryId;
      if (ga4Id) window.__peddiLoadedPixels.ga4 = ga4Id;
    }
  }, [metaId, gadsId, ga4Id, enabled]);
}