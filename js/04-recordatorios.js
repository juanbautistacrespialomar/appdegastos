/* ===== Tu Contador — js/04-recordatorios.js =====
   Recordatorios push (suscripción, señales que se sincronizan) e invitación a activarlos.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* ===== Recordatorios push (diarios, vía Worker + GitHub Actions) =====
   Reemplazá VAPID_PUBLIC_KEY y RECORDATORIOS_URL por los valores reales una
   vez que despliegues el Worker (ver checklist). Lo que se sincroniza son
   solo 6 números agregados — nunca montos individuales, descripciones ni
   nombres de tarjeta. */
const VAPID_PUBLIC_KEY = "BHe5al9QdWygfWL8ZnF15HY4oLqVtM9LjibaAUkTWkmdktJT5k47ub1qtmkdc-NGdr73HENMJMEmQIUpNZt5Kkw";
const RECORDATORIOS_URL = "https://mis-gastos-recordatorios.juanbautistacrespialomar.workers.dev/sync";
const PKEY = "misGastosApp.push.v1";
let pushPrefs = load(PKEY, {enabled:false});
const AKEY = "misGastosApp.aperturas";
let _aperturas = (load(AKEY,0)||0)+1; save(AKEY,_aperturas);

function urlBase64ToUint8Array(base64String){
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

async function activarRecordatorios(){
  if(!("serviceWorker" in navigator) || !("PushManager" in window)){ alert("Tu navegador no soporta notificaciones push."); return false; }
  try{
    const perm = await Notification.requestPermission();
    if(perm!=="granted") return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    pushPrefs.enabled=true; save(PKEY,pushPrefs);
    const syncOk = await sincronizarRecordatorios(sub, true);
    if(!syncOk){
      pushPrefs.enabled=false; save(PKEY,pushPrefs);
      activarRecordatorios._ultimoError = "No se pudo avisar al servidor (" + (sincronizarRecordatorios._ultimoError || "sin detalle") + ")";
      return false;
    }
    return true;
  }catch(e){ console.warn("No se pudo activar recordatorios:", e); activarRecordatorios._ultimoError = (e && (e.name+": "+e.message)) || String(e); return false; }
}
async function desactivarRecordatorios(){
  pushPrefs.enabled=false; save(PKEY,pushPrefs);
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub) await sub.unsubscribe();
  }catch(e){}
}
/* Solo números agregados — nada de detalle. "ADiaX" es una simplificación:
   compara el total acumulado del mes vs. el total del mes anterior completo
   (no exactamente "hasta el mismo día"), suficiente para las frases que
   tenemos. Si más adelante querés más precisión, se puede filtrar `mov` por
   día del mes acá mismo. */
function calcularSignals(){
  const ymHoy=ymNow();
  const c=computeMes(ymHoy);
  const cPrev=computeMes(ymAdd(ymHoy,-1));
  const ultimaCarga = mov.reduce((max,m)=> (m.fecha && m.fecha>max ? m.fecha : max), "");
  let acumPrev=0, nPrev=0;
  for(let i=1;i<=6;i++){ const cc=computeMes(ymAdd(ymHoy,-i)); if(cc.gasto>0){ acumPrev+=cc.gasto; nPrev++; } }
  return {
    ultimaCarga: ultimaCarga || null,
    gastoEsteMesADiaX: Math.round(c.gasto),
    gastoMesAnteriorADiaX: Math.round(cPrev.gasto),
    ingresoEsteMes: Math.round(c.ingreso),
    gastoTarjetaEsteMes: Math.round(c.tC),
    promedioHistorico: nPrev ? Math.round(acumPrev/nPrev) : 0
  };
}
let _ultimoSyncTs=0;
async function sincronizarRecordatorios(subOpcional, forzar){
  if(!pushPrefs.enabled) return true;
  if(!forzar && Date.now()-_ultimoSyncTs < 60000) return true;
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = subOpcional || await reg.pushManager.getSubscription();
    if(!sub) return true;
    _ultimoSyncTs = Date.now();
    const res = await fetch(RECORDATORIOS_URL, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ subscription: sub.toJSON(), signals: calcularSignals() })
    });
    if(!res.ok) throw new Error("El servidor respondió " + res.status);
    return true;
  }catch(e){
    console.warn("No se pudo sincronizar recordatorios:", e);
    sincronizarRecordatorios._ultimoError = (e && (e.name+": "+e.message)) || String(e);
    return false;
  }
}

/* ===== Invitación (una sola vez por dispositivo) a activar recordatorios =====
   Solo se ofrece si el push realmente puede funcionar ahí (instalada en pantalla
   de inicio, no en una pestaña de Safari). Si tocan "Ahora no" o "Activar", se
   marca pushPrefs.invitado=true y no se vuelve a mostrar nunca más. */
function estaInstaladaComoApp(){
  const standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  return ("serviceWorker" in navigator) && ("PushManager" in window) && standalone;
}
function mostrarInvitacionPush(){
  if(pushPrefs.enabled || pushPrefs.invitado) return;
  if(_aperturas < 2) return;                                             // 1ra apertura no: esa es la del cartel de actualización
  if($("modalUpd") && $("modalUpd").classList.contains("open")) return;  // no encimar con el cartel de "nueva versión"
  if(!estaInstaladaComoApp()) return;
  $("modalInvitePush").classList.add("open");
}
