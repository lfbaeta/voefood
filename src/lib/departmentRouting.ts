/**
 * Department routing helpers.
 * Each category is assigned to either "kitchen" or "bar", and items are
 * printed / KDS-routed to the matching station.
 */
import { supabase } from '@/integrations/supabase/client';

export type Department = 'kitchen' | 'bar';

export const DEPARTMENT_LABELS: Record<Department, string> = {
  kitchen: 'COZINHA',
  bar: 'BAR',
};

export interface CategoryLite {
  id: string;
  department?: Department | null;
}

export interface ProductLite {
  id: string;
  category_id: string | null;
}

/**
 * Resolve the department for a given product using pre-loaded maps.
 * Falls back to 'kitchen' when no mapping is found.
 */
export function resolveDepartmentByProduct(
  productId: string | null | undefined,
  productMap: Map<string, ProductLite>,
  categoryMap: Map<string, CategoryLite>
): Department {
  if (!productId) return 'kitchen';
  const product = productMap.get(productId);
  if (!product?.category_id) return 'kitchen';
  const category = categoryMap.get(product.category_id);
  return (category?.department as Department) || 'kitchen';
}

/**
 * Fetch products + categories for a restaurant and build lookup maps.
 * Safe for both admin and public contexts (tables have public SELECT policies).
 */
export async function loadDepartmentLookups(restaurantId: string) {
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from('products').select('id, category_id').eq('restaurant_id', restaurantId),
    supabase.from('categories').select('id, department').eq('restaurant_id', restaurantId),
  ]);

  const productMap = new Map<string, ProductLite>();
  (productsRes.data || []).forEach((p: any) => productMap.set(p.id, p));

  const categoryMap = new Map<string, CategoryLite>();
  (categoriesRes.data || []).forEach((c: any) => categoryMap.set(c.id, c));

  return { productMap, categoryMap };
}

/**
 * Split a generic items array into two buckets by department.
 * `getProductId` extracts the product_id from each row.
 */
export function splitItemsByDepartment<T>(
  items: T[],
  getProductId: (item: T) => string | null | undefined,
  productMap: Map<string, ProductLite>,
  categoryMap: Map<string, CategoryLite>
): Record<Department, T[]> {
  const result: Record<Department, T[]> = { kitchen: [], bar: [] };
  items.forEach((item) => {
    const dept = resolveDepartmentByProduct(getProductId(item), productMap, categoryMap);
    result[dept].push(item);
  });
  return result;
}
