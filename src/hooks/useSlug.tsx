import { useParams } from "react-router-dom";
import { getSubdomain, buildBasePath } from "@/lib/getSubdomain";

/**
 * Resolve o slug do restaurante atual.
 * Prioridade:
 *   1. Subdomínio do host (produção: `pizzaria.peddioficial.lovable.app`).
 *   2. Parâmetro `:slug` da rota (formato legado `/r/:slug/...`).
 */
export function useSlug(): string | undefined {
  const params = useParams<{ slug?: string }>();
  const fromHost = getSubdomain();
  return fromHost ?? params.slug ?? undefined;
}

/**
 * Base path para prefixar links internos. Vazio no subdomínio; `/r/{slug}` no
 * domínio raiz (preview do Lovable, localhost, etc.).
 */
export function useBasePath(slug?: string | null): string {
  const auto = useSlug();
  const effective = slug ?? auto;
  return buildBasePath(effective);
}
