/* ===== Tu Contador — js/05-ui.js =====
   Estado de la pantalla (vista, mes, filtros), formatos de montos, toasts, combos y filtros.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

let vista="resumen";
let vistaPrev="resumen";
let mesActivo=ymNow();
let colapsado={};
let colCuotas={};

let catExpand=false;   // Resumen: mostrar todas las categorías o solo el top 5
let editId=null;
let oculto=(function(){ try{ return localStorage.getItem("mg_oculto")==="1"; }catch(e){ return false; } })();
let fTexto="", fCat="__todas", fMedio="__todos";

const $ = id => document.getElementById(id);
const fmt = n => oculto ? "$ •••••" : new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Math.round(n)||0);
const fmtN = n => oculto ? "•••••" : new Intl.NumberFormat("es-AR").format(n);
function formatMoneyInput(el){
  const antes = el.value;
  const caret = el.selectionStart==null ? antes.length : el.selectionStart;
  const digitosAntes = (antes.slice(0,caret).match(/\d/g)||[]).length;
  const nuevo = fmtMoneyStr(antes);
  if(nuevo===antes) return;
  el.value = nuevo;
  let vistos=0, pos=nuevo.length;
  for(let k=0;k<nuevo.length;k++){ if(/\d/.test(nuevo[k])) vistos++; if(vistos>=digitosAntes){ pos=k+1; break; } }
  try{ el.setSelectionRange(pos,pos); }catch(e){}
}
document.addEventListener("input", e=>{
  if(e.target && e.target.classList && e.target.classList.contains("js-money")) formatMoneyInput(e.target);
});
/* Achica la fuente de las cajas del resumen cuando el importe es largo, para que no
   se desborde del cuadrado (ej. saldos negativos de 7+ cifras). */
function fsCaja(txt){ const L=String(txt).length; return L>=13?"10px":L>=11?"12px":L>=9?"13px":"15px"; }
// --- microinteracciones ---
function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||12); }catch(e){} }
function countUp(el, from, to, dur){
  const start=performance.now(), ease=t=>1-Math.pow(1-t,3);
  cancelAnimationFrame(el._raf||0);
  (function frame(now){ const p=Math.min((now-start)/(dur||650),1); el.textContent=fmt(Math.round(from+(to-from)*ease(p))); if(p<1) el._raf=requestAnimationFrame(frame); })(performance.now());
}
let _lastSaldoShown=null;   // último saldo mostrado, para animar el count-up solo cuando cambia
// empty state "con cariño": ícono + título + subtítulo + CTA opcional
function emptyState(iconKey, titulo, sub, cta){
  const btn = cta ? `<button class="btn btn-add" onclick="${cta.action}">${ic('plus')} ${cta.label}</button>` : '';
  return `<div class="emptyx"><div class="emptyx-ic">${ic(iconKey)}</div><div class="emptyx-t">${titulo}</div><div class="emptyx-s">${sub}</div>${btn}</div>`;
}
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function persistC(){ invalidarCalc(); save(CKEY,config); } function persistM(){ invalidarCalc(); save(MKEY,mov); }
function histLabel(d){ return MC[(+d.split("-")[1])-1]+" '"+d.slice(2,4); }
// Un renglón del Historial: "ago '25: $9500 (dgo · Entretenimiento)". Muestra el nombre y/o
// la categoría entre paréntesis SOLO si esa entrada del hist los define (es decir, donde cambiaron;
// la entrada base siempre los trae, así ves el valor original).
function histLinea(h, prev){ let s=histLabel(h.d)+": $"+fmtN(h.m); const ext=[]; if(h.n!=null && (!prev || h.n!==prev.n)) ext.push(esc(h.n)); if(h.cat!=null && (!prev || h.cat!==prev.cat)) ext.push(esc(h.cat)); return s+(ext.length?" ("+ext.join(" · ")+")":""); }

function toast(msg, onClick, tipo){
  let t=$("toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; document.body.appendChild(t); }
  // v8.0: el "✓" del texto pasa a ser un ícono. Éxito = check verde, error = alerta roja,
  // el resto (avisos neutros) va sin ícono.
  msg = String(msg);
  const ok = /✓\s*$/.test(msg);
  msg = msg.replace(/\s*✓\s*$/,"");
  const clase = tipo==="error" ? "err" : (ok || tipo==="ok") ? "ok" : "info";
  t.className = "toast " + clase;
  t.innerHTML = (clase==="info" ? "" : `<span class="tic">${ic(clase==="err"?"alert":"check")}</span>`) + `<span></span>`;
  t.lastChild.textContent = msg;
  t.onclick = onClick || null;
  t.style.cursor = onClick ? "pointer" : "default";
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>{ t.classList.remove("show"); }, onClick ? 9000 : 1600);
}

// Lista de descripciones que YA usaste (de tus movimientos), ordenadas por frecuencia.
// Vive solo en este dispositivo. La usamos para el desplegable filtrable de la descripción.
let DESCS = [];
function poblarSugerencias(){
  const cont={};
  mov.forEach(m=>{ const d=(m.descripcion||"").trim(); if(d) cont[d]=(cont[d]||0)+1; });
  DESCS = Object.keys(cont).sort((a,b)=>cont[b]-cont[a]); // las más repetidas primero
}
// Abre/refresca la lista filtrada según lo que estás escribiendo.
function abrirDescList(){
  const box=$("q-desc-list"); if(!box) return;
  const q=normD($("q-desc").value);
  let items;
  if(q){
    // Coinciden las que CONTIENEN el texto; primero las que EMPIEZAN con él.
    items = DESCS.map(d=>({d, i:normD(d).indexOf(q)})).filter(o=>o.i>=0)
                 .sort((a,b)=>a.i-b.i).map(o=>o.d);
  } else { items = DESCS.slice(); }
  items = items.slice(0,30);
  if(items.length===0){ cerrarDescList(); return; } // sin parecidos: queda lo que escribiste
  box.innerHTML = items.map(d=>`<div class="combo-opt">${esc(d)}</div>`).join("");
  // Mismo criterio robusto que en setupCombo: medimos input y sheet con el mismo rect.
  const r=$("q-desc").getBoundingClientRect();
  const host=$("q-desc").closest(".modal-bg");
  const hr=host ? host.getBoundingClientRect() : null;
  const topLim=hr ? hr.top : 0;
  const botLim=hr ? hr.bottom : ((window.visualViewport && window.visualViewport.height) || window.innerHeight);
  const arriba=r.top - topLim, abajo=botLim - r.bottom, irArriba=arriba > abajo;
  box.classList.toggle("up", irArriba);
  box.style.maxHeight=Math.max(120,(irArriba?arriba:abajo)-12)+"px";
  box.style.display="block";
}
function cerrarDescList(){ const box=$("q-desc-list"); if(box){ box.style.display="none"; box.innerHTML=""; } }

/* ===== Formas de pago: UNA sola fuente de verdad para todos los desplegables =====
   Junta las base (Efectivo, Débito, etc.) + TODO lo que ya usaste en movimientos
   (medio) y en cuotas (fuente). Así, cuando cargás algo nuevo, te aparece lo que ya
   tenés escrito (ej: "Visa Banco Provincia") y lo re-elegís en vez de tipear una variante
   ("Visa BP") que después rompe la agrupación del resumen de cuotas.
   Se ordena por frecuencia de uso (lo más usado arriba) y desempata alfabético. */
const FORMAS_BASE = ["Efectivo","Débito","Crédito","Transferencia","MercadoPago","Visa","Mastercard"];
function formasDePago(){
  const cont={};
  const add = s => { s=(s||"").toString().trim(); if(s) cont[s]=(cont[s]||0)+1; };
  FORMAS_BASE.forEach(add);                 // siempre presentes, aunque no las uses
  mov.forEach(m=>add(m.medio));             // medios usados en gastos variables
  config.cuotas.forEach(q=>add(q.f));       // tarjetas/fuentes usadas en cuotas
  return Object.keys(cont).sort((a,b)=> (cont[b]-cont[a]) || a.localeCompare(b,"es"));
}

/* ===== Categorías conocidas =====
   Mismo criterio que formasDePago(): arranca de las base (CATS) y suma TODO lo que ya
   usaste (en gastos variables y en fijos). Así, al cargar un gasto, te aparece cualquier
   categoría que hayas creado antes y la re-elegís en vez de tipear una variante que después
   rompe la agrupación del resumen. Diferencia clave con las formas de pago: éstas ordenan
   por frecuencia; las categorías se ordenan ALFABÉTICO (localeCompare "es", respeta acentos
   y ñ), como pediste. Agregar una categoría nueva = escribirla y guardar el gasto: al quedar
   "usada" en mov, vuelve a aparecer sola la próxima vez (idéntico al medio de pago). */
function categorias(){
  const set={};
  const add = s => { s=(s||"").toString().trim(); if(s) set[s]=true; };
  CATS.forEach(add);                    // base, siempre presentes
  mov.forEach(m=>add(m.categoria));     // usadas en gastos variables
  config.fijos.forEach(f=>add(f.cat));  // usadas en gastos fijos
  config.cuotas.forEach(q=>add(q.cat)); // usadas en cuotas (v7.0)
  return Object.keys(set).sort((a,b)=>a.localeCompare(b,"es"));
}

/* Color estable para categorías que NO están en COLORES (las que creás vos). Deriva un
   color determinístico del nombre (mismo nombre → mismo color siempre), así el donut y la
   leyenda no las pintan todas de gris. NO pisa las que ya tienen color en COLORES: es puramente
   aditivo. Se corre al inicio de cada render(), antes de dibujar el resumen. */
const PALETA_CAT = ["#f97316","#10b981","#8b5cf6","#ef4444","#14b8a6","#e879f9","#f59e0b","#06b6d4","#a3e635","#fb7185","#38bdf8","#c084fc","#4ade80","#f43f5e"];
function ensureColores(){
  categorias().forEach(c=>{
    if(!COLORES[c]){
      let h=0; for(let i=0;i<c.length;i++) h=(h*31 + c.charCodeAt(i))|0;
      COLORES[c]=PALETA_CAT[Math.abs(h)%PALETA_CAT.length];
    }
  });
}

/* ===== Combobox reutilizable: convierte cualquier <input> en autocompletar filtrable =====
   Es el mismo patrón del combo de descripción, pero genérico para reusarlo en los campos
   de forma de pago (modal de gasto) y de tarjeta (cada cuota en Ajustes).
     input      → el <input> que está adentro de un contenedor con class="combo"
     getOptions → función que devuelve el array de sugerencias VIGENTE (siempre fresco)
     onPick     → (opcional) se llama al elegir/escribir; ahí persistís el dato si hace falta
   Importante: NO agrega listeners al document (eso lo maneja UN solo listener global más
   abajo), así no se acumulan en cada re-render de las filas de cuotas. */
function setupCombo(input, getOptions, onPick){
  if(!input) return;
  const wrap = input.closest(".combo"); if(!wrap) return;
  let box = wrap.querySelector(".combo-list");
  if(!box){ box=document.createElement("div"); box.className="combo-list"; wrap.appendChild(box); }
  function abrir(){
    const q = normD(input.value);
    let items = getOptions();
    if(q){
      // las que CONTIENEN el texto; primero las que EMPIEZAN con él (índice 0 arriba)
      items = items.map(d=>({d, i:normD(d).indexOf(q)})).filter(o=>o.i>=0)
                   .sort((a,b)=>a.i-b.i).map(o=>o.d);
    }
    items = items.slice(0,30);
    if(items.length===0){ cerrar(); return; }       // sin parecidos: queda lo que escribiste
    box.innerHTML = items.map(d=>`<div class="combo-opt">${esc(d)}</div>`).join("");
    // Elegimos el lado con MÁS lugar y limitamos el alto al hueco real, así no se corta.
    // Clave iOS: medimos el input Y el borde del sheet con el MISMO getBoundingClientRect
    // (no mezclamos visualViewport.height, que allá vive en otro sistema de coordenadas).
    // El .modal-bg ya está posicionado arriba del teclado, así que su rect nos da los límites.
    const r=input.getBoundingClientRect();
    const host=input.closest(".modal-bg");
    const hr=host ? host.getBoundingClientRect() : null;
    const topLim=hr ? hr.top : 0;
    const botLim=hr ? hr.bottom : ((window.visualViewport && window.visualViewport.height) || window.innerHeight);
    const arriba=r.top - topLim, abajo=botLim - r.bottom, irArriba=arriba > abajo;
    box.classList.toggle("up", irArriba);
    box.style.maxHeight=Math.max(120,(irArriba?arriba:abajo)-12)+"px";
    box.style.display="block";
  }
  function cerrar(){ box.style.display="none"; box.innerHTML=""; }
  sinAutofillContacto(input);   // evita la barra "Autorrellenar contacto" de iOS
  input.addEventListener("input", ()=>{ abrir(); if(onPick) onPick(input.value); });
  input.addEventListener("focus", ()=>{ try{ input.select(); }catch(e){} abrir(); });
  input.addEventListener("keydown", e=>{ if(e.key==="Enter"){ cerrar(); input.blur(); } });
  // Elegir opción: mousedown + preventDefault para no perder el foco antes de registrar el toque.
  box.addEventListener("mousedown", e=>{
    const opt=e.target.closest(".combo-opt"); if(!opt) return;
    e.preventDefault();
    input.value=opt.textContent;
    cerrar();
    if(onPick) onPick(input.value);
  });
  return { abrir, cerrar };
}
/* ===== Barra "Autorrellenar contacto" de iOS — DESACTIVADO =====
   Se probó el truco de readonly-al-enfocar, pero en iOS rompía la apertura del teclado
   (enfocar un campo readonly no lo levanta). No vale la pena: la barra es solo cosmética y
   el campo igual queda visible por encima del teclado gracias al scroll de focusin.
   Dejo la función como no-op (y limpia cualquier readonly que hubiera quedado) para no
   tener que tocar los lugares donde se la llama. */
function sinAutofillContacto(input){
  if(input && input.removeAttribute) input.removeAttribute("readonly");
}
// (Sirve para TODOS los combos, incluido el de descripción.)
document.addEventListener("mousedown", e=>{
  document.querySelectorAll(".combo-list").forEach(box=>{
    const wrap=box.closest(".combo");
    if(wrap && !wrap.contains(e.target)) box.style.display="none";
  });
});

/* Rellena el <select> del filtro de Movimientos con TODAS las formas de pago conocidas,
   conservando la opción que tengas elegida (si todavía existe). */
function poblarFiltroMedios(){
  const sel=$("f-medio"); if(!sel) return;
  const cur=fMedio;
  sel.innerHTML = `<option value="__todos">Todos los medios</option>` +
    formasDePago().map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join("");
  sel.value = [...sel.options].some(o=>o.value===cur) ? cur : "__todos";
  if(sel.value!==cur) fMedio=sel.value;
}

/* Igual que poblarFiltroMedios pero para el filtro de categorías: se rearma en cada render
   con categorias() (alfabético), así cualquier categoría nueva que hayas cargado queda
   filtrable. Conserva la elegida si todavía existe; si no, cae a "Todas". */
function poblarFiltroCats(){
  const sel=$("f-cat"); if(!sel) return;
  const cur=fCat;
  sel.innerHTML = `<option value="__todas">Todas las categorías</option>` +
    categorias().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  sel.value = [...sel.options].some(o=>o.value===cur) ? cur : "__todas";
  if(sel.value!==cur) fCat=sel.value;
}
function setVig(obj, desde, monto, nombre, cat){
  if(!obj.hist) obj.hist=[];
  const ex=obj.hist.find(h=>h.d===desde);
  if(ex){ ex.m=monto; if(nombre!=null) ex.n=nombre; if(cat!=null) ex.cat=cat; }
  else { const e={d:desde,m:monto}; if(nombre!=null) e.n=nombre; if(cat!=null) e.cat=cat; obj.hist.push(e); }
  obj.hist.sort((a,b)=>a.d.localeCompare(b.d));
  // Garantizo que la entrada base (más vieja) siempre tenga nombre/cat, así ningún mes
  // se queda sin de dónde leer (ej: si agregaste un monto retroactivo sin tocar el nombre).
  if(obj.hist[0].n==null) obj.hist[0].n=obj.n;
  if(("cat" in obj) && obj.hist[0].cat==null) obj.hist[0].cat=obj.cat;
  // El nivel superior refleja el nombre/cat ACTUAL (el más nuevo definido) para defaults y borrados.
  const ult=obj.hist[obj.hist.length-1].d;
  obj.n=nombreVigente(obj,ult);
  if("cat" in obj) obj.cat=catVigente(obj,ult);
  persistC(); render();
}
