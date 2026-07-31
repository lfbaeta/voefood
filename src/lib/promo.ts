// Helpers de promoção de produtos.
// A promoção é considerada ativa quando `promo_enabled` está ligado,
// há um valor promocional menor que o preço normal e a data/hora atual
// está dentro da janela configurada (datas vazias = sem limite).

export interface PromoFields {
  price: number | string;
  promo_enabled?: boolean | null;
  promo_price?: number | string | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
}

export function isPromoActive(product?: PromoFields | null, now: Date = new Date()): boolean {
  if (!product) return false;
  if (!product.promo_enabled) return false;

  const promo = Number(product.promo_price);
  const price = Number(product.price);
  if (!Number.isFinite(promo) || promo <= 0) return false;
  if (Number.isFinite(price) && promo >= price) return false;

  const ts = now.getTime();
  if (product.promo_starts_at) {
    const start = new Date(product.promo_starts_at).getTime();
    if (Number.isFinite(start) && ts < start) return false;
  }
  if (product.promo_ends_at) {
    const end = new Date(product.promo_ends_at).getTime();
    if (Number.isFinite(end) && ts > end) return false;
  }
  return true;
}

/** Preço que deve ser cobrado (promocional quando a promoção está ativa). */
export function effectivePrice(product?: PromoFields | null, now: Date = new Date()): number {
  if (!product) return 0;
  return isPromoActive(product, now) ? Number(product.promo_price) : Number(product.price);
}

/** Percentual de desconto arredondado (ex.: 25 => "-25%"). */
export function promoDiscountPercent(product?: PromoFields | null): number | null {
  if (!product || !isPromoActive(product)) return null;
  const price = Number(product.price);
  const promo = Number(product.promo_price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return Math.round(((price - promo) / price) * 100);
}

export function formatBRLPrice(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte um valor de <input type="datetime-local"> para ISO (ou null). */
export function localInputToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Converte ISO para o formato aceito por <input type="datetime-local">. */
export function isoToLocalInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
