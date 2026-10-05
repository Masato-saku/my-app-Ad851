const CACHE = 'lifecoin-v1';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  './theme-purple.css', './theme-red.css', './theme-orange.css',
  './theme-green.css', './theme-blue.css', './theme-brown.css', './theme-dark.css',
  './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 網路優先，沒網路才用快取：你改了程式，重新開啟就會拿到新版
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});