/* Basit kabuk önbelleği: site offline da açılır, veri internetle gelir. */
const VERSION = 'ev-v5';
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './seed.js', './buddies.js', './buddies-data.js', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.endsWith('supabase.co');
  if (isSupabase) return; // veri her zaman ağdan

  if (sameOrigin) {
    // kabuk: önce ağ (güncellemeler hemen gelsin), olmazsa önbellek
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else {
    // CDN / fontlar: önce önbellek, yoksa ağ
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
  }
});
