// sw.js — autodestrucción: limpia el service worker viejo y el caché
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const cl = await self.clients.matchAll({ type: 'window' });
    cl.forEach(c => c.navigate(c.url));
  })());
});
