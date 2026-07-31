// Helpers para venda por peso/volume
// Internamente o "peso" é sempre armazenado em gramas (ou ml para líquidos).
// `unit_of_sale` define como exibir e como interpretar o preço cadastrado.

export type UnitOfSale = 'un' | 'kg' | 'g' | 'L' | 'ml';

export const WEIGHT_UNITS: UnitOfSale[] = ['kg', 'g', 'L', 'ml'];

export function isWeightUnit(unit?: string | null): boolean {
  return !!unit && WEIGHT_UNITS.includes(unit as UnitOfSale);
}

/**
 * Botões pré-definidos de quantidade em gramas/ml por unidade de venda.
 */
export function getQuickAmounts(unit: UnitOfSale): number[] {
  switch (unit) {
    case 'kg':
    case 'g':
      return [250, 500, 750, 1000, 1500, 2000];
    case 'L':
    case 'ml':
      return [250, 500, 1000, 1500, 2000];
    default:
      return [];
  }
}

/**
 * O preço cadastrado refere-se à unidade "grande" (kg, L) ou direto (g, ml, un).
 * Esta função retorna quantos "gramas/ml" valem 1 unidade de preço cadastrado.
 * Ex: unit_of_sale='kg' => 1000 (preço é por 1000g)
 *     unit_of_sale='g'  => 1    (preço é por 1g)
 */
export function basisGrams(unit: UnitOfSale): number {
  switch (unit) {
    case 'kg':
    case 'L':
      return 1000;
    case 'g':
    case 'ml':
      return 1;
    default:
      return 1;
  }
}

/**
 * Calcula o preço de uma quantidade em gramas/ml dado o preço cadastrado.
 */
export function priceForGrams(basePrice: number, unit: UnitOfSale, grams: number): number {
  const basis = basisGrams(unit);
  if (basis <= 0) return basePrice;
  return Number(((basePrice * grams) / basis).toFixed(2));
}

/**
 * Formata uma quantidade em gramas/ml para exibição amigável.
 */
export function formatAmount(grams: number, unit: UnitOfSale): string {
  if (unit === 'kg' || unit === 'g') {
    if (grams >= 1000) {
      const kg = grams / 1000;
      return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
    }
    return `${Math.round(grams)} g`;
  }
  if (unit === 'L' || unit === 'ml') {
    if (grams >= 1000) {
      const l = grams / 1000;
      return `${l.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L`;
    }
    return `${Math.round(grams)} ml`;
  }
  return `${grams}`;
}

/**
 * Sufixo de unidade para o preço cadastrado. Ex: "/kg", "/L".
 */
export function priceUnitSuffix(unit?: string | null): string {
  switch (unit) {
    case 'kg': return '/kg';
    case 'g': return '/g';
    case 'L': return '/L';
    case 'ml': return '/ml';
    default: return '';
  }
}

export const UNIT_OPTIONS: { value: UnitOfSale; label: string }[] = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
];
