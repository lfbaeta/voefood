import { useEffect } from 'react';
import { buildBasePath } from '@/lib/getSubdomain';

interface DynamicManifestOptions {
  slug?: string;
  name?: string;
  shortName?: string;
  themeColor?: string;
  backgroundColor?: string;
  iconUrl?: string;
}

/**
 * Replaces the static manifest with a per-restaurant manifest so that
 * when the user installs the PWA from a restaurant's menu page,
 * launching the installed app opens that restaurant's menu instead of
 * the landing/root page.
 */
export function useDynamicManifest({
  slug,
  name,
  shortName,
  themeColor,
  backgroundColor,
  iconUrl,
}: DynamicManifestOptions) {
  useEffect(() => {
    if (!slug) return;

    const startUrl = `${buildBasePath(slug)}/`;
    const appName = name || 'Cardápio Digital';
    const appShort = shortName || name || 'Cardápio';

    const icons = iconUrl
      ? [
          { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ]
      : [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ];

    const manifest = {
      id: startUrl,
      name: appName,
      short_name: appShort,
      description: `${appName} - Faça seu pedido online`,
      start_url: startUrl,
      scope: startUrl,
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: backgroundColor || '#ffffff',
      theme_color: themeColor || '#f59e0b',
      icons,
      categories: ['food', 'shopping'],
      lang: 'pt-BR',
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const blobUrl = URL.createObjectURL(blob);

    // Remove existing manifest link(s)
    const existing = document.querySelectorAll('link[rel="manifest"]');
    const previousHrefs: string[] = [];
    existing.forEach((el) => {
      previousHrefs.push(el.getAttribute('href') || '');
      el.parentNode?.removeChild(el);
    });

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = blobUrl;
    link.setAttribute('data-dynamic', 'true');
    document.head.appendChild(link);

    return () => {
      link.parentNode?.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      // Restore the static manifest
      const restored = document.createElement('link');
      restored.rel = 'manifest';
      restored.href = previousHrefs[0] || '/manifest.json';
      document.head.appendChild(restored);
    };
  }, [slug, name, shortName, themeColor, backgroundColor, iconUrl]);
}
