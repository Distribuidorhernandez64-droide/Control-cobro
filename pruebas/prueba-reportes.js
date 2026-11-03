// Reportes ⚙️ en Cobros (2/11/2026): solo maestro; pide a la PC "vendedores", "ventas" y "mapa" por la tabla
// reportes_pedidos; la "PC" de esta prueba contesta sola; se arma el PDF igual al de Facturación rápida.
// También: "Enviar texto" del Consolidado usa el menú de compartir en el celular.
let chromium;try{({chromium}=require('playwright-core'));}catch(e){({chromium}=require('playwright'));}
const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','control-cobro-app.html'),'utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8896);
const EXE=['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>fs.existsSync(p));
const FAKE=`
window.__DB={reportes_pedidos:[],alertas:[]};window.__seq=1;window.__pcViva=true;
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
// "PC" falsa: contesta los pedidos al segundo
setInterval(()=>{if(!window.__pcViva)return;for(const p of window.__DB.reportes_pedidos){if(p.estado!=='pedido')continue;
  if(p.tipo==='vendedores')p.resultado={ok:true,vendedores:[{id:7,codigo:'7',nombre:'lesli'},{id:42,codigo:'42',nombre:'brenda (pueblo)'}]};
  else p.resultado={ok:true,desde:p.desde,hasta:p.hasta,generado:p.hasta,documentos:p.tipo==='mapa'?2:3,total:300,empresa:{p_cEmpresa:'DISTRIBUIDORA HERNANDEZ'},
    grupos:[{vid:p.vendedor_id||7,codigo:'7',vendedor:p.vendedor_id===42?'brenda (pueblo)':'lesli',subtotal:300,filas:[{tipo:'nota',nro:22282,cliente:'SANTA ELENA',total:100,lat:'14.5',lon:'-90.9'},{tipo:'nota',nro:22283,cliente:'TIENDA',total:200,lat:'',lon:''}]}]};
  p.estado='listo';}},900);
window.supabase={createClient:()=>({
 rpc(){return Promise.resolve({data:null,error:null});},
 channel(){const c={on(){return c;},subscribe(){return c;}};return c;},
 from(t){const st={t,f:[],upd:null,ins:null};
  const filas=()=>(window.__DB[t]||[]).filter(r=>st.f.every(([op,k,v])=>op==='eq'?r[k]===v:op==='gte'?String(r[k])>=String(v):op==='in'?v.includes(r[k]):op==='is'?(v===null?r[k]==null:r[k]===v):true));
  const fin=()=>{if(st.ins){const o=Object.assign({id:window.__seq++,estado:'pedido'},_cp(st.ins));(window.__DB[t]=window.__DB[t]||[]).push(o);return {data:[_cp(o)],error:null};}
    if(st.upd){const fs=filas();fs.forEach(r=>Object.assign(r,_cp(st.upd)));return {data:_cp(fs),error:null};}return {data:_cp(filas()),error:null};};
  const api={select(){return api;},order(){return api;},limit(){return api;},
   eq(k,v){st.f.push(['eq',k,v]);return api;},neq(){return api;},gte(k,v){st.f.push(['gte',k,v]);return api;},
   in(k,v){st.f.push(['in',k,v]);return api;},is(k,v){st.f.push(['is',k,v]);return api;},
   update(o){st.upd=o;return api;},insert(o){st.ins=o;return api;},upsert(){return Promise.resolve({data:null,error:null});},
   maybeSingle(){const d=fin().data;return Promise.resolve({data:d[0]||null,error:null});},single(){return api.maybeSingle();},
   then(res,rej){return Promise.resolve(fin()).then(res,rej);}};
  return api;}})};
`;
(async()=>{
  const b=await chromium.launch(EXE?{executablePath:EXE}:{});
  const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)process.exitCode=1;};
  const abrir=async(u,pw,movil)=>{
    const ctx=await b.newContext(movil?{viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',hasTouch:true}:{viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
    await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
    await p.route('**/jspdf/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'),'utf8')}));
    await p.goto('http://localhost:8896/',{waitUntil:'domcontentloaded'});
    await p.fill('#loginUser',u);await p.fill('#loginPin',pw);await p.click('#loginScreen button');await p.waitForTimeout(500);
    return {p,errs};
  };
  const {p,errs}=await abrir('cesar','19881987');
  ok('Engranaje visible para el maestro',await p.isVisible('.rp-eng'));
  await p.screenshot({path:'/tmp/rp-cab.png',clip:{x:0,y:0,width:390,height:130}}).catch(()=>{});
  await p.click('.rp-eng');await p.waitForTimeout(2600);
  ok('Abre Reportes con Ventas del día y Mapeo',(await p.textContent('#rpPanel')).includes('Ventas del día')&&(await p.textContent('#rpPanel')).includes('Mapeo por vendedor'));
  ok('Carga los vendedores desde la PC',(await p.$$eval('#rpVen option',o=>o.map(x=>x.textContent))).includes('brenda (pueblo)'));
  await p.screenshot({path:'/tmp/rp-panel.png'}).catch(()=>{});
  // capturar el PDF (sin menú de compartir en esta prueba)
  await p.evaluate(()=>{navigator.canShare=null;window.__pdfs=[];const pon=()=>{const O=window.jspdf.jsPDF;window.jspdf.jsPDF=function(...a){const d=new O(...a);d.save=n=>{window.__pdfs.push([n,d.getNumberOfPages()]);};return d;};};
    const vieja=csCargarPdf;csCargarPdf=async()=>{await vieja();if(!window.__pdfPuesto){pon();window.__pdfPuesto=1;}};});
  await p.click('#rpBtnV');await p.waitForTimeout(2600);
  const v=await p.evaluate(()=>window.__pdfs.slice());
  ok('Ventas del día: PDF "Cuentas tienda dd-mm-aaaa" ('+JSON.stringify(v)+')',v.length===1&&/^Cuentas tienda \d\d-\d\d-\d{4}\.pdf$/.test(v[0][0]));
  ok('El pedido quedó con la fecha de hoy',await p.evaluate(()=>{const r=window.__DB.reportes_pedidos.find(x=>x.tipo==='ventas');return r&&r.desde===new Date().toLocaleDateString('en-CA')&&r.pedido_por==='César';}));
  await p.selectOption('#rpVen','42');await p.click('#rpBtnM');await p.waitForTimeout(2600);
  const m=await p.evaluate(()=>window.__pdfs.slice());
  ok('Mapeo: PDF "Mapa brenda (pueblo) dd-mm-aaaa"',m.length===2&&/^Mapa brenda \(pueblo\) \d\d-\d\d-\d{4}\.pdf$/.test(m[1][0]));
  ok('El mapeo pidió el vendedor 42',await p.evaluate(()=>window.__DB.reportes_pedidos.some(x=>x.tipo==='mapa'&&x.vendedor_id===42)));
  // PC apagada
  await p.evaluate(()=>{window.__pcViva=false;const f=Date.now;let base=f();Date.now=()=>base+=20000;});
  await p.click('#rpBtnV');await p.waitForTimeout(6000);
  ok('Si la PC no contesta, lo dice',(await p.textContent('#rpEst')).includes('La PC no respondió'));
  await p.evaluate(()=>{});
  ok('Sin errores de la página',errs.length===0);if(errs.length)console.log(errs);
  // Celular: Enviar texto del consolidado usa compartir
  const c=await abrir('cesar','19881987',true);
  const comp=await c.p.evaluate(async()=>{let dado=null;navigator.share=async o=>{dado=o;};peConsTexto=()=>'*CONSOLIDADO*\n3  coca';await peConsCopiar();return [csPuedeCompartir(),dado&&dado.text];});
  ok('Celular: "Enviar texto" abre compartir con el texto',comp[0]===true&&comp[1]==='*CONSOLIDADO*\n3  coca');
  const pc=await p.evaluate(()=>csPuedeCompartir());
  ok('PC: sigue siendo "Copiar texto"',pc===false);
  // Anotador
  const usuarios=await p.evaluate(()=>USUARIOS.filter(u=>u.rol!=='maestro').map(u=>[u.usuario,u.pass]));
  const q=await abrir(usuarios[0][0],usuarios[0][1]);
  ok('El otro usuario NO ve el engranaje',!(await q.p.isVisible('.rp-eng')));
  await b.close();srv.close();
})();
