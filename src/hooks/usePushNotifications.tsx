import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SW_URL = '/push-sw.js';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isPreviewOrDev() {
  if (typeof window === 'undefined') return true;
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname;
  if (h.startsWith('id-preview--') || h.startsWith('preview--')) return true;
  if (h === 'lovableproject.com' || h.endsWith('.lovableproject.com')) return true;
  if (h === 'lovableproject-dev.com' || h.endsWith('.lovableproject-dev.com')) return true;
  if (h === 'beta.lovable.dev' || h.endsWith('.beta.lovable.dev')) return true;
  return false;
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function isPushSupported() {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  // iOS requires installed PWA
  if (isIOS() && !isStandalonePWA()) return false;
  return true;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  } catch (e) {
    console.error('[push] SW register failed', e);
    return null;
  }
}

export interface PushSubscribeOptions {
  role: 'staff' | 'customer';
  restaurantId: string;
  topics: string[];
  // customer only
  orderId?: number;
  customerPhone?: string;
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const blocked = isPreviewOrDev();

  useEffect(() => {
    setSupported(isPushSupported() && !blocked && !!VAPID_PUBLIC_KEY);
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
    (async () => {
      const reg = await getRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    })();
  }, [blocked]);

  const subscribe = useCallback(async (opts: PushSubscribeOptions) => {
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key não configurada');
    }
    if (blocked) throw new Error('Notificações indisponíveis no preview');
    if (!isPushSupported()) {
      throw new Error(isIOS() ? 'Adicione o app à tela de início para ativar' : 'Navegador sem suporte');
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Permissão negada');

      const reg = await getRegistration();
      if (!reg) throw new Error('Service worker indisponível');

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json: any = sub.toJSON();
      const endpoint = json.endpoint || sub.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      const userAgent = navigator.userAgent;

      if (opts.role === 'customer') {
        if (!opts.orderId || !opts.customerPhone) throw new Error('Pedido ou telefone ausente');
        const { error } = await supabase.rpc('save_customer_push_subscription', {
          p_order_id: opts.orderId,
          p_customer_phone: opts.customerPhone,
          p_endpoint: endpoint,
          p_p256dh: p256dh,
          p_auth: auth,
          p_topics: opts.topics,
          p_user_agent: userAgent,
        });
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error('Usuário não autenticado');
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert(
            {
              restaurant_id: opts.restaurantId,
              role: 'staff',
              user_id: uid,
              endpoint,
              p256dh,
              auth,
              topics: opts.topics,
              user_agent: userAgent,
              failure_count: 0,
            },
            { onConflict: 'endpoint' }
          );
        if (error) throw error;
      }

      setIsSubscribed(true);
    } finally {
      setLoading(false);
    }
  }, [blocked]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await getRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, permission, isSubscribed, loading, subscribe, unsubscribe, blocked };
}
