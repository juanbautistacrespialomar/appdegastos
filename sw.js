/* Service Worker — Mis Gastos
   Estrategia:
   - Navegación (HTML): network-first con fallback a cache.
     Así, si hay internet, SIEMPRE servís la última versión deployada
     y evitás el clásico problema de "cambié el index pero sigue la versión vieja".
     Offline, cae al cache.
   - Resto de assets (manifest, ícono): cache-first (cambian poco).
   Para forzar una actualización limpia, subí el número de versión del cache. */

const CACHE = "mis-gastos-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

// Instalación: precacheamos los assets base
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())   // activa el SW nuevo sin esperar
  );
});

// Activación: borramos caches viejos (versiones anteriores)
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // toma control de las pestañas abiertas
  );
});

// Fetch: este handler es lo que hace a la app "instalable" para Chrome/Edge
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // HTML / navegación → network-first
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Resto → cache-first, con red de respaldo
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
