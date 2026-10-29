// Quote Card 專用 Service Worker，scope: /quotecard/
const CACHE_NAME = 'quotecard-offline-v2';
const APP_FILES = ['./', './index.html', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 逐一快取：任何單一檔案缺失（例如圖示 404）都不會讓整個安裝失敗。
    const results = await Promise.allSettled(APP_FILES.map(file => cache.add(file)));
    results.forEach((r, i) => { if (r.status === 'rejected') console.warn('Quote Card 快取失敗：', APP_FILES[i], r.reason); });
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // 僅清除 Quote Card 自己的舊版快取，絕不刪除 Life Coin 快取。
    await Promise.all(keys.filter(key => key.startsWith('quotecard-offline-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      return (await caches.match(event.request, { ignoreSearch: true })) || (event.request.mode === 'navigate' ? await caches.match('./index.html') : Response.error());
    }
  })());
});
