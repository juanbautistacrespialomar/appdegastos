/* ===== Tu Contador — js/09-carga-gasto.js =====
   Panel de carga de gasto variable y detalle de un gasto.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* Enfocar un campo recien abierto SIN provocar salto de pantalla.
   OJO CON EL TIMING (esto se rompio en la 6.30): iOS solo abre el teclado si el focus() ocurre
   SINCRONICAMENTE dentro del gesto del usuario. En la 6.30 lo metimos en un requestAnimationFrame
   para que el sheet estuviera maquetado, y perdimos la "activacion de usuario": el sheet abria
   pero el teclado no subia hasta que tocabas el campo a mano.
   La solucion es forzar el layout de forma sincronica (leer offsetHeight obliga al navegador a
   recalcular ahi mismo) y enfocar en el mismo tick. Conseguimos las dos cosas: sheet ya ubicado
   Y teclado automatico.
   preventScroll:true le dice "enfoca, pero no scrollees por el foco programatico"; el scroll que
   hace el navegador al abrir el teclado sigue funcionando igual. El try/catch es para navegadores
   viejos que ignoran el objeto de opciones: ahi cae al focus() de toda la vida. */
function focoSinSalto(el){
  if(!el) return;
  void el.offsetHeight;                       // fuerza layout AHORA, sin salir del gesto
  try{ el.focus({preventScroll:true}); }
  catch(e){ el.focus(); }
}

/* ===== Carga de gasto variable (v8.1) =====
   Antes: cinco campos de texto (monto, categoría, medio, fecha, descripción) y había que
   tipear o abrir listas para todo. Ahora, igual que en Plan:
   - Categoría, medio de pago y día se eligen con UN toque (las categorías y medios que más
     usás aparecen primero; "Más…" / "Otro" abre el buscador para lo demás).
   - El medio arranca en el último que usaste, no siempre en "Efectivo".
   - Si elegís una descripción que ya usaste, completa sola la categoría y el medio de la
     última vez (si todavía no los tocaste).
   - "Agregar y cargar otro" guarda y deja el formulario listo para el siguiente.
   Los campos #q-cat / #q-medio / #q-fecha siguen existiendo (ahora ocultos detrás de los
   chips): el guardado lee de ahí, igual que siempre. */
const CAT_RAPIDAS=["Comida","Transporte","Salidas/Comidas","Hogar","Salud","Ocio","Ropa"];
const QA={catMas:false, medioOtro:false, catTocada:false, medioTocado:false, fechaModo:"hoy"};
const ayer = () => { const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
function catsFrecuentes(){
  const desde=ymAdd(ymNow(),-4), cont={};
  mov.forEach(m=>{ if((m.fecha||"").slice(0,7)>=desde && m.categoria) cont[m.categoria]=(cont[m.categoria]||0)+1; });
  const top=Object.keys(cont).sort((a,b)=>cont[b]-cont[a]);
  CAT_RAPIDAS.forEach(c=>{ if(!top.includes(c)) top.push(c); });
  return top;
}
function pintarQCats(){
  const cur=$("q-cat").value.trim();
  let lista=catsFrecuentes().slice(0,7);
  if(cur && !lista.includes(cur)) lista=[cur, ...lista.slice(0,6)];
  $("q-cat-chips").innerHTML = lista.map(c=>`<button type="button" class="chip${!QA.catMas&&c===cur?' on':''}" data-qc="${esc(c)}"><span class="sq" style="background:${COLORES[c]||'var(--muted)'}"></span>${esc(c)}</button>`).join("")
    + `<button type="button" class="chip${QA.catMas?' on':''}" data-qc-mas="1">Más…</button>`;
  $("q-cat-wrap").style.display = QA.catMas ? "" : "none";
  $("q-cat-chips").querySelectorAll("[data-qc]").forEach(b=>b.onclick=()=>{ $("q-cat").value=b.dataset.qc; QA.catMas=false; QA.catTocada=true; pintarQCats(); });
  $("q-cat-chips").querySelector("[data-qc-mas]").onclick=()=>{ QA.catMas=!QA.catMas; QA.catTocada=true; if(QA.catMas){ $("q-cat").value=""; } pintarQCats(); if(QA.catMas) focoSinSalto($("q-cat")); };
}
function pintarQMedios(){
  const cur=$("q-medio").value.trim();
  let lista=formasDePago().slice(0,5);
  if(cur && !lista.includes(cur)) lista=[cur, ...lista.slice(0,4)];
  $("q-medio-chips").innerHTML = lista.map(m=>`<button type="button" class="chip${!QA.medioOtro&&m===cur?' on':''}" data-qm="${esc(m)}">${esc(tarjetaLabel(m))}</button>`).join("")
    + `<button type="button" class="chip${QA.medioOtro?' on':''}" data-qm-otro="1">${ic('plus')}Otro</button>`;
  $("q-medio-wrap").style.display = QA.medioOtro ? "" : "none";
  $("q-medio-chips").querySelectorAll("[data-qm]").forEach(b=>b.onclick=()=>{ $("q-medio").value=b.dataset.qm; QA.medioOtro=false; QA.medioTocado=true; pintarQMedios(); });
  $("q-medio-chips").querySelector("[data-qm-otro]").onclick=()=>{ QA.medioOtro=!QA.medioOtro; QA.medioTocado=true; if(QA.medioOtro){ $("q-medio").value=""; } pintarQMedios(); if(QA.medioOtro) focoSinSalto($("q-medio")); };
}
function pintarQFecha(){
  const f=$("q-fecha").value;
  QA.fechaModo = QA.fechaModo==="otro" ? "otro" : (f===hoy() ? "hoy" : f===ayer() ? "ayer" : "otro");
  const ops=[["hoy","Hoy"],["ayer","Ayer"],["otro", QA.fechaModo==="otro" && f ? (+f.slice(8,10))+" "+MC[+f.slice(5,7)-1].toLowerCase() : "Otro día"]];
  $("q-fecha-chips").innerHTML = ops.map(([k,l])=>`<button type="button" class="chip${QA.fechaModo===k?' on':''}" data-qf="${k}">${l}</button>`).join("");
  $("q-fecha").style.display = QA.fechaModo==="otro" ? "" : "none";
  $("q-fecha-chips").querySelectorAll("[data-qf]").forEach(b=>b.onclick=()=>{
    QA.fechaModo=b.dataset.qf;
    if(QA.fechaModo==="hoy") $("q-fecha").value=hoy();
    else if(QA.fechaModo==="ayer") $("q-fecha").value=ayer();
    pintarQFecha();
    if(QA.fechaModo==="otro"){ try{ $("q-fecha").showPicker(); }catch(e){ $("q-fecha").focus(); } }
  });
}
// Elegiste una descripción que ya usaste → completamos categoría y medio como la última vez
// (solo los que todavía no tocaste en este formulario).
function autocompletarDesdeDescripcion(desc){
  const d=normD(desc); if(!d) return;
  const prev=mov.find(m=>m.id!==editId && normD(m.descripcion)===d); if(!prev) return;
  const hechos=[];
  if(!QA.catTocada && prev.categoria){ $("q-cat").value=prev.categoria; QA.catMas=false; hechos.push("categoría"); pintarQCats(); }
  if(!QA.medioTocado && prev.medio && prev.medio!=="—"){ $("q-medio").value=prev.medio; QA.medioOtro=false; hechos.push("medio de pago"); pintarQMedios(); }
  $("q-hint").textContent = hechos.length ? "Completé "+hechos.join(" y ")+" como la última vez." : "";
}
function prepararModalGasto(v){
  QA.catMas=false; QA.medioOtro=false; QA.catTocada=!!v; QA.medioTocado=!!v; QA.fechaModo="hoy";
  const ultMedio=(mov.find(m=>m.medio && m.medio!=="—")||{}).medio || "Efectivo";
  $("q-monto").value = v ? numADisplay(v.monto) : "";
  $("q-cat").value   = v ? (v.categoria||"") : "";
  $("q-medio").value = v ? (v.medio||"") : ultMedio;
  $("q-fecha").value = v ? v.fecha : hoy();
  $("q-desc").value  = v ? (v.descripcion||"") : "";
  $("q-hint").textContent="";
  $("m-title").textContent = v ? "Editar gasto" : "Nuevo gasto";
  $("q-add").innerHTML = v ? ic('check')+" Guardar cambios" : ic('plus')+" Agregar";
  $("q-add-otro").style.display = v ? "none" : "";
  $("q-del").style.display = v ? "" : "none";
  poblarSugerencias(); cerrarDescList();
  pintarQCats(); pintarQMedios(); pintarQFecha();
  $("q-body").scrollTop=0;
}
function abrirModalAlta(){
  editId=null; prepararModalGasto(null);
  $("modal").classList.add("open"); focoSinSalto($("q-monto"));
}
function abrirModalEdit(id){
  const v=mov.find(x=>x.id===id); if(!v) return;
  editId=id; prepararModalGasto(v);
  $("modal").classList.add("open");
}
function cerrarModal(){ $("modal").classList.remove("open"); editId=null; cerrarDescList(); }

let detId=null;
function abrirModalDet(id){
  const v=mov.find(x=>x.id===id); if(!v) return;
  detId=id;
  const col=COLORES[v.categoria]||"#6B8194";
  const f=v.fecha;
  const fechaTxt=f.slice(8,10)+"/"+f.slice(5,7)+"/"+f.slice(0,4);
  $("d-body").innerHTML=
    `<div style="text-align:center;margin:4px 0 16px">
       <div style="font-size:32px;font-weight:700">${fmt(v.monto)}</div>
       ${v.descripcion?`<div style="color:var(--txt);margin-top:6px;font-size:15px">${esc(v.descripcion)}</div>`:'<div style="color:var(--muted);margin-top:6px;font-size:13px">Sin descripción</div>'}
     </div>
     <div class="crow" style="grid-template-columns:1fr 1fr;cursor:default">
       <div><label>Categoría</label><div style="font-size:14px;margin-top:2px"><span class="dot" style="background:${col}"></span>${esc(v.categoria)}</div></div>
       <div><label>Medio de pago</label><div style="font-size:14px;margin-top:2px">${esc(v.medio||"—")}</div></div>
       <div class="full"><label>Fecha</label><div style="font-size:14px;margin-top:2px">${fechaTxt}</div></div>
     </div>`;
  $("modalDet").classList.add("open");
}
function cerrarModalDet(){ $("modalDet").classList.remove("open"); detId=null; }
