import { useStoreConfig } from '@/hooks/useStore';
import { resolveMenuLabels, type MenuLabels } from '@/lib/businessTypePresets';
import type { LucideIcon } from 'lucide-react';

export type ResolvedMenuLabels = MenuLabels & { icon: LucideIcon };

/**
 * Resolves the customer-facing menu labels for the current store.
 * Merges the business-type preset with per-store overrides.
 */
export function useMenuLabels(): ResolvedMenuLabels {
  const { data: store } = useStoreConfig();
  const businessType = (store as any)?.business_type as string | undefined;
  const overrides = (store as any)?.menu_labels as Partial<MenuLabels> | undefined;
  return resolveMenuLabels(businessType, overrides);
}
