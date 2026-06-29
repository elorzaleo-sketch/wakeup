// Wake Up Viajes - Service Worker
// Versión: incrementar este número cuando hagas cambios importantes al sitio
const CACHE_VERSION = 'wakeup-v1';

// Archivos que se cachean al instalar la PWA (shell de la app)
const PRECACHE_URLS = [
  '/index.html',
  '/familias.html',
  '/panel_resumen.html',
  '/panel_fichas.html',
  '/panel_encuestas_familias.html',
  '/encuestas.html',
  '/cronograma_pasajero.html',
  '/mensaje_whatsapp.html',
  '/cronograma-general.html',
  '/admin.html',
  '/registro.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// INSTALACIÓN: cachea los archivos principales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN: elimina cachés viejas de versiones anteriores
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_VERSION)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: estrategia "Network First" para páginas, "Cache First" para assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Requests a Supabase y APIs externas: siempre van a la red, sin caché
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('workers.dev') ||
    request.method === 'POST'
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Para HTML: Network First (intenta la red, cae a caché si no hay conexión)
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Actualiza la caché con la versión fresca
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Para todo lo demás: Cache First (más rápido, usa red si no está cacheado)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
