/* ===== Tu Contador — js/15-actualizacion.js =====
   Aviso de versión nueva (con novedades) y aplicar la actualización.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* ===== Aviso de "versión nueva" (pensado para tu modelo de reemplazar index.html) =====
   Como el Service Worker abre desde cache (rápido), en segundo plano chequeamos contra
   la red si subiste una versión más nueva. Si la hay, te aparece un CARTEL (modal) con
   botón "Actualizar ahora". Si no hay internet, no molesta. */
/* Novedades: viven en el <script id="novedades"> de cada versión. Cuando hay una versión
   nueva, las leemos del index.html NUEVO (el que bajamos de la red), así el cartel te cuenta
   qué trae antes de actualizar. Para la próxima versión: agregá su entrada arriba de todo. */
let _updPospuesto=false;
function leerNovedades(html){
  try{
    const mm = String(html).match(/<script type="application\/json" id="novedades">([\s\S]*?)<\/script>/);
    return mm ? JSON.parse(mm[1]) : {};
  }catch(e){ return {}; }
}
function pintarListaNovedades(items){
  const lista = (items && items.length) ? items : ["Mejoras y arreglos menores."];
  $("upd-list").innerHTML = lista.map(t=>`<li>${ic('check')}<span>${esc(t)}</span></li>`).join("");
}
function mostrarAvisoVersion(nueva, nov){
  $("upd-title").textContent = "Hay una versión nueva";
  $("upd-ver").innerHTML = (nueva && nueva!==APP_VERSION) ? `${esc(APP_VERSION)} → <b>${esc(nueva)}</b>` : "Ajustes menores";
  $("upd-sub").textContent = "Esto trae:";
  pintarListaNovedades(nueva ? nov[nueva] : null);
  $("upd-btns").classList.remove("solo"); $("upd-later").style.display=""; $("upd-foot").style.display="";
  const b=$("upd-now"); b.disabled=false; b.innerHTML=ic('sync')+" Actualizar"; b.onclick=aplicarUpdate;
  $("modalUpd").classList.add("open");
}
// Después de actualizar: un aviso corto, y si lo tocás, te muestra qué cambió.
function mostrarNovedadesLocales(){
  let nov={}; try{ nov=JSON.parse(($("novedades")||{}).textContent||"{}"); }catch(e){}
  $("upd-title").textContent = "Novedades";
  $("upd-ver").innerHTML = `Versión <b>${esc(APP_VERSION)}</b>`;
  $("upd-sub").textContent = "Lo que cambió:";
  pintarListaNovedades(nov[APP_VERSION]);
  $("upd-btns").classList.add("solo"); $("upd-later").style.display="none"; $("upd-foot").style.display="none";
  const b=$("upd-now"); b.disabled=false; b.innerHTML=ic('check')+" Listo"; b.onclick=()=>$("modalUpd").classList.remove("open");
  $("modalUpd").classList.add("open");
}
(function avisarSiSeActualizo(){
  try{
    const ant=localStorage.getItem("mg_ver");
    localStorage.setItem("mg_ver", APP_VERSION);
    if(ant && ant!==APP_VERSION) setTimeout(()=>toast("Ya tenés la "+APP_VERSION+". Tocá para ver qué cambió", mostrarNovedadesLocales, "ok"), 900);
  }catch(e){}
})();
async function chequearUpdate(){
  try{
    const res = await fetch("./index.html?freshcheck="+Date.now(), {cache:"no-store"});
    if(!res.ok) return;
    const red = await res.text();

    // Leemos el index tal cual lo tiene cacheado el Service Worker (= el que estás
    // corriendo). Si difiere del de la red, hay versión nueva. Esto NO depende de que
    // hayas cambiado APP_VERSION a mano: detecta CUALQUIER cambio de contenido.
    const cacheado = await leerIndexCacheado();

    let hayNueva;
    if(cacheado != null){
      hayNueva = (red !== cacheado);
    } else {
      // Fallback (no se pudo leer el cache): volvemos a comparar por número de versión.
      const mm = red.match(/APP_VERSION\s*=\s*"([^"]+)"/);
      hayNueva = !!(mm && mm[1] !== APP_VERSION);
    }
    if(!hayNueva) return;
    // No interrumpir: si estás cargando algo (cualquier modal abierto) o ya dijiste "Ahora no"
    // en esta sesión, esperamos. Se vuelve a chequear al volver a abrir la app.
    if(_updPospuesto || document.querySelector(".modal-bg.open")) return;
    const m = red.match(/APP_VERSION\s*=\s*"([^"]+)"/);
    const nueva = m ? m[1] : null;
    mostrarAvisoVersion(nueva, leerNovedades(red));
  }catch(e){ /* sin conexión: lo dejamos pasar */ }
}

// Devuelve el texto del index.html guardado en el cache del Service Worker (o null si no
// lo encuentra). Recorre todos los caches y prueba las URLs típicas; si no matchea ninguna,
// busca cualquier entrada .html que contenga APP_VERSION (nuestro index).
async function leerIndexCacheado(){
  if(!("caches" in window)) return null;
  try{
    const base = location.href.split("?")[0].split("#")[0];
    const candidatos = ["./","index.html","./index.html",location.pathname,base];
    const keys = await caches.keys();
    for(const k of keys){
      const c = await caches.open(k);
      for(const u of candidatos){
        const r = await c.match(u);
        if(r) return await r.text();
      }
      // Último recurso: recorrer las entradas del cache buscando nuestro index.
      const reqs = await c.keys();
      for(const req of reqs){
        if(req.url.includes("index.html") || req.url.endsWith("/")){
          const r = await c.match(req);
          if(r){ const t = await r.text(); if(t.includes("APP_VERSION")) return t; }
        }
      }
    }
  }catch(e){}
  return null;
}

/* ===== Aplicar la actualización: refrescar el HTML cacheado y reiniciar (pedido 1) =====
   El Service Worker abre desde cache, así que para que entre la versión nueva en UN solo
   reload le pedimos que vuelva a bajar el index fresco de la red y lo reemplace en su
   cache. Cuando confirma, recargamos. Si por algo no responde, borramos las entradas
   HTML del cache nosotros y recargamos igual. Los datos viven en localStorage: intactos. */
async function borrarCacheHTML(){
  if(!("caches" in window)) return;
  try{
    const keys = await caches.keys();
    for(const k of keys){
      const c = await caches.open(k);
      await Promise.all(
        ["./","./index.html",location.pathname,location.href.split("?")[0]]
          .map(u=>c.delete(u).catch(()=>{}))
      );
    }
  }catch(e){}
}
function aplicarUpdate(){
  $("upd-now").innerHTML=ic('sync')+" Actualizando…"; $("upd-now").disabled=true;
  let hecho=false;
  const recargar=()=>{ if(hecho) return; hecho=true; location.reload(); };
  const sw = navigator.serviceWorker;
  if(sw && sw.controller){
    // Escuchamos la confirmación del SW (que ya refrescó el cache) y recargamos
    sw.addEventListener("message", ev=>{ if(ev.data && ev.data.type==="HTML_REFRESCADO") recargar(); });
    sw.controller.postMessage({type:"REFRESCAR_HTML"});
    setTimeout(recargar, 2500); // fallback por si el SW no contesta
  } else {
    borrarCacheHTML().finally(recargar);
  }
}
$("upd-later").onclick=()=>{ _updPospuesto=true; $("modalUpd").classList.remove("open"); };
$("upd-now").onclick=aplicarUpdate;   // (mostrarAvisoVersion / mostrarNovedadesLocales lo reasignan según el modo)
$("modalUpd").onclick=e=>{ if(e.target.id==="modalUpd") $("modalUpd").classList.remove("open"); };
$("invite-no").onclick=()=>{ pushPrefs.invitado=true; save(PKEY,pushPrefs); $("modalInvitePush").classList.remove("open"); };
$("invite-si").onclick=async ()=>{
  pushPrefs.invitado=true; save(PKEY,pushPrefs);
  $("modalInvitePush").classList.remove("open");
  const ok = await activarRecordatorios();
  if(ok) toast("Recordatorios activados ✓");
  else alert("No se pudo activar.\n\nMotivo: " + (activarRecordatorios._ultimoError || "desconocido") + "\n\nMandale este texto a Claude para diagnosticar.");
};
setTimeout(chequearUpdate, 1500);
setTimeout(mostrarInvitacionPush, 2500);
// También cuando volvés a la app (sin recargarla), por si subiste una versión mientras tanto.
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") chequearUpdate(); });
