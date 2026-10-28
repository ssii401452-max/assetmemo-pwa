'use strict';
const SCOPE = self.registration.scope;
const PREFIX = 'assetmemo-pwa:' + new URL(SCOPE).pathname + ':';
const CACHE_NAME = PREFIX + 'v4.91';
const SHELL = ['index.html', 'security-v4.91.js', 'app-v4.91.js', 'register-sw-v4.91.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].map(path => new URL(path, SCOPE).href);
const INDEX = new URL('index.html', SCOPE).href;
const ALLOWED = new Set(SHELL);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(SHELL.map(async url => {
      const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
      if (!response.ok || response.redirected) throw new Error('Incomplete application update');
      const type = response.headers.get('content-type') || '';
      if (url.endsWith('.js') && !/(?:javascript|ecmascript)/i.test(type)) throw new Error('Invalid script response');
      // Consume each response immediately. Holding all seven bodies while
      // waiting for another connection can stall a browser's fetch pool.
      await cache.put(url, response);
    }));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) { await caches.delete(CACHE_NAME); throw failed.reason; }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Never remove caches belonging to another app on this origin.
    for (const key of keys) if ((key.startsWith(PREFIX) && key !== CACHE_NAME) || key === 'assetmemo-pwa-v1.3.0') await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search || url.hash) return;
  const isHome = url.href === SCOPE || url.href === INDEX;
  if (!isHome && !ALLOWED.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isHome && request.mode === 'navigate') {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        // Keep the preinstalled shell as the offline fallback until a complete
        // new worker version is installed. Do not mix releases in this cache.
        if (response.ok && !response.redirected && /text\/html/i.test(response.headers.get('content-type') || '')) return response;
      } catch (_) { /* use this version's installed shell */ }
      return (await cache.match(INDEX)) || Response.error();
    }
    const cached = await cache.match(isHome ? INDEX : url.href);
    return cached || fetch(request);
  })());
});
