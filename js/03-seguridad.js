/* ===== Tu Contador — js/03-seguridad.js =====
   Bloqueo con PIN y Face ID / Touch ID.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

/* ===== Bloqueo con PIN / biometría (local al dispositivo) =====
   Guardamos solo un hash SHA-256 (con salt) del PIN, nunca el PIN en texto plano.
   La biometría (Face ID / Touch ID) usa WebAuthn con un autenticador de plataforma:
   no hay servidor, así que no verificamos firma contra una clave pública — solo
   confiamos en que navigator.credentials.get() resuelva sin error, que es la señal
   de que el sistema operativo validó al usuario. Es una capa de conveniencia local,
   no un protocolo de autenticación remota. */
const LKEY = "misGastosApp.lock.v1";
let lock = load(LKEY, {enabled:false, salt:null, hash:null, cred:null});
function bytesToHex(buf){ return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join(""); }
function randomHex(n){ const a=new Uint8Array(n); crypto.getRandomValues(a); return bytesToHex(a); }
async function sha256Hex(str){ const buf=await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)); return bytesToHex(buf); }
async function setPin(pin){ const salt=randomHex(16); const hash=await sha256Hex(salt+":"+pin); lock.enabled=true; lock.salt=salt; lock.hash=hash; save(LKEY,lock); }
async function checkPin(pin){ if(!lock.hash||!lock.salt) return false; return (await sha256Hex(lock.salt+":"+pin))===lock.hash; }
function desactivarLock(){ lock={enabled:false,salt:null,hash:null,cred:null}; save(LKEY,lock); }
async function registrarBiometria(){
  if(!window.PublicKeyCredential) return false;
  try{
    const disp = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if(!disp) return false;
    const userId=new Uint8Array(16); crypto.getRandomValues(userId);
    const challenge=new Uint8Array(32); crypto.getRandomValues(challenge);
    const cred=await navigator.credentials.create({ publicKey:{
      challenge, rp:{name:"Mis Gastos"},
      user:{ id:userId, name:"mis-gastos", displayName:"Mis Gastos" },
      pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
      authenticatorSelection:{ authenticatorAttachment:"platform", userVerification:"required" },
      timeout:60000
    }});
    if(!cred) return false;
    lock.cred=btoa(String.fromCharCode(...new Uint8Array(cred.rawId))); save(LKEY,lock);
    return true;
  }catch(e){ return false; }
}
async function autenticarBiometria(){
  if(!(lock.cred && window.PublicKeyCredential)) return false;
  try{
    const challenge=new Uint8Array(32); crypto.getRandomValues(challenge);
    const idBytes=Uint8Array.from(atob(lock.cred), c=>c.charCodeAt(0));
    const ases=await navigator.credentials.get({ publicKey:{
      challenge, allowCredentials:[{id:idBytes,type:"public-key"}], userVerification:"required", timeout:60000
    }});
    return !!ases;
  }catch(e){ return false; }
}
/* Teclado numérico reutilizable (pantalla de bloqueo + modal de PIN). */
function pinPadHTML(){
  return ["1","2","3","4","5","6","7","8","9","","0","del"].map(k=>{
    if(k==="") return `<div></div>`;
    if(k==="del") return `<button type="button" class="pinkey ghost" data-pinkey="del" aria-label="Borrar"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="width:22px;height:22px"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg></button>`;
    return `<button type="button" class="pinkey" data-pinkey="${k}">${k}</button>`;
  }).join("");
}
function setupPinEntry(padEl, dotsEl, errEl, len, onComplete){
  let buf="";
  const pintar=()=>{ dotsEl.innerHTML=Array.from({length:len}).map((_,i)=>`<div class="pindot${i<buf.length?' filled':''}"></div>`).join(""); };
  const reset=(msg)=>{ buf=""; pintar(); if(errEl) errEl.textContent=msg||""; };
  padEl.innerHTML=pinPadHTML();
  padEl.querySelectorAll("[data-pinkey]").forEach(b=>{ b.onclick=()=>{
    const k=b.dataset.pinkey;
    if(k==="del"){ buf=buf.slice(0,-1); pintar(); return; }
    if(buf.length>=len) return;
    buf+=k; pintar();
    if(buf.length===len){ const val=buf; buf=""; setTimeout(()=>onComplete(val,reset),60); }
  }; });
  pintar();
  return { reset };
}
