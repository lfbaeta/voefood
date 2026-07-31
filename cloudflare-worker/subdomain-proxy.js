/**
 * Cloudflare Worker — Subdomain Proxy para Peddi
 *
 * Objetivo:
 *   Fazer proxy transparente de https://{slug}.peddi.online/*
 *   para a origem Lovable (peddi.online), sem redirect.
 *
 *   O navegador continua vendo `slug.peddi.online` na URL,
 *   e o app usa `window.location.hostname` para identificar o restaurante.
 *
 * Como funciona:
 *   1. Worker intercepta a requisição em *.peddi.online
 *   2. Reescreve o Host para `peddi.online` (assim Lovable serve o app principal
 *      e não redireciona)
 *   3. Retorna a resposta preservando a URL original no navegador
 *
 * Deploy:
 *   1. Cloudflare Dashboard → Workers & Pages → Create Worker
 *   2. Cole este código, salve e faça deploy
 *   3. Vá em "Triggers" → "Add Route":
 *        Route:  *.peddi.online/*
 *        Zone:   peddi.online
 *      (adicione também `peddi.online/*` se quiser cobrir a raiz, opcional)
 *   4. Certifique-se que o DNS wildcard `*.peddi.online` está PROXIED (nuvem laranja)
 */

const ORIGIN_HOST = "peddi.online"; // domínio primário registrado no Lovable

// Subdomínios que NÃO devem ser tratados como restaurante
// (deixe passar direto para o comportamento padrão do domínio primário)
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "email",
  "ftp",
  "cdn",
  "assets",
  "static",
  "docs",
  "blog",
  "status",
  "lp",
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Se já é o domínio raiz, apenas repassa
    if (hostname === ORIGIN_HOST) {
      return fetch(request);
    }

    // Extrai o subdomínio (primeiro segmento)
    const parts = hostname.split(".");
    const subdomain = parts.length > 2 ? parts[0] : null;

    // Subdomínio reservado ou inexistente → passa direto
    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) {
      return fetch(request);
    }

    // Monta a URL de origem apontando para o domínio primário
    const originUrl = new URL(request.url);
    originUrl.hostname = ORIGIN_HOST;

    // Copia headers, sobrescrevendo Host para enganar o roteamento do Lovable
    const headers = new Headers(request.headers);
    headers.set("Host", ORIGIN_HOST);
    // X-Forwarded-Host preserva o subdomínio original (útil para debug/logs)
    headers.set("X-Forwarded-Host", hostname);
    headers.set("X-Peddi-Subdomain", subdomain);

    const proxied = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual", // NÃO seguir o redirect do Lovable
    });

    let response = await fetch(proxied);

    // Se o Lovable ainda tentar redirecionar para peddi.online, reescreve
    // o Location para manter o usuário no subdomínio.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        try {
          const locUrl = new URL(location, originUrl);
          if (locUrl.hostname === ORIGIN_HOST) {
            locUrl.hostname = hostname; // volta para o subdomínio original
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Location", locUrl.toString());
            response = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            });
          }
        } catch {
          // Location relativo ou inválido → ignora
        }
      }
    }

    return response;
  },
};
