const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8884);
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
 await p.goto('http://localhost:8884/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);

 // Teléfono: ruta R de gerson en la calle (cliente a crédito) + viaje X que en ESTE teléfono quedó vacío
 const ids=await p.evaluate(async()=>{
   const t=new Date(Date.now()-60000).toISOString();
   ruteros=['gerson'];
   const R={id:nuevoId(),uid:'R',rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:false,horaSalida:t,envases:'',envOk:false,mod:Date.now(),
     pedidos:[{id:nuevoId(),nombre:'Silvia hernandez',total:110,estado:'credito',devolucion:0,descuento:0,vuelto:0}]};
   const X={id:nuevoId(),uid:'X',rutero:'gerson',entradaLista:false,pedidosListos:true,cerrado:false,envases:'',mod:1,pedidos:[]};
   viajes=[R,X];selRutero='gerson';vistaDetalle=true;
   await guardarAhora('inicio');
   return {R:R.id,X:X.id};
 });

 // En la nube hay una ruta X de otro aparato, EN LA CALLE. Este teléfono, por
 // alguna razón, la tiene anotada como "quitada" (borrados).
 await p.evaluate(async()=>{
   const n=await (await fetch('/__nube')).json();const k=Object.keys(n)[0];
   n[k].estado.viajes.push({id:999,uid:'X',rutero:'gerson',entradaLista:true,cerrado:false,
     horaSalida:new Date().toISOString(),mod:Date.now(),pedidos:[{id:777,nombre:'Cliente de la PC',total:500,estado:'pagado'}]});
   await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});
   viajes=viajes.filter(v=>v.uid!=='X'); borrados.push('X');
 });
 // AHORA: recibir el dinero de la ruta R (otra ruta, nada que ver)
 await p.evaluate(()=>{renderZona();});await p.waitForTimeout(300);
 await p.tap('#rec-'+ids.R);await p.waitForTimeout(500);
 await p.tap('#modalRecibeBody button:has-text("César")');await p.waitForTimeout(1500);
 const r=await p.evaluate(id=>{const v=viajes.find(x=>x.id===id);return {cerrado:v&&v.cerrado};},ids.R);
 const enNube=NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='R');
 console.log('   aviso en pantalla:',await p.textContent('#toast'));
 ok('Se puede RECIBIR el dinero de la ruta R', r.cerrado===true);
 ok('Y queda recibido en la nube', enNube&&enNube.cerrado===true);
 ok('La ruta X de la PC sigue en la nube', NUBE[Object.keys(NUBE)[0]].estado.viajes.some(v=>v.uid==='X'));
 ok('Y vuelve a aparecer en el teléfono', await p.evaluate(()=>viajes.some(v=>v.uid==='X')));

 // Ruta enviada desde un aparato con el reloj 2 minutos ADELANTADO
 const idF=await p.evaluate(async()=>{
   const F={id:nuevoId(),uid:'F',rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:false,
     horaSalida:new Date(Date.now()+120000).toISOString(),envases:'',envOk:false,mod:Date.now(),
     pedidos:[{id:nuevoId(),nombre:'Ana',total:300,estado:'pagado',devolucion:0,descuento:0,vuelto:0}]};
   viajes.push(F);renderZona();return F.id;});
 await p.waitForTimeout(300);
 await p.tap('#rec-'+idF);await p.waitForTimeout(500);
 ok('Reloj de otro aparato adelantado: igual deja recibir', await p.isVisible('#modalRecibe.open'));
 if(await p.isVisible('#modalRecibe.open')){await p.tap('#modalRecibeBody button:has-text("César")');await p.waitForTimeout(1200);}
 ok('Y queda recibido', await p.evaluate(id=>viajes.find(x=>x.id===id).cerrado===true,idF));

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
