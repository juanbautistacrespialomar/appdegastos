/* ===== Tu Contador — js/06-resumen-movimientos.js =====
   render() principal, pestaña Resumen (hero, categorías, presupuestos, proyección) y Movimientos.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

function proyeccion(){
  const hoyYm=ymNow(), E=estimarVariables();
  const arr=[]; let hayEst=false;
  for(let i=0;i<6;i++){
    const ym=ymAdd(mesActivo,i), c=computeMes(ym);
    // Meses cerrados: dato real. Mes en curso y futuros: si lo cargado en variables es menos
    // que el promedio, usamos el promedio (estimado de cierre).
    let varUsado=c.tV, est=false;
    if(ym>=hoyYm && E.n && E.est>c.tV){ varUsado=E.est; est=true; hayEst=true; }
    arr.push({mes:MC[(+ym.split("-")[1])-1], saldo:c.ingreso-c.tF-c.tC-varUsado, actual:i===0, est});
  }
  const maxAbs=Math.max(...arr.map(a=>Math.abs(a.saldo)),1);
  // Geometría: banda inferior reservada para los meses, así el label del saldo nunca se pisa
  // con el mes. maxBarH es igual para + y - (codificación honesta).
  const W=330,H=200,pad=26,bw=30,gap=(W-pad*2-bw*6)/5;
  const mband=20, topPad=12, labelGap=11;
  const plotBottom=H-mband;
  // Línea de cero según los datos: si todos los saldos son del mismo signo, el cero va al
  // borde y las barras usan TODO el alto (antes medio gráfico quedaba vacío siempre).
  const hayNeg=arr.some(a=>a.saldo<0), hayPos=arr.some(a=>a.saldo>=0);
  const zero = (hayNeg&&hayPos) ? Math.round((topPad+plotBottom)/2) : hayPos ? plotBottom-2 : topPad+2;
  const maxBarH = (hayNeg&&hayPos) ? (plotBottom-zero)-labelGap : hayPos ? zero-topPad-labelGap : plotBottom-zero-labelGap;
  const kf=v=>{ const a=Math.abs(v), s=v<0?'−':'+'; return a>=1e6?s+(a/1e6).toFixed(1).replace('.',',')+'M':s+Math.round(a/1e3)+'k'; };
  let bars="";
  arr.forEach((a,i)=>{ const h=(Math.abs(a.saldo)/maxAbs)*maxBarH; const x=pad+i*(bw+gap);
    const y=a.saldo>=0?zero-h:zero; const col=a.saldo>=0?'var(--green)':'var(--red)';
    const ly=a.saldo>=0?y-4:y+h+labelGap;
    // Estimados: misma barra pero translúcida y con borde punteado. Colores por variable de
    // tema (antes estaban hardcodeados y en modo claro el texto casi no se leía).
    bars+=`<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h,1)}" rx="3" style="fill:${col};fill-opacity:${a.est?.38:1};${a.est?`stroke:${col};stroke-dasharray:3 2;stroke-width:1`:''}"></rect>
      <text x="${x+bw/2}" y="${ly}" text-anchor="middle" style="fill:var(--muted);font-variant-numeric:tabular-nums" font-size="10">${oculto ? '•••' : kf(a.saldo)}</text>
      <text x="${x+bw/2}" y="${H-6}" text-anchor="middle" style="fill:${a.actual?'var(--txt)':'var(--muted)'}" font-size="10" ${a.actual?'font-weight="600"':''}>${a.mes}${a.est?'*':''}</text>`; });
  const nota = hayEst
    ? `* Estimado: suma ${oculto?'$ •••':'$'+(E.est>=1e6?(E.est/1e6).toFixed(1).replace('.',',')+'M':Math.round(E.est/1e3)+'k')}/mes de gastos variables (tu promedio de los últimos ${E.n===1?'mes':E.n+' meses'}).`
    : (E.n ? '' : 'Todavía no hay meses cerrados con gastos variables: la proyección resta solo fijos y cuotas.');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><line x1="${pad-6}" y1="${zero}" x2="${W-pad+6}" y2="${zero}" style="stroke:var(--border)" stroke-width="1"/>${bars}</svg>`
    + (nota?`<p class="pnote">${nota}</p>`:'');
}

function render(){
  $("monthLabel").innerHTML = nombreMes(mesActivo) + ` <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.45"><polyline points="6 9 12 15 18 9"/></svg>`;
  $("eyeBtn").classList.toggle("oculto", oculto);
  $("filtros").style.display = vista==="mov" ? "" : "none";
  // Ajustes no depende del mes: ahí el selector de mes no tiene sentido (v7.1).
  document.querySelector(".monthbar").style.display = vista==="ajustes" ? "none" : "";
  $("fab").style.display = (vista==="resumen"||vista==="mov"||vista==="plan") ? "" : "none";
  cerrarFabMenu();
  invalidarCalc();          // por si algo cambió en memoria sin pasar por persistC/persistM
  ensureColores();          // asegura color para categorías nuevas antes de dibujar donut/leyenda
  poblarFiltroMedios();
  poblarFiltroCats();
  const _orden=["resumen","mov","plan","ajustes"], _idx=_orden.indexOf(vista), _cambioVista=vista!==vistaPrev;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.v===vista));
  if(_idx>=0) $("tabInd").style.transform="translateX("+(_idx*100)+"%)";
  const c = computeMes(mesActivo);

  // El hero (saldo + submétricas) y la barra de composición viven SOLO en Resumen (v7.0).
  // Antes se dibujaban arriba de todas las pestañas: Movimientos, Plan y Ajustes repetían
  // el mismo bloque y empujaban el contenido propio de cada pestaña para abajo.
  if(vista==="resumen"){
    const fsHero=t=>{ const L=String(t).length; return L>=13?"26px":L>=11?"30px":"34px"; };
    const kAbrev=v=>{ const a=Math.abs(v); return a>=1e6?(a/1e6).toFixed(1).replace('.',',')+'M':Math.round(a/1e3)+'k'; };
    const mesTxt = MESES[+mesActivo.split("-")[1]-1].toLowerCase();
    const hsub = oculto ? "Balance del mes oculto"
               : c.saldo<0 ? `Gastaste $${kAbrev(c.saldo)} más de lo que entró`
               : c.saldo>0 ? `Te sobró $${kAbrev(c.saldo)} este mes`
               : `Cerraste justo este mes`;
    const cmp = comparativa(mesActivo);
    const dG = deltaGasto(cmp.act.total, cmp.prev.total);
    // Tasa de ahorro = saldo / ingresos. Es LA métrica de salud de unas finanzas personales:
    // el saldo en pesos solo no dice si $200k es mucho o poco para vos.
    const ahorro = c.ingreso>0 ? Math.round(c.saldo/c.ingreso*100) : null;
    $("cards").innerHTML =
      `<div class="hero">
         <div class="hlab">Saldo de ${mesTxt}</div>
         <div class="hval" style="font-size:${fsHero(fmt(c.saldo))}">${fmt(c.saldo)}</div>
         <div class="hsub ${oculto||c.saldo===0?'neu':c.saldo>0?'pos':'neg'}">${oculto?ic('eye'):c.saldo>=0?ic('check'):ic('alert')}${hsub}</div>
       </div>
       <div class="submetrics">
         <div class="sm"><div class="smlab">Ingresos</div><div class="smval" style="color:var(--green)">${fmt(c.ingreso)}</div></div>
         <div class="sm"><div class="smlab">Gastos</div><div class="smval">${fmt(c.gasto)}</div>
           ${dG?`<div class="delta ${dG.cls}">${dG.t} <span>${cmp.lab}</span></div>`:''}</div>
         <div class="sm"><div class="smlab">Ahorro</div><div class="smval" style="color:${ahorro==null?'var(--muted)':ahorro>=0?'var(--green)':'var(--red)'}">${ahorro==null?'—':(oculto?'•••':ahorro+'%')}</div>
           <div class="delta eq"><span>de lo que entró</span></div></div>
       </div>`;
    const tot = c.tF + c.tC + c.tV;
    const pF = tot? c.tF/tot*100 : 0, pC = tot? c.tC/tot*100 : 0, pV = tot? c.tV/tot*100 : 0;
    const rp = n => Math.round(n);
    $("split").innerHTML = tot ?
      `<div class="comp">
         <div class="ctitle">Composición del gasto</div>
         <div class="cbar">
           <div class="cseg" style="width:${pF}%;background:var(--fijo)"></div>
           <div class="cseg" style="width:${pC}%;background:var(--violet)"></div>
           <div class="cseg" style="width:${pV}%;background:var(--c2)"></div>
         </div>
         <div class="clegend">
           <div class="clrow"><span class="clname"><span class="cldot" style="background:var(--fijo)"></span>Fijos</span><span class="clval">${fmt(c.tF)} · ${rp(pF)}%</span></div>
           <div class="clrow"><span class="clname"><span class="cldot" style="background:var(--violet)"></span>Cuotas</span><span class="clval">${fmt(c.tC)} · ${rp(pC)}%</span></div>
           <div class="clrow"><span class="clname"><span class="cldot" style="background:var(--c2)"></span>Variables</span><span class="clval">${fmt(c.tV)} · ${rp(pV)}%</span></div>
         </div>
       </div>` : ``;

    // microinteracciones: count-up del saldo y barra de composición, sólo cuando el saldo cambió
    const _animar = (_lastSaldoShown===null) || (_lastSaldoShown!==c.saldo);
    if(_animar){
      const hvalEl=$("cards").querySelector(".hval");
      if(hvalEl) countUp(hvalEl, _lastSaldoShown===null?0:_lastSaldoShown, c.saldo, 650);
      if(tot){
        const segs=[...$("split").querySelectorAll(".cseg")];
        const ws=segs.map(s=>s.style.width);
        segs.forEach(s=>s.style.width="0%");
        void $("split").offsetWidth;
        requestAnimationFrame(()=>segs.forEach((s,i)=>s.style.width=ws[i]));
      }
    }
    _lastSaldoShown = c.saldo;
  } else {
    $("cards").innerHTML = "";
    $("split").innerHTML = "";
  }

  if(vista==="resumen") renderResumen(c);
  else if(vista==="mov") renderMov(c);
  else if(vista==="plan") renderPlan();
  else renderAjustes();

  if(_cambioVista){
    const _ic=document.querySelector(".tab.active svg");
    if(_ic){ _ic.style.animation="none"; void _ic.offsetWidth; _ic.style.animation="tabpop .35s ease"; }
    const _ct=$("content"); _ct.style.animation="none"; void _ct.offsetWidth; _ct.style.animation="viewin .28s ease";
  }
  vistaPrev=vista;

  $("content").querySelectorAll(".del-mov").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); if(confirm("¿Borrar este gasto?")){ mov=mov.filter(x=>x.id!==b.dataset.id); persistM(); render(); } });
  $("content").querySelectorAll(".var-row").forEach(el=>el.onclick=(e)=>{ if(e.target.closest(".del")) return; abrirModalDet(el.dataset.edit); });
  $("content").querySelectorAll(".fgroup").forEach(el=>el.onclick=()=>{ const cat=el.dataset.cat; colapsado[cat] = (colapsado[cat]!==false)? false : true; render(); });
  $("content").querySelectorAll(".fgroup-c").forEach(el=>el.onclick=()=>{ const card=el.dataset.card; colCuotas[card] = (colCuotas[card]===true)? false : true; render(); });
  // Resumen → tocar una categoría abre Movimientos filtrado por ella
  $("content").querySelectorAll("[data-gocat]").forEach(el=>el.onclick=()=>{
    fCat=el.dataset.gocat; fTexto=""; fMedio="__todos"; $("f-texto").value=""; vista="mov"; render();
    const w=document.querySelector(".wrap"); if(w) w.scrollTo({top:0});
  });
  $("content").querySelectorAll("[data-catmore]").forEach(el=>el.onclick=()=>{ catExpand=!catExpand; render(); });
  $("content").querySelectorAll("[data-goplan]").forEach(el=>el.onclick=()=>{ vista="plan"; render(); const w=document.querySelector(".wrap"); if(w) w.scrollTo({top:0}); });
  sincronizarRecordatorios();
}

function renderResumen(c){
  const cmp = comparativa(mesActivo);
  const cats = Object.entries(cmp.act.map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  const total = cmp.act.total;
  /* Barras horizontales ordenadas en vez del donut (v7.0). Con más de 5-6 porciones el ojo
     no compara ángulos, y el donut podía tener 22. Barras de largo proporcional al MAYOR
     gasto se comparan de un vistazo. Top 5 + "Otras" desplegable. Tocar una categoría te
     lleva a Movimientos filtrado por ella. */
  let catsHtml;
  if(!total){
    catsHtml = emptyState('dollar', 'Todavía no cargaste gastos', 'Cuando cargues tu primer gasto del mes, tu resumen por categoría aparece acá.', {label:'Cargar mi primer gasto', action:'abrirModalAlta()'});
  } else {
    const max = cats[0].value, TOP=5;
    const visibles = catExpand ? cats : cats.slice(0,TOP);
    const resto = cats.slice(TOP);
    const fila1 = x => {
      const d = deltaGasto(x.value, cmp.prev.map[x.name]||0);
      return `<div class="catrow" data-gocat="${esc(x.name)}">
        <div class="cattop"><span class="clname"><span class="cldot" style="background:${COLORES[x.name]||'var(--muted)'}"></span>${esc(x.name)}</span>
          <span class="catval">${fmt(x.value)} <span class="pct">${Math.round(x.value/total*100)}%</span></span></div>
        <div class="cbarh"><div style="width:${Math.max(2,x.value/max*100)}%;background:${COLORES[x.name]||'var(--muted)'}"></div></div>
        ${d?`<div class="delta ${d.cls}">${d.t} <span>${cmp.lab}</span></div>`:''}</div>`;
    };
    catsHtml = visibles.map(fila1).join("");
    if(resto.length){
      const sumResto = resto.reduce((s,x)=>s+x.value,0);
      catsHtml += catExpand
        ? `<button class="catmore" data-catmore="1">Ver menos</button>`
        : `<div class="catrow" data-catmore="1"><div class="cattop"><span class="clname"><span class="cldot" style="background:var(--muted)"></span>Otras ${resto.length} categorías</span>
             <span class="catval">${fmt(sumResto)} <span class="pct">${Math.round(sumResto/total*100)}%</span></span></div>
             <div class="cbarh"><div style="width:${Math.max(2,sumResto/max*100)}%;background:var(--muted)"></div></div>
             <div class="delta eq"><span>Tocá para ver todas</span></div></div>`;
    }
  }
  /* Presupuestos: barra de consumo por categoría contra el tope que cargaste en Plan.
     Va en un panel APARTE del ranking a propósito: mezclar en un mismo gráfico barras
     relativas al mayor gasto con barras relativas a un tope confunde la escala. */
  const presu = Object.entries(config.presu||{}).filter(([,m])=>m>0);
  let presuHtml = "";
  if(presu.length){
    presuHtml = `<div class="panel"><p class="ptitle">${ic('target')} Presupuestos</p>` + presu
      .map(([cat,tope])=>({cat,tope,g:cmp.act.map[cat]||0}))
      .sort((a,b)=>(b.g/b.tope)-(a.g/a.tope))
      .map(p=>{
        const pct=p.g/p.tope*100, cls=pct>100?'over':pct>=80?'warn':'ok';
        const txt = pct>100 ? `Te pasaste ${fmt(p.g-p.tope)}` : `Te quedan ${fmt(p.tope-p.g)}`;
        return `<div class="prow"><div class="cattop"><span class="clname"><span class="cldot" style="background:${COLORES[p.cat]||'var(--muted)'}"></span>${esc(p.cat)}</span>
          <span class="catval">${fmt(p.g)} <span class="pct">de ${fmt(p.tope)}</span></span></div>
          <div class="cbarh pbar ${cls}"><div style="width:${Math.min(100,pct)}%"></div></div>
          <div class="delta ${cls==='over'?'up':'eq'}"><span>${Math.round(pct)}% · ${txt}</span></div></div>`;
      }).join("") + `</div>`;
  }
  $("content").innerHTML =
    `<div class="panel"><p class="ptitle">Gastos por categoría</p>${catsHtml}</div>`
    + presuHtml
    + `<div class="panel"><p class="ptitle">${ic('trend')} Saldo proyectado</p>${proyeccion()}</div>`;
}

function fila(nombre,meta,monto,color,delId,editId){
  return `<div class="item${editId?' var-row':''}"${editId?` data-edit="${editId}"`:''}><div style="display:flex;align-items:center;gap:10px;min-width:0">
    <span class="bar" style="background:${color}"></span>
    <div style="min-width:0"><div class="desc">${esc(nombre)}</div>${meta?`<div class="meta">${esc(meta)}</div>`:''}</div></div>
    <div style="display:flex;align-items:center;gap:6px"><span class="amt">${fmt(monto)}</span>
    ${delId?`<button class="del del-mov" data-id="${delId}" aria-label="Borrar">${ic('trash')}</button>`:''}</div></div>`;
}

/* Movimientos = SOLO el registro de gastos variables (v7.0), agrupado por día con subtotal.
   Ingresos, fijos y cuotas no son "movimientos" que cargás día a día: son el plan del mes
   y viven (y se editan) en la pestaña Plan. Antes se repetían acá. */
const DIAS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
function etiquetaDia(f){
  if(f===hoy()) return "Hoy";
  const d=new Date(+f.slice(0,4), +f.slice(5,7)-1, +f.slice(8,10));
  const ay=new Date(); ay.setDate(ay.getDate()-1);
  if(d.toDateString()===ay.toDateString()) return "Ayer";
  return DIAS[d.getDay()]+" "+(+f.slice(8,10));
}
function renderMov(c){
  const q=fTexto.trim().toLowerCase();
  const filtroActivo = q!=="" || fCat!=="__todas" || fMedio!=="__todos";
  const res = c.variables.filter(v=>{
    if(fCat!=="__todas" && v.categoria!==fCat) return false;
    if(fMedio!=="__todos" && v.medio!==fMedio) return false;
    if(q && !((v.descripcion||"").toLowerCase().includes(q) || (v.categoria||"").toLowerCase().includes(q))) return false;
    return true;
  });
  const suma = res.reduce((s,x)=>s+x.monto,0);
  let h = `<div class="grouphdr"><span>${res.length} gasto${res.length===1?"":"s"}${filtroActivo?" con filtro":""} · ${nombreMes(mesActivo)}</span><span>${fmt(suma)}</span></div>`;
  // Si filtrás por una categoría que también tiene fijos o cuotas, te avisamos: el total de esa
  // categoría en Resumen los incluye y acá (registro de variables) no aparecen.
  let hayNota=false;
  if(fCat!=="__todas"){
    const extra = c.fijos.filter(f=>f.cat===fCat).reduce((s,x)=>s+x.monto,0) + c.cuotas.filter(x=>x.cat===fCat).reduce((s,x)=>s+x.monto,0);
    if(extra>0){ hayNota=true; h += `<div class="note" data-goplan="1">${ic('card')}<span>Además tenés ${fmt(extra)} en fijos y cuotas de ${esc(fCat)} este mes. <u>Ver en Plan</u></span></div>`; }
  }
  if(!res.length){
    h += hayNota ? `<div class="empty">No cargaste gastos variables de ${esc(fCat)} este mes.</div>`
       : filtroActivo
      ? emptyState('search','Sin resultados','Probá con otra descripción o cambiá los filtros de este mes.')
      : emptyState('dollar','Todavía no cargaste gastos','Cuando anotes tu primer gasto, lo vas a ver acá agrupado por día.', {label:'Cargar mi primer gasto', action:'abrirModalAlta()'});
    $("content").innerHTML=h; return;
  }
  const porDia = {}; const orden=[];
  res.forEach(v=>{ if(!porDia[v.fecha]){ porDia[v.fecha]=[]; orden.push(v.fecha); } porDia[v.fecha].push(v); });
  orden.forEach(f=>{
    const items=porDia[f], sub=items.reduce((s,x)=>s+x.monto,0);
    h += `<div class="dayhdr"><span>${etiquetaDia(f)}</span><span>${fmt(sub)}</span></div>`;
    h += items.map(v=>fila(v.descripcion||v.categoria, v.categoria+" · "+v.medio, v.monto, COLORES[v.categoria]||"#6B8194", v.id, v.id)).join("");
  });
  $("content").innerHTML=h;
}
