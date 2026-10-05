/* ===== Tu Contador — js/08-ajustes.js =====
   Pestaña Ajustes: recordatorios, seguridad, backup, Excel y borrar todo.
   Todos los archivos comparten el mismo alcance global y se cargan EN ORDEN (ver index.html). */
"use strict";

// Ajustes = solo configuración de la app (v7.1). Ingresos, fijos, cuotas y presupuestos
// se cargan y editan en Plan.
function renderAjustes(){
    $("content").innerHTML =
    `<div class="panel"><p class="ptitle">${ic('bell')} Recordatorios</p>
       <label class="chk"><input type="checkbox" id="pushToggle" ${pushPrefs.enabled?"checked":""}> Activar recordatorios diarios</label>
       <p style="font-size:11px;color:var(--muted);margin:8px 0 0">Te avisa si hace días que no cargás nada o si algo llama la atención en tus gastos del mes. Solo se sincronizan totales (nunca el detalle de tus movimientos).</p></div>
     <div class="panel"><p class="ptitle">${ic('shield')} Seguridad</p>
       <label class="chk" style="margin-bottom:${lock.enabled?'10px':'0'}"><input type="checkbox" id="lockToggle" ${lock.enabled?"checked":""}> Bloquear la app con PIN al abrirla</label>
       ${lock.enabled?`
       <div id="lockBioRow" style="display:none;margin:6px 0 10px">
         <label class="chk"><input type="checkbox" id="lockBioToggle" ${lock.cred?"checked":""}> Usar también Face ID / Touch ID</label>
       </div>
       <button class="btn btn-ghost" id="lockChangeBtn">Cambiar PIN</button>`:""}
       <p style="font-size:11px;color:var(--muted);margin:8px 0 0">El bloqueo protege el acceso desde este dispositivo. No cifra el archivo de backup que descargás.</p></div>
     <div class="panel"><p class="ptitle">${ic('db')} Datos y backup</p>
       <button class="btn btn-ghost" id="backup" style="margin-bottom:8px">${ic('down')} Descargar backup (todo)</button>
       <button class="btn btn-ghost" id="exportXls" style="margin-bottom:8px">${ic('sheet')} Descargar Excel (todos los meses)</button>
       <button class="btn btn-ghost" id="importBtn" style="margin-bottom:8px">${ic('up')} Restaurar desde backup</button>
       <input type="file" id="importFile" accept="application/json,.json" style="display:none">
       <button class="btn btn-ghost danger" id="reset">${ic('reset')} Borrar todo y empezar de cero</button>
       <p style="font-size:11px;color:var(--muted);margin:8px 0 0">El backup guarda TODO en un archivo. Hacelo cada tanto, por las dudas.</p></div>`;
  const on = (id, fn, ev) => { const el=$(id); if(el) el[ev||"onclick"]=fn; };
  on("reset", ()=>{
    confirmar(
      "Borrar todo y empezar de cero",
      "Vas a borrar TODOS tus datos: ingresos, gastos fijos, cuotas y movimientos. Esta acción no se puede deshacer. Si querés guardar una copia antes, cancelá y tocá «Descargar backup».",
      ()=>{ config=SEED(); mov=MOV_SEED(); persistC(); persistM(); mesActivo=ymNow(); colapsado={}; colCuotas={}; catExpand=false; render(); toast("Datos borrados ✓"); },
      "Sí, borrar todo", true
    );
  });
  on("backup", ()=>{
    const data={ app:"MisGastos", fecha:new Date().toISOString(), config, mov };
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    a.download="backup_misgastos_"+hoy()+".json"; a.click(); URL.revokeObjectURL(a.href);
  });
  on("exportXls", exportarExcel);
  on("importBtn", ()=>$("importFile").click());
  on("importFile", (e)=>{
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=()=>{ try{ const d=JSON.parse(r.result);
        if(!d.config||!Array.isArray(d.mov)) throw new Error("formato");
        if(confirm("Esto va a reemplazar TODOS los datos actuales por los del backup. ¿Seguir?")){
          config=normConfig(d.config); mov=normMov(d.mov); persistC(); persistM(); render(); alert("Backup restaurado ✓");
        }
      }catch(err){ alert("No pude leer el archivo. ¿Es un backup válido?"); }
      e.target.value=""; };
    r.readAsText(file);
  }, "onchange");

  /* ===== Recordatorios: activar/desactivar push ===== */
  const pushToggle=$("pushToggle");
  if(pushToggle){
    pushToggle.onchange=async ()=>{
      if(pushToggle.checked){
        pushToggle.checked=false;
        const ok=await activarRecordatorios();
        if(ok){ pushToggle.checked=true; toast("Recordatorios activados ✓"); }
        else alert("No se pudo activar.\n\nMotivo: " + (activarRecordatorios._ultimoError || "desconocido") + "\n\nMandale este texto a Claude para diagnosticar.");
      } else {
        await desactivarRecordatorios();
        toast("Recordatorios desactivados");
      }
    };
  }

  /* ===== Seguridad: activar/desactivar PIN, cambiarlo, y togglear biometría ===== */
  const lockToggle=$("lockToggle");
  if(lockToggle){
    lockToggle.onchange=()=>{
      if(lockToggle.checked){
        lockToggle.checked=false; // se confirma recién cuando termina el alta del PIN
        pedirPinNuevo(()=>{ toast("Bloqueo activado ✓"); render(); });
      } else {
        lockToggle.checked=true; // se confirma recién si el PIN actual es correcto
        pedirPinActual("Ingresá tu PIN para desactivar el bloqueo", ()=>{ desactivarLock(); toast("Bloqueo desactivado"); render(); });
      }
    };
  }
  const lockChangeBtn=$("lockChangeBtn");
  if(lockChangeBtn) lockChangeBtn.onclick=()=>{
    pedirPinActual("Ingresá tu PIN actual", ()=>{ pedirPinNuevo(()=>{ toast("PIN actualizado ✓"); render(); }); });
  };
  const lockBioToggle=$("lockBioToggle");
  if(lockBioToggle){
    lockBioToggle.onchange=async ()=>{
      if(lockBioToggle.checked){
        const ok=await registrarBiometria();
        if(!ok){ lockBioToggle.checked=false; alert("No se pudo activar Face ID / Touch ID en este dispositivo."); }
        else toast("Face ID / Touch ID activado ✓");
      } else { lock.cred=null; save(LKEY,lock); toast("Face ID / Touch ID desactivado"); }
    };
    if(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(disp=>{
        const row=$("lockBioRow"); if(row) row.style.display = disp ? "" : "none";
      });
    }
  }
}
