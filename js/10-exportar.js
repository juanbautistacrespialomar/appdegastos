/* ===== Tu Contador — js/10-exportar.js =====
   Exportar a CSV / Excel.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

function exportar(){
  const c=computeMes(mesActivo), sep=";", L=[];
  // Convierte cualquier valor a una celda CSV segura: escapa comillas internas y, si el
  // texto empieza con = + - @ (posible fórmula para Excel/Sheets), le antepone una comilla
  // simple para que se interprete como texto literal y no se ejecute nada al abrir el archivo.
  const cell = s => { let t=String(s==null?"":s); if(/^[=+\-@]/.test(t)) t="'"+t; return '"'+t.replace(/"/g,'""')+'"'; };
  L.push(["Tipo","Detalle","Categoría/Tarjeta","Monto"].join(sep));
  c.ingresos.forEach(g=>L.push([cell("Ingreso"),cell(g.nombre),cell(""),g.monto].join(sep)));
  c.fijos.forEach(f=>L.push([cell("Fijo"),cell(f.nombre),cell(f.cat),f.monto].join(sep)));
  c.cuotas.forEach(q=>L.push([cell("Cuota"),cell(q.nombre),cell(q.fuente),q.monto].join(sep)));
  c.variables.forEach(v=>L.push([cell("Variable"),cell(v.descripcion||""),cell(v.categoria),v.monto].join(sep)));
  L.push([cell(""),cell("TOTAL GASTOS"),cell(""),c.gasto].join(sep));
  L.push([cell(""),cell("SALDO"),cell(""),c.saldo].join(sep));
  const csv="\uFEFF"+L.join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download="gastos_"+mesActivo+".csv"; a.click(); URL.revokeObjectURL(a.href);
}

// Exporta TODA la info en una tabla plana (un renglón por línea de cada mes), lista para
// abrir en Excel y pivotear. Columnas: Mes | Fecha | Tipo | Categoría | Detalle | Medio | Importe.
// v8.5: los gastos variables salen APERTURADOS, uno por renglón con su fecha, descripción y
// medio de pago (antes solo traían la categoría y no se podía saber qué gasto era cada uno).
// Rango de meses: desde el primer mes con datos hasta el último con obligación/movimiento,
// garantizando como mínimo el mismo horizonte que "Saldo proyectado" (mes actual + HORIZONTE_FWD).
function exportarExcel(){
  const HORIZONTE_FWD = 5;   // meses hacia adelante asegurados (6 en total con el actual, igual que la proyección)

  // 1) Determino el rango [ini, fin] barriendo todas las fuentes de datos.
  const mins=[], maxs=[];
  config.ingresos.forEach(g=>{ (g.hist||[]).forEach(h=>{ mins.push(h.d); maxs.push(h.d); }); });
  config.fijos.forEach(f=>{ (f.hist||[]).forEach(h=>{ mins.push(h.d); maxs.push(h.d); }); });
  config.cuotas.forEach(q=>{ if(q.d){ mins.push(q.d); maxs.push(ymAdd(q.d, Math.max(0,(q.t||0)-(q.c||0)))); } });
  mov.forEach(m=>{ const ym=(m.fecha||"").slice(0,7); if(ym){ mins.push(ym); maxs.push(ym); } });
  if(!mins.length){ mins.push(mesActivo); maxs.push(mesActivo); }   // app vacía: al menos el mes activo
  mins.sort(); maxs.sort();
  let ini = mins[0];
  let fin = maxs[maxs.length-1];
  const finHoriz = ymAdd(ymNow(), HORIZONTE_FWD);                   // horizonte futuro asegurado
  if(finHoriz > fin) fin = finHoriz;

  // 2) Recorro mes a mes y emito filas planas. Reutilizo computeMes para que lo exportado
  //    sea EXACTAMENTE lo mismo que ves en pantalla (misma lógica de vigencias/cuotas).
  const sep=";", L=[];
  // Celda de texto segura contra inyección de fórmulas (=,+,-,@) al abrir en Excel/Sheets.
  const cell = s => { let t=String(s==null?"":s); if(/^[=+\-@]/.test(t)) t="'"+t; return '"'+t.replace(/"/g,'""')+'"'; };
  // Importe: entero redondeado a pesos (igual que muestra la app con maximumFractionDigits:0).
  // Sin separador decimal => lo lee cualquier Excel sin importar la config regional (coma/punto).
  // Signo: los ingresos van en positivo y los gastos en negativo, así sumando la columna
  // de un mes te da el saldo (ingresos - gastos) idéntico al de la app.
  const num  = v => String(Math.round(v));
  // Fecha en dd/mm/aaaa y sin comillas: Excel en español la toma como fecha real (filtrable).
  const fecha = f => { const p=String(f||"").split("-"); return p.length===3 ? p[2]+"/"+p[1]+"/"+p[0] : ""; };
  L.push(["Mes","Fecha","Tipo","Categoría","Detalle","Medio de pago","Importe"].join(sep));

  let ym = ini, guarda = 0;
  while(ym <= fin && guarda++ < 1200){   // tope de seguridad (100 años): nunca un loop infinito
    const c = computeMes(ym);
    c.ingresos.forEach(g => L.push([cell(ym), "", cell("Ingreso"),      cell(""),    cell(g.nombre), cell(""),       num(g.monto)].join(sep)));
    c.fijos   .forEach(f => L.push([cell(ym), "", cell("Gastos fijos"), cell(f.cat), cell(f.nombre), cell(""),       num(-f.monto)].join(sep)));
    c.cuotas  .forEach(q => L.push([cell(ym), "", cell("Cuotas"),       cell(q.cat), cell(q.nombre), cell(q.fuente), num(-q.monto)].join(sep)));
    // Variables de más viejo a más nuevo dentro del mes (computeMes los trae al revés para la pantalla).
    c.variables.slice().reverse().forEach(v => L.push([cell(ym), fecha(v.fecha), cell("Gastos variables"),
      cell(v.categoria), cell(v.descripcion||""), cell(v.medio||""), num(-v.monto)].join(sep)));
    ym = ymAdd(ym, 1);
  }

  if(L.length <= 1){ alert("No hay datos para exportar todavía."); return; }
  const csv = "\uFEFF" + L.join("\r\n");   // BOM para que Excel respete acentos/UTF-8
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download="misgastos_todos_los_meses_"+hoy()+".csv"; a.click(); URL.revokeObjectURL(a.href);
}
