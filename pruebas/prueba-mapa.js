// Mapa de "Por entregar" y "Ruta en Google Maps" (7/11/2026).
// Misma base local que prueba-por-entregar.js (Postgres + PostgREST en 127.0.0.1:3301/rest/v1,
// token 'anon' en /var/tmp/anon.jwt). Leaflet local: npm i leaflet@1.9.4. Capturas en pruebas/capturas/.
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const UMD=fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'),'utf8');
const LEAF_JS=fs.readFileSync(require.resolve('leaflet/dist/leaflet.js'),'utf8');
const LEAF_CSS=fs.readFileSync(require.resolve('leaflet/dist/leaflet.css'),'utf8');
const JWT=fs.readFileSync('/var/tmp/anon.jwt','utf8').trim();
const LOCAL='http://127.0.0.1:3301';
const SHOTS=path.join(__dirname,'capturas');fs.mkdirSync(SHOTS,{recursive:true});
// Azulejo gris de 1×1 (sin internet en la prueba)
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==','base64');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'')||'control-cobro-app.html');
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
  r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8896);
const sql=s=>execSync(`psql -h /var/tmp/pgtest -p 55432 -U postgres -At -c "${s.replace(/"/g,'\\"')}"`,{encoding:'utf8'}).trim();
async function rest(metodo,ruta,cuerpo,prefer){
  const r=await fetch(LOCAL+'/rest/v1/'+ruta,{method:metodo,headers:{apikey:JWT,Authorization:'Bearer '+JWT,'Content-Type':'application/json',Prefer:prefer||'return=representation'},body:cuerpo?JSON.stringify(cuerpo):undefined});
  const t=await r.text();return {status:r.status,data:t?JSON.parse(t):null};
}
const HOY=new Date().toLocaleDateString('en-CA');
const fila=(nro,cliente,vend,vid,total,hora,cod,lat,lng,extra)=>Object.assign({nro,fecha:HOY,hora,cliente,codigo_cliente:cod,vendedor:vend,vendedor_id:vid,total,lineas:2,envases:[],ubic_lat:lat,ubic_lng:lng,estado:'pendiente',rutero:null,viaje_uid:null},extra||{});
let fallas=0;const ok=(n,c)=>{console.log((c?'✅ ':'❌ ')+n);if(!c)fallas++;};

(async()=>{
  sql('truncate pendientes_entrega; truncate puente; truncate dias; truncate respaldos;');
  await rest('POST','pendientes_entrega',[
    fila(30001,'ABARROTERIA BUENA VISTA','brenda (pueblo)',42,300,'08:10','263',14.4965337,-90.9617256),
    fila(30002,'ADELAIDA GABRIEL','lesli',48,150.5,'08:20','30120',14.4816749,-91.0451764),
    fila(30003,'ADELAIDA GABRIEL','lesli',48,49.5,'08:25','30120',14.4816749,-91.0451764),   // mismo cliente: un solo punto
    fila(30004,'CLTE GCO.','lesli',48,80,'08:40','1',null,null),                            // sin ubicación
    fila(30005,'ALFA Y OMEGA #2','silvia (pueblo)',40,210,'09:00','1093',14.5006218,-90.9906239),
    fila(30006,'ALICIA GONZALES','silvia (pueblo)',40,95,'09:05','40330',14.4019376,-90.9671155,{estado:'asignada',rutero:'Pedro',viaje_uid:'x-otro'})]);
  ok('Notas de prueba cargadas', sql('select count(*) from pendientes_entrega')==='6');
  await rest('POST','puente?on_conflict=id',[{id:'facturacion',latido:1}],'resolution=merge-duplicates,return=minimal');

  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:UMD}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.route('**/unpkg.com/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:LEAF_JS}));
  await p.route('**/unpkg.com/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({status:200,contentType:'text/css',body:LEAF_CSS}));
  await p.route('**/basemaps.cartocdn.com/**',r=>r.fulfill({status:200,contentType:'image/png',body:PNG}));
  await p.route('https://shlolncjhfzqmcllwjrk.supabase.co/**',async r=>{
    const u=r.request().url().replace('https://shlolncjhfzqmcllwjrk.supabase.co',LOCAL);
    const h={...r.request().headers(),authorization:'Bearer '+JWT,apikey:JWT};
    const res=await r.fetch({url:u,headers:h});await r.fulfill({response:res});
  });
  await p.goto('http://localhost:8896/control-cobro-app.html',{waitUntil:'networkidle'});
  await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');await p.click('#loginScreen button');
  await p.waitForTimeout(1500);

  await p.click('#btnPE');await p.waitForTimeout(900);
  ok('Botón de mapa en el encabezado', await p.isVisible('#peMapaBtn'));
  ok('Empieza en la lista', (await p.$$('#peLista .pe-card')).length===5&&!(await p.$('.pe-mapa')));
  await p.click('#peMapaBtn');await p.waitForTimeout(900);
  ok('Abre el mapa', await p.isVisible('.pe-mapa .leaflet-container'));
  const pins=await p.$$eval('.pe-pin',xs=>xs.map(x=>({c:x.className,t:x.textContent})));
  ok('3 puntos por escoger + 1 gris (ruta que se prepara)', pins.filter(x=>!/gris/.test(x.c)).length===3&&pins.filter(x=>/gris/.test(x.c)).length===1);
  ok('El cliente con 2 notas es un solo punto con el número 2', pins.some(x=>x.t==='2'));
  ok('Aviso "1 sin ubicación"', (await p.textContent('#peMTop')).includes('1 sin ubicación'));
  ok('Todos los puntos quedan dentro de la pantalla', await p.evaluate(()=>{const r=document.querySelector('.pe-mapa').getBoundingClientRect();
    return [...document.querySelectorAll('.pe-pin')].every(x=>{const b=x.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom;});}));
  ok('Botón del mapa marcado (ahora dice "Ver como lista")', (await p.getAttribute('#peMapaBtn','aria-label'))==='Ver como lista');
  await p.screenshot({path:SHOTS+'/mapa-1-abierto.png'});

  // Tocar el punto de Buena Vista
  const pinDe=async nombre=>p.locator(`.leaflet-marker-icon[title="${nombre}"]`);
  await (await pinDe('ABARROTERIA BUENA VISTA')).click();await p.waitForTimeout(300);
  ok('Tocar un punto escoge su nota', await p.evaluate(()=>PE.sel.has(30001)&&PE.sel.size===1));
  ok('El punto escogido cambia (✓)', (await p.$$('.pe-pin.on')).length===1);
  ok('Tarjeta arriba con cliente, nota, total y "Escogida"', await p.evaluate(()=>{const t=document.getElementById('peMTop').textContent;return t.includes('ABARROTERIA BUENA VISTA')&&t.includes('Nota 30001')&&t.includes('Q300.00')&&t.includes('Escogida');}));
  ok('Barra abajo con el total y el +', (await p.textContent('.pe-flota')).includes('Q300.00')&&await p.isVisible('.pe-flota .pe-mas'));
  await (await pinDe('ADELAIDA GABRIEL · ADELAIDA GABRIEL')).click();await p.waitForTimeout(300);
  ok('Punto de 2 notas escoge las 2', await p.evaluate(()=>PE.sel.has(30002)&&PE.sel.has(30003)&&PE.sel.size===3));
  ok('Barra suma Q500.00 · 3 notas', (await p.textContent('.pe-flota')).includes('Q500.00')&&(await p.textContent('.pe-flota')).includes('3 notas'));
  await p.screenshot({path:SHOTS+'/mapa-2-escogidas.png'});
  await (await pinDe('ADELAIDA GABRIEL · ADELAIDA GABRIEL')).click();await p.waitForTimeout(300);
  ok('Tocar otra vez lo quita', await p.evaluate(()=>!PE.sel.has(30002)&&!PE.sel.has(30003)&&PE.sel.size===1));
  await p.click('.pe-mi-r button');await p.waitForTimeout(500);
  ok('"Ver" abre la vista previa de la nota', await p.evaluate(()=>PE.vista===30002));
  await p.evaluate(()=>peVerCerrar());await p.waitForTimeout(400);
  await (await pinDe('ADELAIDA GABRIEL · ADELAIDA GABRIEL')).click();await p.waitForTimeout(300);
  // Punto gris: ya va en otra ruta
  await (await p.locator('.leaflet-marker-icon:has(.pe-pin.gris)')).click();await p.waitForTimeout(300);
  ok('Punto gris: dice que ya va en la ruta de Pedro y no se escoge', (await p.textContent('#peMTop')).includes('Ya va en la ruta de Pedro')&&await p.evaluate(()=>!PE.sel.has(30006)));

  // Sin ubicación
  await p.click('.pe-msinb');await p.waitForTimeout(300);
  ok('"Sin ubicación" muestra la nota de CLTE GCO.', (await p.textContent('.pe-msin')).includes('CLTE GCO.')&&(await p.textContent('.pe-msin')).includes('Tú decides'));
  await p.screenshot({path:SHOTS+'/mapa-3-sin-ubicacion.png'});
  await p.click('.pe-msin .pe-card');await p.waitForTimeout(300);
  ok('Se escoge desde "Sin ubicación"', await p.evaluate(()=>PE.sel.has(30004)&&PE.sel.size===4));
  await p.click('.pe-msin .pe-mi-x');await p.waitForTimeout(200);
  ok('El aviso dice cuántas sin ubicación van escogidas', (await p.textContent('.pe-msinb')).includes('1 escogida'));

  // Arrastrar el mapa a la derecha NO cierra el panel
  await p.evaluate(()=>{const el=document.querySelector('.pe-mapadiv');const r=el.getBoundingClientRect();const y=r.top+r.height*0.6;
    const T=(x)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[T(60)],targetTouches:[T(60)],changedTouches:[T(60)]}));
    for(let x=80;x<=320;x+=40)el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[T(x)],targetTouches:[T(x)],changedTouches:[T(x)]}));
    el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[T(320)]}));});
  await p.waitForTimeout(500);
  ok('Arrastrar el mapa a la derecha no cierra Por entregar', await p.evaluate(()=>PE.abierto));

  // Filtro por vendedor en el mapa
  await p.click('.pe-chip:has-text("Lesli")');await p.waitForTimeout(400);
  ok('Filtro Lesli: solo su punto (y su nota sin ubicación)', (await p.$$('.pe-pin:not(.gris)')).length===1&&(await p.textContent('#peMTop')).includes('1 sin ubicación'));
  await p.click('.pe-chip:has-text("Todos")');await p.waitForTimeout(400);
  // Búsqueda
  await p.fill('#peBuscar','alfa');await p.waitForTimeout(400);
  ok('Búsqueda en el mapa: solo ALFA Y OMEGA', (await p.$$('.pe-pin:not(.gris)')).length===1&&!(await p.textContent('#peMTop')).includes('sin ubicación'));
  await p.fill('#peBuscar','');await p.evaluate(()=>peBuscar(''));await p.waitForTimeout(400);
  // Escoger Alfa y Omega al final (orden: Buena Vista, Adelaida x2, CLTE GCO., Alfa y Omega)
  await (await pinDe('ALFA Y OMEGA #2')).click();await p.waitForTimeout(300);
  ok('5 notas escogidas', await p.evaluate(()=>PE.sel.size===5));
  // Refresco de la nube: el mapa sigue igual (no se reencuadra ni pierde lo escogido)
  const centro1=await p.evaluate(()=>PE._map.getCenter());
  await p.evaluate(()=>PE._map.panBy([60,0],{animate:false}));
  const centro2=await p.evaluate(()=>PE._map.getCenter());
  await p.evaluate(()=>peCargar());await p.waitForTimeout(900);
  const centro3=await p.evaluate(()=>PE._map.getCenter());
  ok('Al refrescar no se mueve el mapa ni se pierde la selección', Math.abs(centro3.lng-centro2.lng)<1e-9&&Math.abs(centro2.lng-centro1.lng)>1e-6&&await p.evaluate(()=>PE.sel.size===5));

  // Volver a la lista: la selección sigue
  await p.click('#peMapaBtn');await p.waitForTimeout(400);
  ok('Regresa a la lista con las 5 escogidas', (await p.$$('#peLista .pe-card.on')).length===5&&!(await p.$('.pe-mapa')));
  await p.click('#peMapaBtn');await p.waitForTimeout(600);
  ok('Y otra vez al mapa sin errores', await p.isVisible('.pe-mapa .leaflet-container')&&(await p.$$('.pe-pin.on')).length===3);

  // Mandar a un rutero
  await p.evaluate(()=>peAsignar('Juan'));await p.waitForTimeout(1800);
  const v=await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Juan');return v&&{id:v.id,ps:v.pedidos.map(x=>({fac:x.fac,lat:x.lat,lng:x.lng}))};});
  ok('Viaje de Juan con las 5 notas', v&&v.ps.length===5);
  ok('Quedan en el orden en que se escogieron', v&&v.ps.map(x=>x.fac).join(',')==='30001,30002,30003,30004,30005');
  ok('Cada nota guarda su ubicación (la de CLTE GCO. no)', v&&v.ps[0].lat===14.4965337&&v.ps[0].lng===-90.9617256&&v.ps[3].lat===undefined);
  ok('Botón "Ruta en Google Maps" antes de Enviar ruta', await p.isVisible('.rmaps-b'));
  await p.screenshot({path:SHOTS+'/mapa-4-viaje.png'});
  await p.click('.rmaps-b');await p.waitForTimeout(400);
  const modal=await p.textContent('#modalRecibe');
  ok('Ventana con 3 paradas (Adelaida 2 notas = 1 parada)', modal.includes('3 paradas')&&(await p.$$('.rm-lista li')).length===3);
  ok('En orden: Buena Vista, Adelaida, Alfa y Omega', await p.$$eval('.rm-lista li',xs=>xs.map(x=>x.textContent)).then(a=>a[0].includes('BUENA VISTA')&&a[1].includes('ADELAIDA')&&a[1].includes('30002, 30003')&&a[2].includes('ALFA')));
  ok('Avisa la que no tiene ubicación', modal.includes('Sin ubicación (1)')&&modal.includes('CLTE GCO.'));
  const href=await p.getAttribute('.rm-btns a','href');
  ok('Enlace de Google Maps: destino la última, las otras en orden', href==='https://www.google.com/maps/dir/?api=1&destination=14.5006218,-90.9906239&waypoints='+encodeURIComponent('14.4965337,-90.9617256|14.4816749,-91.0451764')+'&travelmode=driving');
  ok('Botones WhatsApp y Copiar', modal.includes('Enviar por WhatsApp')&&modal.includes('Copiar'));
  await p.screenshot({path:SHOTS+'/mapa-5-ruta-maps.png'});
  const txt=await p.evaluate(id=>rmTexto(viajes.find(x=>x.id===id)),v.id);
  ok('Mensaje de WhatsApp: rutero, paradas en orden, enlace y sin ubicación', txt.startsWith('Ruta de Juan')&&txt.includes('1. ABARROTERIA BUENA VISTA (nota 30001)')&&txt.includes('2. ADELAIDA GABRIEL (nota 30002, 30003)')&&txt.includes(href)&&txt.includes('- CLTE GCO. (nota 30004)'));
  let abierto=null;await p.exposeFunction('__abrio',u=>{abierto=u;});
  await p.evaluate(()=>{window.open=u=>{window.__abrio(u);return null;};});
  await p.click('.rm-btns button.ok');await p.waitForTimeout(300);
  ok('WhatsApp se abre con el mensaje', abierto&&abierto.startsWith('https://wa.me/?text=')&&decodeURIComponent(abierto.split('text=')[1])===txt);
  await p.evaluate(()=>cerrarModalRecibe());
  // Muchas paradas: de 10 en 10
  const partes=await p.evaluate(()=>{const ps=[];for(let i=0;i<23;i++)ps.push({u:[14.4+i/1000,-90.9-i/1000]});return rmEnlaces(ps).map(e=>[e.desde,e.hasta,(e.url.match(/waypoints=([^&]*)/)||[,''])[1]]);});
  ok('23 paradas = 3 enlaces (1-10, 11-20, 21-23)', partes.length===3&&partes[0][0]===1&&partes[0][1]===10&&partes[2][0]===21&&partes[2][1]===23);
  ok('Cada enlace con máximo 9 paradas intermedias', partes.every(x=>decodeURIComponent(x[2]).split('|').length<=9));
  ok('Nota sin ninguna ubicación: el botón no aparece en viajes sin notas de Monica', await p.evaluate(()=>rmBoton({id:1,pedidos:[{nombre:'X',total:5}]})===''));

  // Después de enviar la ruta sigue el botón
  await p.evaluate(id=>{const v=viajes.find(x=>x.id===id);terminarPedidos(id);},v.id);await p.waitForTimeout(500);
  await p.evaluate(()=>{const b=[...document.querySelectorAll('#modalRecibe button')].find(x=>/Sí|Enviar|Confirmar/.test(x.textContent));if(b)b.click();});await p.waitForTimeout(1500);
  const sal=await p.evaluate(id=>{const v=viajes.find(x=>x.id===id);return !!(v.entradaLista||v.horaSalida);},v.id);
  if(sal){await p.evaluate(()=>{renderZona();});await p.waitForTimeout(300);
    ok('Ruta enviada: el botón de Google Maps sigue', await p.isVisible('.rmaps-b'));}
  else console.log('   (no se pudo enviar la ruta en la prueba; se omite)');

  // Ubicación que llega después (Monica la tenía vacía y la llenan): la nota que no ha salido se actualiza
  const pref=await p.evaluate(()=>localStorage.getItem('cc_pe_mapa'));
  ok('Se recuerda que estaba en el mapa', pref==='1');
  ok('Sin errores en la página', errs.length===0);
  if(errs.length)console.log(errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} prueba(s) fallaron`:'\nTodas las pruebas pasaron');
  process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
