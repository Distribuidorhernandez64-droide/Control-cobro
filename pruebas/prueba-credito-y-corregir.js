const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8875);
const FAKE=`window.supabase={createClient:()=>({from(){const a={select:()=>a,eq:()=>a,order:()=>a,limit:()=>a,
maybeSingle:()=>Promise.resolve({data:null,error:null}),then:r=>Promise.resolve({data:[],error:null}).then(r),
upsert:()=>Promise.resolve({error:null}),insert:()=>Promise.resolve({error:null})};return a;}})};`;
const UA_IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,hasTouch:true,isMobile:true,userAgent:UA_IPHONE});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8875/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 await p.evaluate(()=>{window._clip='';navigator.clipboard.writeText=t=>{window._clip=t;return Promise.resolve();};});
 const ids=await p.evaluate(()=>{
   ruteros=['Prueba'];const h=m=>new Date(Date.now()-m*60000).toISOString();
   const ped=(n,m)=>({id:nuevoId(),nombre:n,total:m,estado:'pagado',devolucion:0,descuento:0,vuelto:0});
   const A={id:nuevoId(),uid:uid(),rutero:'Prueba',pedidos:[ped('Credito 1',500),ped('Juan',100)],cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:h(30),envases:'',envOk:false,mod:1};
   viajes=[A];selRutero='Prueba';vistaDetalle=true;renderZona();
   return {vid:A.id,pid:A.pedidos[0].id};});
 // ---- 1) Crédito con abono ----
 await p.tap(`#viaje-${ids.vid} .ped >> nth=0`);await p.waitForTimeout(250);
 await p.tap(`#pb-${ids.vid}-${ids.pid} .chip:has-text("Crédito")`);await p.waitForTimeout(250);
 const inp=p.locator(`#pb-${ids.vid}-${ids.pid} input`);
 ok('Al marcar Crédito aparece "Pagó en efectivo"', await inp.count()===1);
 await inp.fill('200');await inp.press('Tab');await p.waitForTimeout(250);
 let t=await p.evaluate(a=>[document.getElementById('ef-'+a.vid+'-'+a.pid).textContent,document.getElementById('cr-'+a.vid+'-'+a.pid).textContent],ids);
 ok('Recibido Q200 y queda a crédito Q300 '+t, t[0]==='Q200.00'&&t[1]==='Q300.00');
 await p.screenshot({path:'credito-1.png'});
 await p.evaluate(a=>cerrarPed(a.vid,a.pid),ids);await p.waitForTimeout(200);
 t=await p.evaluate(a=>[efectivoViaje(viajes[0]),document.querySelector(`#viaje-${a.vid} .ped`).innerText.replace(/\s+/g,' ')],ids);
 ok('Efectivo del viaje = 200 + 100 '+t[0], t[0]===300);
 ok('La fila dice pagó Q200 y Q300 a crédito ('+t[1]+')', /pagó Q200/.test(t[1])&&/Q300\.00/.test(t[1]));
 await p.evaluate(async a=>{await confirmarRecibido(a.vid,'César');},ids);await p.waitForTimeout(300);
 t=await p.evaluate(()=>[document.getElementById('tEfectivo').textContent,document.getElementById('daySub').innerText]);
 ok('Efectivo del día Q300 y crédito Q300 ('+t.join(' | ').replace(/\n/g,' ')+')', t[0]==='Q300.00'&&/Crédito Q300\.00/.test(t[1]));
 await p.evaluate(()=>copiarReporteUnico());await p.waitForTimeout(200);
 const clip=await p.evaluate(()=>window._clip);
 ok('Reporte: "Credito 1: Q500.00 → Q200.00 (queda a crédito Q300.00)"', clip.includes('Credito 1: Q500.00 → Q200.00 (queda a crédito Q300.00)'));
 ok('Reporte: recibido en efectivo Q300 y pendiente a crédito Q300', clip.includes('Recibido en efectivo: Q300.00')&&clip.includes('• Credito 1 (Prueba): Q300.00'));
 await p.evaluate(()=>{abrirAuditoria();});await p.waitForTimeout(300);
 const rep=await p.evaluate(()=>document.getElementById("sheet").innerText);
 await p.screenshot({path:'credito-rep.png',fullPage:false});ok('Reporte en pantalla cuadra (A crédito Q300, efectivo Q300)', /A crédito\s*Q300\.00/.test(rep)&&/Efectivo recibido\s*Q300\.00/.test(rep));
 await p.evaluate(()=>cerrarReporte());
 // ---- 2) Corregir nombre y monto (ruta reabierta y en corrección) ----
 const hr=await p.evaluate(a=>{const v=viajes[0];return v.horaRecibido;},ids);
 await p.evaluate(async a=>{await reabrir(a.vid);reabrirEntrada(a.vid);},ids);await p.waitForTimeout(300);
 const salAntes=await p.evaluate(()=>viajes[0].horaSalida);
 await p.tap(`#viaje-${ids.vid} .ped >> nth=1 >> .pn`);await p.waitForTimeout(250);
 ok('Tocar el nombre abre "Cambiar nombre"', await p.locator('#modalRecibe.open:has-text("Cambiar nombre")').count()===1);
 await p.fill('#edPed','Juan Pérez');await p.tap('#modalRecibe button:has-text("Guardar")');await p.waitForTimeout(250);
 ok('Nombre cambiado', await p.evaluate(()=>viajes[0].pedidos[1].nombre)==='Juan Pérez');
 await p.tap(`#viaje-${ids.vid} .ped >> nth=1 >> .pm`);await p.waitForTimeout(250);
 ok('Tocar el monto abre "Cambiar monto"', await p.locator('#modalRecibe.open:has-text("Cambiar monto")').count()===1);
 await p.fill('#edPed','150');await p.tap('#modalRecibe button:has-text("Guardar")');await p.waitForTimeout(250);
 ok('Monto cambiado a 150', await p.evaluate(()=>viajes[0].pedidos[1].total)===150);
 const pid2=await p.evaluate(()=>viajes[0].pedidos[1].id);
 await p.tap(`#viaje-${ids.vid} .ped >> nth=1`,{position:{x:200,y:20}});await p.waitForTimeout(250);
 ok('Tocar el medio abre las opciones (crédito, etc.)', await p.evaluate(a=>document.getElementById('pb-'+a.vid+'-'+a.pid2).classList.contains('open'),{...ids,pid2}));
 ok('Quedó registrado en movimientos', await p.evaluate(()=>auditoria.some(a=>a.accion==='CAMBIÓ NOMBRE')&&auditoria.some(a=>a.accion==='CAMBIÓ MONTO')));
 await p.screenshot({path:'credito-2.png'});
 // ---- 3) Horarios ----
 await p.evaluate(async a=>{await terminarPedidos(a.vid);},ids);await p.waitForTimeout(200);
 ok('Salió hace 30 min: al reenviar se respeta la hora de salida', await p.evaluate(()=>viajes[0].horaSalida)===salAntes);
 await p.evaluate(async a=>{await confirmarRecibido(a.vid,'César');},ids);await p.waitForTimeout(200);
 ok('Al recibir de nuevo se respeta la hora de regreso', await p.evaluate(()=>viajes[0].horaRecibido)===hr);
 const r3=await p.evaluate(async()=>{const v={id:nuevoId(),uid:uid(),rutero:'Prueba',pedidos:[{id:nuevoId(),nombre:'X',total:10,estado:'pagado'}],cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:new Date(Date.now()-2*60000).toISOString(),envases:'',mod:1};
   viajes.push(v);const antes=v.horaSalida;reabrirEntrada(v.id);await terminarPedidos(v.id);return v.horaSalida!==antes && Date.now()-new Date(v.horaSalida)<5000;});
 ok('Salió hace 2 min: al reenviar la salida arranca de nuevo', r3);
 console.log(errs.length?errs:'Sin errores de JavaScript');console.log(fail?fail+' FALLARON':'Todas pasaron');await b.close();srv.close();})();
