// Ruta de… en Android (23/11/2026): Chrome no comparte .kml → se baja a Descargas con aviso, y "Enviar por
// WhatsApp" sube el .kml a Supabase Storage (bucket 'rutas') y comparte el enlace.
// Reportes ⚙️ › Mapeo por vendedor › "Archivo Organic Maps" (10/11/2026): con los mismos datos del PDF (la PC
// los lee de Monica con lat/lon de cada cliente) arma el .kml igual al de la ruta: "01. CLIENTE - Q total".
// La "PC" de esta prueba contesta sola (base falsa en la página). Ya entra con sesión de Supabase falsa.
let chromium;try{({chromium}=require('playwright-core'));}catch(e){({chromium}=require('playwright'));}
const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','control-cobro-app.html'),'utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8899);
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
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true,
    userAgent:'Mozilla/5.0 (Linux; Android 14; SM-A156M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.goto('http://localhost:8899/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);
  await p.evaluate(()=>{entrarListo({email:'cesar@cobros.local'},null);
    viajes.push({id:801,rutero:'Pedro',pedidos:[
      {id:1,nombre:'TIENDA NOEMI',total:314,estado:'pagado',fac:23207,lat:14.500845,lng:-90.952338},
      {id:2,nombre:'IRMA TEJAX',total:279.5,estado:'pagado',fac:23206,lat:14.5031,lng:-90.9551},
      {id:3,nombre:'CLTE GCO. lesvia santos',total:80,estado:'pagado',fac:23210}]});rutaMaps(801);});
  await p.waitForTimeout(300);
  const bot=await p.$$eval('#modalRecibeBody .rm-btns button, #modalRecibeBody .rm-btns a',xs=>xs.map(x=>x.textContent.trim()));
  ok('Android: Archivo Organic Maps · Abrir Google Maps · Copiar ('+bot.join(' | ')+')', bot.join('|')==='Archivo Organic Maps|Abrir Google Maps|Copiar');
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('#modalRecibeBody .rm-om')]);
  await p.waitForTimeout(600);
  ok('Android: "Archivo Organic Maps" baja el .kml', dl&&/^ruta_pedro_\d+[a-z]+\.kml$/.test(dl.suggestedFilename()));
  ok('Android: avisa que quedó en Descargas', (await p.evaluate(()=>[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' '))).includes('Guardado en Descargas'));
  // En iPhone no sale el botón nuevo
  await p.screenshot({path:path.join(__dirname,'capturas','android-ruta.png')});
  ok('Sin errores en la página', errs.length===0);if(errs.length)console.log(errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} prueba(s) fallaron`:'\nTodas las pruebas pasaron');process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
