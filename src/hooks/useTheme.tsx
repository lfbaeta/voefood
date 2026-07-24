import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStoreConfig } from './useStore';
import { useCurrentReseller } from './useReseller';
import { applyThemeTokens } from '@/lib/themeTokens';

export function useTheme() {
  const { data: store } = useStoreConfig();
  const { data: reseller } = useCurrentReseller();
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const isResellerPanel = location.pathname.startsWith('/reseller');

    // Reseller panel uses reseller colors; store/admin/client uses store colors,
    // falling back to the reseller's palette so restaurants without custom
    // colors still inherit the white-label look.
    const source = isResellerPanel ? reseller : store;
    const fallback = isResellerPanel ? null : reseller;

    applyThemeTokens(root, {
      primary: (source as any)?.primary_color ?? (fallback as any)?.primary_color,
      secondary: (source as any)?.secondary_color ?? (fallback as any)?.secondary_color,
      background: (source as any)?.background_color ?? (fallback as any)?.background_color,
      foreground: (source as any)?.foreground_color ?? (fallback as any)?.foreground_color,
      buttonText: (source as any)?.button_text_color ?? (fallback as any)?.button_text_color,
      accent: (store as any)?.accent_color,
    });

    // Update theme-color meta tag (best effort)
    const themeColor = (source as any)?.primary_color;
    if (themeColor) {
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        const hslMatch = themeColor.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
        if (hslMatch) {
          const h = parseInt(hslMatch[1]);
          const s = parseInt(hslMatch[2]) / 100;
          const l = parseInt(hslMatch[3]) / 100;
          const hex = hslToHex(h, s, l);
          themeColorMeta.setAttribute('content', hex);
        }
      }
    }

    // Update title (store only)
    if (store?.pwa_name || store?.name) {
      document.title = store.pwa_name || store.name || 'Cardápio';

      const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitleMeta) {
        appleTitleMeta.setAttribute(
          'content',
          store.pwa_short_name || store.pwa_name || store.name || 'Cardápio'
        );
      }
    }
  }, [store, reseller, location.pathname]);
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
