// Dos teléfonos con la misma nube (28/11/2026): uno saca el consolidado/recuento del viaje mientras el otro anota un cobro.
// El recuento NO debe pisar el cobro, y el cobro NO debe borrar el recuento.
const {chromium}=require('playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const nube=require('./nube-simulada');
const ROOT=path.join(__dirname,'..');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(fs.readFileSync(path.join(ROOT,'control-cobro-app.html')));}).listen(8895);
let fallas=0;const ok=(n,c,x)=>{console.log((c?'✅ ':'❌ ')+n+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)fallas++;};
const hoy=new Date().toLocaleDateString('en-CA');
const L=(c,d,q,p,m)=>({c,d,q,p,x:0,m:m||''});
const nota=(nro,cliente,det)=>({nro,fecha:hoy,hora:'08:00',cliente,codigo_cliente:'10',vendedor:'lesli',vendedor_id:48,total:det.reduce((s,l)=>s+l.q*l.p,0),lineas:det.length,envases:[],detalle:det,estado:'pendiente',anulada:false,regresada:false,pospuesta_hasta:null,monica_cambio:false});
(async()=>{
  const db=nube.nueva();
  db.tablas.pendientes_entrega.push(nota(22901,'TIENDA MARIA JOSE',[L('05','----coca cola 1lt 12ud',2,72)]),nota(22902,'DANIELA XIA',[L('333','----pepsi 1/2lt 24ud',1,85,'4 seven')]));
  db.tablas.puente.push({id:'facturacion',latido:1});
  const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
  const abrir=async()=>{const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
    await nube.conectar(p,db);await p.goto('http://localhost:8895/',{waitUntil:'load'});await p.waitForTimeout(1000);await nube.entrar(p);return p;};
  const A=await abrir(),B=await abrir();
  await A.evaluate(async()=>{await peCargar();PE.sel=new Set([22901,22902]);await peAsignar('Milton');const v=viajes.find(x=>x.rutero==='Milton');await terminarPedidos(v.id,true);});
  await A.waitForTimeout(1200);
  await B.evaluate(async()=>{await actualizarYa();});await B.waitForTimeout(600);
  ok('B ve la ruta de Milton enviada', await B.evaluate(()=>!!viajes.find(x=>x.rutero==='Milton'&&x.entradaLista)));
  // B anota crédito en un pedido (marca el viaje como cambiado y guarda)
  await B.evaluate(async()=>{const v=viajes.find(x=>x.rutero==='Milton');const p=v.pedidos.find(x=>x.fac===22902);p.estado='credito';p.credito=85;tocar(v);await guardarAhora('prueba');});
  await B.waitForTimeout(400);
  // A, con su copia vieja (no ha recargado), saca el consolidado → guarda Recuento 1
  await A.evaluate(()=>abrirVendedor('Milton'));await A.waitForTimeout(300);
  await A.click('.vhead-open .vc-b');await A.waitForTimeout(1500);
  const vn=()=>((db.tablas.dias[0]||{}).estado||{viajes:[]}).viajes.find(x=>x.rutero==='Milton');
  ok('En la nube: el Recuento 1 quedó guardado', (vn().rcs||[]).length===1);
  ok('En la nube: el crédito que anotó B sigue ahí', vn().pedidos.find(x=>x.fac===22902).estado==='credito',vn().pedidos.map(x=>x.estado));
  ok('A ya ve el crédito de B', await A.evaluate(()=>viajes.find(x=>x.rutero==='Milton').pedidos.find(x=>x.fac===22902).estado)==='credito');
  // B vuelve a guardar otro cobro sin haber recargado: el recuento no se pierde
  await B.evaluate(async()=>{const v=viajes.find(x=>x.rutero==='Milton');const p=v.pedidos.find(x=>x.fac===22901);p.devolucion=10;tocar(v);await guardarAhora('prueba 2');});
  await B.waitForTimeout(400);
  ok('Después del guardado de B el recuento sigue en la nube', (vn().rcs||[]).length===1);
  ok('Y la devolución de B quedó', vn().pedidos.find(x=>x.fac===22901).devolucion===10);
  ok('B ahora tiene el recuento', await B.evaluate(()=>(viajes.find(x=>x.rutero==='Milton').rcs||[]).length)===1);
  // Recuentos sacados en los dos teléfonos a la vez: se guardan los dos
  db.tablas.pendientes_entrega.find(f=>f.nro===22901).monica_cambio=true;
  Object.assign(db.tablas.pendientes_entrega.find(f=>f.nro===22901),{monica_detalle:[L('05','----coca cola 1lt 12ud',1,72)],monica_total:72,monica_cambio_en:new Date().toISOString(),enviada_en:new Date().toISOString()});
  db.tablas.pendientes_entrega.forEach(f=>{if(!f.enviada_en)f.enviada_en=new Date().toISOString();});
  await A.evaluate(()=>peVerCerrar());
  for(const P of [A,B]){await P.evaluate(async()=>{await peCargar();abrirVendedor('Milton');});await P.waitForTimeout(800);}
  ok('Los dos teléfonos ven el puntito', await A.isVisible('.vc-b.aviso')&&await B.isVisible('.vc-b.aviso'));
  await Promise.all([A,B].map(P=>P.evaluate(async()=>{const v=viajes.find(x=>x.rutero==='Milton');VC.vid=v.id;await vcGuardar(v);})));
  await A.waitForTimeout(500);
  await B.evaluate(async()=>{await actualizarYa();});await B.waitForTimeout(400);
  ok('Recuentos de los dos teléfonos: ninguno se pierde', (vn().rcs||[]).length===3,(vn().rcs||[]).length);
  const d1=vn().pedidos.find(x=>x.fac===22901);
  ok('Los cobros siguen intactos (crédito; devolución 10 a mano + 72 que Monica descontó)', vn().pedidos.find(x=>x.fac===22902).estado==='credito'&&d1.devolucion===82&&d1.devMon===72,d1);
  ok('Sin errores', !A.errs.length&&!B.errs.length,[...A.errs,...B.errs]);
  await b.close();srv.close();console.log(fallas?`\n${fallas} fallas`:'\nTodo bien');process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
