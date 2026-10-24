// Prueba completa de "Por entregar" con la librería real de Supabase contra una base local
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
  r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8897);
const sql=s=>execSync(`psql -h /var/tmp/pgtest -p 55432 -U postgres -At -c "${s.replace(/"/g,'\\"')}"`,{encoding:'utf8'}).trim();
async function rest(metodo,ruta,cuerpo,prefer){
  const r=await fetch(LOCAL+'/rest/v1/'+ruta,{method:metodo,headers:{apikey:JWT,Authorization:'Bearer '+JWT,'Content-Type':'application/json',Prefer:prefer||'return=representation'},body:cuerpo?JSON.stringify(cuerpo):undefined});
  const t=await r.text();return {status:r.status,data:t?JSON.parse(t):null};
}
const fila=(nro,cliente,vend,vid,total,hora,cod)=>({nro,fecha:'2026-10-24',hora,cliente,codigo_cliente:cod,vendedor:vend,vendedor_id:vid,total,lineas:4});
let fallas=0;const ok=(n,c)=>{console.log((c?'✅ ':'❌ ')+n);if(!c)fallas++;};

(async()=>{
  sql('truncate pendientes_entrega; truncate puente; truncate dias; truncate respaldos;');
  await rest('POST','pendientes_entrega',[
    fila(21801,'TIENDA LA BENDICIÓN','brenda (pueblo)',42,385,'08:15','101'),
    fila(21802,'ABARROTERÍA SAN JOSÉ','brenda (pueblo)',42,220.5,'08:32','214'),
    fila(21803,'DESPENSA LUCY','lesli',48,645,'09:05','087'),
    fila(21804,'TIENDA EL CARMEN','silvia (pueblo)',40,98.75,'09:20','132')]);
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
  await p.goto('http://localhost:8897/control-cobro-app.html',{waitUntil:'networkidle'});
  await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');await p.click('#loginScreen button');
  await p.waitForTimeout(1500);

  ok('Campanita con 4 pendientes', (await p.textContent('#peBadge'))==='4');
  ok('Tarjeta "4 facturas por entregar" en la lista', (await p.textContent('#zona')).includes('4 facturas por entregar'));
  await p.screenshot({path:SHOTS+'/1-lista-con-aviso.png'});

  await p.click('#btnPE');await p.waitForTimeout(800);
  ok('Panel abierto agrupado por vendedor', (await p.textContent('#peLista')).includes('Brenda pueblo')&&(await p.textContent('#peLista')).includes('Lesli'));
  ok('Muestra nota, hora y código', (await p.textContent('#peLista')).includes('Nota 21801 · 8:15 a. m. · Cód. 101'));
  ok('Marca las nuevas', (await p.$$('.pe-nueva')).length===4);
  await p.screenshot({path:SHOTS+'/2-panel.png'});

  await p.fill('#peBuscar','21803');await p.waitForTimeout(200);
  ok('Busca por número de nota', (await p.$$('#peLista .pe-item')).length===1&&(await p.textContent('#peLista')).includes('DESPENSA LUCY'));
  await p.fill('#peBuscar','bendic');await p.waitForTimeout(200);
  ok('Busca por nombre', (await p.textContent('#peLista')).includes('TIENDA LA BENDICIÓN')&&(await p.$$('#peLista .pe-item')).length===1);
  await p.fill('#peBuscar','214');await p.waitForTimeout(200);
  ok('Busca por código', (await p.textContent('#peLista')).includes('ABARROTERÍA SAN JOSÉ'));
  await p.fill('#peBuscar','');await p.waitForTimeout(200);

  await p.click('.pe-chip:has-text("Brenda")');await p.waitForTimeout(200);
  ok('Filtro por vendedor', (await p.$$('#peLista .pe-item')).length===2);
  await p.click('.pe-todas');await p.waitForTimeout(200);
  ok('"Todas" selecciona el grupo', (await p.$$('.pe-item.on')).length===2);
  ok('Barra con total seleccionado Q605.50', (await p.textContent('.pe-barra')).includes('Q605.50'));
  await p.screenshot({path:SHOTS+'/3-seleccion.png'});

  await p.click('.pe-mas');await p.waitForTimeout(300);
  ok('Pregunta quién lo lleva', (await p.textContent('#modalRecibeBody')).includes('¿Quién lo lleva?'));
  await p.screenshot({path:SHOTS+'/4-elegir-rutero.png'});
  await p.click('.pe-rut.nuevo');await p.fill('#peNom','Juan');await p.click('#modalRecibeBody button:has-text("Crear y mandar")');
  await p.waitForTimeout(1800);
  let db=(await rest('GET','pendientes_entrega?select=*&order=nro')).data;
  ok('En la nube quedan apartadas para Juan', db.filter(f=>f.estado==='asignada'&&f.rutero==='Juan').map(f=>f.nro).join()==='21801,21802');
  let v=await p.evaluate(()=>viajes.find(x=>x.rutero==='Juan'));
  ok('Se armó el viaje de Juan con las 2 notas', v&&v.pedidos.length===2&&v.pedidos.every(x=>x.fac)&&!v.entradaLista);
  ok('El panel sigue abierto y quedan 2', await p.evaluate(()=>PE.abierto)&&(await p.$$('#peLista .pe-item:not(.quieto)')).length===2);
  ok('La ruta quedó guardada en la nube', JSON.stringify((await rest('GET','dias?select=estado')).data).includes('21801'));
  ok('Aparecen en "En rutas que se preparan"', (await p.textContent('#peLista')).includes('En rutas que se preparan'));
  await p.screenshot({path:SHOTS+'/5-despues-de-mandar.png'});

  // Otro aparato intenta tomar la misma nota
  const otro=await rest('PATCH','pendientes_entrega?nro=eq.21801&estado=eq.pendiente',{estado:'asignada',rutero:'Pedro'});
  ok('Otro aparato no puede tomar una nota ya apartada', Array.isArray(otro.data)&&otro.data.length===0);

  // Monica cambia la nota 21801 (el puente la actualiza) -> sigue a Monica mientras no sale
  await rest('PATCH','pendientes_entrega?nro=eq.21801&estado=neq.enviada',{total:400});
  await p.evaluate(()=>peCargar());await p.waitForTimeout(1200);
  v=await p.evaluate(()=>viajes.find(x=>x.rutero==='Juan'));
  ok('Mientras no sale, el monto sigue a Monica (385 → 400)', v.pedidos.find(x=>x.fac===21801).total===400);

  await p.click('.shHead .x');await p.waitForTimeout(300);
  await p.evaluate(()=>entrarVendedor('Juan'));await p.waitForTimeout(500);
  ok('La fila del pedido muestra la nota', (await p.textContent('#zona')).includes('Nota 21801'));
  await p.screenshot({path:SHOTS+'/6-viaje-juan.png'});
  // No se edita el monto de una nota de Monica
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Juan');editarPed(v.id,v.pedidos[0].id,'total');});
  ok('No deja editar el monto de una nota de Monica', !(await p.isVisible('#modalRecibe.open')));

  // Cerrar pedidos -> no lleva envases
  await p.click('text=Cerrar pedidos');await p.waitForTimeout(600);
  if(await p.isVisible('#modalRecibe.open'))await p.click('#modalRecibeBody button:has-text("No lleva")');
  await p.waitForTimeout(400);
  // Justo antes de enviar cambian otra nota en Monica (sin que la app se haya enterado)
  await rest('PATCH','pendientes_entrega?nro=eq.21802&estado=neq.enviada',{total:250});
  await p.click('.btn-enviar',{force:true});await p.waitForTimeout(1500);
  ok('Al enviar avisa que cambió la nota 21802', (await p.textContent('#modalRecibeBody')).includes('Nota 21802')&&(await p.textContent('#modalRecibeBody')).includes('Q250.00'));
  v=await p.evaluate(()=>viajes.find(x=>x.rutero==='Juan'));
  ok('Todavía no salió', !v.entradaLista);
  await p.screenshot({path:SHOTS+'/7-aviso-cambio.png'});
  await p.click('#modalRecibeBody button:has-text("Usar montos de Monica")');await p.waitForTimeout(2500);
  v=await p.evaluate(()=>viajes.find(x=>x.rutero==='Juan'));
  ok('Salió con los montos exactos (400 + 250)', v.entradaLista&&v.pedidos.reduce((s,x)=>s+x.total,0)===650);
  db=(await rest('GET','pendientes_entrega?select=*&order=nro')).data;
  const e1=db.find(f=>f.nro===21801),e2=db.find(f=>f.nro===21802);
  ok('En la nube quedan ENVIADAS con su total', e1.estado==='enviada'&&Number(e1.total_enviado)===400&&e2.estado==='enviada'&&Number(e2.total_enviado)===250);
  const intento=await rest('PATCH','pendientes_entrega?nro=eq.21801',{total:1});
  ok('Una enviada ya no se puede cambiar (lo bloquea la base)', intento.status===400);
  await p.screenshot({path:SHOTS+'/8-enviada.png'});

  // Corregir: la nota enviada no se puede quitar
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Juan');reabrirEntrada(v.id);borrarPedido(v.id,v.pedidos[0].id);});
  v=await p.evaluate(()=>viajes.find(x=>x.rutero==='Juan'));
  ok('En "Corregir" no se puede quitar una nota ya enviada', v.pedidos.length===2);
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Juan');terminarPedidos(v.id);});await p.waitForTimeout(1200);

  // Al regresar: crédito / no entregó siguen funcionando
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Juan');setEst(v.id,v.pedidos[1].id,'credito');});
  v=await p.evaluate(()=>viajes.find(x=>x.rutero==='Juan'));
  ok('Crédito en una nota de Monica funciona igual', v.pedidos[1].estado==='credito');

  // Quitar una nota de un viaje que no ha salido -> vuelve a pendientes
  await p.evaluate(()=>volverLista());await p.waitForTimeout(300);
  await p.evaluate(()=>{PE.sel=new Set([21803]);return peAsignar('Pedro');});await p.waitForTimeout(1500);
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Pedro');borrarPedido(v.id,v.pedidos[0].id);});await p.waitForTimeout(1200);
  db=(await rest('GET','pendientes_entrega?select=*&nro=eq.21803')).data;
  ok('Quitar del viaje (antes de salir) la regresa a pendientes', db[0].estado==='pendiente'&&!db[0].rutero);

  // Anulada en Monica después de apartarla
  await p.evaluate(()=>{PE.sel=new Set([21803]);return peAsignar('Pedro');});await p.waitForTimeout(1500);
  await rest('PATCH','pendientes_entrega?nro=eq.21803',{anulada:true,motivo:'anulada en Monica'});
  await p.evaluate(()=>peCargar());await p.waitForTimeout(1000);
  await p.evaluate(()=>entrarVendedor('Pedro'));await p.waitForTimeout(400);
  ok('Se ve "anulada en Monica" en la ruta', (await p.textContent('#zona')).includes('anulada en Monica'));
  await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Pedro');v.pedidosListos=true;terminarPedidos(v.id);});await p.waitForTimeout(1200);
  ok('Al enviar avisa que se quita la anulada', (await p.textContent('#modalRecibeBody')).includes('Anulada · se quita'));
  await p.click('#modalRecibeBody button.sec');

  // Facturación rápida apagada -> aviso de montos sin confirmar
  sql("alter table puente disable trigger puente_latido; update puente set visto_en=now()-interval '10 minutes'; alter table puente enable trigger puente_latido;");
  await p.evaluate(()=>volverLista());
  await p.evaluate(()=>peAbrir());await p.waitForTimeout(1200);
  ok('Panel avisa que Facturación rápida no reporta', (await p.textContent('.pe-est')).includes('no reporta hace 10 min'));
  await p.click('.pe-item:has-text("TIENDA EL CARMEN")');await p.click('.pe-mas');await p.waitForTimeout(300);
  ok('Antes de mandar pide confirmar montos', (await p.textContent('#modalRecibeBody')).includes('Montos sin confirmar'));
  await p.screenshot({path:SHOTS+'/9-sin-confirmar.png'});
  await p.click('#modalRecibeBody button.sec');

  // Anotador (tienda): ve la campana, no puede descartar
  ok('Sin errores en la página', errs.length===0);
  if(errs.length)console.log(errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} FALLA(S)`:'\nTodas las pruebas pasaron');
  process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
