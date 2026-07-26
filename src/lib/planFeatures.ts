export interface PlanFeatureDef {
  id: string;
  label: string;
  description?: string;
  group: string;
}

export const PLAN_FEATURE_GROUPS: { label: string; features: PlanFeatureDef[] }[] = [
  {
    label: 'Operações',
    features: [
      { id: 'pdv', label: 'PDV (mesas e balcão)', group: 'Operações' },
      { id: 'cash-register', label: 'Caixa', group: 'Operações' },
      { id: 'kitchen', label: 'Painel de Cozinha (KDS)', group: 'Operações' },
      { id: 'bar', label: 'Painel do Bar', group: 'Operações' },
      { id: 'waiters', label: 'Gestão de Garçons', group: 'Operações' },
      { id: 'drivers', label: 'Entregadores', group: 'Operações' },
    ],

  },
  {
    label: 'Gestão',
    features: [
      { id: 'orders', label: 'Pedidos / Kanban', group: 'Gestão' },
      { id: 'products', label: 'Produtos', group: 'Gestão' },
      { id: 'categories', label: 'Categorias', group: 'Gestão' },
      { id: 'addons', label: 'Acréscimos', group: 'Gestão' },
      { id: 'coupons', label: 'Cupons', group: 'Gestão' },
      { id: 'fiscal', label: 'Fiscal / NFC-e', group: 'Gestão' },
      { id: 'image-enhancer', label: 'Melhorar Fotos com IA', group: 'Gestão' },
      { id: 'stock', label: 'Controle de Estoque', group: 'Gestão' },
      { id: 'stock-recipes', label: 'Ficha Técnica', group: 'Gestão' },
      { id: 'stock-purchases', label: 'Compras e Fornecedores', group: 'Gestão' },
      { id: 'stock-reports', label: 'Relatórios de Estoque', group: 'Gestão' },
    ],
  },
  {
    label: 'Sistema',
    features: [
      { id: 'delivery-zones', label: 'Taxas de Entrega', group: 'Sistema' },
      { id: 'hours', label: 'Horários de Funcionamento', group: 'Sistema' },
      { id: 'print-settings', label: 'Impressão automática', group: 'Sistema' },
    ],
  },
  {
    label: 'WhatsApp & IA',
    features: [
      { id: 'chat', label: 'Chat WhatsApp', group: 'WhatsApp & IA' },
      { id: 'whatsapp-connections', label: 'Conexões WhatsApp', group: 'WhatsApp & IA' },
      { id: 'ai-agents', label: 'Agentes de IA', group: 'WhatsApp & IA' },
    ],
  },
];

export const ALL_PLAN_FEATURE_IDS: string[] = PLAN_FEATURE_GROUPS.flatMap((g) =>
  g.features.map((f) => f.id)
);

/** Features always available regardless of plan (core screens). */
export const ALWAYS_ENABLED_FEATURES = new Set<string>([
  'dashboard',
  'settings',
  'whatsapp-health',
  'menu',
  'waiter-access',
  'print-settings',
  'stock',
  'stock-recipes',
  'stock-purchases',
  'stock-reports',
  'drivers',
  'delivery-map',
  'driver-access',
]);

