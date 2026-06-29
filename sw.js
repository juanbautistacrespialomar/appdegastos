/* Service Worker — Mis Gastos
   Estrategia v2 (stale-while-revalidate):
   - Navegación (HTML): servimos YA lo que está en cache (apertura instantánea)
     y EN PARALELO vamos a la red para actualizar el cache para la PRÓXIMA vez.
     Esto arregla la lentitud al abrir que daba el network-first anterior, que
     esperaba la respuesta de la red antes de mostrar absolutamente nada.
   - Resto de assets (manifest, íconos): cache-first (cambian poco).
   - URL con ?freshcheck=... → red directa, sin cachear. La usa el aviso de
     "versión nueva" del index.html para no quedarse pegado a la copia vieja.
   Para forzar una limpieza total, subí el número de versión del cache (CACHE). */

const CACHE = "mis-gastos-v2";
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

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Chequeo de versión: nunca del cache, siempre a la red.
  if (url.searchParams.has("freshcheck")) {
    e.respondWith(fetch(req).catch(() => new Response("", { status: 504 })));
    return;
  }

  // HTML / navegación → stale-while-revalidate (rápido + se actualiza solo)
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match(req).then(cached => {
        const red = fetch(req)
          .then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)); // refresca para la próxima
            return res;
          })
          .catch(() => cached || caches.match("./index.html"));
        // Si hay cache, lo devolvemos YA; la red corre en segundo plano.
        return cached || red;
      })
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
