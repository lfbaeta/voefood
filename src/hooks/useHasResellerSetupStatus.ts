import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Determina se o sistema já foi configurado (existe pelo menos 1 reseller).
 *
 * IMPORTANT: não use `count/head` aqui. Em alguns ambientes o `count` pode vir
 * como `null`, causando falso negativo e loop para /setup.
 */
export function useHasResellerSetupStatus() {
  return useQuery({
    queryKey: ["setup-status-has-reseller"],
    queryFn: async () => {
      // Use a RPC (SECURITY DEFINER) para evitar dependência de VIEWs públicas
      // que podem filtrar por landing_page_enabled ou sofrer restrições.
      const { data, error } = await supabase.rpc("get_has_any_reseller");

      if (error) {
        console.error("Erro ao verificar reseller via RPC (get_has_any_reseller):", error);
        // Se não conseguimos verificar, não prende o usuário no setup.
        return true;
      }

      return !!data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
