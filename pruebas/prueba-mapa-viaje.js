// Mapa del viaje (21/11/2026): en "Ruta de…" el botón de mapa abre el mapa de ese viaje (bodega + paradas
// numeradas en orden); tocar una parada muestra sus notas con "Ver productos"; solo para ver.
// (base) Reportes ⚙️ › Mapeo por vendedor › "Archivo Organic Maps" (10/11/2026): con los mismos datos del PDF (la PC
// los lee de Monica con lat/lon de cada cliente) arma el .kml igual al de la ruta: "01. CLIENTE - Q total".
// La "PC" de esta prueba contesta sola (base falsa en la página). Ya entra con sesión de Supabase falsa.
let chromium;try{({chromium}=require('playwright-core'));}catch(e){({chromium}=require('playwright'));}
const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','control-cobro-app.html'),'utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8898);
const FAKE=`
window.__DB={reportes_pedidos:[],alertas:[]};window.__seq=1;
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
setInterval(()=>{for(const p of window.__DB.reportes_pedidos){if(p.estado!=='pedido')continue;
  if(p.tipo==='vendedores')p.resultado={ok:true,vendedores:[{id:7,codigo:'7',nombre:'lesli'},{id:15,codigo:'15',nombre:'edwin (morelia)'}]};
  else if(p.vendedor_id===99)p.resultado={ok:true,desde:p.desde,hasta:p.hasta,documentos:0,total:0,grupos:[]};
  else p.resultado={ok:true,desde:p.desde,hasta:p.hasta,generado:p.hasta,documentos:5,total:1700,empresa:{p_cEmpresa:'DISTRIBUIDORA HERNANDEZ'},
    grupos:[{vid:15,codigo:'15',vendedor:'edwin (morelia)',subtotal:1700,filas:[
      {tipo:'nota',nro:22500,cliente:'LA CUCHILLA',total:514.7,lat:'14.5002191',lon:'-90.9888658'},
      {tipo:'nota',nro:22501,cliente:'TIENDA SANTI',total:279,lat:'14.5008534,',lon:'-90.9895494'},
      {tipo:'nota',nro:22502,cliente:'LA CUCHILLA',total:100,lat:'14.5002191',lon:'-90.9888658'},
      {tipo:'nota',nro:22503,cliente:'CLTE GCO.',total:80,lat:'',lon:''},
      {tipo:'nota',nro:22504,cliente:'ALFA Y OMEGA #2',total:726.3,lat:'-90.99062389798002',lon:'14.500621823575248'}]}]};
  p.estado='listo';}},700);
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null}),
   signInWithPassword:async()=>({data:{session:{user:{email:'cesar@cobros.local'}}},error:null})},
 rpc(){return Promise.resolve({data:null,error:null});},
 channel(){const c={on(){return c;},subscribe(){return c;}};return c;},removeChannel(){},
 from(t){const st={t,f:[],upd:null,ins:null};
  const filas=()=>(window.__DB[t]||[]).filter(r=>st.f.every(([op,k,v])=>op==='eq'?r[k]===v:true));
  const fin=()=>{if(st.ins){const o=Object.assign({id:window.__seq++,estado:'pedido'},_cp(st.ins));(window.__DB[t]=window.__DB[t]||[]).push(o);return {data:[_cp(o)],error:null};}
    if(st.upd){const fs=filas();fs.forEach(r=>Object.assign(r,_cp(st.upd)));return {data:_cp(fs),error:null};}return {data:_cp(filas()),error:null};};
  const api={select(){return api;},order(){return api;},limit(){return api;},range(){return api;},
   eq(k,v){st.f.push(['eq',k,v]);return api;},neq(){return api;},gte(){return api;},lte(){return api;},in(){return api;},is(){return api;},not(){return api;},
   update(o){st.upd=o;return api;},insert(o){st.ins=o;return api;},upsert(){return Promise.resolve({data:null,error:null});},delete(){return api;},
   maybeSingle(){const d=fin().data;return Promise.resolve({data:d[0]||null,error:null});},single(){return api.maybeSingle();},
   then(res,rej){return Promise.resolve(fin()).then(res,rej);}};
  return api;}})};
`;

const LEAF_JS=fs.readFileSync(require.resolve('leaflet/dist/leaflet.js'),'utf8'),LEAF_CSS=fs.readFileSync(require.resolve('leaflet/dist/leaflet.css'),'utf8'),
  LEAF_ROT=fs.readFileSync(require.resolve('leaflet-rotate/dist/leaflet-rotate.js'),'utf8');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==','base64');
(async()=>{
  const b=await chromium.launch();
  let fallas=0;const ok=(n,c)=>{console.log((c?'✅ ':'❌ ')+n);if(!c)fallas++;};
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.route('**/unpkg.com/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:LEAF_JS}));
  await p.route('**/unpkg.com/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({status:200,contentType:'text/css',body:LEAF_CSS}));
  await p.route('**/unpkg.com/leaflet-rotate@0.5.3/dist/leaflet-rotate.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:LEAF_ROT}));
  await p.route('**/tile.openstreetmap.org/**',r=>r.fulfill({status:200,contentType:'image/png',body:PNG}));
  await p.goto('http://localhost:8898/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);
  await p.evaluate(()=>entrarListo({email:'cesar@cobros.local'},null));await p.waitForTimeout(500);
  await p.evaluate(()=>{window.__vistos=[];peVerRuta=(n,r)=>window.__vistos.push([n,r]);
    viajes.push({id:701,rutero:'Milton',pedidos:[
      {id:1,nombre:'TDA. Yaquelin',total:314,estado:'pagado',fac:23116,lat:14.500845,lng:-90.952338},
      {id:2,nombre:'TIENDA PRICILA',total:410.75,estado:'pagado',fac:23117,lat:14.5031,lng:-90.9551},
      {id:3,nombre:'TIENDA PRICILA',total:20,estado:'pagado',fac:23120,lat:14.5031,lng:-90.9551},
      {id:4,nombre:'CLTE GCO. gloria cos',total:80,estado:'pagado',fac:23118},
      {id:5,nombre:'TIENDA PAMELA',total:416.75,estado:'pagado',fac:23123,lat:14.50342,lng:-90.94969}]});
    rutaMaps(701);});
  await p.waitForTimeout(300);
  ok('"Ruta de Milton" tiene el botón de mapa junto a la X', await p.isVisible('#modalRecibeBody .rm-cbtn .pe-mapab')&&await p.isVisible('#modalRecibeBody .rm-x'));
  await p.screenshot({path:path.join(__dirname,'capturas','mapa-viaje-0.png')});
  await p.click('#modalRecibeBody .rm-cbtn .pe-mapab');await p.waitForTimeout(1200);
  ok('Abre el mapa del viaje a pantalla completa', await p.isVisible('#rmMapa.open .leaflet-container')&&(await p.textContent('#rmMapa .al-cab')).includes('Ruta de Milton'));
  const nums=await p.$$eval('.rmm-num',xs=>xs.map(x=>x.textContent));
  ok('3 paradas numeradas en el orden de la ruta (PRICILA con 2 notas = 1 parada)', nums.join(',')==='1,2,3');
  ok('Bodega en el mapa', (await p.$$('#rmMapa .pe-bod')).length===1);
  ok('"1 sin ubicación"', (await p.textContent('#rmMTop')).includes('1 sin ubicación'));
  ok('Todo queda dentro de la pantalla', await p.evaluate(()=>{const r=document.querySelector('#rmMapa .pe-mapa').getBoundingClientRect();
    return [...document.querySelectorAll('#rmMapa .rmm-num,#rmMapa .pe-bod')].every(x=>{const b=x.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom;});}));
  ok('Se puede girar con dos dedos', await p.evaluate(()=>!!(RMM.map.touchRotate&&RMM.map.touchRotate.enabled())));
  await p.screenshot({path:path.join(__dirname,'capturas','mapa-viaje-1.png')});
  const centro=t=>p.evaluate(t=>{const e=document.querySelector(`#rmMapa .leaflet-marker-icon[title="${t}"]`).getBoundingClientRect();return [e.left+e.width/2,e.top+e.height/2];},t);
  let c=await centro('2. TIENDA PRICILA');await p.touchscreen.tap(c[0],c[1]);await p.waitForTimeout(400);
  const t=await p.textContent('#rmMTop');
  ok('Tocar la parada 2: tarjeta con sus 2 notas y "Ver productos"', t.includes('TIENDA PRICILA')&&t.includes('Nota 23117')&&t.includes('Nota 23120')&&t.includes('Q410.75')&&(await p.$$('#rmMTop .pe-mi-r button')).length===2);
  ok('No hay nada para escoger (solo ver)', !(await p.$('#rmMapa .pe-flota'))&&!/escoger/i.test(t));
  await p.click('#rmMTop .pe-mi-r button');await p.waitForTimeout(200);
  ok('"Ver productos" abre la nota de esa ruta', await p.evaluate(()=>JSON.stringify(window.__vistos)==='[[23117,"Milton"]]'));
  await p.screenshot({path:path.join(__dirname,'capturas','mapa-viaje-2.png')});
  await p.touchscreen.tap(30,700);await p.waitForTimeout(400);
  ok('Tocar fuera cierra la tarjeta', !(await p.$('#rmMTop .pe-minfo')));
  await p.click('#rmMTop .pe-msinb');await p.waitForTimeout(300);
  const sinT=await p.textContent('#rmMSin');
  ok('"Sin ubicación" muestra CLTE GCO. con "Ver productos"', sinT.includes('CLTE GCO. gloria cos')&&sinT.includes('Nota 23118')&&sinT.includes('Ver productos'));
  await p.screenshot({path:path.join(__dirname,'capturas','mapa-viaje-3.png')});
  await p.click('#rmMapa .pe-cerrar');await p.waitForTimeout(300);
  ok('Cerrar regresa a "Ruta de Milton"', !(await p.$('#rmMapa.open'))&&await p.isVisible('#modalRecibeBody .rm-cab'));
  await p.click('#modalRecibeBody .rm-cbtn .pe-mapab');await p.waitForTimeout(800);
  ok('Se puede abrir otra vez sin errores', await p.isVisible('#rmMapa.open .leaflet-container')&&(await p.$$('.rmm-num')).length===3);
  ok('Sin errores en la página', errs.length===0);if(errs.length)console.log(errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} prueba(s) fallaron`:'\nTodas las pruebas pasaron');process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
