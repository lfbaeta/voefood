import {
  Utensils,
  Pizza,
  Pill,
  ShoppingCart,
  Beef,
  Croissant,
  PawPrint,
  Store,
  IceCream,
  Coffee,
  Sandwich,
  Fish,
  Wine,
  type LucideIcon,
} from 'lucide-react';

export type BusinessType =
  | 'restaurant'
  | 'pizzeria'
  | 'pharmacy'
  | 'market'
  | 'butcher'
  | 'bakery'
  | 'icecream'
  | 'cafe'
  | 'burger'
  | 'japanese'
  | 'drinks'
  | 'petshop'
  | 'custom';

export interface MenuLabels {
  /** Tagline acima do nome no hero (ex: "CARDÁPIO DIGITAL") */
  heroTagline: string;
  /** Título da seção principal (ex: "Cardápio") */
  menuSectionTitle: string;
  /** Título da seção de categorias (ex: "Categorias") */
  categoriesTitle: string;
  /** Label do botão/filtro "Todos" */
  allCategoriesLabel: string;
  /** Placeholder do campo de busca */
  searchPlaceholder: string;
  /** Singular do label de itens (ex: "item") */
  itemsLabelSingular: string;
  /** Plural do label de itens (ex: "itens") */
  itemsLabelPlural: string;
  /** Texto quando não há produtos cadastrados */
  emptyStateText: string;
  /** Texto quando a busca não retorna nada */
  emptySearchText: string;
  /** Emoji do botão "Todos" no scroll de categorias */
  allCategoriesEmoji: string;
  /** Emoji padrão para categorias sem imagem */
  defaultCategoryEmoji: string;
}

export interface BusinessTypePreset {
  id: BusinessType;
  label: string;
  description: string;
  icon: LucideIcon;
  labels: MenuLabels;
}

export const BUSINESS_TYPE_PRESETS: Record<BusinessType, BusinessTypePreset> = {
  restaurant: {
    id: 'restaurant',
    label: 'Restaurante / Lanchonete',
    description: 'Restaurantes, lanchonetes, pizzarias, hamburguerias',
    icon: Utensils,
    labels: {
      heroTagline: 'CARDÁPIO DIGITAL',
      menuSectionTitle: 'Cardápio',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'O que você deseja hoje?',
      itemsLabelSingular: 'item',
      itemsLabelPlural: 'itens',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🍽️',
      defaultCategoryEmoji: '🍴',
    },
  },
  pizzeria: {
    id: 'pizzeria',
    label: 'Pizzaria',
    description: 'Pizzarias com escolha de sabores e bordas',
    icon: Pizza,
    labels: {
      heroTagline: 'PIZZARIA DIGITAL',
      menuSectionTitle: 'Cardápio',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Qual pizza você quer hoje?',
      itemsLabelSingular: 'item',
      itemsLabelPlural: 'itens',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🍕',
      defaultCategoryEmoji: '🍕',
    },
  },
  pharmacy: {
    id: 'pharmacy',
    label: 'Farmácia / Drogaria',
    description: 'Farmácias, drogarias, produtos de saúde',
    icon: Pill,
    labels: {
      heroTagline: 'FARMÁCIA DIGITAL',
      menuSectionTitle: 'Produtos',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar medicamento ou produto...',
      itemsLabelSingular: 'produto',
      itemsLabelPlural: 'produtos',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '💊',
      defaultCategoryEmoji: '🏥',
    },
  },
  market: {
    id: 'market',
    label: 'Mercado / Mercearia',
    description: 'Mercados, mercearias, hortifrúti, empórios',
    icon: ShoppingCart,
    labels: {
      heroTagline: 'MERCADO ONLINE',
      menuSectionTitle: 'Produtos',
      categoriesTitle: 'Departamentos',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar produto...',
      itemsLabelSingular: 'produto',
      itemsLabelPlural: 'produtos',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🛒',
      defaultCategoryEmoji: '🥫',
    },
  },
  butcher: {
    id: 'butcher',
    label: 'Açougue',
    description: 'Açougues e casas de carnes',
    icon: Beef,
    labels: {
      heroTagline: 'AÇOUGUE DIGITAL',
      menuSectionTitle: 'Cortes',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar corte ou produto...',
      itemsLabelSingular: 'produto',
      itemsLabelPlural: 'produtos',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🥩',
      defaultCategoryEmoji: '🍖',
    },
  },
  bakery: {
    id: 'bakery',
    label: 'Padaria / Confeitaria',
    description: 'Padarias, confeitarias, docerias',
    icon: Croissant,
    labels: {
      heroTagline: 'PADARIA DIGITAL',
      menuSectionTitle: 'Produtos',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'O que você deseja hoje?',
      itemsLabelSingular: 'produto',
      itemsLabelPlural: 'produtos',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🥐',
      defaultCategoryEmoji: '🥖',
    },
  },
  icecream: {
    id: 'icecream',
    label: 'Sorveteria / Açaiteria',
    description: 'Sorveterias, açaiterias, gelaterias e casas de milkshakes',
    icon: IceCream,
    labels: {
      heroTagline: 'SORVETERIA & AÇAÍ',
      menuSectionTitle: 'Cardápio',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar açaí, sorvete ou complemento...',
      itemsLabelSingular: 'item',
      itemsLabelPlural: 'itens',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🍦',
      defaultCategoryEmoji: '🍨',
    },
  },
  cafe: {
    id: 'cafe',
    label: 'Cafeteria / Casa de café',
    description: 'Cafeterias, coffee shops, casas de chá e brunch',
    icon: Coffee,
    labels: {
      heroTagline: 'CAFETERIA DIGITAL',
      menuSectionTitle: 'Cardápio',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar café, bebida ou lanche...',
      itemsLabelSingular: 'item',
      itemsLabelPlural: 'itens',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '☕',
      defaultCategoryEmoji: '🥐',
    },
  },
  burger: {
    id: 'burger',
    label: 'Hamburgueria',
    description: 'Hamburguerias, food trucks e casas de lanches',
    icon: Sandwich,
    labels: {
      heroTagline: 'HAMBURGUERIA',
      menuSectionTitle: 'Cardápio',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar burger, combo ou bebida...',
      itemsLabelSingular: 'item',
      itemsLabelPlural: 'itens',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🍔',
      defaultCategoryEmoji: '🍟',
    },
  },
  japanese: {
    id: 'japanese',
    label: 'Japonês / Sushi',
    description: 'Restaurantes japoneses, sushi bars e temakerias',
    icon: Fish,
    labels: {
      heroTagline: 'SUSHI & CULINÁRIA JAPONESA',
      menuSectionTitle: 'Cardápio',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar combinado, temaki ou porção...',
      itemsLabelSingular: 'item',
      itemsLabelPlural: 'itens',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🍣',
      defaultCategoryEmoji: '🍱',
    },
  },
  drinks: {
    id: 'drinks',
    label: 'Adega / Distribuidora de bebidas',
    description: 'Adegas, distribuidoras, tabacarias e conveniências',
    icon: Wine,
    labels: {
      heroTagline: 'BEBIDAS GELADAS',
      menuSectionTitle: 'Produtos',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar cerveja, destilado ou gelo...',
      itemsLabelSingular: 'produto',
      itemsLabelPlural: 'produtos',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🍺',
      defaultCategoryEmoji: '🍾',
    },
  },
  petshop: {
    id: 'petshop',
    label: 'Pet Shop',
    description: 'Pet shops, produtos para animais',
    icon: PawPrint,
    labels: {
      heroTagline: 'PET SHOP ONLINE',
      menuSectionTitle: 'Produtos',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar produto para seu pet...',
      itemsLabelSingular: 'produto',
      itemsLabelPlural: 'produtos',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🐾',
      defaultCategoryEmoji: '🦴',
    },
  },
  custom: {
    id: 'custom',
    label: 'Outro / Personalizado',
    description: 'Personalize todos os textos manualmente',
    icon: Store,
    labels: {
      heroTagline: 'CATÁLOGO DIGITAL',
      menuSectionTitle: 'Produtos',
      categoriesTitle: 'Categorias',
      allCategoriesLabel: 'Todos',
      searchPlaceholder: 'Buscar produto...',
      itemsLabelSingular: 'produto',
      itemsLabelPlural: 'produtos',
      emptyStateText: 'Nenhum produto cadastrado ainda',
      emptySearchText: 'Nenhum produto encontrado',
      allCategoriesEmoji: '🛍️',
      defaultCategoryEmoji: '📦',
    },
  },
};

export const BUSINESS_TYPE_LIST: BusinessTypePreset[] = Object.values(BUSINESS_TYPE_PRESETS);

/**
 * Resolve final labels merging preset defaults with per-store overrides.
 */
export function resolveMenuLabels(
  businessType: string | null | undefined,
  overrides: Partial<MenuLabels> | null | undefined
): MenuLabels & { icon: LucideIcon } {
  const type = (businessType as BusinessType) || 'restaurant';
  const preset = BUSINESS_TYPE_PRESETS[type] || BUSINESS_TYPE_PRESETS.restaurant;
  const labels = { ...preset.labels };
  if (overrides && typeof overrides === 'object') {
    for (const key of Object.keys(labels) as (keyof MenuLabels)[]) {
      const v = overrides[key];
      if (typeof v === 'string' && v.trim().length > 0) {
        labels[key] = v;
      }
    }
  }
  return { ...labels, icon: preset.icon };
}
