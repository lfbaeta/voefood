/**
 * Detecta o subdomínio do restaurante no hostname atual e monta URLs.
 *
 * O domínio raiz usado como base para os subdomínios é resolvido nesta ordem:
 *   1. Domínio configurado pelo super admin (salvo em `resellers.root_domain`
 *      e espelhado em localStorage para uso síncrono).
 *   2. VITE_APP_ROOT_DOMAINS (lista separada por vírgulas).
 *   3. Derivação automática a partir do hostname atual (funciona em remix,
 *      sem depender do domínio do app original).
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

const STORAGE_KEY = "peddi:root_domain";

/** Normaliza um domínio digitado pelo usuário (remove protocolo, path, www). */
export function normalizeRootDomain(input: string): string {
  let value = (input || "").trim().toLowerCase();
  if (!value) return "";
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0];
  value = value.replace(/^www\./, "");
  value = value.replace(/\.$/, "");
  return value;
}

export function isValidRootDomain(input: string): boolean {
  const value = normalizeRootDomain(input);
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value);
}

/** Domínio configurado pelo super admin (cache local, leitura síncrona). */
export function getConfiguredRootDomain(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && isValidRootDomain(value) ? normalizeRootDomain(value) : null;
  } catch {
    return null;
  }
}

/** Grava/limpa o domínio configurado no cache local. */
export function setConfiguredRootDomain(domain: string | null | undefined) {
  if (typeof localStorage === "undefined") return;
  try {
    const value = domain ? normalizeRootDomain(domain) : "";
    if (value && isValidRootDomain(value)) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readEnvRootDomains(): string[] {
  const raw = (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_APP_ROOT_DOMAINS : undefined) as
    | string
    | undefined;
  return raw
    ? raw
        .split(",")
        .map((s) => normalizeRootDomain(s))
        .filter(Boolean)
    : [];
}

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

/**
 * Deriva o domínio raiz a partir do hostname atual, sem depender de listas
 * fixas — essencial para remixes com domínio próprio.
 */
function deriveRootFromHost(hostname: string): string | null {
  if (!hostname || isPreviewHost(hostname)) return null;
  const parts = hostname.split(".");
  if (parts.length < 2) return null;
  // Sufixos de plataforma com 2 rótulos (ex.: lovable.app, netlify.app)
  const platformSuffixes = ["lovable.app", "lovableproject.com", "netlify.app", "vercel.app", "pages.dev"];
  const suffix = platformSuffixes.find((s) => hostname === s || hostname.endsWith(`.${s}`));
  if (suffix) {
    const suffixParts = suffix.split(".").length;
    return parts.slice(-(suffixParts + 1)).join(".");
  }
  // Sufixos de 2 níveis mais comuns (com.br, co.uk, ...)
  const secondLevel = ["com", "co", "net", "org", "gov", "edu"];
  if (parts.length >= 3 && parts[parts.length - 1].length === 2 && secondLevel.includes(parts[parts.length - 2])) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/** Lista ordenada de domínios raiz reconhecidos para o host informado. */
function rootDomainsFor(hostname: string): string[] {
  const list: string[] = [];
  const configured = getConfiguredRootDomain();
  if (configured) list.push(configured);
  list.push(...readEnvRootDomains());
  const derived = deriveRootFromHost(hostname);
  if (derived) list.push(derived);
  return Array.from(new Set(list.filter(Boolean)));
}

export function getSubdomain(
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): string | null {
  if (!hostname) return null;
  hostname = hostname.toLowerCase();

  if (isPreviewHost(hostname)) return null;

  for (const root of rootDomainsFor(hostname)) {
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
 * Retorna o domínio raiz a usar em URLs geradas do lado do cliente.
 * Prioriza o domínio configurado pelo super admin.
 */
export function getCurrentRootDomain(
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): string {
  hostname = hostname.toLowerCase();
  const configured = getConfiguredRootDomain();
  if (configured) return configured;
  const roots = rootDomainsFor(hostname);
  return roots[0] || hostname;
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
    const configured = getConfiguredRootDomain();
    return configured ? `https://${slug}.${configured}` : `/r/${slug}`;
  }
  const url = new URL(origin);
  if (shouldUsePathBasedRouting(url.hostname)) {
    const configured = getConfiguredRootDomain();
    if (configured) return `https://${slug}.${configured}`;
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
