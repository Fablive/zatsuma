/* Zatsuma service worker — the cure for "my installed app won't update".
   Strategy: NETWORK-FIRST for everything on our own origin, so a home-screen
   app always shows the latest deploy the moment it has signal, then falls back
   to the cached copy when offline (Zatsuma still opens with no connection).

   Because it's network-first, the CACHE_VERSION below doesn't have to be bumped
   on every release to stay current — the network copy always wins when online;
   the cache is only the offline safety net, refreshed on each successful fetch.
   Bump it when you want to force-clear old offline copies. */

const CACHE_VERSION = 'v56';
const CACHE = `zatsuma-${CACHE_VERSION}`;
const CORE = ['./', './index.html', './app.js', './style.css', './manifest.json'];

self.addEventListener('install', event => {
  self.skipWaiting(); // take over as soon as it's ready, no "waiting" limbo
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim(); // control open pages right away
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // never touch the Supabase POST
  if (new URL(req.url).origin !== location.origin) return; // leave Google Fonts etc. to the browser

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);               // always try the network first
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());                // keep the offline copy current
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);        // offline → serve what we have
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
