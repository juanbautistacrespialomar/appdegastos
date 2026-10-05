/* ===== Tu Contador — js/01-dominio.js =====
   Datos y cálculos PUROS: constantes, fechas AAAA-MM, vigencias, computeMes, comparativas,
   proyección de variables. No toca la pantalla ni el localStorage: por eso tiene tests (test/).
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

const CATS = ["Comida","Transporte","Salidas/Comidas","Hogar","Mantenimiento","Servicios","Suscripciones","Salud","Cuidado personal","Ocio","Educación","Ropa","Viajes","Mascotas","Regalos","Gimnasio","Tecnología","Niños","Impuestos","Alquiler","Cuotas","Otros"];
const MEDIOS = ["Efectivo","Débito","Crédito","Transferencia","MercadoPago"];
const TARJETAS = ["Visa","Mastercard","MercadoPago"];
const COLORES = { "Comida":"#22c55e","Transporte":"#3b82f6","Salidas/Comidas":"#FFA31A","Salidas/Asados":"#FFA31A","Hogar":"#fb923c","Mantenimiento":"#ca8a04","Servicios":"#06b6d4","Suscripciones":"#6366f1","Salud":"#ec4899","Cuidado personal":"#a855f7","Ocio":"#fb7185","Educación":"#0ea5e9","Ropa":"#d946ef","Viajes":"#eab308","Mascotas":"#b45309","Regalos":"#c2410c","Gimnasio":"#84cc16","Tecnología":"#0284c7","Niños":"#fbbf24","Impuestos":"#8B9CAB","Alquiler":"#14b8a6","Cuotas":"#818cf8","Otros":"#6B8194" };
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MC = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function ymNow(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
// Devuelve SOLO el nombre limpio de la tarjeta. Antes prefijaba "💳 " y la linea de renderCuotas
// tenia que hacer .replace("💳 ","") para recuperar el dato: el emoji estaba haciendo de separador
// en la logica. Ahora el icono lo pone quien renderiza (ic("card")) y el dato viaja limpio.
function tarjetaLabel(f){ return (f==="MercadoPago"?"Mercado Pago":f); }

function SEED() { return { v:3, ingresos:[{n:"Sueldo", hist:[{d:ymNow(), m:0}]}], fijos:[], cuotas:[], presu:{} }; }
function MOV_SEED() { return []; }

function parseMonto(v){ v=String(v).trim(); if(!v) return NaN; v=v.replace(/\./g,"").replace(",","."); return parseFloat(v); }
function migrarCat(c){ return c==="Salidas/Asados" ? "Salidas/Comidas" : c; }

function normConfig(c){
  if(!c||typeof c!=="object") return SEED();
  c.v=3;
  if(!Array.isArray(c.ingresos)){
    c.ingresos=[];
    if(typeof c.sueldo==="number" && c.sueldo>0) c.ingresos.push({n:"Sueldo", hist:[{d:(c.desde||ymNow()), m:c.sueldo}]});
    else c.ingresos.push({n:"Sueldo", hist:[{d:ymNow(), m:0}]});
  }
  delete c.sueldo;
  c.ingresos.forEach(g=>{ if(!Array.isArray(g.hist)) g.hist=[{d:ymNow(), m:(g.m||0)}]; if(!g.n) g.n="Ingreso"; g.hist.sort((a,b)=>a.d.localeCompare(b.d)); g.hist.forEach(h=>{ if(h.n==null) h.n=g.n; }); });
  if(!Array.isArray(c.fijos)) c.fijos=[];
  if(!Array.isArray(c.cuotas)) c.cuotas=[];
  if(!c.presu || typeof c.presu!=="object" || Array.isArray(c.presu)) c.presu={};
  c.cuotas.forEach(q=>{ if(!q.d) q.d=ymNow(); if((q.tot==null||q.tot===0) && q.m>0 && q.t>0) q.tot=q.m*q.t; });
  c.fijos.forEach(f=>{ if(!f.hist){ f.hist=[{d:(c.desde||ymNow()),m:(f.m||0)}]; delete f.m; } if(!f.cat) f.cat="Otros"; f.cat=migrarCat(f.cat); if(!f.n) f.n="Gasto fijo"; f.hist.sort((a,b)=>a.d.localeCompare(b.d)); f.hist.forEach(h=>{ if(h.n==null) h.n=f.n; if(h.cat==null) h.cat=f.cat; }); });
  return c;
}
function normMov(m){ if(!Array.isArray(m)) return []; m.forEach(x=>{ if(!x.medio) x.medio="—"; if(!x.categoria) x.categoria="Otros"; x.categoria=migrarCat(x.categoria); if(typeof x.monto!=="number") x.monto=parseMonto(x.monto)||0; }); return m; }
/* ===== Separador de miles en los campos de monto mientras se escribe =====
   "169998" -> "169.998" en vivo. La coma queda como decimal (es-AR). parseMonto
   ya saca los puntos, así que lo que se guarda sigue siendo un número limpio. */
function fmtMoneyStr(v){
  v = String(v==null?"":v).replace(/[^\d,]/g,"");
  const i = v.indexOf(",");
  let ent = (i>=0 ? v.slice(0,i) : v).replace(/,/g,"");
  let dec = (i>=0 ? v.slice(i+1) : "").replace(/,/g,"").slice(0,2);
  ent = ent.replace(/^0+(?=\d)/,"");
  const entFmt = ent.replace(/\B(?=(\d{3})+(?!\d))/g,".");
  return i>=0 ? (entFmt||"0")+","+dec : entFmt;
}
/* Convierte un número guardado (decimal con punto, ej 1234.5) al formato es-AR de
   pantalla (1.234,5). OJO: fmtMoneyStr es para texto tipeado por el usuario (coma
   decimal); pasarle un número le comía el punto decimal. Por eso va esta aparte. */
function numADisplay(n){
  if(n===""||n==null||isNaN(n)) return "";
  return Number(n).toLocaleString("es-AR",{maximumFractionDigits:2});
}
const hoy = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const nombreMes = ym => { const [y,m]=ym.split("-"); return MESES[+m-1]+" "+y; };
function ymAdd(ym,k){ const [y,m]=ym.split("-").map(Number); const d=new Date(y,m-1+k,1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
function ymDiff(a,b){ const [ay,am]=a.split("-").map(Number),[by,bm]=b.split("-").map(Number); return (by-ay)*12+(bm-am); }
// Normaliza para comparar sin importar mayúsculas ni acentos (así "almuerzo" matchea "Almuerzo").
const normD = s => (s||"").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function montoVigente(hist, ym){ let best=null; (hist||[]).forEach(h=>{ if(h.d<=ym && (!best||h.d>best.d)) best=h; }); return best?best.m:0; }
// Igual que montoVigente pero para un campo cualquiera (n, cat). Recorre el hist de forma
// "sparse": solo mira las entradas que TIENEN el campo definido y se queda con la última
// hasta ese mes. Así el nombre/categoría se arrastra hacia adelante idéntico al importe.
function campoVigente(hist, ym, campo, def){ let best=null; (hist||[]).forEach(h=>{ if(h.d<=ym && h[campo]!=null && (!best||h.d>best.d)) best=h; }); return best?best[campo]:def; }
function nombreVigente(f, ym){ return campoVigente(f.hist, ym, "n", f.n); }
function catVigente(f, ym){ return campoVigente(f.hist, ym, "cat", f.cat); }
// ¿Está dado de baja a este mes? (importe 0 vigente y ADEMÁS tuvo importe alguna vez).
// Los recién creados que nunca tuvieron importe NO se ocultan, para poder cargarlos.
function ocultoEnAjustes(obj, ym){ return montoVigente(obj.hist,ym)<=0 && (obj.hist||[]).some(h=>h.m>0); }
// Monto de un ingreso en un mes. Si es "solo este mes" (once), cuenta únicamente en los
// meses EXACTOS donde lo cargaste (ej: aguinaldo en jun y dic), no de ahí en adelante.
// Si no, se comporta como siempre: el último monto vigente hasta ese mes.
function montoIngresoMes(g, ym){
  if(g.once){ const h=(g.hist||[]).find(x=>x.d===ym); return h?h.m:0; }
  return montoVigente(g.hist, ym);
}
/* ===== Capa de cálculo (v7.0) =====
   computeMes se llama MUCHAS veces por render (hero, comparativa, proyección de 6 meses,
   señales de recordatorios). Antes cada llamada recorría TODOS los movimientos. Ahora:
   - _movIdx: índice mes → movimientos, armado una sola vez.
   - _cmCache: resultado de computeMes por mes.
   Ambos se invalidan en persistC/persistM y al principio de cada render(), así nunca se
   sirve un dato viejo después de editar algo. */
let _cmCache = new Map(), _movIdx = null;
function invalidarCalc(){ _cmCache.clear(); _movIdx = null; }
function movDelMes(ym){
  if(!_movIdx){
    _movIdx = new Map();
    mov.forEach(x=>{ const k=(x.fecha||"").slice(0,7); if(!_movIdx.has(k)) _movIdx.set(k,[]); _movIdx.get(k).push(x); });
  }
  return _movIdx.get(ym) || [];
}
function computeMes(ym){
  if(_cmCache.has(ym)) return _cmCache.get(ym);
  const ingresos=[]; config.ingresos.forEach(g=>{ const m=montoIngresoMes(g,ym); if(m>0) ingresos.push({nombre:nombreVigente(g,ym), monto:m, once:!!g.once}); });
  const ingreso = ingresos.reduce((s,x)=>s+x.monto,0);
  const fijos=[]; config.fijos.forEach(f=>{ const m=montoVigente(f.hist,ym); if(m>0) fijos.push({nombre:nombreVigente(f,ym), monto:m, cat:catVigente(f,ym)}); });
  // Cada cuota viaja con su categoría REAL (q.cat). Las cargadas antes de la v7.0 no la
  // tienen y caen en "Cuotas" hasta que les asignes una en Plan.
  const cuotas=[];
  config.cuotas.forEach(q=>{ const k=ymDiff(q.d,ym); if(k>=0 && k<=(q.t-q.c)) cuotas.push({nombre:q.n+" "+(q.c+k)+"/"+q.t, fuente:q.f, monto:q.m, cat:q.cat||"Cuotas"}); });
  const variables = movDelMes(ym).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const tF=fijos.reduce((s,x)=>s+x.monto,0), tC=cuotas.reduce((s,x)=>s+x.monto,0), tV=variables.reduce((s,x)=>s+x.monto,0);
  const gasto=tF+tC+tV;
  const r = {ingresos,ingreso,fijos,cuotas,variables,tF,tC,tV,gasto,saldo:ingreso-gasto};
  _cmCache.set(ym, r);
  return r;
}

/* Gasto del mes agrupado por categoría (fijos + cuotas + variables).
   corte = día del mes: si viene, los variables se cuentan solo hasta ese día. Sirve para
   comparar el mes en curso contra el anterior "a la misma altura": si hoy es 5, comparar
   tus 5 días de octubre contra septiembre COMPLETO te daría siempre una baja falsa. */
function gastosPorCat(c, corte){
  const map={}; const add=(k,v)=>{ if(v>0) map[k]=(map[k]||0)+v; };
  c.fijos.forEach(f=>add(f.cat, f.monto));
  c.cuotas.forEach(q=>add(q.cat, q.monto));
  c.variables.forEach(v=>{ if(corte && +(v.fecha||"").slice(8,10)>corte) return; add(v.categoria, v.monto); });
  return {map, total:Object.values(map).reduce((s,x)=>s+x,0)};
}
function comparativa(ym){
  const corte = ym===ymNow() ? +hoy().slice(8,10) : null;
  const ymPrev = ymAdd(ym,-1), mPrev = +ymPrev.split("-")[1];
  return {
    act:  gastosPorCat(computeMes(ym), null),
    prev: gastosPorCat(computeMes(ymPrev), corte),
    lab:  corte ? ("vs "+corte+"/"+mPrev) : ("vs "+MC[mPrev-1].toLowerCase())
  };
}
// Variación % de un gasto. Para gastos, SUBIR es malo (rojo) y BAJAR es bueno (verde).
// Siempre va con flecha además del color, así no depende solo del rojo/verde.
function deltaGasto(a,b){
  if(!(b>0)) return a>0 ? {t:"nuevo", cls:"eq"} : null;
  const p=Math.round((a-b)/b*100);
  if(p===0) return {t:"= igual", cls:"eq"};
  return {t:ic(p>0?"arrUp":"arrDown")+Math.abs(p)+"%", cls:p>0?"up":"down"};
}
/* Estimación de gastos variables para meses que todavía no terminaron: promedio de los
   últimos 3 meses CERRADOS que tengan variables cargados. Sin esto, la proyección restaba
   solo fijos + cuotas y los meses futuros se veían artificialmente en verde. */
function estimarVariables(){
  const base=ymNow(); let s=0, n=0;
  for(let i=1;i<=3;i++){ const cc=computeMes(ymAdd(base,-i)); if(cc.tV>0){ s+=cc.tV; n++; } }
  return {est: n ? s/n : 0, n};
}

/* ===== Cuotas: fin y orden (v8.3) ===== */
// Último mes (AAAA-MM) en que se paga la cuota. q.d es el mes de la cuota número q.c.
function finCuota(q){ return ymAdd(q.d, Math.max(0,(q.t||0)-(q.c||0))); }
// Orden para Plan: primero las que están en curso, de la que TERMINA ANTES a la que termina
// después (a igual fin, por nombre); al final las que todavía no empezaron, por fecha de inicio.
// Recibe y devuelve índices de config.cuotas (no reordena los datos guardados).
function ordenarCuotas(idxs, ym){
  return idxs.slice().sort((a,b)=>{
    const qa=config.cuotas[a], qb=config.cuotas[b];
    const fa=ymDiff(qa.d,ym)<0, fb=ymDiff(qb.d,ym)<0;          // ¿todavía no empezó?
    if(fa!==fb) return fa?1:-1;
    if(fa) return qa.d.localeCompare(qb.d) || (qa.n||"").localeCompare(qb.n||"");
    return finCuota(qa).localeCompare(finCuota(qb)) || (qa.n||"").localeCompare(qb.n||"");
  });
}
