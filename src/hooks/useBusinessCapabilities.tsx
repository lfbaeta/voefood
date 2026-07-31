import { useMemo } from 'react';
import { useStoreConfig } from './useStore';
import { useBusinessTypeDefaults } from './useBusinessTypeDefaults';
import {
  resolveCapabilities,
  type BusinessCapabilities,
} from '@/lib/businessCapabilities';

/**
 * Retorna as capabilities do estabelecimento atual (baseado no store_config
 * do restaurante em contexto). Aplica o padrão global do tipo (definido pelo
 * Super Admin) e o override manual do operador por cima.
 */
export function useBusinessCapabilities(): BusinessCapabilities {
  const { data: store } = useStoreConfig();
  const { data: typeDefaults } = useBusinessTypeDefaults();

  return useMemo(() => {
    const type = (store as any)?.business_type as string | null | undefined;
    const subtype = (store as any)?.business_subtype as string | null | undefined;
    const override = (store as any)?.capabilities_override as
      | Partial<BusinessCapabilities>
      | null
      | undefined;
    return resolveCapabilities(type, subtype, override);
    // typeDefaults entra nas deps para recalcular quando o Super Admin salvar
  }, [store, typeDefaults]);
}
