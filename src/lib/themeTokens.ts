/**
 * Central theme derivation.
 *
 * Given the primary/secondary/background/foreground/button-text colors chosen
 * by a reseller or restaurant, derive the full set of semantic tokens
 * (card, muted, border, popover, input, accent, sidebar, …) so the whole
 * interface stays legible whether the operator picked a light or dark
 * background. Keeping this logic in one place avoids the "black background
 * with white cards" problem we had when only a handful of tokens were being
 * overwritten.
 */

export interface ThemeColors {
  primary?: string | null;
  secondary?: string | null;
  background?: string | null;
  foreground?: string | null;
  buttonText?: string | null;
  accent?: string | null;
}

interface Hsl { h: number; s: number; l: number }

const DEFAULTS = {
  primary: '45 100% 51%',
  secondary: '142 76% 49%',
  background: '0 0% 100%',
  foreground: '0 0% 10%',
};

function parseHsl(hsl: string | null | undefined): Hsl | null {
  if (!hsl) return null;
  const m = hsl.trim().match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!m) return null;
  return { h: +m[1], s: +m[2], l: +m[3] };
}

function fmt(h: number, s: number, l: number): string {
  const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  return `${Math.round(clamp(h, 0, 360))} ${Math.round(clamp(s))}% ${Math.round(clamp(l))}%`;
}

function shiftL(color: Hsl, delta: number, satOverride?: number): string {
  return fmt(color.h, satOverride ?? color.s, color.l + delta);
}

function contrastFg(bg: Hsl): string {
  // Simple luminance-based contrast (matches the eye better than raw L alone).
  return bg.l < 55 ? '0 0% 98%' : '0 0% 10%';
}

/**
 * Compute the full derived token map from the operator's chosen colors.
 * Returns a `Record<cssVarName, value>` ready to `setProperty` on :root.
 */
export function deriveThemeTokens(colors: ThemeColors): Record<string, string> {
  const primary = parseHsl(colors.primary) ?? parseHsl(DEFAULTS.primary)!;
  const secondary = parseHsl(colors.secondary) ?? parseHsl(DEFAULTS.secondary)!;
  const background = parseHsl(colors.background) ?? parseHsl(DEFAULTS.background)!;
  const foreground = parseHsl(colors.foreground) ?? parseHsl(contrastFg(background))!;
  const buttonText = parseHsl(colors.buttonText) ?? parseHsl(contrastFg(primary))!;

  const isDark = background.l < 55;

  // Surface tokens are close to background but with a subtle lift/dip so cards
  // remain visible on dark AND light backgrounds.
  const cardL = isDark ? Math.min(background.l + 6, 96) : Math.max(background.l - 1, 4);
  const popoverL = cardL;
  const mutedL = isDark ? Math.min(background.l + 10, 92) : Math.max(background.l - 5, 6);
  const borderL = isDark ? Math.min(background.l + 15, 90) : Math.max(background.l - 10, 8);
  const inputL = borderL;
  const sidebarBgL = isDark ? Math.min(background.l + 3, 96) : Math.max(background.l - 2, 4);
  const sidebarAccentL = mutedL;
  const sidebarBorderL = borderL;

  // Muted foreground: dial back the primary foreground for secondary text.
  const mutedFg = fmt(foreground.h, foreground.s, isDark ? 65 : 42);

  // Accent block: reuse primary but tinted to the current mode so it reads on
  // both light and dark surfaces.
  const accent = colors.accent
    ? colors.accent
    : isDark
    ? fmt(primary.h, Math.min(primary.s, 50), 22)
    : fmt(primary.h, Math.min(primary.s, 90), 94);
  const accentFg = isDark
    ? fmt(primary.h, Math.min(primary.s, 90), 82)
    : fmt(primary.h, Math.min(primary.s, 90), 32);

  const bgSat = background.s;
  const bgHue = background.h;

  const primaryStr = fmt(primary.h, primary.s, primary.l);
  const secondaryStr = fmt(secondary.h, secondary.s, secondary.l);
  const backgroundStr = fmt(bgHue, bgSat, background.l);
  const foregroundStr = fmt(foreground.h, foreground.s, foreground.l);
  const buttonTextStr = fmt(buttonText.h, buttonText.s, buttonText.l);

  return {
    '--background': backgroundStr,
    '--foreground': foregroundStr,

    '--card': fmt(bgHue, bgSat, cardL),
    '--card-foreground': foregroundStr,

    '--popover': fmt(bgHue, bgSat, popoverL),
    '--popover-foreground': foregroundStr,

    '--primary': primaryStr,
    '--primary-foreground': buttonTextStr,

    '--secondary': secondaryStr,
    '--secondary-foreground': buttonTextStr,

    '--muted': fmt(bgHue, bgSat, mutedL),
    '--muted-foreground': mutedFg,

    '--accent': accent,
    '--accent-foreground': accentFg,

    '--border': fmt(bgHue, bgSat, borderL),
    '--input': fmt(bgHue, bgSat, inputL),
    '--ring': primaryStr,

    '--whatsapp': secondaryStr,
    '--whatsapp-foreground': buttonTextStr,

    '--sidebar-background': fmt(bgHue, bgSat, sidebarBgL),
    '--sidebar-foreground': foregroundStr,
    '--sidebar-primary': primaryStr,
    '--sidebar-primary-foreground': buttonTextStr,
    '--sidebar-accent': fmt(bgHue, bgSat, sidebarAccentL),
    '--sidebar-accent-foreground': foregroundStr,
    '--sidebar-border': fmt(bgHue, bgSat, sidebarBorderL),
    '--sidebar-ring': primaryStr,
  };
}

export function applyThemeTokens(
  target: HTMLElement,
  colors: ThemeColors,
): void {
  const tokens = deriveThemeTokens(colors);
  for (const [k, v] of Object.entries(tokens)) {
    target.style.setProperty(k, v);
  }
}

/**
 * Curated palette presets — used by the color settings UI so operators can
 * pick a good-looking combination in one click instead of hand-tuning HSL.
 */
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: Required<Pick<ThemeColors, 'primary' | 'secondary' | 'background' | 'foreground' | 'buttonText'>>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic-amber',
    name: 'Âmbar Clássico',
    description: 'Branco com destaques dourados — padrão do sistema.',
    colors: {
      primary: '45 100% 51%',
      secondary: '142 76% 49%',
      background: '0 0% 100%',
      foreground: '0 0% 10%',
      buttonText: '0 0% 10%',
    },
  },
  {
    id: 'midnight-gold',
    name: 'Meia-noite Dourada',
    description: 'Fundo escuro com dourado — moderno e elegante.',
    colors: {
      primary: '45 100% 55%',
      secondary: '142 76% 49%',
      background: '220 15% 10%',
      foreground: '0 0% 96%',
      buttonText: '220 15% 10%',
    },
  },
  {
    id: 'crimson-noir',
    name: 'Vermelho Noir',
    description: 'Fundo preto com vermelho vibrante — hamburgueria/steakhouse.',
    colors: {
      primary: '0 84% 55%',
      secondary: '142 76% 49%',
      background: '0 0% 8%',
      foreground: '0 0% 96%',
      buttonText: '0 0% 100%',
    },
  },
  {
    id: 'ocean-fresh',
    name: 'Oceano Fresco',
    description: 'Azul suave — sushi, açaí, saudáveis.',
    colors: {
      primary: '199 89% 48%',
      secondary: '142 76% 49%',
      background: '210 40% 98%',
      foreground: '215 35% 15%',
      buttonText: '0 0% 100%',
    },
  },
  {
    id: 'forest-organic',
    name: 'Floresta Orgânica',
    description: 'Verde natural — comida saudável, vegana, orgânica.',
    colors: {
      primary: '142 71% 40%',
      secondary: '35 92% 55%',
      background: '60 20% 98%',
      foreground: '150 25% 12%',
      buttonText: '0 0% 100%',
    },
  },
  {
    id: 'pizzeria-red',
    name: 'Pizzaria Italiana',
    description: 'Vermelho quente e cremoso — pizzarias e cantinas.',
    colors: {
      primary: '0 72% 51%',
      secondary: '142 60% 40%',
      background: '30 30% 97%',
      foreground: '20 20% 15%',
      buttonText: '0 0% 100%',
    },
  },
  {
    id: 'coffee-warm',
    name: 'Café Aconchegante',
    description: 'Marrom e creme — cafeterias e padarias.',
    colors: {
      primary: '25 55% 40%',
      secondary: '142 60% 40%',
      background: '35 30% 96%',
      foreground: '25 30% 15%',
      buttonText: '0 0% 100%',
    },
  },
  {
    id: 'bubble-tea',
    name: 'Doceria Rosa',
    description: 'Rosa vibrante — sorveteria, açaí, docerias.',
    colors: {
      primary: '335 78% 58%',
      secondary: '199 89% 55%',
      background: '340 40% 98%',
      foreground: '335 30% 15%',
      buttonText: '0 0% 100%',
    },
  },
];
