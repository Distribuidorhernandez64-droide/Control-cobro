const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8883);
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
 await p.goto('http://localhost:8883/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 // Viaje 8: Marta mox Q170.75, 2 cajas, en ruta (guardado en la nube)
 const vid=await p.evaluate(async()=>{
   ruteros=['gerson'];
   const V={id:nuevoId(),uid:'V8',rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:false,
     horaSalida:new Date(Date.now()-60000).toISOString(),envases:'2 cajas',envOk:false,mod:Date.now()-60000,
     pedidos:[{id:nuevoId(),nombre:'Marta mox',total:170.75,estado:'pagado',devolucion:0,descuento:0,vuelto:0}]};
   viajes=[V];selRutero='gerson';await guardarAhora('inicio');renderZona();return V.id;});
 await p.waitForTimeout(300);
 // marcar el check de envases
 await p.tap(`#viaje-${vid} div[onclick^="toggleEnvOk"]`);await p.waitForTimeout(300);
 ok('Check marcado', await p.evaluate(id=>viajes.find(x=>x.id===id).envOk===true,vid));
 // otro aparato guarda cualquier cosa → este teléfono sincroniza (🔄 o la de cada 5 min)
 await p.evaluate(async()=>{const n=await (await fetch('/__nube')).json();const k=Object.keys(n)[0];
   n[k].actualizado_en=new Date().toISOString();n[k].estado.ruteros.push('Otro');
   await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});});
 await p.evaluate(async()=>{await actualizarYa();});await p.waitForTimeout(600);
 ok('Después de sincronizar el check SIGUE marcado', await p.evaluate(id=>viajes.find(x=>x.id===id).envOk===true,vid));
 ok('El check quedó guardado en la nube', NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='V8').envOk===true);
 // recibir el dinero
 await p.tap('#rec-'+vid);await p.waitForTimeout(500);
 const abierto=await p.isVisible('#modalRecibe.open');
 console.log('   al tocar Dinero recibido:', abierto?(await p.textContent('#modalRecibeBody')).replace(/\s+/g,' ').slice(0,70):'aviso → '+await p.textContent('#toast'));
 if(abierto&&await p.isVisible('#modalRecibeBody button:has-text("César")')){
   await p.tap('#modalRecibeBody button:has-text("César")');await p.waitForTimeout(1200);}
 ok('Se recibe el dinero', await p.evaluate(id=>viajes.find(x=>x.id===id).cerrado===true,vid));
 // Otra ruta con envases SIN revisar: al tocar Dinero recibido debe preguntar, no trabarse
 const v2=await p.evaluate(async()=>{
   const V={id:nuevoId(),uid:'V9',rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:false,
     horaSalida:new Date(Date.now()-60000).toISOString(),envases:'3 cajas',envOk:false,mod:Date.now(),
     pedidos:[{id:nuevoId(),nombre:'Ana',total:200,estado:'pagado',devolucion:0,descuento:0,vuelto:0}]};
   viajes.push(V);renderZona();return V.id;});
 await p.waitForTimeout(300);
 await p.tap('#rec-'+v2);await p.waitForTimeout(500);
 ok('Sin check: pregunta "¿Los envases vinieron completos?"', (await p.textContent('#modalRecibeBody')).includes('vinieron completos'));
 await p.screenshot({path:'envok-pregunta.png'});
 await p.tap('#modalRecibeBody button:has-text("Sí, completos")');await p.waitForTimeout(400);
 ok('Con "Sí" sigue directo a ¿Quién recibió?', (await p.textContent('#modalRecibeBody')).includes('Recibió el dinero'));
 await p.tap('#modalRecibeBody button:has-text("César")');await p.waitForTimeout(1200);
 const r2=NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='V9');
 ok('Queda recibido y con envases revisados en la nube', r2&&r2.cerrado===true&&r2.envOk===true);

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
