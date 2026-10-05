/* ===== Tu Contador — js/13-ios-teclado.js =====
   Parches de iOS: zoom, alto visible con teclado abierto y que el teclado no tape el campo.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* ===== Evitar el zoom por doble toque y por pellizco — que quede fijo (pedido 2) =====
   touch-action:manipulation (en el CSS) ya mata el double-tap-to-zoom; acá además
   cancelamos el gesto de pellizco de Safari para que el nivel de zoom no se mueva. */
document.addEventListener("gesturestart", e=>e.preventDefault(), {passive:false});

/* ===== Teclado en iOS: el teclado se superpone (no empuja el layout), así que medimos
   el área realmente visible con visualViewport y la exponemos como variables CSS:
   --appvh  = alto visible (referencia general)
   --kb     = alto del teclado (para esconder la bottomnav/FAB y dar padding a la página)
   --vv-top = borde superior del área visible / --vv-h = alto del área visible.
   El overlay del modal se ancla a (--vv-top, --vv-h): así ocupa EXACTO lo que se ve y el
   bottom-sheet queda pegado arriba del teclado, sin el doble descuento que antes lo hacía
   escapar por arriba. El contenido que no entra scrollea dentro del propio modal. */
let _campoActivo=null, _centrarTimer=null, _campoFocuseado=false, _yaCentre=false;
let _vvGrowTimer=null, _vvH=0;
function escribirVV(){
  const vv = window.visualViewport;
  const h  = vv ? vv.height : window.innerHeight;
  const kb = vv ? Math.max(0, window.innerHeight - vv.height) : 0;
  const root = document.documentElement;
  root.style.setProperty("--appvh", h + "px");
  root.style.setProperty("--kb", kb + "px");
  // Posición y alto del área realmente visible, para anclar el overlay del modal ahí.
  root.style.setProperty("--vv-top", (vv ? vv.offsetTop : 0) + "px");
  root.style.setProperty("--vv-h", h + "px");
  // Teclado abierto: escondemos la bottomnav y el FAB (usamos un umbral para no
  // confundir la barra de URL de Safari con el teclado real).
  document.body.classList.toggle("kb-open", _campoFocuseado || kb > 120);
  _vvH = h;
}
/* ANTI-REBOTE AL CAMBIAR DE CAMPO (el "sube y baja" de Monto -> Descripcion).
   Medido cuadro a cuadro sobre un video real: el sheet recorria 1102px para desplazarse 336px
   netos, con TRES cambios de direccion en 270ms. La causa: al pasar de Monto (teclado numerico)
   a Descripcion (teclado alfabetico), iOS no "cambia" el teclado — BAJA el viejo y SUBE el nuevo.
   Durante ~150ms el area visible CRECE, y como nosotros copiabamos ese crecimiento al instante,
   el sheet se iba 220px para abajo y despues tenia que volver.
   Arreglo: si el area visible crece MIENTRAS hay un campo enfocado, no lo aplicamos enseguida:
   esperamos 160ms. Si en ese rato vuelve a achicarse (o sea, era un cambio de teclado), la bajada
   se descarta y el sheet nunca se movio para abajo. Si el teclado se cerro de verdad, se aplica
   igual 160ms mas tarde: imperceptible. Los achiques se aplican SIEMPRE al toque, para que el
   sheet nunca quede tapado por el teclado ni por un instante. */
function ajustarVV(){
  const vv = window.visualViewport;
  const h  = vv ? vv.height : window.innerHeight;
  if(_campoFocuseado && h > _vvH + 24){
    clearTimeout(_vvGrowTimer);
    _vvGrowTimer = setTimeout(escribirVV, 160);
    return;
  }
  clearTimeout(_vvGrowTimer);
  escribirVV();
}
if(window.visualViewport){
  // El teclado subiendo dispara 'resize' varias veces seguidas. En cada uno actualizamos las
  // medidas Y reprogramamos el centrado (debounce): el scroll definitivo ocurre UNA sola vez,
  // recién cuando el teclado dejó de moverse. Si scrolleábamos antes o varias veces (como antes),
  // el auto-scroll nativo de iOS —que pega el campo contra el teclado— peleaba con el nuestro y
  // la vista rebotaba: subía, bajaba, y el campo terminaba tapado.
  window.visualViewport.addEventListener("resize", ()=>{ ajustarVV(); if(_campoActivo) pedirCentrado(); });
  window.visualViewport.addEventListener("scroll", ajustarVV);   // solo refresca medidas; NO re-centra
}
window.addEventListener("orientationchange", ()=>setTimeout(ajustarVV,200));
ajustarVV();

/* Un ÚNICO centrado por foco, tras un respiro sin cambios de teclado (debounce). Cada resize del
   teclado reinicia el reloj; cuando pasan ~250ms sin movimiento, damos por asentado el teclado y
   recién ahí centramos. El candado _yaCentre evita que, una vez centrado, un nuevo resize (que en
   iOS también dispara al scrollear con la barra de Safari) nos haga re-centrar: por eso antes, al
   scrollear con la mano, la vista "se volvía para arriba". Ahora, una vez ubicado, te dejamos
   scrollear libre. Al cambiar de campo, el focusin resetea el candado. */
function pedirCentrado(){
  /* Android NO necesita esto: al subir el teclado, Chrome achica el visual viewport y YA se
     encarga de dejar visible el campo enfocado. Nuestro centrado llegaba 180ms despues, encima
     del que ya habia hecho el navegador, y lo movia de nuevo -> rebote. Ademas block:"center"
     sube por TODOS los contenedores scrolleables (.modal, .wrap y el documento), asi que movia
     tambien el fondo. En iOS si hace falta, porque alla el teclado se superpone y no centra nada. */
  if(document.documentElement.classList.contains("no-ios")) return;
  if(_yaCentre) return;
  clearTimeout(_centrarTimer);
  _centrarTimer = setTimeout(()=>{ if(_campoActivo){ asegurarVisible(_campoActivo); _yaCentre=true; } }, 180);
}

/* La barra inferior + FAB se esconden apenas se enfoca cualquier campo. No dependemos
   solo de medir el teclado, porque en pantallas scrolleadas el offsetTop despistaba la
   medición y la barra reaparecía flotando encima del teclado. */
document.addEventListener("focusin", e=>{
  const el=e.target;
  if(!el || !el.matches || !el.matches("input, textarea, select")) return;
  _campoActivo = el;
  _campoFocuseado = true;
  _yaCentre = false;              // campo nuevo: permitimos un (1) centrado
  document.body.classList.add("kb-open");
  pedirCentrado();     // se reprograma con cada resize del teclado y corre al asentarse
});
document.addEventListener("focusout", e=>{
  if(e.target && e.target.matches && e.target.matches("input, textarea, select")){
    _campoActivo = null; _campoFocuseado = false;
    clearTimeout(_centrarTimer);
    setTimeout(()=>{ if(!_campoFocuseado) ajustarVV(); }, 120);
  }
});

/* ===== iOS: que el teclado no tape lo que estás editando =====
   Dejamos que el NAVEGADOR haga el centrado con scrollIntoView. Él sabe cuál es el contenedor
   scrolleable del campo (el .modal si vive en el modal de gasto, o la página en Ajustes) y cuánto
   espacio real deja el teclado — mucho mejor que los cálculos manuales con visualViewport, que en
   iOS venían frágiles (el campo terminaba tapado) y peleaban con el auto-scroll nativo. Un solo
   intento, instantáneo, disparado cuando el teclado ya se asentó (ver pedirCentrado). */
function asegurarVisible(el){
  if(!el) return;
  /* Primero PREGUNTAMOS si hace falta. Antes centrabamos siempre (block:"center") y con animacion
     ("smooth"), asi que en cada cambio de campo habia un movimiento garantizado aunque el campo ya
     estuviera perfectamente a la vista — parte del "sube y baja". Ahora: si el campo ya se ve
     comodo dentro del area visible, no tocamos NADA.
     Y si hay que moverse, usamos block:"nearest" (mueve lo MINIMO necesario, no lo lleva al medio)
     y behavior:"auto" (instantaneo): una correccion se nota menos si no viene animada.
     El calculo compara contra visualViewport, no contra el layout: en iOS el teclado se superpone,
     asi que el navegador "cree" que la pagina entera se ve y hay que corregirlo a mano. */
  const vv    = window.visualViewport;
  const vTop  = vv ? vv.offsetTop : 0;
  const vH    = vv ? vv.height    : window.innerHeight;
  const r     = el.getBoundingClientRect();
  const MARGEN = 8;
  if((r.top - vTop) >= MARGEN && ((vTop + vH) - r.bottom) >= MARGEN) return;
  try { el.scrollIntoView({ block:"nearest", inline:"nearest", behavior:"auto" }); }
  catch(e){ el.scrollIntoView(); }
}
