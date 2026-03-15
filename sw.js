// ─────────────────────────────────────────────────────────────
//  Kids Math — Service Worker
//  Increment VERSION on every deploy to bust old caches.
// ─────────────────────────────────────────────────────────────
const VERSION     = 'app-v3';
const CACHE_CORE  = `${VERSION}-core`;
const CACHE_FONTS = `${VERSION}-fonts`;

// Files to pre-cache on install
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

// ── Install: pre-cache shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_CORE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old versioned caches ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_CORE && k !== CACHE_FONTS)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: tiered caching strategy ───────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // External fonts → network-first, cache fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(networkFirstFonts(request));
    return;
  }

  // HTML documents → network-first, cache fallback (catch updates quickly)
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstDoc(request));
    return;
  }

  // Everything else (JS, CSS, images, icons) → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Network-first for HTML — always try network, fall back to cache
async function networkFirstDoc(request) {
  const cache = await caches.open(CACHE_CORE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) || (await cache.match('./index.html'));
  }
}

// Network-first for fonts
async function networkFirstFonts(request) {
  const cache = await caches.open(CACHE_FONTS);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) || new Response('', { status: 408 });
  }
}

// Stale-while-revalidate for assets
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_CORE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(fresh => {
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || await fetchPromise;
}
