import { supabase } from '@/integrations/supabase/client';
import { buildRestaurantUrl } from '@/lib/getSubdomain';

/**
 * SSO entre o painel administrativo e os subdomínios das lojas.
 *
 * A sessão do Supabase é persistida em localStorage, que NÃO é compartilhado
 * entre subdomínios (voefood.com x loja.voefood.com). Por isso, ao abrir o
 * painel de uma loja a partir do painel admin/reseller, transferimos os tokens
 * da sessão atual via fragmento (#access_token=...), que o cliente Supabase
 * detecta automaticamente (detectSessionInUrl) e usa para hidratar a sessão
 * no novo subdomínio — sem pedir e-mail/senha novamente.
 */
export async function buildDirectAccessUrl(slug: string): Promise<string> {
  const base = `${buildRestaurantUrl(slug)}/auth?direct=true`;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Sem sessão no painel: cai na tela de login da loja (comportamento esperado).
    if (!session?.access_token || !session?.refresh_token) return base;

    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type || 'bearer',
      expires_in: String(session.expires_in ?? 3600),
    });

    return `${base}#${params.toString()}`;
  } catch {
    return base;
  }
}

/** Abre o painel da loja já autenticado (impersonação master). */
export async function openRestaurantDirect(
  slug: string,
  target: '_self' | '_blank' = '_self',
): Promise<void> {
  const url = await buildDirectAccessUrl(slug);
  window.open(url, target);
}
