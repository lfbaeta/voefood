import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { CartItem, CartAddonSnapshot, Product } from '@/types';
import { trackAddToCart } from '@/lib/tracking';
import { newId } from '@/lib/pizza';
import type { PizzaFlavor, PizzaBorder } from '@/lib/pizza';

const CART_STORAGE_KEY = 'delivery-cart';

interface CartStorageData {
  items: CartItem[];
  restaurantSlug: string | null;
  restaurantId: string | null;
}

interface AddItemOptions {
  observation?: string;
  selectedAddons?: Record<string, string[]>;
  addonsSnapshot?: CartAddonSnapshot[];
  quantity_grams?: number;
  pizzaFlavors?: PizzaFlavor[];
  pizzaBorder?: PizzaBorder | null;
  /** If provided, replaces the existing cart line instead of merging. */
  replaceLineId?: string;
  /** When true, forces a new line (used for pizza / customized items). */
  forceNewLine?: boolean;
}

interface EnsureResult {
  cleared: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: Product,
    quantity: number,
    observationOrOptions?: string | AddItemOptions,
    selectedAddons?: Record<string, string[]>,
  ) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  restaurantSlug: string | null;
  restaurantId: string | null;
  setRestaurantSlug: (slug: string) => void;
  ensureRestaurant: (slug: string | null | undefined, restaurantId: string | null | undefined) => EnsureResult;
  belongsTo: (slug: string | null | undefined, restaurantId?: string | null) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizeItem(raw: any): CartItem {
  return {
    lineId: raw.lineId || newId(),
    product: raw.product,
    quantity: raw.quantity,
    observation: raw.observation,
    selectedAddons: raw.selectedAddons,
    addonsSnapshot: raw.addonsSnapshot,
    quantity_grams: raw.quantity_grams,
    pizzaFlavors: raw.pizzaFlavors,
    pizzaBorder: raw.pizzaBorder,
  };
}

function loadCartFromStorage(): CartStorageData {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return { items: parsed.map(normalizeItem), restaurantSlug: null, restaurantId: null };
      }
      return {
        items: (parsed.items || []).map(normalizeItem),
        restaurantSlug: parsed.restaurantSlug || null,
        restaurantId: parsed.restaurantId || null,
      };
    }
  } catch (error) {
    console.error('Error loading cart from storage:', error);
  }
  return { items: [], restaurantSlug: null, restaurantId: null };
}

function saveCartToStorage(data: CartStorageData) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartData, setCartData] = useState<CartStorageData>(() => loadCartFromStorage());

  useEffect(() => {
    saveCartToStorage(cartData);
  }, [cartData]);

  const addItem: CartContextType['addItem'] = (product, quantity, observationOrOptions, selectedAddons) => {
    const opts: AddItemOptions = typeof observationOrOptions === 'object' && observationOrOptions !== null
      ? observationOrOptions
      : { observation: observationOrOptions as string | undefined, selectedAddons };

    try {
      trackAddToCart({ id: product.id, name: product.name, price: product.price, quantity });
    } catch (e) {}

    setCartData(prev => {
      // Replace flow (edit)
      if (opts.replaceLineId) {
        const idx = prev.items.findIndex(i => i.lineId === opts.replaceLineId);
        if (idx > -1) {
          const updated = [...prev.items];
          updated[idx] = {
            ...updated[idx],
            product,
            quantity,
            observation: opts.observation,
            selectedAddons: opts.selectedAddons,
            addonsSnapshot: opts.addonsSnapshot,
            quantity_grams: opts.quantity_grams,
            pizzaFlavors: opts.pizzaFlavors,
            pizzaBorder: opts.pizzaBorder,
          };
          return { ...prev, items: updated };
        }
      }

      const isCustomized = opts.forceNewLine
        || !!opts.pizzaFlavors?.length
        || !!opts.pizzaBorder
        || !!(opts.addonsSnapshot && opts.addonsSnapshot.length > 0)
        || !!(opts.selectedAddons && Object.values(opts.selectedAddons).some(a => a?.length > 0))
        || !!opts.quantity_grams;

      // Non-customized: merge by product.id
      if (!isCustomized) {
        const existingIndex = prev.items.findIndex(item => item.product.id === product.id && !item.pizzaFlavors?.length && !item.addonsSnapshot?.length && !item.quantity_grams);
        if (existingIndex > -1) {
          const updated = [...prev.items];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
            observation: opts.observation || updated[existingIndex].observation,
          };
          return { ...prev, items: updated };
        }
      }

      const newLine: CartItem = {
        lineId: newId(),
        product,
        quantity,
        observation: opts.observation,
        selectedAddons: opts.selectedAddons,
        addonsSnapshot: opts.addonsSnapshot,
        quantity_grams: opts.quantity_grams,
        pizzaFlavors: opts.pizzaFlavors,
        pizzaBorder: opts.pizzaBorder,
      };
      return { ...prev, items: [...prev.items, newLine] };
    });
  };

  const removeItem = (lineId: string) => {
    setCartData(prev => ({
      ...prev,
      // Accept lineId OR fallback to product.id (backward compat with old callers).
      items: prev.items.filter(item => item.lineId !== lineId && item.product.id !== lineId),
    }));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(lineId);
      return;
    }
    setCartData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.lineId === lineId || item.product.id === lineId ? { ...item, quantity } : item
      ),
    }));
  };

  const clearCart = () => {
    setCartData({ items: [], restaurantSlug: null, restaurantId: null });
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const setRestaurantSlug = (slug: string) => {
    setCartData(prev => ({ ...prev, restaurantSlug: slug }));
  };

  const belongsTo = useCallback(
    (slug: string | null | undefined, restaurantId?: string | null) => {
      if (cartData.items.length === 0) return true;
      if (cartData.restaurantId && restaurantId) {
        return cartData.restaurantId === restaurantId;
      }
      if (cartData.restaurantSlug && slug) {
        return cartData.restaurantSlug === slug;
      }
      return true;
    },
    [cartData.items.length, cartData.restaurantId, cartData.restaurantSlug],
  );

  const ensureRestaurant = useCallback(
    (slug: string | null | undefined, restaurantId: string | null | undefined): EnsureResult => {
      let cleared = false;
      setCartData(prev => {
        const slugMismatch = !!prev.restaurantSlug && !!slug && prev.restaurantSlug !== slug;
        const idMismatch = !!prev.restaurantId && !!restaurantId && prev.restaurantId !== restaurantId;
        const mismatch = slugMismatch || idMismatch;

        if (mismatch && prev.items.length > 0) {
          cleared = true;
          return {
            items: [],
            restaurantSlug: slug ?? null,
            restaurantId: restaurantId ?? null,
          };
        }

        const nextSlug = slug ?? prev.restaurantSlug;
        const nextId = restaurantId ?? prev.restaurantId;
        if (nextSlug === prev.restaurantSlug && nextId === prev.restaurantId) return prev;
        return { ...prev, restaurantSlug: nextSlug, restaurantId: nextId };
      });
      return { cleared };
    },
    [],
  );

  const totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartData.items.reduce((sum, item) => {
    const addonsTotal = (item.addonsSnapshot || []).reduce((s, a) => s + Number(a.price || 0), 0);
    return sum + (item.product.price + addonsTotal) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{
      items: cartData.items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      restaurantSlug: cartData.restaurantSlug,
      restaurantId: cartData.restaurantId,
      setRestaurantSlug,
      ensureRestaurant,
      belongsTo,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
