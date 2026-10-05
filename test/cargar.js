/* Carga js/01-dominio.js TAL CUAL lo usa la app, en un entorno aislado de Node.
   Cada test arma su propio "config" y "mov" con datos chicos y conocidos. */
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function cargarDominio({ config, mov } = {}) {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "01-dominio.js"), "utf8"), ctx);
  // Lo que en la app viene de otros archivos: los datos y el dibujo de íconos.
  vm.runInContext("let config = SEED(); let mov = []; function ic(k){ return '[' + k + ']'; }", ctx);
  const app = (codigo) => vm.runInContext(codigo, ctx);
  ctx.__config = config; ctx.__mov = mov;
  if (config) app("config = normConfig(__config)");
  if (mov) app("mov = normMov(__mov)");
  app("invalidarCalc()");
  // Los objetos vienen de otro "mundo" de JS: los paso por JSON para compararlos tranquilo.
  return (codigo) => JSON.parse(JSON.stringify(app(codigo) ?? null));
}
module.exports = { cargarDominio };
