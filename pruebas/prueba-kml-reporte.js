// Reportes ⚙️ › Mapeo por vendedor › "Archivo Organic Maps" (10/11/2026): con los mismos datos del PDF (la PC
// los lee de Monica con lat/lon de cada cliente) arma el .kml igual al de la ruta: "01. CLIENTE - Q total".
// La "PC" de esta prueba contesta sola (base falsa en la página). Ya entra con sesión de Supabase falsa.
let chromium;try{({chromium}=require('playwright-core'));}catch(e){({chromium}=require('playwright'));}
const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','control-cobro-app.html'),'utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8897);
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
(async()=>{
  const b=await chromium.launch();
  let fallas=0;const ok=(n,c)=>{console.log((c?'✅ ':'❌ ')+n);if(!c)fallas++;};
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,acceptDownloads:true});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.goto('http://localhost:8897/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);
  await p.evaluate(()=>entrarListo({email:'cesar@cobros.local'},null));await p.waitForTimeout(600);
  ok('Entró como maestro', await p.evaluate(()=>esMaestro()));
  await p.evaluate(()=>rpAbrir());await p.waitForTimeout(2200);
  ok('Mapeo por vendedor tiene PDF y "Archivo Organic Maps" con compartir', await p.isVisible('#rpBtnM')&&await p.isVisible('#rpBtnK')&&await p.isVisible('#rpBtnKc'));
  await p.screenshot({path:path.join(__dirname,'capturas','kml-reporte-1.png')});
  await p.selectOption('#rpVen','15');
  const hoy=await p.evaluate(()=>rpHoy());
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}).catch(()=>null),p.click('#rpBtnK')]);
  ok('Se descarga el .kml', !!dl);
  const [a,m,d]=hoy.split('-').map(Number),MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m-1];
  ok('Nombre del archivo: mapeo_edwin_morelia_<día><mes>.kml', dl&&dl.suggestedFilename()===`mapeo_edwin_morelia_${d}${MES}.kml`);
  const txt=dl?fs.readFileSync(await dl.path(),'utf8'):'';
  const esperado='<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n<name>Mapeo edwin (morelia) '+d+' '+MES+'</name>\n'+
    '<Placemark><name>01. LA CUCHILLA - Q614.70</name><Point><coordinates>-90.9888658,14.5002191,0</coordinates></Point></Placemark>\n'+
    '<Placemark><name>02. TIENDA SANTI - Q279</name><Point><coordinates>-90.9895494,14.5008534,0</coordinates></Point></Placemark>\n'+
    '<Placemark><name>03. ALFA Y OMEGA #2 - Q726.30</name><Point><coordinates>-90.99062389798002,14.500621823575248,0</coordinates></Point></Placemark>\n</Document>\n</kml>\n';
  ok('Contenido igual al formato de la ruta (mismo cliente = un punto con el total de sus notas; coma al final y lat/lon al revés se arreglan)', txt===esperado);
  if(txt!==esperado)console.log(txt);
  await p.waitForTimeout(300);
  const est=await p.textContent('#rpEst');
  ok('Dice cuántos y cuáles quedaron fuera: "3 clientes · 1 sin ubicación … CLTE GCO."', est.includes('3 clientes')&&est.includes('1 sin ubicación')&&est.includes('CLTE GCO.'));
  ok('Pidió a la PC el mapeo del vendedor 15 de hoy', await p.evaluate(h=>window.__DB.reportes_pedidos.some(x=>x.tipo==='mapa'&&x.vendedor_id===15&&x.desde===h&&x.hasta===h),hoy));
  ok('El botón vuelve a su texto', (await p.textContent('#rpBtnK')).includes('Archivo Organic Maps')&&!(await p.$eval('#rpBtnK',e=>e.disabled)));
  await p.screenshot({path:path.join(__dirname,'capturas','kml-reporte-2.png')});
  // Rango de fechas en el nombre
  const k=await p.evaluate(()=>{const r={desde:'2026-11-08',hasta:'2026-11-10',grupos:[{vendedor:'edwin (morelia)',filas:[{nro:1,cliente:'X',total:5,lat:'14.5',lon:'-90.9'}]}]};
    const r2={desde:'2026-10-30',hasta:'2026-11-02',grupos:r.grupos};return [rpKmlArmar(r),rpKmlArmar(r2)].map(x=>[x.nombre,x.archivo]);});
  ok('Rango: "Mapeo edwin (morelia) 8 al 10 noviembre" · mapeo_edwin_morelia_8al10noviembre.kml', k[0][0]==='Mapeo edwin (morelia) 8 al 10 noviembre'&&k[0][1]==='mapeo_edwin_morelia_8al10noviembre.kml');
  ok('Rango de dos meses: "30 octubre al 2 noviembre"', k[1][0]==='Mapeo edwin (morelia) 30 octubre al 2 noviembre'&&k[1][1]==='mapeo_edwin_morelia_30octubreal2noviembre.kml');
  // Compartir directo (iPhone): manda el archivo .kml al menú de compartir
  const comp=await p.evaluate(async()=>{let dado=null;navigator.canShare=()=>true;navigator.share=async o=>{dado=o;};
    await rpKml(true);return dado&&{n:dado.files[0].name,t:dado.files[0].type,titulo:dado.title};});
  ok('Compartir: abre el menú con el .kml', comp&&/^mapeo_edwin_morelia_.*\.kml$/.test(comp.n)&&comp.t==='application/vnd.google-earth.kml+xml'&&comp.titulo.startsWith('Mapeo edwin (morelia)'));
  // Sin ventas
  await p.evaluate(()=>{RP.vens.push({id:99,codigo:'99',nombre:'nadie'});const s=document.getElementById('rpVen');s.innerHTML=rpOpciones();s.value='99';});
  await p.click('#rpBtnK');await p.waitForTimeout(2500);
  ok('Sin ventas: "No hay ventas en esas fechas"', (await p.textContent('#rpEst')).includes('No hay ventas'));
  // La ruta del viaje sigue igual
  const ruta=await p.evaluate(()=>{viajes.push({id:555,rutero:'juan',pedidos:[{id:1,nombre:'LA CUCHILLA',total:514.7,estado:'pagado',fac:1,lat:14.5002191,lng:-90.9888658}]});
    return rmKml(viajes.find(v=>v.id===555),new Date(2026,10,7));});
  ok('Ruta del viaje: mismo archivo que antes', ruta.archivo==='ruta_juan_7noviembre.kml'&&ruta.txt.includes('<name>Ruta Juan 7 noviembre</name>')&&ruta.txt.includes('<name>01. LA CUCHILLA - Q514.70</name>'));
  ok('Sin errores en la página', errs.length===0);if(errs.length)console.log(errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} prueba(s) fallaron`:'\nTodas las pruebas pasaron');process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
