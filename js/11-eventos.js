/* ===== Tu Contador — js/11-eventos.js =====
   Conexión de botones y eventos: mes, tema, pestañas, filtros, FAB, panel de gasto.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

$("prevMonth").onclick=()=>{ mesActivo=ymAdd(mesActivo,-1); render(); };
$("nextMonth").onclick=()=>{ mesActivo=ymAdd(mesActivo,1); render(); };

// --- Selector rápido de mes: tap en la etiqueta abre grilla de meses con navegación de año ---
let selAnioMes;
function pintarSelectorMes(){
  $("mes-anio").textContent = selAnioMes;
  const [ay, am] = mesActivo.split("-").map(Number);
  $("mes-grid").innerHTML = MC.map((m,i)=>{
    const sel = (selAnioMes===ay && (i+1)===am) ? " sel" : "";
    return `<button class="mesbtn${sel}" data-m="${i+1}">${m}</button>`;
  }).join("");
  $("mes-grid").querySelectorAll(".mesbtn").forEach(b=>{
    b.onclick=()=>{
      mesActivo = selAnioMes + "-" + String(+b.dataset.m).padStart(2,"0");
      $("modalMes").classList.remove("open");
      render();
    };
  });
}
function abrirSelectorMes(){ selAnioMes = +mesActivo.split("-")[0]; pintarSelectorMes(); $("modalMes").classList.add("open"); }
$("monthLabel").onclick = abrirSelectorMes;
$("mes-prevA").onclick = ()=>{ selAnioMes--; pintarSelectorMes(); };
$("mes-nextA").onclick = ()=>{ selAnioMes++; pintarSelectorMes(); };
$("mes-x").onclick = ()=>$("modalMes").classList.remove("open");
$("modalMes").onclick = (e)=>{ if(e.target===$("modalMes")) $("modalMes").classList.remove("open"); };
$("eyeBtn").onclick=()=>{ oculto=!oculto; try{ localStorage.setItem("mg_oculto", oculto?"1":"0"); }catch(e){} render(); };
/* Tema claro/oscuro: SOLO cambia colores (variables CSS). No toca datos: la preferencia
   se guarda en su propia clave "mg_theme", aparte de tus gastos. No llama a render(). */
const THEME_KEY="mg_theme";
function aplicarTema(t){
  if(t==="light") document.documentElement.setAttribute("data-theme","light");
  else document.documentElement.removeAttribute("data-theme");
  const b=$("themeBtn"); if(b) b.setAttribute("aria-checked", t==="light");
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", t==="light" ? "#faf9f7" : "#0f141b");
}
// Sin elección guardada, arranca con el tema del celular (claro u oscuro).
let temaActual = (function(){ try{ return localStorage.getItem(THEME_KEY) || ((window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark"); }catch(e){ return "dark"; } })();
aplicarTema(temaActual);
$("themeBtn").onclick=()=>{ temaActual = temaActual==="light"?"dark":"light"; try{ localStorage.setItem(THEME_KEY,temaActual); }catch(e){} aplicarTema(temaActual); };
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{ if(vista===t.dataset.v){ const w=document.querySelector(".wrap"); (w||window).scrollTo({top:0,behavior:"smooth"}); return; } vista=t.dataset.v; render(); });

setupCombo($("q-cat"), categorias, null);       // categoría: input editable + buscador + agregar nueva (igual que el medio de pago, pero alfabético)
setupCombo($("q-medio"), formasDePago, null);   // medio de pago del gasto variable: input editable + sugerencias
poblarFiltroMedios();   // el filtro de medios se arma dinámico (y se refresca en cada render)
poblarFiltroCats();     // idem el de categorías
$("f-texto").oninput=()=>{ fTexto=$("f-texto").value; render(); };
$("f-cat").onchange=()=>{ fCat=$("f-cat").value; render(); };
$("f-medio").onchange=()=>{ fMedio=$("f-medio").value; render(); };
$("f-clear").onclick=()=>{ fTexto=""; fCat="__todas"; fMedio="__todos"; $("f-texto").value=""; $("f-cat").value="__todas"; $("f-medio").value="__todos"; render(); };
/* FAB: en Resumen/Movimientos carga un gasto variable (lo de siempre). En Plan abre un
   menú para elegir qué agregar: ingreso, fijo, cuota o presupuesto. */
function cerrarFabMenu(){ const m=$("fabmenu"); if(m){ m.classList.remove("open"); m.setAttribute("aria-hidden","true"); } $("fab").classList.remove("open"); }
$("fab").onclick=()=>{
  if(vista!=="plan"){ abrirModalAlta(); return; }
  const m=$("fabmenu"), abrir=!m.classList.contains("open");
  if(abrir){ m.classList.add("open"); m.setAttribute("aria-hidden","false"); $("fab").classList.add("open"); } else cerrarFabMenu();
};
document.querySelectorAll("#fabmenu [data-fa]").forEach(b=>b.onclick=()=>{
  const k=b.dataset.fa, tipo={ing:"ing",fijo:"fijo",cuota:"cuota",presu:"presu"}[k];
  cerrarFabMenu(); abrirSheet(tipo, null);
});
$("modalPlan").onclick=e=>{ if(e.target.id==="modalPlan") cerrarSheet(); };
document.addEventListener("click", e=>{ if(!e.target.closest("#fab") && !e.target.closest("#fabmenu")) cerrarFabMenu(); });
// haptic sutil al tocar botones de acción (sin tener que engancharlo en cada handler)
document.addEventListener("click", (e)=>{ if(e.target.closest && e.target.closest(".btn-add, #fab, .mesbtn, .pinkey")) haptic(12); }, true);
$("m-close").onclick=cerrarModal;
$("modal").onclick=e=>{ if(e.target.id==="modal") cerrarModal(); };
$("d-close").onclick=cerrarModalDet;
$("modalDet").onclick=e=>{ if(e.target.id==="modalDet") cerrarModalDet(); };
$("d-edit").onclick=()=>{ const id=detId; cerrarModalDet(); abrirModalEdit(id); };
$("d-del").onclick=()=>{ if(detId && confirm("¿Borrar este gasto?")){ mov=mov.filter(x=>x.id!==detId); persistM(); cerrarModalDet(); render(); } };
$("q-monto").addEventListener("keydown",e=>{ if(e.key==="Enter") $("q-add").click(); });
// Combobox de descripción: al escribir o enfocar se abre/filtra la lista.
sinAutofillContacto($("q-desc"));   // también acá, para que no aparezca "Autorrellenar contacto"
$("q-desc").addEventListener("input", abrirDescList);
$("q-desc").addEventListener("focus", abrirDescList);
$("q-desc").addEventListener("keydown",e=>{ if(e.key==="Enter"){ cerrarDescList(); $("q-add").click(); } });
// Elegir una opción: usamos mousedown + preventDefault para que el input no pierda
// el foco antes de registrar el toque (clave en mobile). Copia el texto y cierra.
$("q-desc-list").addEventListener("mousedown", e=>{
  const opt=e.target.closest(".combo-opt"); if(!opt) return;
  e.preventDefault();
  $("q-desc").value=opt.textContent;
  cerrarDescList();
  autocompletarDesdeDescripcion(opt.textContent);
});
$("q-desc").addEventListener("change", ()=>autocompletarDesdeDescripcion($("q-desc").value));
// Tocar fuera del combo lo cierra (si no hay parecidos, queda lo que escribiste).
document.addEventListener("mousedown", e=>{ if(!e.target.closest("#q-desc-wrap")) cerrarDescList(); });
function guardarGasto(otro){
  const monto=parseMonto($("q-monto").value);
  if(!monto||monto<=0){ toast("Poné cuánto gastaste", null, "error"); focoSinSalto($("q-monto")); return; }
  const cat=$("q-cat").value.trim();
  if(!cat){ toast("Elegí en qué gastaste", null, "error"); return; }
  const desc=$("q-desc").value.trim();
  const medio=$("q-medio").value.trim() || "Efectivo";
  const fecha=$("q-fecha").value||hoy();
  if(editId){
    const v=mov.find(x=>x.id===editId);
    if(v){ v.monto=monto; v.categoria=cat; v.medio=medio; v.fecha=fecha; v.descripcion=desc; }
  } else {
    mov.unshift({id:Date.now()+"_"+Math.random().toString(36).slice(2,6), monto, categoria:cat, fecha, descripcion:desc, medio});
  }
  persistM();
  if(otro){
    // Queda abierto: conserva medio y día (lo típico al cargar varios del mismo día) y
    // limpia monto, categoría y descripción para el siguiente.
    $("q-monto").value=""; $("q-desc").value=""; $("q-cat").value=""; $("q-hint").textContent="";
    QA.catMas=false; QA.catTocada=false;
    pintarQCats(); render(); toast("Gasto agregado ✓");
    focoSinSalto($("q-monto"));
    return;
  }
  const eraEdicion=!!editId;
  cerrarModal(); vista="mov"; render(); toast(eraEdicion?"Cambios guardados ✓":"Gasto agregado ✓");
}
$("q-add").onclick=()=>guardarGasto(false);
$("q-add-otro").onclick=()=>guardarGasto(true);
$("q-del").onclick=()=>{
  const id=editId; if(!id) return;
  confirmar("Borrar gasto","Se borra este gasto. No se puede deshacer.",()=>{ mov=mov.filter(x=>x.id!==id); persistM(); cerrarModal(); render(); toast("Gasto borrado"); },"Borrar",true);
};
$("q-fecha").addEventListener("change", ()=>{ QA.fechaModo="otro"; pintarQFecha(); });
$("q-cat").addEventListener("input", ()=>{ QA.catTocada=true; });
$("q-medio").addEventListener("input", ()=>{ QA.medioTocado=true; });
