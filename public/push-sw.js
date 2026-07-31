// Push-only service worker. Does NOT cache anything, does NOT interfere with the PWA/app shell.
// Handles `push` events and shows native notifications; on click, focuses/opens the target URL.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: 'Notificação', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Notificação';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || undefined,
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    vibrate: payload.vibrate || [200, 100, 200],
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ('navigate' in client) {
              try { await client.navigate(targetUrl); } catch (_e) {}
            }
            return;
          }
        } catch (_e) {}
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
