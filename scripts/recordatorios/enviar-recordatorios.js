/* ===== Recordatorios diarios — Mis Gastos =====
   Corre 1 vez por día desde GitHub Actions. Lee los registros guardados por
   el Worker (suscripción push + señales agregadas), decide qué mensaje
   corresponde a cada dispositivo según las reglas de abajo, y lo manda.

   No tiene acceso a montos, descripciones ni nombres de tarjetas — solo a los
   6 números agregados que sincroniza el teléfono (ver calcularSignals() en
   index.html). */
const webpush = require("web-push");

const {
  CF_API_TOKEN, CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
} = process.env;

for (const v of ["CF_API_TOKEN","CF_ACCOUNT_ID","CF_KV_NAMESPACE_ID","VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY"]) {
  if (!process.env[v]) { console.error(`Falta la variable de entorno ${v}`); process.exit(1); }
}

webpush.setVapidDetails(VAPID_SUBJECT || "mailto:cambiar@ejemplo.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}`;

async function cfFetch(path, opts = {}) {
  return fetch(`${CF_BASE}${path}`, {
    ...opts,
    headers: { "Authorization": `Bearer ${CF_API_TOKEN}`, ...(opts.headers || {}) }
  });
}

async function listarClaves() {
  const res = await cfFetch("/keys");
  const data = await res.json();
  if (!data.success) throw new Error("No pude listar claves de KV: " + JSON.stringify(data.errors));
  return (data.result || []).map(k => k.name);
}

async function leerValor(key) {
  const res = await cfFetch(`/values/${encodeURIComponent(key)}`);
  if (!res.ok) return null;
  return res.text();
}

async function borrarClave(key) {
  await cfFetch(`/values/${encodeURIComponent(key)}`, { method: "DELETE" });
}

async function env_put(key, record) {
  await cfFetch(`/values/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });
}

/* ===== Mensajes y reglas =====
   Cada frase tiene una "condición de oportunidad": cuándo cae bien. Varias
   pueden estar disponibles el mismo día; de las disponibles se elige una al
   azar (todas compiten parejo). El tope de 2/semana es el único freno. */
const CANDIDATAS = [
  // --- Inactividad (días sin cargar nada) ---
  { id:"inactivo7", texto:"Tenemos que hablar. Traé mate.",
    cond:(s,ctx)=> ctx.dias >= 7 },
  { id:"inactivo5", texto:"No saber cuánto gastaste es peor que la incertidumbre del dólar. Cargá.",
    cond:(s,ctx)=> ctx.dias >= 4 && ctx.dias <= 6 },
  { id:"inactivo3", texto:"Hace 3 días que no cargás nada. O sos un monje tibetano o le estás mintiendo a la app 🧘",
    cond:(s,ctx)=> ctx.dias === 3 },
  { id:"inactivo1", texto:"Che, ¿desaparecieron tus gastos o te hacés el distraído? Veníte a cargar.",
    cond:(s,ctx)=> ctx.dias === 2 },

  // --- Reaccionan a algo concreto de tus gastos ---
  { id:"saldoNegativo", texto:"Tus ahorros y yo nos juntamos a hablar de vos. No salió bien.",
    cond:(s)=> s.ingresoEsteMes > 0 && s.gastoEsteMesADiaX > s.ingresoEsteMes },
  { id:"proyeccion", texto:"Spoiler: si seguís así, el 28 morfás arroz con arroz.",
    cond:(s,ctx)=> ctx.diaMes >= 10 && ctx.diaMes <= 22 && s.ingresoEsteMes > 0 && proyectarFinMes(s,ctx) > s.ingresoEsteMes },
  { id:"tarjetaAlta", texto:"Tu tarjeta pidió licencia médica. Está agotada.",
    cond:(s)=> s.gastoEsteMesADiaX > 0 && (s.gastoTarjetaEsteMes / s.gastoEsteMesADiaX) > 0.6 },
  { id:"empanadas", texto:"Lo que gastaste este mes, en empanadas, alcanza para un casamiento.",
    cond:(s)=> s.promedioHistorico > 0 && s.gastoEsteMesADiaX > s.promedioHistorico * 1.3 },
  { id:"gastoMenor", texto:"Gastaste menos que el mes pasado. Tomá, campeón 🏆",
    cond:(s,ctx)=> ctx.diaMes >= 27 && s.gastoMesAnteriorADiaX > 0 && s.gastoEsteMesADiaX < s.gastoMesAnteriorADiaX },

  // --- Rutina / calendario (compiten parejo con el resto) ---
  { id:"inicioMes", texto:"Tu yo del mes pasado tiene cosas para explicarte. Pasá a verlas.",
    cond:(s,ctx)=> ctx.diaMes <= 3 },
  { id:"lunes", texto:"¿Cómo venís de plata después del finde? Hacé el balance del daño.",
    cond:(s,ctx)=> ctx.diaSemana === 1 },
  { id:"viernes", texto:"Cierre de semana: la plata del lunes se fue y solo dejó saludos.",
    cond:(s,ctx)=> ctx.diaSemana === 5 }
];

function diasEntre(fechaYMD, hoy) {
  if (!fechaYMD) return 99;
  const a = new Date(fechaYMD + "T00:00:00Z");
  const b = new Date(hoy.toISOString().slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

// Proyección simple de gasto a fin de mes: lo gastado hasta hoy, llevado a ritmo
// del mes completo (regla de tres por día transcurrido). Sirve para anticipar
// si vas camino a quedar en rojo, sin necesitar el detalle de movimientos.
function proyectarFinMes(s, ctx) {
  if (ctx.diaMes <= 0) return s.gastoEsteMesADiaX || 0;
  const diasDelMes = new Date(Date.UTC(ctx.anio, ctx.mes, 0)).getUTCDate();
  return Math.round((s.gastoEsteMesADiaX || 0) / ctx.diaMes * diasDelMes);
}

/* ===== Mensaje especial de arranque de mes =====
   Se manda SIEMPRE el día 1: no compite en el sorteo y se saltea el tope
   semanal (ver main). Rota entre varias frases para no repetir todos los meses.
   El nombre del mes se arma según la fecha. */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const FRASES_INICIO_MES = [
  m => `Arrancó ${m}. Reseteá el contador de "este mes me cuido"… nadie te cree, pero reseteá igual.`,
  m => `${m}: mes nuevo, deudas viejas. Pasá a mirarlas a los ojos.`,
  m => `Arrancó ${m} y tu billetera ya te tiene miedo. Cargá los gastos, seamos serios.`,
  m => `Nuevo mes, misma incapacidad de ahorrar. Empecemos ${m} fingiendo que esta vez es distinto.`,
  m => `Arrancó ${m}. El sueldo entró y ya está haciendo las valijas. Anotalo antes de que se escape.`,
  m => `Bienvenido a ${m}. Mismo presupuesto, misma fuerza de voluntad de papel. Cargá igual.`,
  m => `Arrancó ${m}. Prometeme que este mes el gasto hormiga no se te morfa el asado de fin de mes.`
];
function mensajeInicioMes(hoy) {
  const m = MESES[hoy.getUTCMonth()];
  const frase = FRASES_INICIO_MES[Math.floor(Math.random() * FRASES_INICIO_MES.length)];
  return { id: "arrancoMes", texto: frase(m) };
}

function elegirMensaje(signals, hoy) {
  const s = signals || {};
  const ctx = {
    dias: diasEntre(s.ultimaCarga, hoy),
    diaMes: hoy.getUTCDate(),
    diaSemana: hoy.getUTCDay(),   // 0=domingo ... 6=sábado
    mes: hoy.getUTCMonth() + 1,
    anio: hoy.getUTCFullYear()
  };
  // Todas las candidatas cuya condición se cumple hoy. Todas compiten parejo.
  const disponibles = CANDIDATAS.filter(c => { try { return c.cond(s, ctx); } catch (e) { return false; } });
  if (!disponibles.length) return null;
  const elegida = disponibles[Math.floor(Math.random() * disponibles.length)];
  return { id: elegida.id, texto: elegida.texto };
}

/* Tope duro anti-spam: como máximo MAX_POR_VENTANA notificaciones cada
   VENTANA_DIAS, por dispositivo. Aunque varias reglas matcheen distintos días,
   nunca se supera. Guardamos las fechas de envío en el propio registro del KV. */
const MAX_POR_VENTANA = 2;
const VENTANA_DIAS = 7;

// Inicio de la ventana anti-spam. Normalizamos "hoy" a medianoche UTC para que
// el borde coincida con las fechas del historial (que se guardan sin hora, o sea
// a medianoche). Restamos VENTANA_DIAS-1: hoy + los 6 días previos = 7 justos.
function inicioVentana(hoy) {
  const hoyMedianoche = new Date(hoy.toISOString().slice(0, 10) + "T00:00:00Z");
  return new Date(hoyMedianoche.getTime() - (VENTANA_DIAS - 1) * 86400000);
}

function dentroDelTope(historial, hoy) {
  const limite = inicioVentana(hoy);
  const recientes = (historial || []).filter(f => new Date(f) >= limite);
  return recientes.length < MAX_POR_VENTANA;
}

async function main() {
  const hoy = new Date();
  const claves = await listarClaves();
  console.log(`Dispositivos registrados: ${claves.length}`);

  for (const key of claves) {
    const raw = await leerValor(key);
    if (!raw) continue;
    let record;
    try { record = JSON.parse(raw); } catch (e) { continue; }

    const esPrimeroDeMes = hoy.getUTCDate() === 1;
    let mensaje = esPrimeroDeMes ? mensajeInicioMes(hoy) : elegirMensaje(record.signals, hoy);
    if (!mensaje) { console.log(`${key}: nada para hoy`); continue; }

    // Evitar repetir exactamente la última frase enviada: si hay otras candidatas,
    // re-elegimos; si era la única posible, se manda igual (mejor eso que silencio).
    if (!esPrimeroDeMes && record.ultimoId && mensaje.id === record.ultimoId) {
      const ctx2 = {
        dias: diasEntre((record.signals||{}).ultimaCarga, hoy),
        diaMes: hoy.getUTCDate(), diaSemana: hoy.getUTCDay(),
        mes: hoy.getUTCMonth()+1, anio: hoy.getUTCFullYear()
      };
      const otras = CANDIDATAS.filter(c => {
        if (c.id === record.ultimoId) return false;
        try { return c.cond(record.signals || {}, ctx2); } catch (e) { return false; }
      });
      if (otras.length) { const o = otras[Math.floor(Math.random()*otras.length)]; mensaje = { id:o.id, texto:o.texto }; }
    }

    // Respetar el tope semanal antes de mandar nada.
    if (!esPrimeroDeMes && !dentroDelTope(record.enviados, hoy)) {
      console.log(`${key}: hay mensaje ("${mensaje.texto}") pero ya llegó al tope de ${MAX_POR_VENTANA}/${VENTANA_DIAS}d — se omite`);
      continue;
    }

    const payload = JSON.stringify({
      title: mensaje.texto,
      body: mensaje.texto,
      tag: "mis-gastos-recordatorio-" + hoy.toISOString().slice(0, 10)
    });

    try {
      await webpush.sendNotification(record.subscription, payload);
      console.log(`${key}: enviado → "${mensaje.texto}"`);
      // Registrar el envío y podar fechas viejas (más allá de la ventana) para que el KV no crezca.
      const limite = inicioVentana(hoy);
      record.enviados = (record.enviados || []).filter(f => new Date(f) >= limite);
      record.enviados.push(hoy.toISOString().slice(0, 10));
      record.ultimoId = mensaje.id;
      await env_put(key, record);
    } catch (err) {
      console.warn(`${key}: error al enviar (${err.statusCode || err.message})`);
      // 404/410 = la suscripción ya no existe (desinstaló, cambió de teléfono, etc.)
      if (err.statusCode === 404 || err.statusCode === 410) {
        await borrarClave(key);
        console.log(`${key}: suscripción vencida, borrada del KV`);
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
