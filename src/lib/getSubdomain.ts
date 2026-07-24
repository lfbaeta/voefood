/**
 * Detecta o subdomínio do restaurante no hostname atual e monta URLs.
 *
 * Regras:
 * - Domínios base conhecidos (peddi.online, peddioficial.lovable.app, www.*, localhost)
 *   → retornam null.
 * - Subdomínios reservados (www, admin, api, auth, mail, ...) → null.
 * - Ambientes de preview (id-preview--*.lovable.app, *.lovableproject.com) → null.
 * - Caso contrário, retorna o primeiro segmento (ex.: "pizzaria-do-ze").
 */

export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "auth",
  "mail",
  "ftp",
  "smtp",
  "cdn",
  "static",
  "assets",
  "blog",
  "docs",
  "help",
  "support",
  "status",
  "dev",
  "staging",
  "test",
  "preview",
  "id-preview",
  "lp",
]);

/**
 * Domínios raiz reconhecidos. Configurável via VITE_APP_ROOT_DOMAINS
 * (lista separada por vírgulas) para permitir mudar de domínio sem redeploy.
 */
function readRootDomains(): string[] {
  const raw = (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_APP_ROOT_DOMAINS : undefined) as
    | string
    | undefined;
  const configured = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const defaults = ["voefood.com", "voefood.lovable.app"];
  return Array.from(new Set([...configured, ...defaults]));
}

const ROOT_DOMAINS = readRootDomains();

function isPreviewHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".lovableproject.com") ||
    // id-preview--<uuid>.lovable.app é o preview do editor
    hostname.startsWith("id-preview--") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

export function getSubdomain(
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): string | null {
  if (!hostname) return null;
  hostname = hostname.toLowerCase();

  if (isPreviewHost(hostname)) return null;

  for (const root of ROOT_DOMAINS) {
    if (hostname === root || hostname === `www.${root}`) return null;
    if (hostname.endsWith(`.${root}`)) {
      const sub = hostname.slice(0, -1 * (root.length + 1));
      if (sub.includes(".")) return null; // só primeiro nível
      if (RESERVED_SUBDOMAINS.has(sub)) return null;
      return sub;
    }
  }

  return null;
}

/**
 * Retorna o domínio raiz "melhor" a usar em URLs geradas do lado do cliente.
 * Prioriza o domínio do host atual (se for um dos ROOT_DOMAINS conhecidos).
 */
export function getCurrentRootDomain(
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): string {
  hostname = hostname.toLowerCase();
  for (const root of ROOT_DOMAINS) {
    if (hostname === root || hostname === `www.${root}` || hostname.endsWith(`.${root}`)) {
      return root;
    }
  }
  return ROOT_DOMAINS[0];
}

/**
 * Verdadeiro quando estamos rodando num host que NÃO suporta subdomínio de restaurante
 * (localhost, preview do Lovable, IP). Nesses casos usamos o formato /r/:slug.
 */
export function shouldUsePathBasedRouting(
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): boolean {
  return isPreviewHost(hostname);
}

/**
 * URL absoluta pública do restaurante.
 * - Em produção: https://{slug}.{rootDomain}
 * - Em preview/localhost: {origin}/r/{slug}
 */
export function buildRestaurantUrl(
  slug: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
): string {
  if (!origin) {
    return `https://${slug}.${ROOT_DOMAINS[0]}`;
  }
  const url = new URL(origin);
  if (shouldUsePathBasedRouting(url.hostname)) {
    return `${origin.replace(/\/$/, "")}/r/${slug}`;
  }
  const root = getCurrentRootDomain(url.hostname);
  return `${url.protocol}//${slug}.${root}`;
}

/**
 * Base path para links internos (react-router). Vazio quando o slug atual
 * já é servido via subdomínio; caso contrário, `/r/{slug}`.
 */
export function buildBasePath(
  slug: string | null | undefined,
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): string {
  if (!slug) return "";
  const sub = getSubdomain(hostname);
  if (sub && sub === slug.toLowerCase()) return "";
  return `/r/${slug}`;
}
