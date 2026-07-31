import { ShoppingCart, Sparkles, ClipboardList } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { StoreConfig } from '@/hooks/useStore';
import { useCart } from '@/hooks/useCart';
import { useStoreOpenStatus } from '@/hooks/useStoreOpenStatus';
import { useMenuLabels } from '@/hooks/useMenuLabels';
import { Badge } from '@/components/ui/badge';

interface HeroHeaderProps {
  store: StoreConfig;
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop';

export function HeroHeader({ store }: HeroHeaderProps) {
  const { totalItems } = useCart();
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const coverUrl = store.cover_url || DEFAULT_COVER;
  const { isOpen } = useStoreOpenStatus(store.restaurant_id);
  const labels = useMenuLabels();


  return (
    <header className="relative">
      {/* Hero Image Section */}
      <div className="relative h-56 overflow-hidden">
        {/* Background Image with parallax effect */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700"
          style={{ backgroundImage: `url('${coverUrl}')` }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 gradient-hero" />
        
        {/* Decorative elements */}
        <div className="absolute top-4 left-4 h-20 w-20 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-10 right-8 h-16 w-16 rounded-full bg-primary/30 blur-2xl" />

        {/* Top Bar with glassmorphism */}
        <div className="relative z-10 flex items-center justify-between p-4">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-background/95 backdrop-blur-md px-3.5 py-2 shadow-lg border border-border/50">
            <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-semibold text-foreground">
              {isOpen ? 'Aberto' : 'Fechado'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* My Orders Button */}
            <Link
              to={`${basePath}/my-orders`}
              aria-label="Meus pedidos"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-primary-foreground shadow-lg border border-primary/20 transition-all duration-300 hover:scale-105 hover:brightness-110"
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-semibold">Meus Pedidos</span>
            </Link>

            {/* Cart Button */}
            <Link
              to={`${basePath}/cart`}
              aria-label="Abrir carrinho"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border border-primary/20 transition-all duration-300 hover:scale-105 hover:brightness-110"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground shadow-lg animate-bounce-in border border-border">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Store Name - Centered with elegant typography */}
        <div className="absolute bottom-16 left-0 right-0 text-center px-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-widest text-white/80">
              {labels.heroTagline}
            </span>
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">
            {store.name}
          </h1>
        </div>
      </div>

      {/* Logo Avatar - Enhanced with glow effect */}
      <div className="relative z-20 flex justify-center -mt-12">
        <div className="relative group">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full bg-primary/40 blur-md scale-110 group-hover:scale-125 transition-transform duration-500" />
          
          {/* Logo container */}
          <div className="relative h-24 w-24 rounded-full border-4 border-background bg-background shadow-xl overflow-hidden transition-transform duration-300 group-hover:scale-105">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={`Logo do restaurante ${store.name}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center gradient-primary">
                <span className="text-4xl">🍔</span>
              </div>
            )}
          </div>
          
          {/* Open indicator dot */}
          {isOpen && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 border-4 border-background flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}