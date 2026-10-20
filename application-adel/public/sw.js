/* Coach Adel — service worker (mises à jour forcées) */
const VERSION = 'adel-pwa-v26';
const PRECACHE = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/css/site.css',
  '/css/admin.css',
  '/js/site.js',
  '/js/admin.js',
  '/js/pwa.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache fail', url, err);
          }),
        ),
      );
      // Notifie seulement s'il y a déjà un SW actif (vraie mise à jour)
      if (self.registration.active) {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_WAITING', version: VERSION });
        });
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: VERSION }));
        }),
      ),
  );
});

function isNavigation(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
  );
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (/\/(css|js|icons|image|uploads)\//.test(url.pathname) ||
      url.pathname.endsWith('.webmanifest') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.webp') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff2'))
  );
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || caches.match(request);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (isNavigation(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // CSS/JS : réseau d'abord pour que les mises à jour arrivent vite
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(networkFirstAsset(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(networkFirstAsset(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION' || event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: VERSION });
  }
});
