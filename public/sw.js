const CACHE_NAME = 'kajdogaja-static-v16';
const STATIC_ASSETS = [
    '/pwa',
    '/pwa/',
    '/pwa/index.html',
    '/pwa/styles.css?v=16',
    '/pwa/app.js?v=16',
    '/manifest.webmanifest',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request).catch(async () => {
                const directMatch = await caches.match(request);
                if (directMatch) {
                    return directMatch;
                }

                const trailingSlashMatch = await caches.match('/pwa/');
                if (trailingSlashMatch) {
                    return trailingSlashMatch;
                }

                const shellMatch = await caches.match('/pwa/index.html');
                if (shellMatch) {
                    return shellMatch;
                }

                return Response.error();
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request))
    );
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'KajDogaja';
    const options = {
        body: data.body || 'Novo obvestilo v aplikaciji.',
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        data: data.data || {}
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'PUSH_NOTIFICATION') {
        return;
    }

    const payload = event.data.payload || {};
    self.registration.showNotification(payload.title || 'KajDogaja', {
        body: payload.body || 'Novo obvestilo.',
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        data: payload.data || {}
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/pwa';
    event.waitUntil(clients.openWindow(targetUrl));
});
