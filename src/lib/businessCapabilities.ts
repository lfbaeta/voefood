import type { BusinessType } from './businessTypePresets';

/**
 * Capabilities descrevem quais funcionalidades do sistema fazem sentido
 * para o tipo (e subtipo) de estabelecimento. Componentes consultam essas
 * flags para renderizar ou não menus, abas e campos.
 *
 * Sempre pode ser sobrescrito manualmente via store_config.capabilities_override
 * (para o cliente que "sai da caixinha").
 */
export interface BusinessCapabilities {
  // --- Produto ---
  productHasAddons: boolean;
  productHasVariants: boolean;
  productSoldByWeight: boolean;
  productHasFlavors: boolean;
  productHasBorder: boolean;
  productHasPrescription: boolean;
  productHasExpiration: boolean;
  productHasBrand: boolean;
  productHasNutrition: boolean;

  // --- Operação ---
  kitchenDepartment: boolean;
  barDepartment: boolean;
  waiterModule: boolean;
  tableModule: boolean;
  counterPOS: boolean;
  deliveryModule: boolean;
  stockRecipes: boolean;
  pizzaModule: boolean;

  // --- Cardápio ---
  showCombos: boolean;
  showFlavorFilter: boolean;

  // --- Fiscal ---
  suggestedFiscalType: 'nfce' | 'nfe' | 'nfse' | 'none';
}

export interface BusinessSubtype {
  id: string;
  label: string;
  /** Overrides parciais sobre as capabilities do tipo pai */
  capabilities?: Partial<BusinessCapabilities>;
}

const DEFAULTS: BusinessCapabilities = {
  productHasAddons: false,
  productHasVariants: false,
  productSoldByWeight: false,
  productHasFlavors: false,
  productHasBorder: false,
  productHasPrescription: false,
  productHasExpiration: false,
  productHasBrand: false,
  productHasNutrition: false,
  kitchenDepartment: false,
  barDepartment: false,
  waiterModule: false,
  tableModule: false,
  counterPOS: true,
  deliveryModule: true,
  stockRecipes: false,
  pizzaModule: false,
  showCombos: false,
  showFlavorFilter: false,
  suggestedFiscalType: 'nfce',
};

export const CAPABILITY_LABELS: Record<keyof BusinessCapabilities, string> = {
  productHasAddons: 'Adicionais em produtos',
  productHasVariants: 'Variantes (tamanhos/cortes)',
  productSoldByWeight: 'Venda por peso (kg)',
  productHasFlavors: 'Sabores múltiplos',
  productHasBorder: 'Borda recheada',
  productHasPrescription: 'Exigir receita médica',
  productHasExpiration: 'Data de validade / lote',
  productHasBrand: 'Campo marca',
  productHasNutrition: 'Informação nutricional',
  kitchenDepartment: 'Departamento Cozinha (KDS)',
  barDepartment: 'Departamento Bar',
  waiterModule: 'Módulo Garçons',
  tableModule: 'Comandas de mesa',
  counterPOS: 'PDV Balcão',
  deliveryModule: 'Entregas / Delivery',
  stockRecipes: 'Ficha técnica / Receitas',
  pizzaModule: 'Módulo Pizzaria (sabores/bordas)',
  showCombos: 'Combos no cardápio',
  showFlavorFilter: 'Filtro por sabor/tipo',
  suggestedFiscalType: 'Tipo fiscal sugerido',
};

interface TypeConfig {
  base: Partial<BusinessCapabilities>;
  subtypes?: BusinessSubtype[];
}

const TYPE_CONFIG: Record<BusinessType, TypeConfig> = {
  restaurant: {
    base: {
      productHasAddons: true,
      productHasVariants: true,
      kitchenDepartment: true,
      barDepartment: true,
      waiterModule: true,
      tableModule: true,
      counterPOS: true,
      deliveryModule: true,
      stockRecipes: true,
      showCombos: true,
    },
    subtypes: [
      { id: 'a_la_carte', label: 'À la carte' },
      {
        id: 'prato_feito',
        label: 'Prato feito / Marmitex',
        capabilities: { productHasVariants: true, waiterModule: false, tableModule: false },
      },
      {
        id: 'self_service',
        label: 'Self-service / Por kg',
        capabilities: { productSoldByWeight: true, productHasAddons: false },
      },
    ],
  },
  pizzeria: {
    base: {
      productHasAddons: true,
      productHasVariants: true,
      productHasFlavors: true,
      productHasBorder: true,
      pizzaModule: true,
      kitchenDepartment: true,
      barDepartment: true,
      waiterModule: true,
      tableModule: true,
      counterPOS: true,
      deliveryModule: true,
      stockRecipes: true,
      showCombos: true,
      showFlavorFilter: true,
    },
  },
  pharmacy: {
    base: {
      productHasBrand: true,
      productHasExpiration: true,
      productHasPrescription: true,
      productHasVariants: true,
      counterPOS: true,
      deliveryModule: true,
      suggestedFiscalType: 'nfce',
    },
  },
  market: {
    base: {
      productHasBrand: true,
      productHasExpiration: true,
      productHasVariants: true,
      productSoldByWeight: true,
      counterPOS: true,
      deliveryModule: true,
    },
    subtypes: [
      { id: 'mercado', label: 'Mercado / Mercearia' },
      { id: 'hortifruti', label: 'Hortifrúti', capabilities: { productSoldByWeight: true } },
      { id: 'emporio', label: 'Empório' },
      { id: 'adega', label: 'Adega / Bebidas', capabilities: { productSoldByWeight: false } },
    ],
  },
  butcher: {
    base: {
      productHasVariants: true,
      productSoldByWeight: true,
      productHasBrand: true,
      productHasExpiration: true,
      counterPOS: true,
      deliveryModule: true,
      showFlavorFilter: true,
    },
    subtypes: [
      { id: 'acougue', label: 'Açougue' },
      { id: 'peixaria', label: 'Peixaria' },
      { id: 'casa_carnes', label: 'Casa de carnes especiais' },
    ],
  },
  bakery: {
    base: {
      productHasAddons: false,
      productHasVariants: true,
      productSoldByWeight: true,
      productHasExpiration: true,
      kitchenDepartment: true,
      counterPOS: true,
      deliveryModule: true,
      stockRecipes: true,
    },
    subtypes: [
      { id: 'padaria', label: 'Padaria' },
      { id: 'confeitaria', label: 'Confeitaria' },
      { id: 'doceria', label: 'Doceria' },
    ],
  },
  petshop: {
    base: {
      productHasBrand: true,
      productHasVariants: true,
      productHasExpiration: true,
      counterPOS: true,
      deliveryModule: true,
    },
  },
  custom: {
    base: {
      productHasAddons: true,
      productHasVariants: true,
      productHasBrand: true,
      productSoldByWeight: true,
      productHasExpiration: true,
      productHasPrescription: true,
      productHasFlavors: true,
      productHasBorder: true,
      kitchenDepartment: true,
      barDepartment: true,
      waiterModule: true,
      tableModule: true,
      counterPOS: true,
      deliveryModule: true,
      stockRecipes: true,
      pizzaModule: true,
      showCombos: true,
      showFlavorFilter: true,
    },
  },
};

export function getSubtypes(type: BusinessType | string | null | undefined): BusinessSubtype[] {
  const cfg = TYPE_CONFIG[(type as BusinessType) || 'restaurant'];
  return cfg?.subtypes ?? [];
}

/**
 * Resolve as capabilities finais para o restaurante, aplicando:
 * defaults → base do tipo → overrides do subtipo → overrides manuais do operador.
 */
export function resolveCapabilities(
  businessType: string | null | undefined,
  businessSubtype?: string | null,
  override?: Partial<BusinessCapabilities> | null,
): BusinessCapabilities {
  const type = (businessType as BusinessType) || 'restaurant';
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.restaurant;
  const subtype = cfg.subtypes?.find((s) => s.id === businessSubtype);

  return {
    ...DEFAULTS,
    ...cfg.base,
    ...(subtype?.capabilities || {}),
    ...(override || {}),
  };
}
