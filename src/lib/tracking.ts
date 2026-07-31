/**
 * Helpers para disparar eventos no Meta Pixel + Google Ads/GA4
 * de forma idempotente. Eventos só são enviados se os scripts já
 * tiverem sido injetados (ver useRestaurantTracking).
 */

type EventParams = Record<string, any>;

function safeFbq(...args: any[]) {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq(...args);
    }
  } catch (e) {
    // silencioso — tracking não deve quebrar UX
  }
}

function safeGtag(...args: any[]) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag(...args);
    }
  } catch (e) {}
}

export function trackPageView() {
  safeFbq('track', 'PageView');
  // gtag dispara page_view automaticamente no config; nada extra aqui.
}

export function trackViewContent(params: { id?: string; name?: string; price?: number }) {
  safeFbq('track', 'ViewContent', {
    content_ids: params.id ? [params.id] : undefined,
    content_name: params.name,
    content_type: 'product',
    value: params.price,
    currency: 'BRL',
  });
  safeGtag('event', 'view_item', {
    currency: 'BRL',
    value: params.price,
    items: params.id ? [{ item_id: params.id, item_name: params.name, price: params.price }] : undefined,
  });
}

export function trackAddToCart(params: { id?: string; name?: string; price?: number; quantity?: number }) {
  const value = (params.price ?? 0) * (params.quantity ?? 1);
  safeFbq('track', 'AddToCart', {
    content_ids: params.id ? [params.id] : undefined,
    content_name: params.name,
    content_type: 'product',
    value,
    currency: 'BRL',
  });
  safeGtag('event', 'add_to_cart', {
    currency: 'BRL',
    value,
    items: params.id ? [{ item_id: params.id, item_name: params.name, price: params.price, quantity: params.quantity }] : undefined,
  });
}

export function trackInitiateCheckout(params: { value: number; numItems?: number }) {
  safeFbq('track', 'InitiateCheckout', {
    value: params.value,
    currency: 'BRL',
    num_items: params.numItems,
  });
  safeGtag('event', 'begin_checkout', {
    currency: 'BRL',
    value: params.value,
  });
}

export function trackPurchase(params: {
  orderId: string | number;
  value: number;
  gadsConversionLabel?: string | null;
  gadsId?: string | null;
}) {
  safeFbq('track', 'Purchase', {
    value: params.value,
    currency: 'BRL',
    eventID: String(params.orderId),
  });
  safeGtag('event', 'purchase', {
    transaction_id: String(params.orderId),
    value: params.value,
    currency: 'BRL',
  });
  // Conversion específica do Google Ads
  if (params.gadsId && params.gadsConversionLabel) {
    safeGtag('event', 'conversion', {
      send_to: `${params.gadsId}/${params.gadsConversionLabel}`,
      value: params.value,
      currency: 'BRL',
      transaction_id: String(params.orderId),
    });
  }
}