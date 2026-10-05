# Tu Contador 💰

Tu contador personal de gastos, instalable en el celular como PWA. Los datos viven **en el dispositivo** (nada de servidores ni bases externas): privacidad total y cero costo de infraestructura.

Te manda recordatorios diarios con humor argentino para que no te olvides de cargar los gastos.

---

## Características

- **100% local** — todo se guarda en `localStorage`; los datos nunca salen del teléfono.
- **PWA instalable** — se agrega al escritorio y funciona offline gracias al service worker.
- **Bloqueo de seguridad** — PIN (hasheado con SHA-256 + salt) y desbloqueo biométrico (Face ID / Touch ID vía WebAuthn / passkey de plataforma).
- **Gastos variables** por 22 categorías con colores propios.
- **Gastos fijos, cuotas e ingresos** configurables, con vista mensual y navegación entre meses. Cada cuota tiene su categoría real, así suma donde corresponde en los gráficos.
- **Resumen** — saldo del mes, tasa de ahorro y variación contra el mes anterior (a la misma altura del mes), ranking de categorías en barras (top 5 + resto), presupuestos por categoría y proyección de saldo a 6 meses con gastos variables estimados.
- **Movimientos** — registro de gastos variables agrupado por día, con buscador y filtros.
- **Plan** — ingresos, gastos fijos, cuotas por tarjeta y presupuestos: se ven y se editan en el mismo lugar.
- **Ocultar importes** — botón 👁 para mostrar/esconder los montos de un vistazo.
- **Backup export/import** — exportás toda tu data a un JSON y la restaurás cuando quieras (clave para no depender solo del `localStorage`).
- **Recordatorios push** — notificación diaria con la persona "Tu Contador".

---

## Stack técnico

- **Frontend:** HTML + CSS + JS vanilla, sin frameworks ni dependencias ni build. `index.html` tiene la estructura; los estilos viven en `css/app.css` y el código en `js/`, separado por tema.
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
├── index.html                  # Estructura de la pantalla + APP_VERSION + novedades de cada versión
├── css/app.css                 # Todos los estilos (paleta, componentes, vistas)
├── js/                         # El código, en orden de carga (comparten el alcance global)
│   ├── 01-dominio.js           # Cálculos puros (cuotas, vigencias, saldos, comparativas) → con tests
│   ├── 02-base.js              # Íconos, guardado en el dispositivo y carga de datos
│   ├── 03-seguridad.js         # PIN y Face ID
│   ├── 04-recordatorios.js     # Notificaciones push
│   ├── 05-ui.js                # Estado de pantalla, formatos, toasts, combos, filtros
│   ├── 06-resumen-movimientos.js
│   ├── 07-plan.js              # Plan y paneles de carga de ingresos/fijos/cuotas/presupuestos
│   ├── 08-ajustes.js
│   ├── 09-carga-gasto.js       # Panel de carga de gasto variable
│   ├── 10-exportar.js          # CSV / Excel
│   ├── 11-eventos.js           # Conexión de botones y eventos
│   ├── 12-modales.js           # Confirmación y PIN
│   ├── 13-ios-teclado.js       # Parches de iOS (teclado, zoom, alto visible)
│   ├── 14-arranque.js          # Pantalla de bloqueo y arranque
│   ├── 15-actualizacion.js     # Aviso de versión nueva
│   ├── 16-pwa.js               # Registro del service worker / botón Instalar
│   └── 17-ios-altura.js        # Alto real en iPhone instalado
├── fonts/                      # Inter Tight y Spline Sans Mono (licencia OFL)
├── sw.js                       # Service worker (offline + push + actualización)
├── manifest.json               # Manifest PWA (nombre, íconos, colores)
├── icon-192.png / icon-512.png / icon-maskable.png
├── test/                      # Tests (node --test, sin instalar nada)
├── .github/workflows/
│   ├── tests.yml               # Corre los tests en cada subida
│   └── recordatorios.yml       # Cron diario de recordatorios
└── scripts/recordatorios/      # Lógica de envío de push
```

---

## Publicar una versión nueva

1. Cambiá `APP_VERSION` en `index.html` **y** el `?v=` de todas las líneas `<script src="js/...">` y del `<link href="css/app.css">` al mismo número. Así el celular baja los archivos nuevos en vez de usar los guardados.
2. Agregá las novedades de esa versión en el bloque `<script id="novedades">` (arriba de todo, 3 a 5 líneas cortas). El aviso de actualización las muestra antes de actualizar.
3. Subí los archivos que cambiaste. En la pestaña **Actions** vas a ver correr **Tests - Tu Contador**: si queda en verde, está todo en orden; si queda en rojo, el detalle te dice qué falta (una versión sin actualizar, un archivo sin subir, un cálculo que cambió).

## Tests

```
node --test test/*.test.js
```

- `test/dominio.test.js` — los cálculos: cuotas (incluida la que "ya venía"), vigencias de fijos e ingresos, saldo del mes, comparación a la misma altura del mes, variación %, proyección de variables, migración de backups viejos y el cache de cálculos.
- `test/estructura.test.js` — que versión y `?v=` coincidan, que exista cada archivo que pide `index.html`, que no quede ningún JS sin cargar, que haya novedades para la versión actual, que las rutas del CSS existan y que ningún JS tenga errores de sintaxis.

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

La versión actual está definida en la constante `APP_VERSION` dentro de `index.html` (ver *Publicar una versión nueva*).
