/* ===== Tu Contador — js/07-plan.js =====
   Pestaña Plan (ingresos, fijos, cuotas, presupuestos) y los paneles de carga/edición.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* ===================================================================================
   PLAN (v7.1) — lista compacta + carga en bottom sheet
   Antes cada ingreso/fijo/cuota era un formulario SIEMPRE abierto con todos sus campos,
   y los campos hablaban en términos de cómo se guarda el dato ("Cuota en Sep '26",
   "Aplicar cambio desde"). Ahora:
   - Plan muestra filas de solo lectura (nombre, detalle, monto). Tocás una → se abre un
     sheet para editarla. "+ Agregar" abre el mismo sheet vacío.
   - El sheet pregunta en criollo ("¿En cuántas cuotas?", "¿Cuándo pagás la primera?"),
     usa botones en vez de tipear y muestra el RESULTADO en vivo antes de guardar.
   - Los datos se guardan EXACTAMENTE con la misma estructura de siempre: no hay migración
     y los backups viejos siguen sirviendo.
   =================================================================================== */
const mesLargo = ym => MESES[(+ym.split("-")[1])-1];
const mesCortoA = ym => MC[(+ym.split("-")[1])-1].toLowerCase()+" "+ym.slice(2,4);
// Un ítem con historial "empieza en el futuro" si todas sus vigencias son posteriores al mes
// que estás mirando. Sin esto, un fijo cargado "desde noviembre" desaparecía de octubre
// apenas lo guardabas y parecía que no se había guardado.
const empiezaDespues = obj => (obj.hist||[]).length>0 && obj.hist.every(h=>h.d>mesActivo);
const cambioEsteMes = obj => (obj.hist||[]).length>1 && obj.hist.some((h,i)=>i>0 && h.d===mesActivo);

function filaPlan(tipo, i, nombre, meta, monto, extra, apagado){
  return `<button class="plrow" data-sheet="${tipo}" data-i="${esc(String(i))}">
    <span class="l"><span class="n">${esc(nombre)}</span>${extra||''}<span class="m">${esc(meta)}</span></span>
    <span class="r"${apagado?' style="color:var(--muted)"':''}>${fmt(monto)}<i>${ic('chevR')}</i></span></button>`;
}
function seccionPlan(id, titulo, tipo, cuerpo, vacio, extraTitulo){
  return `<div class="panel plsec" id="pnl-${id}">
    <div class="plhd"><span class="pltit">${titulo}${extraTitulo?` <span>${extraTitulo}</span>`:''}</span>
      <button class="pladd" data-sheet="${tipo}" data-i="">${ic('plus')}Agregar</button></div>
    ${cuerpo || `<div class="plempty">${vacio}</div>`}</div>`;
}

/* Cuotas agrupadas por tarjeta. Encabezado del grupo = cuánto te viene ESE mes en esa tarjeta
   (y al tocarlo, cómo baja en los próximos meses). Filas = cada compra con su progreso. */
function cuotasPlan(){
  const SIN="__sin";
  const keyF = q => (q.f && String(q.f).trim()) ? q.f : SIN;
  const ultK = q => (q.t||0)-(q.c||0);
  const activa = (q,ym) => { const k=ymDiff(q.d,ym); return k>=0 && k<=ultK(q); };
  const fin = q => ymAdd(q.d, Math.max(0,ultK(q)));
  const grupos={};
  config.cuotas.forEach((q,i)=>{ if(fin(q)<mesActivo) return; (grupos[keyF(q)]=grupos[keyF(q)]||[]).push(i); });
  const otras=Object.keys(grupos).filter(f=>f!==SIN && !TARJETAS.includes(f));
  let html="", totMes=0, totRest=0, finTot=null;
  TARJETAS.concat(otras,[SIN]).forEach(f=>{
    const idxs=grupos[f]; if(!idxs||!idxs.length) return;
    const qs=idxs.map(i=>config.cuotas[i]);
    const mensual=qs.reduce((s,q)=>s+(activa(q,mesActivo)?(q.m||0):0),0);
    const resta=qs.reduce((s,q)=>{ const k=ymDiff(q.d,mesActivo); const rest=k<0?(ultK(q)+1):(ultK(q)-k+1); return s+Math.max(0,rest)*(q.m||0); },0);
    const finG=qs.map(fin).reduce((a,b)=>b>a?b:a);
    totMes+=mensual; totRest+=resta; if(!finTot||finG>finTot) finTot=finG;
    const col=colCuotas[f]!==true;
    const etiqueta=f===SIN?"Sin tarjeta":tarjetaLabel(f);
    html+=`<div class="plgrp fgroup-c" data-card="${esc(f)}"><span>${chev(col)} ${esc(etiqueta)} · resta ${fmt(resta)}</span><span>${fmt(mensual)}/mes</span></div>`;
    if(!col){
      const chips=[];
      for(let j=1;j<=6;j++){ const ym=ymAdd(mesActivo,j); const m=qs.reduce((s,q)=>s+(activa(q,ym)?(q.m||0):0),0); if(m<=0) break;
        chips.push(`<span class="cq-chip${m<mensual?' baja':''}"><b>${MC[(+ym.split("-")[1])-1]}</b>${fmt(m)}</span>`); }
      if(chips.length) html+=`<div class="cq-chips" style="margin:6px 0 4px">${chips.join("")}</div>`;
    }
    idxs.forEach(i=>{
      const q=config.cuotas[i], k=ymDiff(q.d,mesActivo), nro=(q.c||1)+k, t=q.t||0;
      const fut = k<0;
      const hechas = fut ? 0 : Math.min(nro, t);
      // Barrita de progreso: un segmento por cuota (hasta 24; más que eso, barra continua).
      const prog = t<=24
        ? `<span class="plprog">${Array.from({length:t},(_,s)=>`<span${s<hechas?' class="on"':''}></span>`).join("")}</span>`
        : `<span class="plprog"><span class="on" style="flex:${hechas}"></span><span style="flex:${t-hechas}"></span></span>`;
      const meta = fut
        ? `${q.cat||"Cuotas"} · empieza en ${mesLargo(ymAdd(q.d,1-(q.c||1))).toLowerCase()}`
        : `${q.cat||"Cuotas"} · cuota ${nro} de ${t} · termina en ${mesCortoA(fin(q))}`;
      html+=filaPlan("cuota", i, q.n||"Sin detalle", meta, q.m||0, prog, fut);
    });
  });
  return {html, totMes, totRest, fin:finTot};
}

function renderPlan(){
  const cm=computeMes(mesActivo), libre=cm.ingreso-cm.tF-cm.tC, mesTxt=mesLargo(mesActivo);
  // Ingresos
  let ingH="";
  config.ingresos.forEach((g,i)=>{
    if(g.once){
      const h=(g.hist||[]).find(x=>x.d===mesActivo); if(!h) return;
      ingH+=filaPlan("ing", i, h.n||g.n||"Ingreso", "Solo en "+mesTxt.toLowerCase(), h.m);
    } else if(empiezaDespues(g)){
      ingH+=filaPlan("ing", i, g.n||"Ingreso", "Todos los meses · empieza en "+mesLargo(g.hist[0].d).toLowerCase(), g.hist[0].m, "", true);
    } else if(!ocultoEnAjustes(g,mesActivo)){
      ingH+=filaPlan("ing", i, nombreVigente(g,mesActivo)||"Ingreso", "Todos los meses"+(cambioEsteMes(g)?" · cambió este mes":""), montoVigente(g.hist,mesActivo));
    }
  });
  // Fijos
  let fijH="";
  config.fijos.forEach((f,i)=>{
    if(empiezaDespues(f)){ fijH+=filaPlan("fijo", i, f.n||"Gasto fijo", (f.cat||"")+" · empieza en "+mesLargo(f.hist[0].d).toLowerCase(), f.hist[0].m, "", true); return; }
    if(ocultoEnAjustes(f,mesActivo)) return;
    fijH+=filaPlan("fijo", i, nombreVigente(f,mesActivo)||"Gasto fijo", catVigente(f,mesActivo)+(cambioEsteMes(f)?" · cambió este mes":""), montoVigente(f.hist,mesActivo));
  });
  // Cuotas
  const qt=cuotasPlan();
  const cuotasCuerpo = qt.html ? `<div class="grid" style="margin:2px 0 8px">
        <div><div class="pslab">Pagás en ${mesTxt}</div><div class="psbig" style="color:var(--violet)">${fmt(qt.totMes)}</div></div>
        <div><div class="pslab">Total comprometido</div><div class="psbig">${fmt(qt.totRest)}</div></div></div>
      ${qt.fin?`<div class="pnote" style="margin:0 0 8px">Si no sumás nada nuevo, terminás de pagar en ${nombreMes(qt.fin)}.</div>`:''}
      ${qt.html}` : "";
  // Presupuestos
  const presH=Object.keys(config.presu||{}).map(k=>filaPlan("presu", k, k, "Tope mensual", config.presu[k]||0)).join("");

  $("content").innerHTML =
    `<div class="panel plansum">
       <p class="ptitle">Plan de ${mesTxt}</p>
       <div class="psrow"><span>Ingresos</span><span style="color:var(--green)">${fmt(cm.ingreso)}</span></div>
       <div class="psrow"><span><span class="cldot" style="background:var(--fijo)"></span>Gastos fijos</span><span>− ${fmt(cm.tF)}</span></div>
       <div class="psrow"><span><span class="cldot" style="background:var(--violet)"></span>Cuotas</span><span>− ${fmt(cm.tC)}</span></div>
       <div class="psrow tot"><span>Libre para el día a día</span><span style="color:${libre>=0?'var(--txt)':'var(--red)'}">${fmt(libre)}</span></div>
       <div class="psrow"><span><span class="cldot" style="background:var(--c2)"></span>Ya gastado en variables</span><span>− ${fmt(cm.tV)}</span></div>
       <div class="psrow tot"><span>Te queda</span><span style="color:${cm.saldo>=0?'var(--green)':'var(--red)'}">${fmt(cm.saldo)}</span></div>
     </div>`
    + seccionPlan("ing", "Ingresos", "ing", ingH, "Todavía no cargaste ingresos para "+mesTxt.toLowerCase()+".")
    + seccionPlan("fijos", "Gastos fijos", "fijo", fijH, "Alquiler, servicios, suscripciones… lo que pagás todos los meses.")
    + seccionPlan("cuotas", "Cuotas", "cuota", cuotasCuerpo, "No hay cuotas activas en "+mesTxt.toLowerCase()+".")
    + seccionPlan("presu", "Presupuestos", "presu", presH, "Poné un tope mensual a las categorías que querés controlar. Lo ves en Resumen.");

  $("content").querySelectorAll("[data-sheet]").forEach(b=>b.onclick=()=>{
    const t=b.dataset.sheet, raw=b.dataset.i;
    abrirSheet(t, raw==="" ? null : (t==="presu" ? raw : +raw));
  });
}

/* ===================== Bottom sheet de carga/edición ===================== */
let SH=null;   // estado del formulario abierto
const CUOTAS_OPC=[1,3,6,9,12,18];
const CAT_BASE={ cuota:["Hogar","Tecnología","Ropa","Viajes","Salud","Educación"],
                 fijo:["Alquiler","Servicios","Suscripciones","Impuestos","Gimnasio","Educación"],
                 presu:["Comida","Salidas/Comidas","Transporte","Ropa","Ocio","Hogar"] };
function tarjetasConocidas(){
  const set=new Set(TARJETAS);
  config.cuotas.forEach(q=>{ const f=(q.f||"").trim(); if(f) set.add(f); });
  return [...set];
}
function mesDeModo(){ return SH.modo==="prox" ? ymAdd(mesActivo,1) : SH.modo==="otro" ? SH.otroYm : mesActivo; }

function abrirSheet(tipo, i){
  const base={tipo, i, modo:"este", otroYm:ymAdd(mesActivo,2), catMas:false};
  if(tipo==="cuota"){
    if(i==null) SH={...base, n:"", tot:0, t:6, tOtra:false, f:"Visa", fOtra:false, cat:"Otros", actual:2};
    else {
      const q=config.cuotas[i], k=ymDiff(q.d,mesActivo), act=(q.c||1)+k, t=q.t||1;
      const ini=ymAdd(q.d, 1-(q.c||1));     // mes de la cuota 1
      const modo = (act>=2 && t>=2) ? "venia" : act===1 ? "este" : (ini===ymAdd(mesActivo,1) ? "prox" : "otro");
      SH={...base, n:q.n||"", tot:q.tot||((q.m||0)*t), t, tOtra:!CUOTAS_OPC.includes(t), f:q.f||"",
          fOtra:false,
          cat:q.cat||"Cuotas", modo, actual:Math.min(Math.max(act,2),t), otroYm:ini};
    }
  } else if(tipo==="fijo"){
    if(i==null) SH={...base, n:"", monto:0, cat:"Servicios"};
    else {
      const f=config.fijos[i], fut=empiezaDespues(f);
      const ref = fut ? f.hist[0].d : mesActivo;
      const vig=(f.hist||[]).filter(h=>h.d<=ref).map(h=>h.d).sort().pop()||ref;
      SH={...base, n:nombreVigente(f,ref)||"", monto:montoVigente(f.hist,ref), montoActual:montoVigente(f.hist,ref), vigDesde:vig, cat:catVigente(f,ref)||"Otros",
          modo: fut ? (f.hist[0].d===ymAdd(mesActivo,1)?"prox":"otro") : "este", otroYm: fut ? f.hist[0].d : base.otroYm};
    }
  } else if(tipo==="ing"){
    if(i==null) SH={...base, once:false, n:"", monto:0};
    else {
      const g=config.ingresos[i], fut=!g.once && empiezaDespues(g);
      const ref = fut ? g.hist[0].d : mesActivo;
      SH={...base, once:!!g.once, n:(g.once?((g.hist.find(h=>h.d===mesActivo)||{}).n||g.n):nombreVigente(g,ref))||"",
          monto:montoIngresoMes(g,ref), montoActual:montoIngresoMes(g,ref),
          modo: fut ? (g.hist[0].d===ymAdd(mesActivo,1)?"prox":"otro") : "este", otroYm: fut ? g.hist[0].d : base.otroYm};
    }
  } else if(tipo==="presu"){
    if(i==null){ const libre=categorias().find(c=>!(c in (config.presu||{}))) || "Comida"; SH={...base, cat:libre, monto:0}; }
    else SH={...base, cat:i, monto:config.presu[i]||0};
  }
  pintarSheet(true);
  $("modalPlan").classList.add("open");
  // Alta: foco directo en el primer campo (sincrónico, para que iOS abra el teclado).
  if(i==null){ const f=$("pl-body").querySelector("[data-focus]"); if(f) focoSinSalto(f); }
}
function cerrarSheet(){ $("modalPlan").classList.remove("open"); SH=null; }

// Pasa lo que está escrito en los inputs al estado (antes de re-pintar por un toque en un chip).
function leerSheet(){
  if(!SH) return;
  $("pl-body").querySelectorAll("[data-in]").forEach(el=>{
    const k=el.dataset.in;
    if(el.classList.contains("js-money")) SH[k]=parseMonto(el.value)||0;
    else if(el.type==="number") SH[k]=parseInt(el.value,10)||0;
    else SH[k]=el.value;
  });
  const mEl=$("pl-body").querySelector("[data-otm]"), yEl=$("pl-body").querySelector("[data-oty]");
  if(mEl&&yEl) SH.otroYm=yEl.value+"-"+String(+mEl.value).padStart(2,"0");
}

const chip = (k,v,label,on) => `<button type="button" class="chip${on?' on':''}" data-ch="${k}" data-v="${esc(String(v))}">${label}</button>`;
function chipsCategoria(){
  const lista=[...CAT_BASE[SH.tipo]];
  if(SH.cat && !lista.includes(SH.cat)) lista.unshift(SH.cat);
  return `<div class="chips">${lista.slice(0,7).map(c=>chip("cat",c,esc(c),SH.cat===c)).join("")}${chip("catMas",SH.catMas?0:1,"Más…",SH.catMas)}</div>`
    + (SH.catMas ? `<select class="sh-sel" data-in="cat">${categorias().map(c=>`<option ${c===SH.cat?"selected":""}>${esc(c)}</option>`).join("")}</select>` : "");
}
function chipsMes(conVenia, labelOtro){
  const ops=[["este",mesLargo(mesActivo)],["prox",mesLargo(ymAdd(mesActivo,1))]];
  if(conVenia) ops.push(["venia","Ya venía"]); else ops.push(["otro",labelOtro||"Otro mes"]);
  let h=`<div class="chips g3">${ops.map(([k,l])=>chip("modo",k,l,SH.modo===k)).join("")}</div>`;
  if(conVenia && SH.modo!=="otro") h+=`<button type="button" class="sh-link" data-ch="modo" data-v="otro">La primera cuota cae más adelante…</button>`;
  if(SH.modo==="otro"){
    const [y,m]=SH.otroYm.split("-").map(Number), nowY=new Date().getFullYear();
    let ys=""; for(let a=Math.min(nowY-2,y); a<=Math.max(nowY+5,y); a++) ys+=`<option value="${a}" ${a===y?"selected":""}>${a}</option>`;
    h+=`<div style="display:flex;gap:6px"><select class="sh-sel" data-otm style="flex:1">${MESES.map((mm,ix)=>`<option value="${ix+1}" ${ix+1===m?"selected":""}>${mm}</option>`).join("")}</select>
        <select class="sh-sel" data-oty style="flex:0 0 96px">${ys}</select></div>`;
  }
  return h;
}

function resumenSheet(){
  const s=SH;
  if(s.tipo==="cuota"){
    const t=Math.max(1,s.t||1), porC=(s.tot||0)/t;
    let ini, ult;
    if(s.modo==="venia"){ const a=Math.min(Math.max(2,s.actual),t); ini=ymAdd(mesActivo,-(a-1)); ult=ymAdd(mesActivo,t-a); }
    else { ini=mesDeModo(); ult=ymAdd(ini,t-1); }
    const restan = ini<=mesActivo ? ymDiff(mesActivo,ult)+1 : t;
    const l1 = t===1 ? `1 pago de ${fmt(porC)}` : `${t} cuotas de ${fmt(porC)}`;
    const l2 = (t===1 ? `Se paga en ${mesLargo(ini).toLowerCase()}` : `De ${mesCortoA(ini)} a ${mesCortoA(ult)}`) + ` · ${s.f?tarjetaLabel(s.f):"sin tarjeta"} · ${s.cat}`;
    const l3 = ini<=mesActivo
      ? `Este mes te suma ${fmt(porC)} · quedan ${restan} por pagar (${fmt(porC*restan)})`
      : `Empieza a impactar en ${mesLargo(ini).toLowerCase()}`;
    return `<b>${l1}</b><span>${esc(l2)}</span><span class="acc">${l3}</span>`;
  }
  if(s.tipo==="fijo"){
    const desde=mesDeModo();
    if(s.i==null) return `<span>Desde ${mesLargo(desde).toLowerCase()} se suma <b style="font-size:inherit;color:var(--txt)">${fmt(s.monto)}</b> por mes a tus gastos fijos.</span>`;
    if(s.monto===s.montoActual) return `<span>El monto no cambia. Si cambiás nombre o categoría, aplica desde ${mesLargo(desde).toLowerCase()}.</span>`;
    return `<span>${mesLargo(ymAdd(desde,-1))} y los meses anteriores siguen en ${fmt(s.montoActual)}. Desde ${mesLargo(desde).toLowerCase()} pasa a <b style="font-size:inherit;color:var(--txt)">${fmt(s.monto)}</b>. No se pierde la historia.</span>`;
  }
  if(s.tipo==="ing"){
    const mes=mesDeModo(), g=s.i!=null?config.ingresos[s.i]:null;
    const prev = g ? montoIngresoMes(g,mes) : 0;
    const tot = computeMes(mes).ingreso - prev + (s.monto||0);
    return `<span>Tus ingresos de ${mesLargo(mes).toLowerCase()} pasan a <b style="font-size:inherit;color:var(--green)">${fmt(tot)}</b>. ${s.once?"Es solo ese mes.":"Se repite todos los meses hasta que lo des de baja."}</span>`;
  }
  if(s.tipo==="presu"){
    const g=gastosPorCat(computeMes(mesActivo),null).map[s.cat]||0;
    const pct = s.monto>0 ? Math.round(g/s.monto*100) : 0;
    return `<span>En ${mesLargo(mesActivo).toLowerCase()} llevás ${fmt(g)} en ${esc(s.cat)}${s.monto>0?` · ${pct}% del tope`:""}.</span>`;
  }
  return "";
}

function pintarSheet(inicial){
  const body=$("pl-body"), scroll=inicial?0:body.scrollTop, s=SH;
  const nuevo = s.i==null;
  const titulos={cuota:nuevo?"Compra en cuotas":"Editar compra", fijo:nuevo?"Nuevo gasto fijo":(s.n||"Gasto fijo"), ing:nuevo?"Nuevo ingreso":(s.n||"Ingreso"), presu:nuevo?"Nuevo presupuesto":"Presupuesto"};
  const campo=(label,html)=>`<div class="sh-f"><span class="sh-l">${label}</span>${html}</div>`;
  const inTxt=(k,ph,foco)=>`<input type="text" data-in="${k}" value="${esc(s[k]||"")}" placeholder="${ph}" autocomplete="off"${foco?" data-focus":""}>`;
  const inMoney=(k,color)=>`<input type="text" inputmode="decimal" class="js-money sh-big${oculto?' masked':''}" data-in="${k}" data-live value="${s[k]?numADisplay(s[k]):""}" placeholder="$ 0"${color?` style="color:${color}"`:''}>`;
  let h=`<div class="sh-hd"><button type="button" class="sh-x" id="pl-x">Cancelar</button><span class="sh-t">${esc(titulos[s.tipo])}</span><span style="min-width:70px"></span></div>`;

  if(s.tipo==="cuota"){
    h+=campo("¿Qué compraste?", inTxt("n","Ej: Heladera, zapatillas…",true));
    h+=campo("Monto total de la compra", inMoney("tot"));
    h+=campo("¿En cuántas cuotas?", `<div class="chips g7">${CUOTAS_OPC.map(n=>chip("t",n,n,!s.tOtra&&s.t===n)).join("")}${chip("tOtra",1,"Otra",s.tOtra)}</div>`
      + (s.tOtra?`<input type="number" inputmode="numeric" min="1" data-in="t" data-live value="${s.t||""}" placeholder="Cantidad de cuotas">`:""));
    const tjs=tarjetasConocidas();
    h+=campo("Tarjeta", `<div class="chips">${tjs.map(f=>chip("f",f,esc(tarjetaLabel(f)),!s.fOtra&&s.f===f)).join("")}${chip("fOtra",1,ic('plus')+"Otra",s.fOtra)}</div>`
      + (s.fOtra?`<div class="combo"><input type="text" data-in="f" data-live value="${esc(s.f||"")}" placeholder="Ej: Visa Banco Provincia" autocomplete="off"><div class="combo-list"></div></div>`:""));
    h+=campo("Categoría", chipsCategoria());
    let mes=chipsMes(true);
    if(s.modo==="venia"){
      const t=Math.max(2,s.t||2), a=Math.min(Math.max(2,s.actual),t);
      mes+=`<div class="sh-step"><span>Este mes pagás la cuota</span><span style="display:flex;align-items:center;gap:4px">
        <button type="button" data-step="-1" aria-label="Una cuota menos">${ic('minus')}</button><b style="min-width:62px;text-align:center">${a} de ${t}</b>
        <button type="button" data-step="1" aria-label="Una cuota más">${ic('plus')}</button></span></div>`;
    }
    h+=campo("¿Cuándo pagás la primera cuota?", mes);
  } else if(s.tipo==="fijo"){
    if(!nuevo) h+=`<div class="sh-now"><span><span class="sh-l">Hoy pagás</span><br><b>${fmt(s.montoActual)}</b></span><span class="sh-l" style="text-align:right">${esc(s.cat)}<br>desde ${mesLargo(s.vigDesde).toLowerCase()} ${s.vigDesde.slice(0,4)}</span></div>`;
    h+=campo(nuevo?"¿Qué es?":"Nombre", inTxt("n","Ej: Alquiler, luz, Netflix…",nuevo));
    h+=campo(nuevo?"¿Cuánto pagás por mes?":"Monto por mes", inMoney("monto"));
    h+=campo("¿Desde cuándo?", chipsMes(false));
    h+=campo("Categoría", chipsCategoria());
    if(!nuevo){
      const f=config.fijos[s.i];
      if((f.hist||[]).length) h+=`<div class="sh-hist"><b style="color:var(--txt)">Historial</b><br>${f.hist.map((x,ix,arr)=>histLinea(x,arr[ix-1])).join("<br>")}</div>`;
    }
  } else if(s.tipo==="ing"){
    if(nuevo) h+=`<div class="sh-seg"><button type="button" data-ch="once" data-v="0" class="${!s.once?'on':''}">Todos los meses</button><button type="button" data-ch="once" data-v="1" class="${s.once?'on':''}">Solo una vez</button></div>`;
    else h+=`<div class="sh-now"><span class="sh-l">${s.once?"Ingreso de una sola vez":"Se cobra todos los meses"}</span><b>${fmt(s.montoActual)}</b></div>`;
    h+=campo("¿De qué es?", inTxt("n","Ej: Sueldo, freelance…",nuevo)
      + (nuevo?`<div class="chips">${["Sueldo","Aguinaldo","Freelance","Bono"].map(x=>`<button type="button" class="chip sm" data-ch="n" data-v="${x}">${x}</button>`).join("")}</div>`:""));
    h+=campo(s.once?"¿Cuánto?":"¿Cuánto cobrás por mes?", inMoney("monto","var(--green)"));
    h+=campo(s.once?"¿En qué mes?":"¿Desde cuándo?", chipsMes(false));
  } else if(s.tipo==="presu"){
    h+=campo("Categoría", chipsCategoria());
    h+=campo("Tope por mes", inMoney("monto"));
  }
  h+=`<div class="sh-res" id="pl-res">${resumenSheet()}</div>`;
  h+=`<button type="button" class="btn btn-add sh-save" id="pl-save">${nuevo?"Guardar":"Guardar cambios"}</button>`;
  if(!nuevo){
    const txtDel={cuota:"Borrar esta compra", fijo:"Dar de baja", ing:"Dar de baja", presu:"Quitar presupuesto"}[s.tipo];
    h+=`<button type="button" class="sh-del" id="pl-del">${txtDel}</button>`;
  }
  body.innerHTML=h;
  body.scrollTop=scroll;

  // Chips: leen lo tipeado, cambian el estado y re-pintan.
  body.querySelectorAll("[data-ch]").forEach(b=>b.onclick=()=>{
    leerSheet();
    const k=b.dataset.ch, v=b.dataset.v;
    if(k==="t"){ SH.t=+v; SH.tOtra=false; }
    else if(k==="tOtra"){ SH.tOtra=true; }
    else if(k==="f"){ SH.f=v; SH.fOtra=false; }
    else if(k==="fOtra"){ SH.fOtra=true; SH.f=""; }
    else if(k==="catMas"){ SH.catMas=v==="1"; }
    else if(k==="once"){ SH.once=v==="1"; }
    else SH[k]=v;
    if(SH.tipo==="cuota" && SH.modo==="venia" && (SH.t||0)<2) SH.modo="este";
    pintarSheet();
  });
  body.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>{ leerSheet(); SH.actual=Math.min(Math.max(2,(SH.actual||2)+(+b.dataset.step)), Math.max(2,SH.t||2)); pintarSheet(); });
  // Inputs: actualizan SOLO el resumen (sin re-pintar), así no se pierde el foco.
  body.querySelectorAll("[data-in]").forEach(el=>{
    const upd=()=>{ leerSheet(); $("pl-res").innerHTML=resumenSheet(); };
    el.addEventListener("input", upd); el.addEventListener("change", upd);
  });
  body.querySelectorAll("[data-otm],[data-oty]").forEach(el=>el.onchange=()=>{ leerSheet(); $("pl-res").innerHTML=resumenSheet(); });
  const fIn=body.querySelector(".combo input[data-in='f']");
  if(fIn) setupCombo(fIn, formasDePago, val=>{ SH.f=val.trim(); $("pl-res").innerHTML=resumenSheet(); });
  $("pl-x").onclick=cerrarSheet;
  $("pl-save").onclick=guardarSheet;
  if($("pl-del")) $("pl-del").onclick=borrarSheet;
}

function guardarSheet(){
  leerSheet(); const s=SH;
  const nombre=(s.n||"").trim();
  if(s.tipo==="cuota"){
    const t=parseInt(s.t,10)||0;
    if(!(s.tot>0)){ toast("Poné el monto total de la compra", null, "error"); return; }
    if(t<1){ toast("¿En cuántas cuotas?", null, "error"); return; }
    let d, c;
    if(s.modo==="venia"){ c=Math.min(Math.max(2,s.actual),t); d=mesActivo; }
    else { d=mesDeModo(); c=1; }
    const obj={n:nombre||"Compra en cuotas", f:(s.f||"").trim(), cat:s.cat||"Otros", c, t, tot:s.tot, m:Math.round(s.tot/t), d};
    if(s.i==null) config.cuotas.unshift(obj); else Object.assign(config.cuotas[s.i], obj);
    persistC(); cerrarSheet(); toast(s.i==null?"Compra guardada ✓":"Cambios guardados ✓"); render(); return;
  }
  if(s.tipo==="fijo"){
    if(!(s.monto>0)){ toast("Poné cuánto pagás por mes", null, "error"); return; }
    const desde=mesDeModo();
    let f;
    if(s.i==null){ f={n:nombre||"Gasto fijo", cat:s.cat, hist:[]}; config.fijos.unshift(f); }
    else f=config.fijos[s.i];
    cerrarSheet();
    setVig(f, desde, s.monto, nombre||"Gasto fijo", s.cat);   // persiste y renderiza
    toast(s.i==null?"Gasto fijo guardado ✓":"Cambios guardados ✓"); return;
  }
  if(s.tipo==="ing"){
    if(!(s.monto>0)){ toast("Poné el monto del ingreso", null, "error"); return; }
    const mes=mesDeModo(), n=nombre||"Ingreso";
    if(s.once){
      if(s.i==null) config.ingresos.unshift({n, once:true, hist:[{d:mes, m:s.monto, n}]});
      else {
        const g=config.ingresos[s.i];
        g.hist=(g.hist||[]).filter(h=>h.d!==mesActivo && h.d!==mes);
        g.hist.push({d:mes, m:s.monto, n}); g.hist.sort((a,b)=>a.d.localeCompare(b.d)); g.n=n;
      }
      persistC(); cerrarSheet(); toast("Ingreso guardado ✓"); render(); return;
    }
    let g;
    if(s.i==null){ g={n, hist:[]}; config.ingresos.unshift(g); } else g=config.ingresos[s.i];
    cerrarSheet(); setVig(g, mes, s.monto, n); toast("Ingreso guardado ✓"); return;
  }
  if(s.tipo==="presu"){
    if(!(s.monto>0)){ toast("Poné el tope por mes", null, "error"); return; }
    if(s.i!=null && s.i!==s.cat) delete config.presu[s.i];
    config.presu[s.cat]=s.monto;
    persistC(); cerrarSheet(); toast("Presupuesto guardado ✓"); render();
  }
}

/* Borrar / dar de baja. Misma lógica que antes: si el ítem tuvo monto en meses anteriores
   se da de baja desde el mes que estás mirando (la historia queda); si no, se borra. */
function borrarSheet(){
  const s=SH;
  if(s.tipo==="cuota"){
    const q=config.cuotas[s.i];
    confirmar("Borrar compra", `Se borra "${q.n||"esta compra"}" con todas sus cuotas, también de los meses pasados.`, ()=>{ config.cuotas.splice(s.i,1); persistC(); cerrarSheet(); render(); toast("Compra borrada"); }, "Borrar", true);
    return;
  }
  if(s.tipo==="presu"){ delete config.presu[s.i]; persistC(); cerrarSheet(); render(); toast("Presupuesto quitado"); return; }
  const lista = s.tipo==="fijo" ? config.fijos : config.ingresos, obj=lista[s.i];
  const nm = s.n || "este ítem";
  if(s.tipo==="ing" && obj.once){
    confirmar("Borrar ingreso", `Se borra "${nm}" de ${mesLargo(mesActivo).toLowerCase()}.`, ()=>{ obj.hist=(obj.hist||[]).filter(h=>h.d!==mesActivo); if(!obj.hist.length) lista.splice(s.i,1); persistC(); cerrarSheet(); render(); }, "Borrar", true);
    return;
  }
  const tienePasado = montoVigente(obj.hist, ymAdd(mesActivo,-1)) > 0;
  if(tienePasado){
    confirmar("Dar de baja", `"${nm}" deja de contar desde ${mesLargo(mesActivo).toLowerCase()}. Los meses anteriores quedan como estaban.`, ()=>{
      obj.hist=obj.hist.filter(h=>h.d<mesActivo); cerrarSheet();
      if(s.tipo==="fijo") setVig(obj, mesActivo, 0, nombreVigente(obj,mesActivo), catVigente(obj,mesActivo)); else setVig(obj, mesActivo, 0, nombreVigente(obj,mesActivo));
      toast("Dado de baja desde "+mesLargo(mesActivo).toLowerCase());
    }, "Dar de baja", true);
  } else {
    confirmar("Borrar", `"${nm}" no tiene montos en meses anteriores, así que se borra por completo.`, ()=>{ lista.splice(s.i,1); persistC(); cerrarSheet(); render(); }, "Borrar", true);
  }
}
