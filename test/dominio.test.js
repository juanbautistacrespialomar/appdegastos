/* Tests de los cálculos de Tu Contador (js/01-dominio.js).
   Correr: node --test test/*.test.js      (sin instalar nada; Node 18 o más nuevo)
   En GitHub corren solos en cada subida (.github/workflows/tests.yml). */
const test = require("node:test");
const assert = require("node:assert/strict");
const { cargarDominio } = require("./cargar");

test("fechas AAAA-MM: sumar y restar meses cruzando el año", () => {
  const app = cargarDominio();
  assert.equal(app('ymAdd("2026-11", 3)'), "2027-02");
  assert.equal(app('ymAdd("2026-01", -1)'), "2025-12");
  assert.equal(app('ymDiff("2026-10", "2027-03")'), 5);
  assert.equal(app('ymDiff("2026-10", "2026-07")'), -3);
});

test("montos: lee el formato argentino (punto de miles, coma decimal)", () => {
  const app = cargarDominio();
  assert.equal(app('parseMonto("1.234,50")'), 1234.5);
  assert.equal(app('parseMonto("600.000")'), 600000);
  assert.equal(app('Number.isNaN(parseMonto(""))'), true);   // vacío = no es un número
  assert.equal(app('fmtMoneyStr("1234567")'), "1.234.567");
  assert.equal(app('fmtMoneyStr("1234,567")'), "1.234,56");
});

test("vigencias: un fijo que sube a mitad de año y después se da de baja", () => {
  const app = cargarDominio({ config: { ingresos: [], cuotas: [],
    fijos: [{ n: "Alquiler", cat: "Alquiler", hist: [{ d: "2026-01", m: 450000 }, { d: "2026-07", m: 520000 }, { d: "2026-11", m: 0 }] }] } });
  assert.equal(app('montoVigente(config.fijos[0].hist, "2025-12")'), 0);    // antes de empezar
  assert.equal(app('montoVigente(config.fijos[0].hist, "2026-06")'), 450000);
  assert.equal(app('montoVigente(config.fijos[0].hist, "2026-07")'), 520000); // el aumento
  assert.equal(app('montoVigente(config.fijos[0].hist, "2027-03")'), 0);     // dado de baja
  assert.equal(app('ocultoEnAjustes(config.fijos[0], "2026-12")'), true);
  assert.equal(app('ocultoEnAjustes(config.fijos[0], "2026-08")'), false);
});

test("ingreso de una sola vez: cuenta solo en su mes", () => {
  const app = cargarDominio({ config: { fijos: [], cuotas: [],
    ingresos: [{ n: "Aguinaldo", once: true, hist: [{ d: "2026-06", m: 750000 }, { d: "2026-12", m: 800000 }] }] } });
  assert.equal(app('montoIngresoMes(config.ingresos[0], "2026-06")'), 750000);
  assert.equal(app('montoIngresoMes(config.ingresos[0], "2026-07")'), 0);
  assert.equal(app('montoIngresoMes(config.ingresos[0], "2026-12")'), 800000);
});

test("cuotas: 6 cuotas desde septiembre van de sep a feb y se numeran bien", () => {
  const app = cargarDominio({ config: { ingresos: [], fijos: [],
    cuotas: [{ n: "Heladera", f: "Visa", cat: "Hogar", c: 1, t: 6, m: 100000, tot: 600000, d: "2026-09" }] } });
  assert.equal(app('computeMes("2026-08").tC'), 0);
  assert.equal(app('computeMes("2026-09").cuotas[0].nombre'), "Heladera 1/6");
  assert.equal(app('computeMes("2027-02").cuotas[0].nombre'), "Heladera 6/6");
  assert.equal(app('computeMes("2027-03").tC'), 0);
  assert.equal(app('computeMes("2026-10").cuotas[0].cat'), "Hogar");
});

test("cuotas: una compra que 'ya venía' (cuota 4 de 12 en octubre)", () => {
  const app = cargarDominio({ config: { ingresos: [], fijos: [],
    cuotas: [{ n: "Notebook", f: "Visa", c: 4, t: 12, m: 100000, tot: 1200000, d: "2026-10" }] } });
  assert.equal(app('computeMes("2026-10").cuotas[0].nombre'), "Notebook 4/12");
  assert.equal(app('computeMes("2027-06").cuotas[0].nombre'), "Notebook 12/12"); // última
  assert.equal(app('computeMes("2027-07").tC'), 0);
  assert.equal(app('computeMes("2026-10").cuotas[0].cat'), "Cuotas");  // sin categoría → "Cuotas"
});

test("computeMes: ingresos − fijos − cuotas − variables = saldo", () => {
  const app = cargarDominio({
    config: { ingresos: [{ n: "Sueldo", hist: [{ d: "2026-01", m: 1500000 }] }],
      fijos: [{ n: "Alquiler", cat: "Alquiler", hist: [{ d: "2026-01", m: 450000 }] }],
      cuotas: [{ n: "Heladera", f: "Visa", cat: "Hogar", c: 1, t: 6, m: 100000, d: "2026-10" }] },
    mov: [{ id: "a", fecha: "2026-10-03", monto: 20000, categoria: "Comida", medio: "Visa" },
          { id: "b", fecha: "2026-10-15", monto: 30000, categoria: "Comida", medio: "Débito" },
          { id: "c", fecha: "2026-09-30", monto: 99999, categoria: "Comida", medio: "Débito" }] });   // otro mes
  const c = app('computeMes("2026-10")');
  assert.equal(c.ingreso, 1500000);
  assert.equal(c.tF, 450000);
  assert.equal(c.tC, 100000);
  assert.equal(c.tV, 50000);
  assert.equal(c.saldo, 1500000 - 450000 - 100000 - 50000);
  assert.equal(c.variables[0].id, "b");   // ordenados del más nuevo al más viejo
});

test("comparación 'a la misma altura del mes': corta los variables del mes anterior en el día", () => {
  const app = cargarDominio({ config: { ingresos: [], cuotas: [],
      fijos: [{ n: "Netflix", cat: "Suscripciones", hist: [{ d: "2026-01", m: 12000 }] }] },
    mov: [{ id: "a", fecha: "2026-09-03", monto: 10000, categoria: "Comida", medio: "Visa" },
          { id: "b", fecha: "2026-09-20", monto: 40000, categoria: "Comida", medio: "Visa" }] });
  const hasta5 = app('gastosPorCat(computeMes("2026-09"), 5)');
  assert.equal(hasta5.map.Comida, 10000);           // el del 20 no entra
  assert.equal(hasta5.map.Suscripciones, 12000);    // los fijos van completos
  assert.equal(app('gastosPorCat(computeMes("2026-09"), null)').total, 62000);
});

test("variación %: sube = rojo, baja = verde, sin base = 'nuevo'", () => {
  const app = cargarDominio();
  assert.deepEqual(app("deltaGasto(110, 100)"), { t: "[arrUp]10%", cls: "up" });
  assert.deepEqual(app("deltaGasto(90, 100)"), { t: "[arrDown]10%", cls: "down" });
  assert.deepEqual(app("deltaGasto(100, 100)"), { t: "= igual", cls: "eq" });
  assert.deepEqual(app("deltaGasto(50, 0)"), { t: "nuevo", cls: "eq" });
  assert.equal(app("deltaGasto(0, 0)"), null);
});

test("proyección: estima variables con el promedio de los 3 meses cerrados que tienen datos", () => {
  const app = cargarDominio();
  const m1 = app("ymAdd(ymNow(), -1)"), m2 = app("ymAdd(ymNow(), -2)"), m4 = app("ymAdd(ymNow(), -4)");
  const app2 = cargarDominio({ mov: [
    { id: "1", fecha: m1 + "-10", monto: 300000, categoria: "Comida", medio: "Visa" },
    { id: "2", fecha: m2 + "-10", monto: 100000, categoria: "Comida", medio: "Visa" },
    { id: "3", fecha: m4 + "-10", monto: 999999, categoria: "Comida", medio: "Visa" } ] }); // fuera de la ventana
  assert.deepEqual(app2("estimarVariables()"), { est: 200000, n: 2 });
});

test("backups viejos: se migran al formato actual sin perder nada", () => {
  const app = cargarDominio({ config: { sueldo: 900000, desde: "2025-03",
    fijos: [{ n: "Asado", cat: "Salidas/Asados", m: 15000 }],
    cuotas: [{ n: "Tele", f: "Visa", c: 1, t: 3, m: 50000 }] } });
  const c = app("config");
  assert.deepEqual(c.ingresos[0].hist, [{ d: "2025-03", m: 900000, n: "Sueldo" }]);
  assert.equal(c.sueldo, undefined);
  assert.equal(c.fijos[0].cat, "Salidas/Comidas");         // categoría renombrada
  assert.equal(c.fijos[0].hist[0].m, 15000);               // monto suelto → historial
  assert.equal(c.cuotas[0].tot, 150000);                   // total reconstruido
  assert.deepEqual(c.presu, {});                           // presupuestos vacíos
});

test("cache de cálculos: después de invalidar, refleja los cambios", () => {
  const app = cargarDominio({ config: { ingresos: [], fijos: [], cuotas: [] },
    mov: [{ id: "a", fecha: "2026-10-01", monto: 1000, categoria: "Comida", medio: "Visa" }] });
  assert.equal(app('computeMes("2026-10").tV'), 1000);
  app('mov.push({id:"b", fecha:"2026-10-02", monto:500, categoria:"Comida", medio:"Visa"})');
  assert.equal(app('computeMes("2026-10").tV'), 1000);     // todavía cacheado
  app("invalidarCalc()");
  assert.equal(app('computeMes("2026-10").tV'), 1500);
});

test("cuotas en Plan: primero las que terminan antes; las que no empezaron, al final", () => {
  const app = cargarDominio({ config: { ingresos: [], fijos: [], cuotas: [
    { n: "Larga",    f: "Visa", c: 1, t: 12, m: 1, d: "2026-10" },   // termina sep 27
    { n: "Futura",   f: "Visa", c: 1, t: 3,  m: 1, d: "2026-12" },   // empieza en diciembre
    { n: "Corta",    f: "Visa", c: 2, t: 3,  m: 1, d: "2026-10" },   // termina nov 26
    { n: "Última",   f: "Visa", c: 6, t: 6,  m: 1, d: "2026-10" } ] } });  // termina este mes
  assert.equal(app('finCuota(config.cuotas[0])'), "2027-09");
  assert.equal(app('finCuota(config.cuotas[3])'), "2026-10");
  assert.deepEqual(app('ordenarCuotas([0,1,2,3], "2026-10").map(i => config.cuotas[i].n)'), ["Última", "Corta", "Larga", "Futura"]);
});
