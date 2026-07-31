import { useState, useEffect, useMemo } from 'react';
import { Loader2, Palette, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { applyThemeTokens, deriveThemeTokens, THEME_PRESETS, type ThemePreset } from '@/lib/themeTokens';

/** HSL <-> hex helpers (kept local so the panel can render the color inputs). */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '');
  if (hex.length !== 6) return { h: 0, s: 100, l: 50 };
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function parseHsl(hsl: string): { h: number; s: number; l: number } {
  const m = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (m) return { h: +m[1], s: +m[2], l: +m[3] };
  return { h: 45, s: 100, l: 51 };
}
function toHex(hsl: string): string {
  const p = parseHsl(hsl);
  return hslToHex(p.h, p.s, p.l);
}

function ColorField({
  label, description, value, onChange,
}: {
  label: string; description: string; value: string; onChange: (v: string) => void;
}) {
  const hex = toHex(value);
  const [hexValue, setHexValue] = useState(hex);
  useEffect(() => { setHexValue(hex); }, [hex]);

  const handleHex = (h: string) => {
    setHexValue(h);
    if (/^#[0-9A-Fa-f]{6}$/.test(h)) {
      const { h: hh, s, l } = hexToHsl(h);
      onChange(`${hh} ${s}% ${l}%`);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hexValue}
          onChange={(e) => handleHex(e.target.value)}
          className="h-11 w-14 rounded-lg cursor-pointer border-2 border-border overflow-hidden"
          style={{ padding: 0 }}
        />
        <Input
          value={hexValue}
          onChange={(e) => handleHex(e.target.value)}
          placeholder="#000000"
          className="font-mono uppercase h-11"
        />
      </div>
    </div>
  );
}

export interface ColorFormState {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  foreground_color: string;
  button_text_color: string;
}

export const DEFAULT_COLOR_FORM: ColorFormState = {
  primary_color: '45 100% 51%',
  secondary_color: '142 76% 49%',
  background_color: '0 0% 100%',
  foreground_color: '0 0% 10%',
  button_text_color: '0 0% 10%',
};

interface Props {
  title?: string;
  description?: string;
  initial: Partial<ColorFormState>;
  saving?: boolean;
  onSave: (values: ColorFormState) => void | Promise<void>;
}

/**
 * Shared color settings panel used by both the reseller (global theme) and
 * each restaurant admin (per-store override). Presents palette presets, five
 * manual pickers, and a live preview that mirrors the derived tokens exactly
 * — so what the operator sees is what the app will render after saving.
 */
export function ColorSettingsPanel({ title = 'Cores do Sistema', description, initial, saving, onSave }: Props) {
  const [formData, setFormData] = useState<ColorFormState>({ ...DEFAULT_COLOR_FORM, ...initial });

  useEffect(() => {
    setFormData({ ...DEFAULT_COLOR_FORM, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.primary_color, initial.secondary_color, initial.background_color, initial.foreground_color, initial.button_text_color]);

  const applyPreset = (preset: ThemePreset) => {
    setFormData({
      primary_color: preset.colors.primary,
      secondary_color: preset.colors.secondary,
      background_color: preset.colors.background,
      foreground_color: preset.colors.foreground,
      button_text_color: preset.colors.buttonText,
    });
  };

  // Derive the full token set for the preview surface.
  const previewStyle = useMemo(() => {
    const tokens = deriveThemeTokens({
      primary: formData.primary_color,
      secondary: formData.secondary_color,
      background: formData.background_color,
      foreground: formData.foreground_color,
      buttonText: formData.button_text_color,
    });
    return tokens as React.CSSProperties;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Presets */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Paletas prontas</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique em uma paleta para aplicar todas as cores de uma vez. Você pode ajustar depois.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => {
                const bg = toHex(preset.colors.background);
                const fg = toHex(preset.colors.foreground);
                const primary = toHex(preset.colors.primary);
                const secondary = toHex(preset.colors.secondary);
                const isActive =
                  preset.colors.primary === formData.primary_color &&
                  preset.colors.background === formData.background_color &&
                  preset.colors.foreground === formData.foreground_color;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'group relative rounded-lg border-2 p-3 text-left transition-all hover:border-primary hover:shadow-md',
                      isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                    )}
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    {isActive && (
                      <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="flex gap-1.5 mb-2">
                      <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: primary }} />
                      <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: secondary }} />
                      <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: bg, borderColor: fg + '33' }} />
                    </div>
                    <div className="text-xs font-semibold leading-tight">{preset.name}</div>
                    <div className="text-[10px] opacity-70 mt-1 line-clamp-2">{preset.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual pickers */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Ajuste manual</Label>
            <div className="grid sm:grid-cols-2 gap-4">
              <ColorField
                label="Cor Principal"
                description="Botões, links e destaques"
                value={formData.primary_color}
                onChange={(v) => setFormData({ ...formData, primary_color: v })}
              />
              <ColorField
                label="Cor Secundária"
                description="WhatsApp, sucesso e status positivos"
                value={formData.secondary_color}
                onChange={(v) => setFormData({ ...formData, secondary_color: v })}
              />
              <ColorField
                label="Cor de Fundo"
                description="Fundo geral do painel e do cardápio"
                value={formData.background_color}
                onChange={(v) => setFormData({ ...formData, background_color: v })}
              />
              <ColorField
                label="Cor do Texto"
                description="Títulos e conteúdos da página"
                value={formData.foreground_color}
                onChange={(v) => setFormData({ ...formData, foreground_color: v })}
              />
              <ColorField
                label="Cor do Texto dos Botões"
                description="Texto sobre a cor principal"
                value={formData.button_text_color}
                onChange={(v) => setFormData({ ...formData, button_text_color: v })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              As demais cores (cards, bordas, cinzas, sidebar) são geradas automaticamente a partir do fundo escolhido — funciona tanto para temas claros quanto escuros.
            </p>
          </div>

          {/* Live preview using derived tokens (matches the real app exactly) */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Pré-visualização</Label>
            <div
              className="rounded-xl border p-5 space-y-4"
              style={{
                ...previewStyle,
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
              }}
            >
              {/* Cards */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-4 border"
                  style={{
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                    borderColor: 'hsl(var(--border))',
                  }}
                >
                  <div className="text-xs opacity-60 mb-1">Pedido #1234</div>
                  <div className="font-semibold">X-Bacon + Refri</div>
                  <div className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Rua das Flores, 123 • 30-45 min
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md text-sm font-medium"
                      style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-md text-sm font-medium border"
                      style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
                <div
                  className="rounded-lg p-4 border"
                  style={{
                    background: 'hsl(var(--muted))',
                    color: 'hsl(var(--foreground))',
                    borderColor: 'hsl(var(--border))',
                  }}
                >
                  <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Faturamento hoje</div>
                  <div className="text-2xl font-bold mt-1">R$ 1.284,50</div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}
                    >
                      Aberto
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                    >
                      12 pedidos
                    </span>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                style={{
                  background: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--input))',
                  color: 'hsl(var(--foreground))',
                }}
              >
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>Buscar produtos…</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>) : 'Salvar Cores'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
