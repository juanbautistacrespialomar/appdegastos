# Tu Contador 💰

Tu contador personal de gastos, en un solo archivo, instalable en el celular como PWA. Los datos viven **en el dispositivo** (nada de servidores ni bases externas): privacidad total y cero costo de infraestructura.

Te manda recordatorios diarios con humor argentino para que no te olvides de cargar los gastos.

---

## Características

- **100% local** — todo se guarda en `localStorage`; los datos nunca salen del teléfono.
- **PWA instalable** — se agrega al escritorio y funciona offline gracias al service worker.
- **Bloqueo de seguridad** — PIN (hasheado con SHA-256 + salt) y desbloqueo biométrico (Face ID / Touch ID vía WebAuthn / passkey de plataforma).
- **Gastos variables** por 22 categorías con colores propios.
- **Gastos fijos, cuotas e ingresos** configurables, con vista mensual y navegación entre meses.
- **Visualizaciones** — gráfico donut de gastos por categoría y proyección de saldo a 6 meses.
- **Ocultar importes** — botón 👁 para mostrar/esconder los montos de un vistazo.
- **Backup export/import** — exportás toda tu data a un JSON y la restaurás cuando quieras (clave para no depender solo del `localStorage`).
- **Recordatorios push** — notificación diaria con la persona "Tu Contador".

---

## Stack técnico

- **Frontend:** un único `index.html` (HTML + CSS + JS vanilla, sin frameworks ni dependencias).
- **Almacenamiento:** `localStorage`.
- **Offline / caché:** `sw.js` — service worker con estrategia *stale-while-revalidate* para la navegación y *cache-first* para los assets, con caché versionado y mecanismo de "Actualizar ahora".
- **Hosting:** GitHub Pages (sitio estático).
- **Notificaciones push:**
  - Cloudflare Worker + KV (guarda las suscripciones push).
  - GitHub Actions (cron diario) que dispara el envío.
  - VAPID para la autenticación de Web Push.

---

## Estructura del repo

```
├── index.html                              # La app entera
├── sw.js                                   # Service worker (offline + push)
├── manifest.json                           # Manifest PWA (nombre, íconos, colores)
├── icon-192.png / icon-512.png             # Íconos de la app
├── icon-maskable.png                       # Ícono maskable (Android)
├── .github/workflows/recordatorios.yml     # Cron diario de recordatorios
└── scripts/recordatorios/
    ├── enviar-recordatorios.js             # Lógica de envío de push
    └── package.json
```

---

## Instalar en el celular

1. Entrá al sitio publicado en GitHub Pages desde el navegador del celu.
2. **iPhone (Safari):** Compartir → *Agregar a inicio*.
   **Android (Chrome):** menú ⋮ → *Instalar app* / *Agregar a pantalla principal*.
3. Abrila desde el ícono nuevo. Listo, funciona offline.

> **Nota iOS:** el nombre y los datos de una PWA se "congelan" al agregarla al escritorio. Si borrás el ícono en iPhone podés perder el `localStorage`. **Antes de borrar el ícono, exportá el backup** (⚙️ Datos y backup) y guardalo en iCloud Drive.

---

## Recordatorios push (configuración)

El cron de `recordatorios.yml` corre todos los días a las **12:00 UTC (09:00 ART)** y también se puede disparar a mano desde la pestaña **Actions** de GitHub (`workflow_dispatch`).

Necesita estos **secrets** cargados en el repo (Settings → Secrets and variables → Actions):

| Secret | Qué es |
|---|---|
| `CF_API_TOKEN` | Token de la API de Cloudflare |
| `CF_ACCOUNT_ID` | ID de la cuenta de Cloudflare |
| `CF_KV_NAMESPACE_ID` | ID del namespace KV donde viven las suscripciones |
| `VAPID_PUBLIC_KEY` | Clave pública VAPID |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID (⚠️ nunca en el front) |

> ⚠️ **Ojo con las claves:** al ser un sitio estático, cualquier cosa que metas en `index.html` queda pública. La VAPID **pública** va sin problema en el front; la **privada** vive únicamente como secret de GitHub Actions.

---

## Backup y datos

Toda la información se guarda en `localStorage`, así que es tan frágil como el navegador: se puede perder si limpiás datos, reinstalás el navegador o (en iOS) borrás el ícono. Por eso: **exportá seguido** desde ⚙️ Datos y backup y guardá el JSON en un lugar seguro (iCloud Drive, Drive, mail, donde sea). Para restaurar, importás ese mismo JSON.

---

## Versión

La versión actual está definida en la constante `APP_VERSION` dentro de `index.html`.
