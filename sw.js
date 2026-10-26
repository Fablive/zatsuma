/* Zatsuma service worker — the cure for "my installed app won't update".
   Strategy: NETWORK-FIRST for everything on our own origin, so a home-screen
   app always shows the latest deploy the moment it has signal, then falls back
   to the cached copy when offline (Zatsuma still opens with no connection).

   Because it's network-first, the CACHE_VERSION below doesn't have to be bumped
   on every release to stay current — the network copy always wins when online;
   the cache is only the offline safety net, refreshed on each successful fetch.
   Bump it when you want to force-clear old offline copies.

   On a weak signal (one bar, train, basement) the network can hang for ages
   rather than fail, which left people staring at a blank screen. So the network
   gets NETWORK_WAIT ms; if a saved copy exists and the network hasn't answered,
   the saved copy opens instantly and the fresh one still lands in the cache
   for next time. */

const CACHE_VERSION = 'v59';
const NETWORK_WAIT = 3000;
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

  const network = fetch(req).then(fresh => {        // always try the network first
    if (fresh.ok) {
      const copy = fresh.clone();                   // copy before the page starts reading it
      caches.open(CACHE).then(c => c.put(req, copy)); // keep the offline copy current
    }
    return fresh;
  });
  event.waitUntil(network.catch(() => {}));         // let the cache refresh finish in the background

  event.respondWith((async () => {
    const saved = async () => (await caches.match(req)) ||
      (await caches.match(req, { ignoreSearch: true })) || // style.css?v=48 → any saved style.css
      (req.mode === 'navigate' ? await caches.match('./index.html') : undefined);
    const slow = new Promise(res => setTimeout(res, NETWORK_WAIT));
    try {
      const first = await Promise.race([network, slow]);
      if (first) return first;                      // network answered in time
      const cached = await saved();                 // network dawdling → saved copy now
      return cached || await network;
    } catch (err) {
      const cached = await saved();                 // offline → serve what we have
      if (cached) return cached;
      throw err;
    }
  })());
});
