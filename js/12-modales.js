/* ===== Tu Contador — js/12-modales.js =====
   Modales reutilizables: confirmación y PIN.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* ===== Modal de confirmación reutilizable (pedido 6) ===== */
let _cfOk=null;
function confirmar(titulo, msg, onOk, textoOk, peligro){
  $("cf-title").textContent = titulo;
  $("cf-msg").textContent = msg;
  const ok=$("cf-ok");
  ok.textContent = textoOk || "Confirmar";
  ok.className = peligro ? "btn btn-add danger" : "btn btn-add"; // rojo si es destructivo
  _cfOk = onOk;
  $("modalConfirm").classList.add("open");
}
function cerrarConfirm(){ $("modalConfirm").classList.remove("open"); _cfOk=null; }
$("cf-x").onclick=cerrarConfirm;
$("cf-cancel").onclick=cerrarConfirm;
$("modalConfirm").onclick=e=>{ if(e.target.id==="modalConfirm") cerrarConfirm(); };
$("cf-ok").onclick=()=>{ const fn=_cfOk; cerrarConfirm(); if(fn) fn(); };

/* ===== Modal de PIN: pedir el actual (para verificar) o pedir uno nuevo (alta/cambio) ===== */
function abrirModalPin(titulo, sub){
  $("pin-title").textContent=titulo; $("pin-sub").textContent=sub||""; $("pin-err").textContent="";
  $("modalPin").classList.add("open");
}
function cerrarModalPin(){ $("modalPin").classList.remove("open"); }
$("pin-x").onclick=cerrarModalPin;
$("modalPin").onclick=e=>{ if(e.target.id==="modalPin") cerrarModalPin(); };
function pedirPinActual(msg, onOk){
  abrirModalPin("Confirmá tu PIN", msg);
  setupPinEntry($("pin-pad"), $("pin-dots"), $("pin-err"), 4, async (pin, reset)=>{
    if(await checkPin(pin)){ cerrarModalPin(); onOk(); } else reset("PIN incorrecto, probá de nuevo");
  });
}
function pedirPinNuevo(onOk){
  abrirModalPin("Elegí un PIN", "4 dígitos");
  setupPinEntry($("pin-pad"), $("pin-dots"), $("pin-err"), 4, (pin1)=>{
    abrirModalPin("Repetí el PIN", "Para confirmarlo");
    setupPinEntry($("pin-pad"), $("pin-dots"), $("pin-err"), 4, async (pin2, reset2)=>{
      if(pin1!==pin2){ reset2("No coincide, empezá de nuevo"); setTimeout(()=>pedirPinNuevo(onOk), 900); return; }
      await setPin(pin1); cerrarModalPin(); onOk();
    });
  });
}
