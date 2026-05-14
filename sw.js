// ============================================================
// sw.js - SERVICE WORKER LENGKAP (PWA SpinDecide v4)
// Strategi: Cache First (static), Network First (API), Online Only (realtime)
// ============================================================

const CACHE_VERSION  = 'v4';
const CACHE_STATIC   = `spindecide-static-${CACHE_VERSION}`;
const CACHE_DYNAMIC  = `spindecide-dynamic-${CACHE_VERSION}`;
const OFFLINE_URL    = 'offline.html';

// ─── Asset statis yang WAJIB di-cache saat install ───────────
const STATIC_ASSETS = [
  'offline.html',
  'login.html',
  'register.html',
  'dashboard.html',
  'history.html',
  'truth-dare.html',
  'double-spin.html',
  'multiplayer.html',
  'manifest.json',
  // CSS
  'style.css',
  'global-features.css',
  'truth-dare.css',
  'double-spin.css',
  'multiplayer.css',
  // JS lokal
  'supabase.js',
  'auth.js',
  'spin.js',
  'history.js',
  'truth-dare-data.js',
  'truth-dare.js',
  'double-spin.js',
  'multiplayer.js',
  'audio-controller.js',
  'theme-controller.js',
  // Icon
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-72.png',
  'icons/icon-96.png',
  'icons/icon-128.png',
  'icons/icon-144.png',
  'icons/icon-152.png',
  'icons/icon-384.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
];

// ─── Host yang TIDAK boleh di-cache (online-only) ────────────
const BYPASS_HOSTS = [
  'supabase.co',           // Supabase API & realtime
  'supabase.in',
  'up.railway.app',        // Socket.IO backend multiplayer
  'socket.io',
];

// ─── Host CDN yang boleh di-cache secara dinamis ─────────────
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ═══════════════════════════════════════════════════════════════
// INSTALL: Cache semua static asset
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  console.log('[SW] Installing v4…');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        // addAll versi aman — lewati file yang gagal
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn(`[SW] Gagal cache: ${url}`, err)
            )
          )
        );
      })
      .then(() => {
        console.log('[SW] Install selesai, skipWaiting…');
        return self.skipWaiting();
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATE: Hapus cache lama
// ═══════════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name =>
              name.startsWith('spindecide-') &&
              name !== CACHE_STATIC &&
              name !== CACHE_DYNAMIC
            )
            .map(name => {
              console.log('[SW] Hapus cache lama:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Broadcast ke semua tab bahwa ada update
        self.clients.matchAll().then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
          );
        });
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// FETCH: Routing strategi berdasarkan tipe request
// ═══════════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Skip non-GET requests
  if (req.method !== 'GET') return;

  // 2. Skip chrome-extension dan non-http
  if (!url.protocol.startsWith('http')) return;

  // 3. BYPASS: Supabase, Socket.IO, Railway — langsung ke network (online-only)
  if (BYPASS_HOSTS.some(host => url.hostname.includes(host))) {
    // Tidak intercept sama sekali
    return;
  }

  // 4. CDN: Network First, fallback ke cache
  if (CDN_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(networkFirstStrategy(req, CACHE_DYNAMIC));
    return;
  }

  // 5. File lokal: Cache First, fallback ke network, fallback ke offline
  event.respondWith(cacheFirstStrategy(req));
});

// ─── Strategi: Cache First ─────────────────────────────────────
async function cacheFirstStrategy(req) {
  const url = new URL(req.url);

  // Coba ambil dari static cache dulu
  const cachedStatic = await caches.match(req, { cacheName: CACHE_STATIC });
  if (cachedStatic) return cachedStatic;

  // Coba dari dynamic cache
  const cachedDynamic = await caches.match(req, { cacheName: CACHE_DYNAMIC });
  if (cachedDynamic) return cachedDynamic;

  // Tidak ada di cache → fetch network
  try {
    const networkResponse = await fetch(req);

    // Simpan ke dynamic cache jika response valid
    if (networkResponse && networkResponse.status === 200) {
      const resClone = networkResponse.clone();
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(req, resClone);
    }

    return networkResponse;
  } catch (err) {
    // Network gagal → fallback
    console.warn('[SW] Network gagal untuk:', req.url);

    // Untuk request dokumen → tampilkan offline.html
    if (req.destination === 'document') {
      const offlinePage = await caches.match(OFFLINE_URL);
      return offlinePage || new Response('<h1>Offline</h1>', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Untuk image → fallback SVG kosong
    if (req.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    // Lainnya → response kosong
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ─── Strategi: Network First ───────────────────────────────────
async function networkFirstStrategy(req, cacheName) {
  try {
    const networkResponse = await fetch(req);
    if (networkResponse && networkResponse.status === 200) {
      const resClone = networkResponse.clone();
      const cache = await caches.open(cacheName);
      cache.put(req, resClone);
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(req);
    return cached || new Response('', { status: 503 });
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE: Handle pesan dari halaman
// ═══════════════════════════════════════════════════════════════
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting diminta oleh halaman');
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(CACHE_DYNAMIC).then(cache => cache.addAll(urls));
  }

  if (event.data?.type === 'CLEAR_DYNAMIC_CACHE') {
    caches.delete(CACHE_DYNAMIC).then(() =>
      console.log('[SW] Dynamic cache dihapus')
    );
  }
});
