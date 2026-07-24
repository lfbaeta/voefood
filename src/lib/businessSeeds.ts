import type { BusinessType } from './businessTypePresets';

export interface SeedCategory {
  name: string;
  icon?: string | null;
  department?: 'kitchen' | 'bar' | null;
  products: SeedProduct[];
}

export interface SeedProduct {
  name: string;
  description?: string;
  price: number;
  unit_of_sale?: 'unit' | 'kg' | 'g' | 'l' | 'ml';
  price_per_kg?: number | null;
  brand?: string | null;
}

/**
 * Cardápio/catálogo de exemplo por tipo de estabelecimento.
 * Usado quando o revendedor marca "Popular com itens de exemplo"
 * ao criar um novo restaurante.
 */
export const BUSINESS_SEEDS: Partial<Record<BusinessType, SeedCategory[]>> = {
  restaurant: [
    {
      name: 'Entradas', icon: '🥗', department: 'kitchen',
      products: [
        { name: 'Bruschetta de tomate', description: 'Pão italiano tostado com tomate, manjericão e azeite.', price: 18.9 },
        { name: 'Bolinho de bacalhau (6 un)', description: 'Tradicional, servido com limão siciliano.', price: 32.0 },
      ],
    },
    {
      name: 'Pratos principais', icon: '🍽️', department: 'kitchen',
      products: [
        { name: 'Filé mignon ao molho madeira', description: 'Acompanha arroz branco e batata rústica.', price: 68.9 },
        { name: 'Salmão grelhado', description: 'Legumes salteados e purê de mandioquinha.', price: 74.5 },
        { name: 'Risoto de camarão', description: 'Arroz arbóreo, camarões VG e limão siciliano.', price: 79.9 },
      ],
    },
    {
      name: 'Sobremesas', icon: '🍰', department: 'kitchen',
      products: [
        { name: 'Petit gâteau', description: 'Bolinho quente de chocolate com sorvete de creme.', price: 24.0 },
        { name: 'Cheesecake de frutas vermelhas', price: 22.0 },
      ],
    },
    {
      name: 'Bebidas', icon: '🥤', department: 'bar',
      products: [
        { name: 'Coca-Cola 350ml', price: 7.0 },
        { name: 'Suco de laranja natural 500ml', price: 12.0 },
        { name: 'Água mineral 500ml', price: 5.0 },
      ],
    },
  ],

  pizzeria: [
    {
      name: 'Pizzas tradicionais', icon: '🍕', department: 'kitchen',
      products: [
        { name: 'Margherita', description: 'Molho, muçarela, tomate e manjericão.', price: 55.0 },
        { name: 'Calabresa', description: 'Muçarela, calabresa fatiada e cebola.', price: 55.0 },
        { name: 'Portuguesa', description: 'Presunto, ovo, cebola, ervilha e muçarela.', price: 62.0 },
      ],
    },
    {
      name: 'Pizzas especiais', icon: '⭐', department: 'kitchen',
      products: [
        { name: 'Quatro queijos', description: 'Muçarela, provolone, parmesão e gorgonzola.', price: 72.0 },
        { name: 'Pepperoni', description: 'Muçarela e pepperoni importado.', price: 74.0 },
      ],
    },
    {
      name: 'Pizzas doces', icon: '🍫', department: 'kitchen',
      products: [
        { name: 'Chocolate com morango', price: 65.0 },
        { name: 'Romeu e Julieta', price: 58.0 },
      ],
    },
    {
      name: 'Bebidas', icon: '🥤', department: 'bar',
      products: [
        { name: 'Refrigerante 2L', price: 15.0 },
        { name: 'Suco de uva integral 300ml', price: 10.0 },
      ],
    },
  ],

  pharmacy: [
    {
      name: 'Medicamentos MIP', icon: '💊',
      products: [
        { name: 'Dipirona 500mg (20 comp)', brand: 'Genérico', price: 8.9 },
        { name: 'Paracetamol 750mg (10 comp)', brand: 'EMS', price: 12.5 },
        { name: 'Ibuprofeno 600mg (10 comp)', brand: 'Medley', price: 18.0 },
      ],
    },
    {
      name: 'Higiene pessoal', icon: '🧴',
      products: [
        { name: 'Sabonete líquido 250ml', brand: 'Protex', price: 14.9 },
        { name: 'Shampoo anticaspa 400ml', brand: 'Clear', price: 24.9 },
      ],
    },
    {
      name: 'Cuidados infantis', icon: '👶',
      products: [
        { name: 'Fralda descartável M (30 un)', brand: 'Pampers', price: 39.9 },
        { name: 'Lenços umedecidos (80 un)', brand: 'Huggies', price: 18.5 },
      ],
    },
    {
      name: 'Vitaminas e suplementos', icon: '💊',
      products: [
        { name: 'Vitamina C 1g (10 efervescentes)', brand: 'Redoxon', price: 22.0 },
        { name: 'Whey Protein 900g', brand: 'Growth', price: 129.0 },
      ],
    },
  ],

  market: [
    {
      name: 'Hortifrúti', icon: '🥬',
      products: [
        { name: 'Banana prata (kg)', price: 6.9, unit_of_sale: 'kg', price_per_kg: 6.9 },
        { name: 'Tomate italiano (kg)', price: 8.9, unit_of_sale: 'kg', price_per_kg: 8.9 },
        { name: 'Alface crespa (un)', price: 3.9 },
      ],
    },
    {
      name: 'Mercearia', icon: '🛒',
      products: [
        { name: 'Arroz branco 5kg', brand: 'Tio João', price: 32.9 },
        { name: 'Feijão carioca 1kg', brand: 'Camil', price: 8.9 },
        { name: 'Óleo de soja 900ml', brand: 'Liza', price: 9.9 },
      ],
    },
    {
      name: 'Bebidas', icon: '🥤',
      products: [
        { name: 'Coca-Cola 2L', brand: 'Coca-Cola', price: 12.9 },
        { name: 'Cerveja Heineken lata 350ml', brand: 'Heineken', price: 6.5 },
      ],
    },
    {
      name: 'Frios e laticínios', icon: '🧀',
      products: [
        { name: 'Queijo muçarela fatiado (kg)', price: 52.9, unit_of_sale: 'kg', price_per_kg: 52.9 },
        { name: 'Presunto cozido (kg)', price: 38.9, unit_of_sale: 'kg', price_per_kg: 38.9 },
      ],
    },
  ],

  butcher: [
    {
      name: 'Carnes bovinas', icon: '🥩',
      products: [
        { name: 'Picanha (kg)', price: 89.9, unit_of_sale: 'kg', price_per_kg: 89.9 },
        { name: 'Alcatra (kg)', price: 54.9, unit_of_sale: 'kg', price_per_kg: 54.9 },
        { name: 'Contra-filé (kg)', price: 62.9, unit_of_sale: 'kg', price_per_kg: 62.9 },
      ],
    },
    {
      name: 'Aves', icon: '🍗',
      products: [
        { name: 'Peito de frango (kg)', price: 21.9, unit_of_sale: 'kg', price_per_kg: 21.9 },
        { name: 'Coxa e sobrecoxa (kg)', price: 18.9, unit_of_sale: 'kg', price_per_kg: 18.9 },
      ],
    },
    {
      name: 'Suínos', icon: '🐖',
      products: [
        { name: 'Pernil suíno (kg)', price: 28.9, unit_of_sale: 'kg', price_per_kg: 28.9 },
        { name: 'Costelinha suína (kg)', price: 32.9, unit_of_sale: 'kg', price_per_kg: 32.9 },
      ],
    },
    {
      name: 'Linguiças e defumados', icon: '🌭',
      products: [
        { name: 'Linguiça toscana (kg)', price: 34.9, unit_of_sale: 'kg', price_per_kg: 34.9 },
        { name: 'Bacon defumado (kg)', price: 44.9, unit_of_sale: 'kg', price_per_kg: 44.9 },
      ],
    },
  ],

  bakery: [
    {
      name: 'Pães', icon: '🥖', department: 'kitchen',
      products: [
        { name: 'Pão francês (kg)', price: 18.9, unit_of_sale: 'kg', price_per_kg: 18.9 },
        { name: 'Pão de forma integral', price: 12.9 },
        { name: 'Baguete artesanal', price: 9.9 },
      ],
    },
    {
      name: 'Doces e bolos', icon: '🍰', department: 'kitchen',
      products: [
        { name: 'Bolo de chocolate (fatia)', price: 8.9 },
        { name: 'Sonho de creme', price: 6.5 },
        { name: 'Brigadeiro gourmet (un)', price: 4.5 },
      ],
    },
    {
      name: 'Salgados', icon: '🥐', department: 'kitchen',
      products: [
        { name: 'Coxinha de frango (un)', price: 7.5 },
        { name: 'Empada de palmito (un)', price: 8.9 },
      ],
    },
    {
      name: 'Cafeteria', icon: '☕',
      products: [
        { name: 'Café expresso', price: 5.0 },
        { name: 'Cappuccino', price: 9.5 },
      ],
    },
  ],

  petshop: [
    {
      name: 'Rações cães', icon: '🐶',
      products: [
        { name: 'Ração Golden Adultos 15kg', brand: 'Golden', price: 189.0 },
        { name: 'Ração Premier Filhotes 10,1kg', brand: 'Premier', price: 259.0 },
      ],
    },
    {
      name: 'Rações gatos', icon: '🐱',
      products: [
        { name: 'Ração Whiskas Adultos 10,1kg', brand: 'Whiskas', price: 129.0 },
        { name: 'Sachê Sheba 85g', brand: 'Sheba', price: 5.9 },
      ],
    },
    {
      name: 'Higiene e beleza', icon: '🧴',
      products: [
        { name: 'Shampoo antipulgas 500ml', brand: 'Sanol', price: 32.9 },
        { name: 'Areia higiênica 4kg', brand: 'Pipicat', price: 18.9 },
      ],
    },
    {
      name: 'Brinquedos e acessórios', icon: '🎾',
      products: [
        { name: 'Bolinha de borracha', price: 14.9 },
        { name: 'Coleira ajustável M', price: 39.9 },
      ],
    },
  ],
};

export function getSeedsForType(type: string | null | undefined): SeedCategory[] {
  const key = (type as BusinessType) || 'restaurant';
  return BUSINESS_SEEDS[key] || BUSINESS_SEEDS.restaurant!;
}
