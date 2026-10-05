/* ===== Tu Contador — js/17-ios-altura.js =====
   Alto real de la pantalla en iPhone con la app instalada (solo iOS). */
(function(){
  var sa = (window.navigator.standalone===true) ||
           (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  /* Lo recalculamos acá en vez de leer la clase del <head>: si por lo que sea aquel script no
     corrió, NO queremos que iOS se quede sin su parche de altura. Cero acoplamiento. */
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  /* ¡OJO! Todo lo que sigue es un parche EXCLUSIVO de iOS instalado. En iOS, innerHeight viene
     corto y hay que forzar el alto con screen.height. En Android pasa lo contrario: innerHeight
     es correcto y screen.height incluye la barra de estado + la barra de navegación del sistema.
     Aplicarlo ahí estiraba el body ~60-140px POR DEBAJO de lo visible y se llevaba la bottomnav
     fuera de pantalla (y como maxSaH nunca achica, quedaba roto para siempre). Por eso: solo iOS. */
  if(!(sa && isIOS)) return;
  document.documentElement.classList.add('sa');
  var maxSaH = 0;
  function setH(){
    // En este iOS innerHeight viene corto (le descuenta la barra de estado) aunque el webview
    // es full-screen. screen.height sí conoce la pantalla real. Usamos screenH y le restamos lo
    // que iOS reserva arriba (safe-area-inset-top), medido con una sonda, para no meter el
    // contenido bajo la isla. Nos quedamos con el mayor entre eso e innerHeight por las dudas.
    var probe=document.createElement('div');
    probe.style.cssText='position:fixed;top:0;left:0;width:0;visibility:hidden;height:env(safe-area-inset-top)';
    document.body.appendChild(probe);
    var top=Math.round(probe.getBoundingClientRect().height); probe.remove();
    var real=(window.screen && window.screen.height ? window.screen.height : window.innerHeight) - top;
    var h=Math.max(window.innerHeight, real) + 6;
    // Nunca achicar: nos quedamos con el máximo visto. Así la barra baja a lo más bajo y no
    // "rebota" hacia arriba cuando iOS reporta un alto menor en alguna re-medida.
    if(h>maxSaH) maxSaH=h;
    document.documentElement.style.setProperty('--saH', maxSaH + 'px');
  }
  setH();
  // iOS a veces reporta mal el alto en el primer paint y lo corrige un toque después:
  [60,200,500,1000].forEach(function(t){ setTimeout(setH,t); });
  window.addEventListener('resize', setH);
  window.addEventListener('orientationchange', function(){ maxSaH=0; setTimeout(setH,300); });
})();
