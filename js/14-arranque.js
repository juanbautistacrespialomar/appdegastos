/* ===== Tu Contador — js/14-arranque.js =====
   Pantalla de bloqueo y arranque de la app.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* El foco de un campo lo maneja el focusin de más arriba (setea _campoActivo y dispara el
   debounce de centrado). No agregamos más listeners de foco acá: un solo camino, sin scrolls
   solapados. */

/* ===== Pantalla de bloqueo: se muestra al abrir la app (si está activada) y de nuevo
   cada vez que la app vuelve de segundo plano. No reemplaza el contenido, lo tapa
   (overlay opaco a pantalla completa) hasta que el PIN o la biometría sean correctos. */
let bloqueada=false;
function mostrarLockScreen(esInicial){
  bloqueada=true;
  $("lockScreen").classList.add("open");
  const padEl=$("lock-pad"), dotsEl=$("lock-dots"), errEl=$("lock-err"), bioBtn=$("lock-bio");
  const tieneBio = !!(lock.cred && window.PublicKeyCredential);
  bioBtn.style.display = tieneBio ? "inline-flex" : "none";
  let intentos=0, bloqueoHasta=0, ivCount=null;
  function desbloquear(){ $("lockScreen").classList.remove("open"); bloqueada=false; if(esInicial) render(); }
  setupPinEntry(padEl, dotsEl, errEl, 4, (pin, reset)=>{
    if(Date.now()<bloqueoHasta){ reset("Esperá un momento antes de volver a intentar"); return; }
    checkPin(pin).then(ok=>{
      if(ok){ intentos=0; desbloquear(); return; }
      intentos++; if(navigator.vibrate) navigator.vibrate(200);
      if(intentos>=5){
        intentos=0; bloqueoHasta=Date.now()+30000; let restante=30;
        clearInterval(ivCount);
        reset("Demasiados intentos. Esperá "+restante+"s");
        ivCount=setInterval(()=>{ restante--; if(restante<=0){ clearInterval(ivCount); errEl.textContent=""; } else errEl.textContent="Demasiados intentos. Esperá "+restante+"s"; },1000);
      } else reset("PIN incorrecto ("+(5-intentos)+" intentos restantes)");
    });
  });
  if(tieneBio){
    bioBtn.onclick=async ()=>{ if(await autenticarBiometria()) desbloquear(); };
    setTimeout(()=>{ if($("lockScreen").classList.contains("open")) bioBtn.click(); }, 300);
  }
}
function iniciarApp(){ if(lock.enabled) mostrarLockScreen(true); else render(); }
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="hidden" && lock.enabled) bloqueada=true;
  else if(document.visibilityState==="visible" && lock.enabled && bloqueada) mostrarLockScreen(false);
  if(document.visibilityState==="visible") sincronizarRecordatorios();
});
iniciarApp();
