// Prueba del Consolidado de carga de las notas escogidas en Por entregar con la librería real de Supabase contra una base local
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
  r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8899);
const sql=s=>execSync(`psql -h /var/tmp/pgtest -p 55432 -U postgres -At -c "${s.replace(/"/g,'\\"')}"`,{encoding:'utf8'}).trim();
async function rest(metodo,ruta,cuerpo,prefer){
  const r=await fetch(LOCAL+'/rest/v1/'+ruta,{method:metodo,headers:{apikey:JWT,Authorization:'Bearer '+JWT,'Content-Type':'application/json',Prefer:prefer||'return=representation'},body:cuerpo?JSON.stringify(cuerpo):undefined});
  const t=await r.text();return {status:r.status,data:t?JSON.parse(t):null};
}
const CAJA=q=>({n:'cajas',u:'caja',v:'cajas',q}), CIL25=q=>({n:'cil25',u:'cilindro 25lb',v:'cilindros 25lb',q});
const fila=(nro,cliente,vend,vid,total,hora,cod,envases)=>({nro,fecha:'2026-10-24',hora,cliente,codigo_cliente:cod,vendedor:vend,vendedor_id:vid,total,lineas:4,envases:envases||[]});
let fallas=0;const ok=(n,c)=>{console.log((c?'✅ ':'❌ ')+n);if(!c)fallas++;};


const L=(c,d,q,p,m)=>({c,d,q,p,x:0,m:m||''});
const hoy=new Date().toLocaleDateString('en-CA');
const nota=(nro,cliente,vend,vid,hora,det)=>({nro,fecha:hoy,hora,cliente,codigo_cliente:'10',vendedor:vend,vendedor_id:vid,total:det.reduce((s,l)=>s+l.q*l.p,0),lineas:det.length,envases:[],detalle:det});
const JSPDF=process.env.JSPDF;
(async()=>{
  sql('truncate pendientes_entrega; truncate puente; truncate dias; truncate respaldos;');
  await rest('POST','pendientes_entrega',[
    nota(22301,'CLTE GCO.  leticia xia','brenda (pueblo)',42,'08:00',[L('333','----pepsi 1/2lt 24ud',1,85,'4 seven 4 mirinda'),L('05','----coca cola 1lt 12ud',2,72),L('7404001800233','---sopa laky men vaso camaron 12ud',1,46),L('748757002600','Nachos diana 12ud',1,10.25)]),
    nota(22302,'TIENDA EBEN EZER','brenda (pueblo)',42,'08:05',[L('333','----pepsi 1/2lt 24ud',0.5,85,'solo seven'),L('01','----coca-cola 12onz 24ud',1.5,82),L('023','---jugos pulp 250ml manzana 24ud',1,50),L('900','---bonificacion pepsi 1/2lt',1,0)]),
    nota(22303,'CLIENTE  milton','lesli',48,'08:10',[L('332','----pepsi 1 1/4lt 12ud',1,64.5),L('023','---jugos pulp 250ml manzana 24ud',0.5,50),L('781179001059','---azucar caña real 5lb',1,23.5)]),
    nota(22304,'TIENDA SIN PRODUCTOS','lesli',48,'08:20',[L('748757002600','Nachos diana 12ud',2,10.25)])]);
  sql("update pendientes_entrega set detalle=null where nro=22304");
  await rest('POST','puente?on_conflict=id',[{id:'facturacion',latido:1}],'resolution=merge-duplicates,return=minimal');
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true});
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:UMD}));
  await p.route('**/cdnjs.cloudflare.com/ajax/libs/jspdf/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(JSPDF,'utf8')}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.route('https://shlolncjhfzqmcllwjrk.supabase.co/**',async r=>{
    const u=r.request().url().replace('https://shlolncjhfzqmcllwjrk.supabase.co',LOCAL);
    const h={...r.request().headers(),authorization:'Bearer '+JWT,apikey:JWT};
    const res=await r.fetch({url:u,headers:h});await r.fulfill({response:res});
  });
  await p.goto('http://localhost:8899/control-cobro-app.html',{waitUntil:'networkidle'});
  await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');await p.click('#loginScreen button');
  await p.waitForTimeout(1500);
  await p.evaluate(()=>peAbrir());await p.waitForTimeout(1000);
  ok('Sin notas escogidas no aparece el botón Consolidado', !(await p.isVisible('#peConsBtn')));
  await p.click('.pe-card:has-text("leticia")');await p.click('.pe-card:has-text("EBEN EZER")');await p.click('.pe-card:has-text("milton")');await p.click('.pe-card:has-text("SIN PRODUCTOS")');
  await p.waitForTimeout(300);
  ok('Al escoger notas aparece "Consolidado" arriba', await p.isVisible('#peConsBtn'));
  await p.screenshot({path:SHOTS+'/k1-boton-consolidado.png'});
  await p.click('#peConsBtn');await p.waitForTimeout(600);
  const filas=await p.$$eval('#peVista .cs-l',a=>a.map(x=>x.querySelector('.cs-q').textContent+' '+x.querySelector('.cs-n').textContent));
  ok('Orden: grupo 1 (pepsi 1 1/4, coca 1lt) → grupo 2 (coca 12onz, pepsi 1/2) → alfabético (jugos)', JSON.stringify(filas)===JSON.stringify(['1.00 pepsi 1 1/4lt 12ud','2.00 coca cola 1lt 12ud','1.50 coca-cola 12onz 24ud','1.50 pepsi 1/2lt 24ud','1.50 jugos pulp 250ml manzana 24ud','1.00 bonificacion pepsi 1/2lt']));
  let t=await p.textContent('#peVista');
  ok('Sin guiones al inicio, sin Laky ni azúcar, sin productos sin guion', !t.includes('----')&&!t.includes('laky')&&!t.includes('azucar')&&!t.includes('Nachos'));
  ok('Cada nota de sabor en su renglón con su cantidad', t.includes('4 seven 4 mirinda')&&t.includes('solo seven'));
  ok('Bonificaciones aparte', t.includes('Bonificaciones'));
  ok('Encabezado: 3 notas · 6 productos (la que no tiene productos no cuenta) y la lista de notas', t.includes('3 notas · 6 productos')&&t.includes('22301')&&t.includes('leticia xia'));
  ok('Avisa la nota que todavía no tiene productos', t.includes('Sin productos todavía: 22304'));
  ok('Hay separación entre grupos', (await p.$$('#peVista .cs-l.gap')).length===2);
  await p.screenshot({path:SHOTS+'/k2-consolidado.png'});
  await p.click('.cs-sw');await p.waitForTimeout(300);
  t=await p.textContent('#peVista');
  ok('"Solo cajas" apagado: aparecen los productos sin guion (Nachos), pero nunca Laky/azúcar', t.includes('Nachos diana 12ud')&&!t.includes('laky')&&!t.includes('azucar'));
  await p.click('.cs-sw');await p.waitForTimeout(300);
  // Texto para WhatsApp
  const txt=await p.evaluate(()=>peConsTexto());
  ok('Texto para WhatsApp como el de Facturación rápida', txt.startsWith('*CONSOLIDADO DE CARGA*')&&txt.includes('3 notas: leticia xia, EBEN EZER, milton')&&txt.includes('1.50  pepsi 1/2lt 24ud')&&txt.includes('      4 seven 4 mirinda  Cant. = 1.00')&&txt.includes('*BONIFICACIONES*'));
  // PDF
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('#peVista .pv-btn:not(.quitar)')]);
  const ruta=SHOTS+'/consolidado.pdf';await dl.saveAs(ruta);
  const pdfTxt=execSync(`pdftotext -layout "${ruta}" -`,{encoding:'utf8'});
  ok('PDF: DISTRIBUIDORA HERNANDEZ, Consolidado de carga y las notas', pdfTxt.includes('DISTRIBUIDORA HERNANDEZ')&&pdfTxt.includes('Consolidado de carga')&&pdfTxt.includes('22301')&&pdfTxt.includes('3 notas'));
  ok('PDF: cantidades y sabores', pdfTxt.includes('pepsi 1/2lt 24ud')&&pdfTxt.includes('Cantidad = 1.00')&&pdfTxt.includes('BONIFICACIONES'));
  console.log(pdfTxt.split('\n').slice(0,22).join('\n'));
  // Deslizar hacia abajo lo cierra (igual que la vista previa)
  await p.evaluate(()=>peVerCerrar());await p.waitForTimeout(300);
  ok('Se cierra y siguen escogidas las notas', !(await p.evaluate(()=>PE.vista))&&(await p.evaluate(()=>PE.sel.size))===4);
  ok('Sin errores en la página', errs.length===0);
  if(errs.length)console.log(errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} FALLA(S)`:'\nTodas las pruebas pasaron');
  process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
