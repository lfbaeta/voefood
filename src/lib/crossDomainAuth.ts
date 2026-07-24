import { supabase } from '@/integrations/supabase/client';

const HASH_KEY = 'sb_bridge';

/**
 * Abre uma URL em outro subdomínio carregando a sessão atual do usuário
 * via hash fragment (não é enviado ao servidor). Do outro lado,
 * `consumeSessionFromHash` aplica a sessão antes de renderizar as rotas.
 */
export async function openWithCurrentSession(url: string, target: string = '_blank') {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.access_token || !session?.refresh_token) {
      window.open(url, target);
      return;
    }
    const payload = btoa(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
    );
    const u = new URL(url);
    u.hash = `${HASH_KEY}=${payload}`;
    window.open(u.toString(), target);
  } catch {
    window.open(url, target);
  }
}

/**
 * Se a URL atual contiver a sessão no hash, aplica no cliente supabase
 * e limpa o hash. Retorna true se aplicou uma sessão.
 */
export async function consumeSessionFromHash(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const raw = params.get(HASH_KEY);
  if (!raw) return false;
  try {
    const { access_token, refresh_token } = JSON.parse(atob(raw));
    if (!access_token || !refresh_token) return false;
    await supabase.auth.setSession({ access_token, refresh_token });
    // Limpa o hash sem recarregar
    params.delete(HASH_KEY);
    const remaining = params.toString();
    const newUrl =
      window.location.pathname +
      window.location.search +
      (remaining ? `#${remaining}` : '');
    window.history.replaceState(null, '', newUrl);
    return true;
  } catch (err) {
    console.error('[crossDomainAuth] falha ao aplicar sessão:', err);
    return false;
  }
}
