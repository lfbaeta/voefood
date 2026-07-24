/**
 * Pizza module types and helpers.
 * Sabores e bordas ficam dentro do próprio produto "tamanho" (Grande, Média, etc.).
 * Preço = sabor mais caro + borda + adicionais.
 */

export interface PizzaFlavor {
  id: string;
  name: string;
  description?: string;
  price: number;
  is_available: boolean;
}

export interface PizzaBorder {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

export interface PizzaSelection {
  flavors: PizzaFlavor[];
  border: PizzaBorder | null;
}

export function computePizzaBasePrice(flavors: PizzaFlavor[], border: PizzaBorder | null): number {
  const flavorMax = flavors.length > 0 ? Math.max(...flavors.map((f) => Number(f.price) || 0)) : 0;
  const borderPrice = border ? Number(border.price) || 0 : 0;
  return flavorMax + borderPrice;
}

export function formatBRL(v: number): string {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Detail strings to print/display below the item line on cards and receipts. */
export function pizzaDetailLines(flavors: PizzaFlavor[], border: PizzaBorder | null): string[] {
  const lines: string[] = [];
  if (flavors.length > 0) {
    lines.push(
      `Sabor${flavors.length > 1 ? 'es' : ''}: ${flavors.map((f) => f.name).join(' / ')}`,
    );
  }
  if (border && Number(border.price) > 0) {
    lines.push(`Borda: ${border.name} (+${formatBRL(Number(border.price))})`);
  } else if (border) {
    lines.push(`Borda: ${border.name}`);
  }
  return lines;
}
