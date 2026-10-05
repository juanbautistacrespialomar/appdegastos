/* ===== Tu Contador — js/16-pwa.js =====
   Registro del Service Worker y botón "Instalar" (Android/Chrome). */
"use strict";
/* ===== PWA: registro del Service Worker + prompt de instalación ===== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(err => console.warn("SW no registrado:", err));
  });
}

let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");

// El navegador dispara esto solo si la app es instalable (HTTPS + manifest + SW)
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();            // evitamos el mini-infobar automático
  deferredPrompt = e;            // guardamos el evento para dispararlo nosotros
  if (installBtn) installBtn.style.display = "inline-flex";
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = "none";
  });
}

// Si ya quedó instalada, escondemos el botón
window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.style.display = "none";
  deferredPrompt = null;
});
