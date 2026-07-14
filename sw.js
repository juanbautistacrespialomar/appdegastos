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

const CACHE = "mis-gastos-v15";
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

/* Mensaje desde la página: cuando el usuario toca "Actualizar ahora", la app nos pide
   refrescar el HTML cacheado. Bajamos el index fresco de la red (sin pasar por cache) y
   lo reemplazamos en NUESTRO cache (acá sí sabemos el nombre exacto del cache). Después
   avisamos a todas las pestañas para que recarguen: así entra la versión nueva en un
   solo reload, sin que el usuario tenga que abrir y cerrar dos veces. */
self.addEventListener("message", e => {
  if (!e.data || e.data.type !== "REFRESCAR_HTML") return;
  e.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      const fresh = await fetch("./index.html", { cache: "no-store" });
      if (fresh && fresh.ok) {
        await cache.put("./index.html", fresh.clone());
        await cache.put("./", fresh);
      }
    } catch (err) { /* sin internet: dejamos lo que haya cacheado */ }
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: "HTML_REFRESCADO" }));
  })());
});

/* ===== Push: recordatorios diarios =====
   El payload que manda el Worker (vía GitHub Actions) es JSON: { body, tag }.
   Título fijo corto ("💰 Hallazgo del día") y la frase completa en el cuerpo, que iOS
   expande a varias líneas (a diferencia del título, que va en una sola). El logo
   lo toma del ícono de la PWA (icon-192.png). */
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data ? e.data.text() : "" }; }
  const frase = data.body || data.title || "Pasá a cargar tus gastos.";
  const options = {
    body: frase,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "mis-gastos-recordatorio",
    renotify: true,
    data: { url: "./" }
  };
  e.waitUntil(self.registration.showNotification("💰 Hallazgo del día", options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clientsArr) {
      if (c.url.includes(self.location.origin) && "focus" in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
