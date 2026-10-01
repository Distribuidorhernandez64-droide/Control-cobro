const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8887);
const FAKE=`function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
async function _get(){return (await fetch('/__nube')).json();}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
 async maybeSingle(){if(st.t!=='dias')return {data:null,error:null};const n=await _get();return {data:n[st.f.fecha]||null,error:null};},
 then:r=>Promise.resolve({data:[],error:null}).then(r),
 async upsert(o){const n=await _get();n[o.fecha]=_cp(o);await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});return {error:null};},
 insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:390,height:664},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8887/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 await p.fill('#newRutero','gerson');await p.press('#newRutero','Enter');await p.waitForTimeout(200);
 const nuevo=async(cli,monto)=>{await p.evaluate(()=>nuevoViaje());await p.waitForTimeout(300);
   const vid=await p.evaluate(()=>viajes[viajes.length-1].id);
   await p.fill('#in-nom-'+vid,cli);await p.fill('#in-mon-'+vid,monto);await p.tap('.anotaadd');await p.waitForTimeout(200);
   return vid;};
 const abierto=()=>p.isVisible('#modalRecibe.open');

 // ---- CASO A: "No lleva" ----
 let vid=await nuevo('Maria','250');
 await p.tap('text=Cerrar pedidos');await p.waitForTimeout(500);
 ok('Al cerrar pedidos pregunta "¿Lleva envases?"', (await abierto()) && (await p.textContent('#modalRecibeBody')).includes('¿Lleva envases?'));
 await p.screenshot({path:'env-1-pregunta.png'});
 ok('Mientras arma la ruta el botón + está escondido', await p.isHidden('#fab'));
 await p.tap('#modalRecibeBody button:has-text("No lleva")');await p.waitForTimeout(500);
 ok('"No lleva": se cierra el cuadro', !(await abierto()));
 ok('"No lleva": queda listo para Enviar ruta', await p.isVisible('#viaje-'+vid+' .btn-enviar'));
 ok('"No lleva": no anota envases', !(await p.evaluate(v=>viajes.find(x=>x.id===v).envases,vid)));
 await p.tap('#viaje-'+vid+' .btn-enviar',{force:true});await p.waitForTimeout(2200);
 ok('Ruta enviada y el botón + vuelve a aparecer', await p.isVisible('#fab'));

 // ---- CASO B: "Sí" ----
 vid=await nuevo('Pedro','400');
 await p.tap('text=Cerrar pedidos');await p.waitForTimeout(500);
 // el toque en "Sí" debe dejar el campo enfocado sin esperas (condición del iPhone)
 const enfocado=await p.evaluate(v=>{anotarEnvases(v);return document.activeElement&&document.activeElement.id;},vid);
 ok('"Sí": el campo queda enfocado en el MISMO toque (teclado abre en iPhone)', enfocado==='envModal');
 await p.screenshot({path:'env-2-campo.png'});
 // Listo vacío no deja pasar
 await p.tap('#modalRecibeBody button:has-text("Listo")');await p.waitForTimeout(300);
 ok('Listo vacío: no avanza', await abierto());
 // ← Volver
 await p.tap('#modalRecibeBody button:has-text("Volver")');await p.waitForTimeout(300);
 ok('"← Volver" regresa a la pregunta', (await p.textContent('#modalRecibeBody')).includes('¿Lleva envases?'));
 await p.tap('#modalRecibeBody button:has-text("Sí")');await p.waitForTimeout(300);
 await p.fill('#envModal','2 cajas retornables');
 await p.press('#envModal','Enter');await p.waitForTimeout(800);
 ok('Enter guarda los envases', (await p.evaluate(v=>viajes.find(x=>x.id===v).envases,vid))==='2 cajas retornables');
 ok('Se ven en la tarjeta', (await p.inputValue('#env-'+vid))==='2 cajas retornables');
 ok('Quedan guardados en la nube', NUBE[Object.keys(NUBE)[0]].estado.viajes.some(v=>v.envases==='2 cajas retornables'));
 await p.screenshot({path:'env-3-listo.png'});

 // volver a "Agregar más pedidos" y cerrar otra vez: ya no pregunta
 await p.tap('#viaje-'+vid+' button:has-text("Agregar más pedidos")');await p.waitForTimeout(300);
 await p.tap('text=Cerrar pedidos');await p.waitForTimeout(500);
 ok('Si ya anotó envases, no vuelve a preguntar', !(await abierto()));

 // al enviar la ruta, los envases viajan con ella
 await p.tap('#viaje-'+vid+' .btn-enviar',{force:true});await p.waitForTimeout(2200);
 const env=NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.envases);
 ok('La ruta sale con sus envases', env && env.entradaLista===true);
 // y para recibir el dinero hay que marcar el check de envases (como siempre)
 await p.tap('#rec-'+vid);await p.waitForTimeout(400);
 ok('Para recibir el dinero pregunta si los envases vinieron completos', (await abierto()) && (await p.textContent('#modalRecibeBody')).includes('vinieron completos'));

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
