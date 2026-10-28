// Prueba de devoluciones desde Monica y notas que regresan sin entregar con la librería real de Supabase contra una base local
// (Postgres + PostgREST con supabase/pendientes_entrega.sql cargado, escuchando en 127.0.0.1:3301/rest/v1,
// y el token de rol 'anon' en /var/tmp/anon.jwt). Las capturas quedan en pruebas/capturas/.
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const UMD=fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'),'utf8');
const JWT=fs.readFileSync('/var/tmp/anon.jwt','utf8').trim();
const LOCAL='http://127.0.0.1:3301';
const SHOTS=path.join(__dirname,'capturas');
fs.mkdirSync(SHOTS,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'')||'control-cobro-app.html');
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
  r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8898);
const sql=s=>execSync(`psql -h /var/tmp/pgtest -p 55432 -U postgres -At -c "${s.replace(/"/g,'\\"')}"`,{encoding:'utf8'}).trim();
async function rest(metodo,ruta,cuerpo,prefer){
  const r=await fetch(LOCAL+'/rest/v1/'+ruta,{method:metodo,headers:{apikey:JWT,Authorization:'Bearer '+JWT,'Content-Type':'application/json',Prefer:prefer||'return=representation'},body:cuerpo?JSON.stringify(cuerpo):undefined});
  const t=await r.text();return {status:r.status,data:t?JSON.parse(t):null};
}
const CAJA=q=>({n:'cajas',u:'caja',v:'cajas',q}), CIL25=q=>({n:'cil25',u:'cilindro 25lb',v:'cilindros 25lb',q});
const fila=(nro,cliente,vend,vid,total,hora,cod,envases)=>({nro,fecha:'2026-10-24',hora,cliente,codigo_cliente:cod,vendedor:vend,vendedor_id:vid,total,lineas:4,envases:envases||[]});
let fallas=0;const ok=(n,c)=>{console.log((c?'✅ ':'❌ ')+n);if(!c)fallas++;};


const L=(c,d,q,p,x)=>({c,d,q,p,x:x||0,m:''});
const D1=[L('400','tiky jumbo 3lt 6ud',1,92),L('087','Tampico 3.3lt 6ud',0.5,79),L('7508','anillos papa 12un',2,16)]; // 92+39.5+32 = 163.50
const D2=[L('05','PEPSI 2LT',4,25)];      // 100
const D3=[L('09','GALLETA',1,50)];        // 50
const hoy=new Date().toLocaleDateString('en-CA');
const nota=(nro,cliente,total,hora,det)=>({nro,fecha:hoy,hora,cliente,codigo_cliente:'10',vendedor:'brenda (pueblo)',vendedor_id:42,total,lineas:det.length,envases:[],detalle:det});
(async()=>{
  sql('truncate pendientes_entrega; truncate puente; truncate dias; truncate respaldos;');
  await rest('POST','pendientes_entrega',[nota(21901,'TIENDA ROSA',163.5,'08:00',D1),nota(21902,'TIENDA SOL',100,'08:05',D2),nota(21903,'TIENDA LUNA',50,'08:10',D3),nota(21904,'TIENDA NUEVA',75,'08:20',[L('09','GALLETA',1.5,50)])]);
  await rest('POST','puente?on_conflict=id',[{id:'facturacion',latido:1}],'resolution=merge-duplicates,return=minimal');
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:UMD}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.route('https://shlolncjhfzqmcllwjrk.supabase.co/**',async r=>{
    const u=r.request().url().replace('https://shlolncjhfzqmcllwjrk.supabase.co',LOCAL);
    const h={...r.request().headers(),authorization:'Bearer '+JWT,apikey:JWT};
    const res=await r.fetch({url:u,headers:h});await r.fulfill({response:res});
  });
  await p.goto('http://localhost:8898/control-cobro-app.html',{waitUntil:'networkidle'});
  await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');await p.click('#loginScreen button');
  await p.waitForTimeout(1500);
  const recargar=async()=>{await rest('POST','puente?on_conflict=id',[{id:'facturacion',latido:Date.now()%100000}],'resolution=merge-duplicates,return=minimal');await p.evaluate(()=>peCargar());await p.waitForTimeout(1300);};
  const ped=async nro=>p.evaluate(n=>{for(const v of viajes)for(const x of (v.pedidos||[]))if(x.fac===n&&!x.facReg)return {...x,efectivo:efectivoDe(x)};return null;},nro);
  const fila=async nro=>(await rest('GET','pendientes_entrega?select=*&nro=eq.'+nro)).data[0];

  // Gerson se lleva 21901, 21902 y 21903; sale la ruta
  await p.evaluate(()=>{PE.sel=new Set([21901,21902,21903]);return peAsignar('Gerson');});await p.waitForTimeout(1500);
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');return terminarPedidos(v.id);});await p.waitForTimeout(2500);
  let db=(await rest('GET','pendientes_entrega?select=nro,estado&order=nro')).data;
  ok('Salió la ruta de Gerson con las 3 notas', db.filter(f=>f.estado==='enviada').length===3);
  const vG=await p.evaluate(()=>viajes.find(x=>x.rutero==='Gerson').id);

  // ---- 1) Devolución: en Monica bajan 1/2 caja de Tiky (Q46.00) ----
  await rest('PATCH','pendientes_entrega?nro=eq.21901',{monica_cambio:true,monica_total:117.5,monica_detalle:[L('400','tiky jumbo 3lt 6ud',0.5,92),L('087','Tampico 3.3lt 6ud',0.5,79),L('7508','anillos papa 12un',2,16)]});
  await recargar();
  let x=await ped(21901);
  ok('Devolución automática: −Q46.00 en "Devolución"', x.devolucion===46&&x.devMon===46);
  ok('Se cobra Q117.50 (lo mismo que Monica ahora)', Math.abs(x.efectivo-117.5)<0.001);
  ok('Lo que salió sigue igual (Q163.50)', x.total===163.5);
  await p.evaluate(()=>entrarVendedor('Gerson'));await p.waitForTimeout(500);
  let z=await p.textContent('#zona');
  ok('El pedido dice "devolución" y cuánto ya se descontó', z.includes('devolución Q46.00')&&z.includes('Devolución de Monica ya descontada'));
  ok('El viaje muestra "1 cambió en Monica · devolución −Q46.00"', z.includes('1 cambió en Monica · devolución −Q46.00'));
  await p.screenshot({path:SHOTS+'/d1-viaje-devolucion.png'});
  await p.click('.pe-vercam');await p.waitForTimeout(400);
  let m=await p.textContent('#modalRecibeBody');
  ok('"Ver qué cambió": producto, cantidad y monto devuelto', m.includes('Devolvió')&&m.includes('−0.5')&&m.includes('tiky jumbo 3lt 6ud')&&m.includes('−Q46.00'));
  ok('"Ver qué cambió": salió / Monica ahora / se cobra', m.includes('Salió')&&m.includes('Q163.50')&&m.includes('Monica ahora')&&m.includes('Se cobra')&&m.includes('Q117.50')&&m.includes('Gerson'));
  await p.screenshot({path:SHOTS+'/d2-ver-que-cambio.png'});
  await p.evaluate(()=>cerrarModalRecibe());
  await p.evaluate(()=>volverLista());await p.waitForTimeout(300);
  ok('En la lista de ruteros: "1 cambió en Monica · devolución −Q46.00"', (await p.textContent('#zona')).includes('1 cambió en Monica · devolución −Q46.00'));
  await p.screenshot({path:SHOTS+'/d3-lista-ruteros.png'});

  // Monica cambia otra vez: quitan también los anillos (Q32) -> la devolución se ajusta a Q78 (no se suma dos veces)
  await rest('PATCH','pendientes_entrega?nro=eq.21901',{monica_total:85.5,monica_detalle:[L('400','tiky jumbo 3lt 6ud',0.5,92),L('087','Tampico 3.3lt 6ud',0.5,79)]});
  await recargar();x=await ped(21901);
  ok('Si cambian otra vez, se ajusta: devolución Q78.00 (46 + 32), se cobra Q85.50', x.devolucion===78&&x.devMon===78&&Math.abs(x.efectivo-85.5)<0.001);
  // Alguien escribe a mano Q5 más de devolución; luego en Monica regresan los anillos -> se respeta lo escrito a mano
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');const pp=v.pedidos.find(x=>x.fac===21901);setAj(v.id,pp.id,'devolucion','83');});
  await rest('PATCH','pendientes_entrega?nro=eq.21901',{monica_total:117.5,monica_detalle:[L('400','tiky jumbo 3lt 6ud',0.5,92),L('087','Tampico 3.3lt 6ud',0.5,79),L('7508','anillos papa 12un',2,16)]});
  await recargar();x=await ped(21901);
  ok('Lo escrito a mano se respeta: 83 − 78 + 46 = Q51.00', x.devolucion===51&&x.devMon===46);
  const aud=await p.evaluate(()=>auditoria.filter(a=>a.accion==='DEVOLUCIÓN DESDE MONICA').length);
  ok('Queda en el historial cada devolución que puso el sistema', aud===3);

  // ---- 2) Solo cambió el precio: NO se descuenta nada, solo aviso ----
  await rest('PATCH','pendientes_entrega?nro=eq.21902',{monica_cambio:true,monica_total:96,monica_detalle:[L('05','PEPSI 2LT',4,24)]});
  await recargar();x=await ped(21902);
  ok('Cambio de precio: la cuenta no cambia (se cobra Q100.00, sin devolución)', !x.devMon&&!x.devolucion&&x.efectivo===100);
  await p.evaluate(()=>entrarVendedor('Gerson'));await p.waitForTimeout(400);
  z=await p.textContent('#zona');
  ok('Cambio de precio: aviso "cambió precio" y "Monica ahora Q96.00"', z.includes('cambió precio')&&z.includes('Salió Q100.00 · Monica ahora Q96.00'));
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');const pp=v.pedidos.find(x=>x.fac===21902);peVerCambio(v.id,pp.id);});await p.waitForTimeout(300);
  m=await p.textContent('#modalRecibeBody');
  ok('"Ver qué cambió" muestra el precio antes y ahora (Q25.00 → Q24.00) y que no se descuenta', m.includes('Q25.00 → Q24.00')&&m.includes('no se descuenta'));
  await p.screenshot({path:SHOTS+'/d4-cambio-precio.png'});
  await p.evaluate(()=>cerrarModalRecibe());

  // ---- 3) Ruta ya recibida: no se toca, solo aviso ----
  await p.evaluate(vid=>{const v=viajes.find(x=>x.id===vid);v.cerrado=true;v.horaRecibido=new Date().toISOString();renderZona();},vG);
  await rest('PATCH','pendientes_entrega?nro=eq.21901',{monica_total:85.5,monica_detalle:[L('400','tiky jumbo 3lt 6ud',0.5,92),L('087','Tampico 3.3lt 6ud',0.5,79)]});
  await recargar();x=await ped(21901);
  ok('Ruta ya recibida: no cambia la cuenta', x.devMon===46&&x.devolucion===51);
  await p.evaluate(vid=>{viajeAbierto=vid;renderZona();},vG);
  ok('Ruta ya recibida: dice "Monica: devolución −Q78.00 sin descontar (ruta ya recibida)"', (await p.textContent('#zona')).includes('Monica: devolución −Q78.00 sin descontar (ruta ya recibida)'));
  await p.evaluate(vid=>{const v=viajes.find(x=>x.id===vid);v.cerrado=false;viajeAbierto=null;renderZona();},vG);
  await recargar();x=await ped(21901);
  ok('Al reabrirla, se pone al día (devolución Q78.00 de Monica)', x.devMon===78&&x.devolucion===83);

  // ---- 4) Sin productos para comparar (salió antes de la vista previa): solo aviso ----
  sql("update pendientes_entrega set monica_cambio=true, monica_total=40, monica_detalle=null where nro=21903");
  await recargar();x=await ped(21903);
  ok('Sin productos de Monica: no adivina, solo aviso', !x.devMon&&x.efectivo===50);

  // ---- 5) No se entregó: la nota regresa a Por entregar ----
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');const pp=v.pedidos.find(x=>x.fac===21903);setEst(v.id,pp.id,'cancelado');});
  await p.waitForTimeout(1800);
  let f3=await fila(21903);
  ok('En la nube: vuelve a pendiente, con quién la llevó', f3.estado==='pendiente'&&f3.regresada===true&&f3.regreso_rutero==='Gerson'&&!f3.viaje_uid&&f3.monica_cambio===false);
  z=await p.textContent('#zona');
  ok('En la ruta queda "no entregó" (Q0) con la marca "regresó"', z.includes('regresó a Por entregar')&&!z.includes('no entreg.'));
  ok('La ruta ya no cuenta esa nota como cambiada', !(await p.evaluate(()=>peAvisosDe(viajes.filter(v=>v.rutero==='Gerson')).anul)));
  await p.screenshot({path:SHOTS+'/d5-no-entregado.png'});
  await p.evaluate(()=>{volverLista();peAbrir();});await p.waitForTimeout(1000);
  ok('Aparece en Por entregar como tarjeta "regresó" (apagada)', (await p.$$('.pe-card.reg')).length===1&&(await p.textContent('.pe-card.reg')).includes('TIENDA LUNA')&&(await p.textContent('.pe-card.reg')).includes('regresó · Gerson')&&(await p.textContent('.pe-card.reg')).includes('Cód. 10'));
  ok('No lleva el tiempo en rojo', (await p.$$('.pe-card.reg .pe-esp')).length===0);
  ok('Va al final del grupo (después de la nueva)', await p.evaluate(()=>{const cs=[...document.querySelectorAll('.pe-card')];return cs[cs.length-1].classList.contains('reg');}));
  ok('La tarjeta no es más alta que las otras', await p.evaluate(()=>{const r=document.querySelector('.pe-card.reg'),o=document.querySelector('.pe-card:not(.reg)');return Math.abs(r.offsetHeight-o.offsetHeight)<=1;}));
  await p.screenshot({path:SHOTS+'/d6-por-entregar-regreso.png'});
  await p.evaluate(()=>peMenuNota(21903));await p.waitForTimeout(300);
  m=await p.textContent('#modalRecibeBody');
  ok('Al mantenerla presionada dice quién la llevó y qué hacer', m.includes('Regresó · la llevó Gerson')&&m.includes('anúlela en Monica'));
  await p.screenshot({path:SHOTS+'/d7-menu-regreso.png'});
  await p.evaluate(()=>cerrarModalRecibe());
  await p.evaluate(()=>peVer(21903));await p.waitForTimeout(400);
  ok('La vista previa también dice "Regresó · Gerson"', (await p.textContent('#peVista')).includes('Regresó · Gerson'));
  await p.evaluate(()=>peVerCerrar());await p.waitForTimeout(300);

  // Fue un error: se marca otra vez "Pagó completo" -> vuelve a la ruta
  await p.evaluate(()=>peCerrar());
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');const pp=v.pedidos.find(x=>x.fac===21903);setEst(v.id,pp.id,'pagado');});
  await p.waitForTimeout(2000);
  f3=await fila(21903);
  ok('Deshacer: la nota vuelve a la misma ruta como salió', f3.estado==='enviada'&&f3.regresada===false&&f3.rutero==='Gerson'&&Number(f3.total_enviado)===50);
  ok('Deshacer: ya no está en Por entregar', !(await p.evaluate(()=>pePendientes().some(f=>f.nro===21903))));

  // Regresa otra vez y la anulan en Monica -> alarma pequeña "regresó y la anularon"
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');const pp=v.pedidos.find(x=>x.fac===21903);setEst(v.id,pp.id,'cancelado');});
  await p.waitForTimeout(1800);
  await rest('PATCH','pendientes_entrega?nro=eq.21903',{anulada:true,motivo:'anulada en Monica'});
  await recargar();
  ok('Anulada: sale de Por entregar', !(await p.evaluate(()=>pePendientes().some(f=>f.nro===21903))));
  await p.evaluate(()=>entrarVendedor('Gerson'));await p.waitForTimeout(400);
  z=await p.textContent('#zona');
  ok('En la ruta: "regresó y la anularon"', z.includes('regresó y la anularon'));
  await p.screenshot({path:SHOTS+'/d8-regreso-anulada.png'});
  await p.evaluate(()=>volverLista());await p.waitForTimeout(300);
  ok('En la lista de ruteros: "1 regresó y la anularon"', (await p.textContent('#zona')).includes('1 regresó y la anularon'));
  await p.screenshot({path:SHOTS+'/d9-lista-anulada.png'});

  // ---- 6) Regresa y se manda con otro rutero: la ruta vieja ya no la puede reclamar ----
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');const pp=v.pedidos.find(x=>x.fac===21902);setEst(v.id,pp.id,'cancelado');});
  await p.waitForTimeout(1800);
  ok('21902 regresó a Por entregar', await p.evaluate(()=>pePendientes().some(f=>f.nro===21902)));
  await p.evaluate(()=>{PE.sel=new Set([21902]);return peAsignar('Pedro');});await p.waitForTimeout(1500);
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Pedro');return terminarPedidos(v.id);});await p.waitForTimeout(2500);
  let f2=await fila(21902);
  const uidP=await p.evaluate(()=>viajes.find(x=>x.rutero==='Pedro').uid);
  ok('Se volvió a mandar con Pedro', f2.estado==='enviada'&&f2.viaje_uid===uidP&&f2.rutero==='Pedro');
  // Gerson corrige y vuelve a enviar su ruta: no se lleva la nota de Pedro
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');reabrirEntrada(v.id);return terminarPedidos(v.id);});await p.waitForTimeout(2000);
  f2=await fila(21902);
  ok('Al reenviar la ruta vieja, la nota sigue siendo de Pedro', f2.viaje_uid===uidP&&f2.rutero==='Pedro');
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');const pp=v.pedidos.find(x=>x.fac===21902);setEst(v.id,pp.id,'pagado');});
  await p.waitForTimeout(1800);
  x=await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Gerson');return v.pedidos.find(x=>x.fac===21902);});
  ok('Deshacer en la ruta vieja: no se deja (ya va con Pedro), sigue "no entregó"', x.estado==='cancelado'&&x.facReg===true&&(await fila(21902)).rutero==='Pedro');

  // ---- 7) Gesto: si la lista se refresca a media arrastrada, el gesto sigue ----
  await p.evaluate(()=>peAbrir());await p.waitForTimeout(800);
  const cdp=await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:60,y:420}]});
  for(let i=1;i<=12;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:60+i*22,y:425}]});
    if(i===4)await p.evaluate(()=>{document.getElementById('peLista').innerHTML+='';peRenderLista();});
    await p.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(450);
  ok('Aunque la lista se refresque a media arrastrada, deslizar a la derecha cierra', !(await p.evaluate(()=>PE.abierto)));

  ok('Sin errores en la página', errs.length===0);
  if(errs.length)console.log(errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} FALLA(S)`:'\nTodas las pruebas pasaron');
  process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
