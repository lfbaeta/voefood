import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useParams, Navigate } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { Helmet } from 'react-helmet-async';
import { HeroHeader } from '@/components/menu/HeroHeader';
import { StoreInfo } from '@/components/menu/StoreInfo';
import { CategoryIcons } from '@/components/menu/CategoryIcons';
import { MenuSection } from '@/components/menu/MenuSection';
import { ProductModal } from '@/components/menu/ProductModal';
import { CartButton } from '@/components/cart/CartButton';
import { FloatingOrderButton, getLastOrderId } from '@/components/order/FloatingOrderButton';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { useStoreConfig } from '@/hooks/useStore';
import { useCategories } from '@/hooks/useCategories';
import { useProducts, Product } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import { useRestaurantTracking } from '@/hooks/useRestaurantTracking';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useHasResellerSetupStatus } from '@/hooks/useHasResellerSetupStatus';
import { useDynamicManifest } from '@/hooks/useDynamicManifest';
import { useMenuLabels } from '@/hooks/useMenuLabels';
import { useCart } from '@/hooks/useCart';
import { usePizzaSizes, usePizzaFlavors, type PizzaSize } from '@/hooks/usePizzeria';
import { PizzaBuilderModal } from '@/components/menu/PizzaBuilderModal';
import { Pizza as PizzaIcon } from 'lucide-react';
import { formatBRL } from '@/lib/pizza';
import { PromoSection } from '@/components/menu/PromoSection';
import { isPromoActive } from '@/lib/promo';


interface EditingProduct {
  product: Product;
  quantity: number;
  quantity_grams?: number;
  observation: string;
  returnTo: string | null;
  selectedAddons?: Record<string, string[]>;
}

const Index = () => {
  const slug = useSlug();
  useRestaurantTracking();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [pizzaSize, setPizzaSize] = useState<PizzaSize | null>(null);
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  const basePath = useBasePath(slug);

  // Check if any reseller exists (system is configured)
  // Usa RPC via hook centralizado (não depende de VIEW pública).
  const { data: hasReseller, isLoading: resellerCheckLoading } = useHasResellerSetupStatus();

  const { data: store, isLoading: storeLoading } = useStoreConfig();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: products, isLoading: productsLoading } = useProducts();
  const labels = useMenuLabels();

  // Apply dynamic theme based on store colors
  useTheme();

  const isPizzeria = (store as any)?.business_type === 'pizzeria';
  const { data: pizzaSizes = [] } = usePizzaSizes();
  const { data: pizzaFlavors = [] } = usePizzaFlavors();
  const availableSizes = pizzaSizes.filter((s) => s.is_available);
  const availableFlavors = pizzaFlavors.filter((f) => f.is_available);

  // Per-restaurant PWA manifest so installed app opens this menu, not the landing page
  useDynamicManifest({
    slug,
    name: store?.pwa_name || store?.name,
    shortName: store?.pwa_short_name || store?.name,
    themeColor: store?.primary_color,
    iconUrl: store?.logo_url,
  });

  const isLoading = storeLoading || categoriesLoading || productsLoading || resellerCheckLoading;

  // If on root route and no reseller exists, redirect to setup
  if (!slug && hasReseller === false && !resellerCheckLoading) {
    return <Navigate to="/setup" replace />;
  }

  // Check for last order on mount
  useEffect(() => {
    const orderId = getLastOrderId();
    setLastOrderId(orderId);
  }, []);

  // Tick para que promoções iniciem/encerrem automaticamente sem reload
  const [, setPromoTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPromoTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);


  // Isolate carts per restaurant: vincula o carrinho ao estabelecimento atual
  // (slug + restaurant_id). Se já houver carrinho de outra loja, é descartado.
  const { ensureRestaurant } = useCart();
  useEffect(() => {
    if (!slug) return;
    ensureRestaurant(slug, store?.restaurant_id ?? store?.id ?? null);
  }, [slug, store?.restaurant_id, store?.id, ensureRestaurant]);

  // Handle URL params for editing products from cart/checkout
  useEffect(() => {
    const productId = searchParams.get('product');
    const rawObservation = searchParams.get('observation') || '';
    const quantity = parseInt(searchParams.get('quantity') || '1', 10);
    const quantityGrams = searchParams.get('grams') ? parseInt(searchParams.get('grams') || '', 10) : undefined;
    const returnTo = searchParams.get('returnTo');
    const addonsParam = searchParams.get('addons');

    const sanitizeObservation = (value: string) => {
      const v = value.trim();
      if (!v) return '';

      // Legacy format previously stored: "Adicionais: ... | Obs: ..."
      const obsMarker = 'Obs:';
      if (v.includes(obsMarker)) {
        const idx = v.lastIndexOf(obsMarker);
        const extracted = v.slice(idx + obsMarker.length).trim();
        return extracted;
      }

      // If it only contains legacy addons text, drop it
      if (v.startsWith('Adicionais:')) return '';

      return v;
    };

    if (productId && products) {
      const product = products.find((p) => p.id === productId);
      if (product) {
        let selectedAddons: Record<string, string[]> | undefined;
        if (addonsParam) {
          try {
            selectedAddons = JSON.parse(decodeURIComponent(addonsParam));
          } catch (e) {
            console.error('Error parsing addons:', e);
          }
        }

        setEditingProduct({
          product,
          quantity,
          quantity_grams: quantityGrams,
          observation: sanitizeObservation(rawObservation),
          returnTo,
          selectedAddons,
        });
        // Clear the URL params
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, products, setSearchParams]);

  const scrollToCategory = (categoryId: string) => {
    const element = sectionRefs.current[categoryId];
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setEditingProduct(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center p-6">
          <p className="text-muted-foreground mb-4">Restaurante não configurado</p>
          <a 
            href="/setup"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Configurar aplicativo
          </a>
        </div>
      </div>
    );
  }

  // Filter products by search
  const filteredProducts = products?.filter(product => 
    searchQuery === '' || 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  ) || [];

  // Group products by category
  const productsByCategory = categories?.map(category => ({
    category,
    products: filteredProducts.filter(p => p.category_id === category.id)
  })).filter(group => group.products.length > 0) || [];

  // Produtos em promoção ativa (mantidos também nas categorias originais)
  const promoProducts = filteredProducts.filter(p => p.is_available && isPromoActive(p));

  const totalItems = filteredProducts.length;

  // Determine which modal to show
  const modalProduct = editingProduct?.product || selectedProduct;
  const isEditing = !!editingProduct;

  return (
    <>
      <Helmet>
        <title>{`${store.name} - ${labels.heroTagline}`}</title>
        <meta name="description" content={`Peça online no ${store.name}. ${labels.heroTagline} com entrega rápida.`} />
        <link rel="canonical" href={`${window.location.origin}${basePath || '/'}`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${store.name} - ${labels.heroTagline}`} />
        <meta property="og:description" content={`Peça online no ${store.name}.`} />
        <meta property="og:url" content={`${window.location.origin}${basePath || '/'}`} />
        {(store.cover_url || store.logo_url) && (
          <meta property="og:image" content={store.cover_url || store.logo_url} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${store.name} - ${labels.heroTagline}`} />
        <meta name="twitter:description" content={`Peça online no ${store.name}.`} />
        {(store.cover_url || store.logo_url) && (
          <meta name="twitter:image" content={store.cover_url || store.logo_url} />
        )}
      </Helmet>

      <div className="min-h-screen bg-background pb-24 mx-auto max-w-[1200px]">
        {/* Hero Header */}
        <HeroHeader store={store} />

        {/* Store Info */}
        <StoreInfo store={store} />

        {/* Search Bar - Enhanced */}
        <div className="px-4 mt-6">
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-md opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <Input
              type="text"
              placeholder={labels.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="relative h-14 w-full rounded-2xl border-2 border-border bg-card pl-5 pr-14 text-base shadow-sm placeholder:text-muted-foreground focus:border-primary focus:ring-0 transition-all duration-300"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Search className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Categories */}
        {categories && categories.length > 0 && (
          <CategoryIcons 
            categories={categories} 
            onCategorySelect={scrollToCategory}
          />
        )}

        {/* Cardápio Header */}
        <div className="px-4 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-primary" />
            <h2 className="text-xl font-bold text-foreground">{labels.menuSectionTitle}</h2>
          </div>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {totalItems} {totalItems === 1 ? labels.itemsLabelSingular : labels.itemsLabelPlural}
          </span>
        </div>

        {/* Menu Sections */}
        <div className="px-4 space-y-8">
          <PromoSection products={promoProducts} onProductSelect={setSelectedProduct} />

          {isPizzeria && availableSizes.length > 0 && (
            <section className="space-y-6">
              {/* Tamanhos — hero cards */}
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-6 rounded-full bg-primary" />
                    <h3 className="text-xl font-bold text-foreground">Monte sua pizza</h3>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {availableSizes.length} tamanho{availableSizes.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableSizes.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setPizzaSize(s)}
                      className="group text-left rounded-2xl overflow-hidden bg-card shadow-card border border-border/50 hover:border-primary/50 hover:shadow-card-hover transition-all active:scale-[0.98]"
                    >
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                        {s.image_url ? (
                          <img
                            src={s.image_url}
                            alt={s.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <PizzaIcon className="h-16 w-16 text-primary/40" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                          até {s.max_flavors} sabor{s.max_flavors > 1 ? 'es' : ''}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-foreground leading-tight">{s.name}</h4>
                            {s.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-end justify-between">
                          {s.base_price != null && Number(s.base_price) > 0 ? (
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">a partir de</div>
                              <div className="text-lg font-bold text-primary leading-none">{formatBRL(Number(s.base_price))}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">Escolha os sabores</div>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
                            Montar +
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </section>
          )}



          {productsByCategory.map(({ category, products }) => (
            <MenuSection
              key={category.id}
              ref={(el) => { sectionRefs.current[category.id] = el; }}
              category={category}
              products={products}
              onProductSelect={setSelectedProduct}
            />
          ))}

          {productsByCategory.length === 0 && (
            <div className="py-16 text-center">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4 text-lg">
                {searchQuery ? labels.emptySearchText : labels.emptyStateText}
              </p>
              {!searchQuery && store.name === 'Meu Restaurante' && (
                <a 
                  href={`${basePath}/admin`}
                  className="inline-flex items-center justify-center rounded-xl gradient-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shadow-lg"
                >
                  Acessar Painel Admin
                </a>
              )}
            </div>
          )}
        </div>

        {/* Floating Order Button */}
        {lastOrderId && (
          <FloatingOrderButton 
            orderId={lastOrderId} 
            onDismiss={() => setLastOrderId(null)} 
          />
        )}

        {/* PWA Install Prompt */}
        <InstallPrompt />

        <CartButton />
        
        {modalProduct && (
        <ProductModal
            product={modalProduct}
            onClose={handleCloseModal}
            initialQuantity={editingProduct?.quantity}
            initialQuantityGrams={editingProduct?.quantity_grams}
            initialObservation={editingProduct?.observation}
            initialAddons={editingProduct?.selectedAddons}
            isEditing={isEditing}
            returnTo={editingProduct?.returnTo}
          />
        )}

        {pizzaSize && (
          <PizzaBuilderModal size={pizzaSize} open={!!pizzaSize} onClose={() => setPizzaSize(null)} />
        )}
      </div>
    </>
  );
};

export default Index;
