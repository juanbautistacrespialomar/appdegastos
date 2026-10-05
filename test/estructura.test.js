/* Controles de estructura: que index.html, los archivos y el service worker estén en sintonía.
   Son los errores típicos al subir a mano: un archivo que falta o una versión sin actualizar. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const version = (html.match(/const APP_VERSION = "([^"]+)"/) || [])[1];
const assets = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)\?v=([^"]+)"/g)].map(m => ({ archivo: m[1], v: m[2] }));

test("index.html declara APP_VERSION", () => { assert.ok(version, "falta const APP_VERSION en index.html"); });

test("todos los ?v= coinciden con APP_VERSION", () => {
  const mal = assets.filter(a => a.v !== version).map(a => `${a.archivo}?v=${a.v}`);
  assert.deepEqual(mal, [], `cambiá estos ?v= a ${version}`);
});

test("existe cada archivo que pide index.html", () => {
  const faltan = assets.filter(a => !fs.existsSync(path.join(raiz, a.archivo))).map(a => a.archivo);
  assert.deepEqual(faltan, [], "faltan subir estos archivos");
});

test("index.html carga TODOS los archivos de js/ (no queda ninguno huérfano)", () => {
  const pedidos = new Set(assets.map(a => a.archivo));
  const huerfanos = fs.readdirSync(path.join(raiz, "js")).filter(f => f.endsWith(".js")).map(f => "js/" + f).filter(f => !pedidos.has(f));
  assert.deepEqual(huerfanos, []);
});

test("los js se cargan en orden numérico", () => {
  const js = assets.filter(a => a.archivo.startsWith("js/")).map(a => a.archivo);
  assert.deepEqual(js, [...js].sort());
});

test("hay novedades para la versión actual", () => {
  const nov = JSON.parse((html.match(/<script type="application\/json" id="novedades">([\s\S]*?)<\/script>/) || [])[1] || "{}");
  assert.ok(Array.isArray(nov[version]) && nov[version].length, `agregá las novedades de la ${version}`);
});

test("el service worker precachea las fuentes que existen", () => {
  const sw = fs.readFileSync(path.join(raiz, "sw.js"), "utf8");
  const fuentes = [...sw.matchAll(/"\.\/(fonts\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(fuentes.length >= 2);
  fuentes.forEach(f => assert.ok(fs.existsSync(path.join(raiz, f)), "falta " + f));
});

test("ningún archivo JS tiene errores de sintaxis", () => {
  const vm = require("node:vm");
  fs.readdirSync(path.join(raiz, "js")).filter(f => f.endsWith(".js")).forEach(f => {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(raiz, "js", f), "utf8"), { filename: f }), f);
  });
});

test("las rutas url(...) del CSS apuntan a archivos que existen", () => {
  // Las rutas dentro de css/app.css son relativas a la carpeta css/ (por eso "../fonts/...").
  const css = fs.readFileSync(path.join(raiz, "css", "app.css"), "utf8");
  const urls = [...css.matchAll(/url\("?([^")]+)"?\)/g)].map(m => m[1]).filter(u => !u.startsWith("data:"));
  const faltan = urls.filter(u => !fs.existsSync(path.join(raiz, "css", u)));
  assert.deepEqual(faltan, [], "estas rutas del CSS no existen");
});
