/* ===== Tu Contador — js/02-base.js =====
   Íconos, guardado en el dispositivo (localStorage) y carga de los datos al abrir la app.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* ===================== ICONOS =====================
   Un unico lugar donde vive cada path. ic("trash") devuelve el <svg> listo.
   Estilo calcado del #eyeBtn original (Feather): viewBox 24x24, stroke, sin fill.
   El color NO se define aca: sale de currentColor del contenedor.            */
const ICONS = {
  sync:   '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  chevL:  '<path d="M15 18l-6-6 6-6"/>',
  chevR:  '<path d="M9 18l6-6-6-6"/>',
  arrUp:  '<path d="M7 17L17 7M9 7h8v8"/>',
  arrDown:'<path d="M7 7l10 10M17 9v8H9"/>',
  minus:  '<path d="M5 12h14"/>',
  eye:    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  alert:  '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  receipt:'<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  lock:   '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  finger: '<path d="M12 10a2 2 0 0 1 2 2c0 3-.4 5.2-1 6.8"/><path d="M8.5 12a3.5 3.5 0 0 1 7 0c0 3.6-.6 6.2-1.3 8.2"/><path d="M5 12a7 7 0 0 1 14 0c0 4.2-1 7.2-1.6 8.8"/><path d="M3.6 8.2A9.5 9.5 0 0 1 20.4 8.2"/>',
  down:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  up:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus:   '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x:      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  trash:  '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  gift:   '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z"/>',
  bell:   '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  card:   '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  bksp:   '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
  trend:  '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  save:   '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  pin:    '<line x1="12" y1="17" x2="12" y2="22"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
  db:     '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  sheet:  '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  reset:  '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  check:  '<polyline points="20 6 9 17 4 12"/>',
  chev:   '<polyline points="9 18 15 12 9 6"/>'
};
/* cls extra opcional: ic("lock","ic-lg"). aria-hidden porque el label de texto ya esta al lado. */
function ic(k, cls){ return '<svg class="ic'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+ICONS[k]+'</svg>'; }
/* Chevron de colapso: colapsado = apunta a la derecha; abierto = rota 90deg hacia abajo. */
function chev(colapsado){ return '<svg class="fold-ic'+(colapsado?'':' open')+'" viewBox="0 0 24 24" aria-hidden="true">'+ICONS.chev+'</svg>'; }

// (APP_VERSION vive en index.html: el aviso de versión nueva lo lee de ahí)
try{ const _fv=document.getElementById("footVer"); if(_fv) _fv.textContent="Tu Contador v"+APP_VERSION+" · tus datos se guardan en este dispositivo."; }catch(e){}

const CKEY="misGastosApp.config.v1", MKEY="misGastosApp.mov.v1";
const mem={};
function load(k,def){ try{const r=localStorage.getItem(k); return r?JSON.parse(r):def;}catch(e){ return (k in mem)?mem[k]:def; } }
let _saveFailAvisado = 0;   // timestamp del último aviso de fallo, para no spamear
function save(k,v){
  mem[k]=v;                                     // siempre en memoria: la sesión sigue andando aunque falle el disco
  try{
    localStorage.setItem(k,JSON.stringify(v));
    return true;                                // persistió en el dispositivo
  }catch(e){
    // localStorage falló (cuota llena, modo privado de Safari, o storage bloqueado).
    // El dato quedó SOLO en memoria y se pierde al cerrar la app -> hay que avisar.
    // Anti-spam: save() se llama en ráfaga, así que avisamos como mucho 1 vez cada 8s.
    if(Date.now()-_saveFailAvisado > 8000){
      _saveFailAvisado = Date.now();
      try{ toast("No pude guardar los cambios en el dispositivo. Liberá espacio o salí del modo privado.", ()=>{ const t=$("toast"); if(t) t.classList.remove("show"); }, "error"); }catch(_){}
    }
    return false;                               // NO persistió
  }
}

let config = load(CKEY,null); config = config? normConfig(config) : SEED(); save(CKEY,config);
let mov = load(MKEY,null); mov = (mov===null)? MOV_SEED() : normMov(mov); save(MKEY,mov);
