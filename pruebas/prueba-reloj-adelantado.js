const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8880);
const FAKE=`function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
async function _get(){return (await fetch('/__nube')).json();}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
 async maybeSingle(){if(st.t!=='dias')return {data:null,error:null};const n=await _get();return {data:n[st.f.fecha]||null,error:null};},
 then:r=>Promise.resolve({data:[],error:null}).then(r),
 async upsert(o){const n=await _get();n[o.fecha]=_cp(o);await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});return {error:null};},
 insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:390,height:740},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8880/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 const ADEL=3*60*1000; // la PC va 3 minutos adelantada
 // La PC envía la ruta (su reloj adelantado queda grabado en 'mod' y en la hora de salida)
 await p.evaluate(async(ADEL)=>{
   const hoy=HOY;const pcAhora=Date.now()+ADEL;
   const V={id:1789000000000001,uid:'PC1',rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:false,
     horaSalida:new Date(pcAhora).toISOString(),envases:'',envOk:false,mod:pcAhora,
     pedidos:[{id:1789000000000002,nombre:'Marta mox',total:170.75,estado:'pagado',devolucion:0,descuento:0,vuelto:0}]};
   const n={};n[hoy]={fecha:hoy,actualizado_en:new Date().toISOString(),estado:{ruteros:['gerson'],viajes:[V],auditoria:[],idv:1,idp:1}};
   await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});
 },ADEL);
 // El celular sincroniza y ve la ruta
 await p.evaluate(async()=>{await actualizarYa();selRutero='gerson';renderRuteros();renderZona();});await p.waitForTimeout(500);
 const vid=await p.evaluate(()=>viajes.find(v=>v.uid==='PC1').id);
 // Recibir el dinero en el celular
 await p.tap('#rec-'+vid);await p.waitForTimeout(400);
 const abierto=await p.isVisible('#modalRecibe.open');
 ok('Abre "¿Quién recibió?"', abierto);
 if(abierto){await p.tap('#modalRecibeBody button:has-text("Lesli")');await p.waitForTimeout(1500);}
 console.log('   aviso:',await p.textContent('#toast'));
 const enNube=NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='PC1');
 ok('En la nube queda RECIBIDO', enNube.cerrado===true);
 ok('En la pantalla queda RECIBIDO', await p.evaluate(()=>viajes.find(v=>v.uid==='PC1').cerrado===true));
 ok('Ya no aparece el botón "Dinero recibido"', !(await p.isVisible('#rec-'+vid)));
 // La PC (reloj adelantado, todavía sin ver el recibido) guarda otra cosa de esa ruta
 await p.evaluate(async(ADEL)=>{
   const n=await (await fetch('/__nube')).json();const k=Object.keys(n)[0];
   const V=n[k].estado.viajes.find(v=>v.uid==='PC1');
   const copiaPC=JSON.parse(JSON.stringify(V));copiaPC.cerrado=false;copiaPC.recibidoPor=null;copiaPC.envOk=true;copiaPC.mod=Date.now()+ADEL+60000;
   const r=combinarViajes([copiaPC],n[k].estado.viajes);
   n[k].estado.viajes=r;await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});
 },ADEL);
 ok('La PC adelantada NO puede deshacer el recibido', NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='PC1').cerrado===true);

 // Reabrir a propósito sí funciona, aunque la PC vaya adelantada
 await p.evaluate(async()=>{await actualizarYa();});await p.waitForTimeout(400);
 await p.evaluate(async()=>{const v=viajes.find(x=>x.uid==='PC1');await reabrir(v.id);});await p.waitForTimeout(900);
 ok('Reabrir sí lo reabre', NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='PC1').cerrado===false);
 // y volver a recibir
 const vid2=await p.evaluate(()=>{renderZona();return viajes.find(v=>v.uid==='PC1').id;});await p.waitForTimeout(300);
 await p.tap('#rec-'+vid2);await p.waitForTimeout(400);
 if(await p.isVisible('#modalRecibeBody button:has-text("César")')){await p.tap('#modalRecibeBody button:has-text("César")');await p.waitForTimeout(1500);}
 const fin=NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='PC1');
 ok('Y volver a recibirlo', fin.cerrado===true && fin.recibidoPor==='César');

 // Caso normal, sin desfase de reloj: sigue funcionando
 const vid3=await p.evaluate(async()=>{
   const V={id:nuevoId(),uid:'N1',rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:false,
     horaSalida:new Date(Date.now()-60000).toISOString(),envases:'',envOk:false,mod:Date.now()-60000,
     pedidos:[{id:nuevoId(),nombre:'Ana',total:90,estado:'pagado',devolucion:0,descuento:0,vuelto:0}]};
   viajes.push(V);await guardarAhora('x');renderZona();return V.id;});
 await p.waitForTimeout(300);
 await p.tap('#rec-'+vid3);await p.waitForTimeout(400);
 await p.tap('#modalRecibeBody button:has-text("Lesli")');await p.waitForTimeout(1300);
 ok('Sin desfase de reloj: se recibe normal', NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='N1').cerrado===true);

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
