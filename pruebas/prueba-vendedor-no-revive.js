const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8891);
// nube que sobrevive recargas de la página (como Supabase real)
let NUBE={};
const FAKE=`
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
async function _get(){const r=await fetch('/__nube');return r.json();}
async function _put(d){await fetch('/__nube',{method:'POST',body:JSON.stringify(d)});}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
 async maybeSingle(){if(st.t!=='dias')return {data:null,error:null};const n=await _get();return {data:n[st.f.fecha]||null,error:null};},
 then:r=>Promise.resolve({data:[],error:null}).then(r),
 async upsert(o){const n=await _get();n[o.fecha]=_cp(o);await _put(n);return {error:null};},
 insert:()=>Promise.resolve({error:null})};return a;}})};`;
srv.removeAllListeners('request');
srv.on('request',(q,r)=>{
 if(q.url==='/__nube'){
   if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));
 }
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));
});
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:412,height:860}});
 const p=await ctx.newPage();
 const errs=[],toasts=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.text().includes('guardar'))console.log('   [app] '+m.text());});
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 const entrar=async()=>{await p.goto('http://localhost:8891/control-cobro-app.html',{waitUntil:'networkidle'});
   if(await p.isVisible('#loginScreen')){await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
   await p.click('#loginScreen button');}await p.waitForTimeout(600);};
 await entrar();
 await p.evaluate(()=>{const o=window.toast;window.__t=[];window.toast=(m,e)=>{window.__t.push(m);o(m,e);};});

 // 1) vendedor Cesar con un viaje de prueba que queda guardado en la nube
 await p.fill('#newRutero','gerson');await p.press('#newRutero','Enter');await p.waitForTimeout(200);
 await p.fill('#newRutero','Cesar');await p.press('#newRutero','Enter');await p.waitForTimeout(200);
 await p.click('button.nb');await p.waitForTimeout(250);
 const vid=await p.evaluate(()=>viajes.find(v=>v.rutero==='Cesar').id);
 await p.fill('#in-nom-'+vid,'Prueba');await p.fill('#in-mon-'+vid,'58');await p.click('.anotaadd');await p.waitForTimeout(200);
 await p.click('text=Cerrar pedidos');await p.waitForTimeout(700);
 ok('El viaje de prueba quedó en la nube', NUBE[Object.keys(NUBE)[0]].estado.viajes.some(v=>v.rutero==='Cesar'));

 // 2) quitarle el cliente, quitar el viaje, eliminar a Cesar (lo que hizo el usuario)
 await p.evaluate(v=>{const x=viajes.find(y=>y.id===v);borrarPedido(v,x.pedidos[0].id);},vid);await p.waitForTimeout(600);
 await p.evaluate(v=>borrarViaje(v),vid);await p.waitForTimeout(800);
 await p.evaluate(()=>borrarRutero('Cesar'));await p.waitForTimeout(800);
 ok('Cesar desaparece de la pantalla', !(await p.evaluate(()=>ruteros.includes('Cesar'))));
 const t=await p.evaluate(()=>window.__t);
 console.log('   avisos que salieron:', t.join(' | '));
 const enNube=NUBE[Object.keys(NUBE)[0]].estado;
 ok('Cesar ya NO está en la nube', !enNube.ruteros.includes('Cesar'));
 ok('Su viaje ya NO está en la nube', !enNube.viajes.some(v=>v.rutero==='Cesar'));

 // 3) recargar la app (o que otro aparato abra): ¿vuelve Cesar?
 await entrar();
 ok('Tras recargar, Cesar NO vuelve', !(await p.evaluate(()=>ruteros.includes('Cesar'))));
 await p.click('#fab');await p.waitForTimeout(500);
 ok('Y no aparece en el botón +', !(await p.textContent('#fabMenu')).includes('Cesar'));

 // 4) La protección del dinero sigue: una ruta que YA SALIÓ no se borra
 //    aunque este aparato la haya mandado a quitar
 await p.evaluate(async()=>{
   const n=await (await fetch('/__nube')).json(); const k=Object.keys(n)[0];
   n[k].estado.viajes.push({uid:'en-ruta-x',id:1,rutero:'gerson',entradaLista:true,cerrado:false,
     horaSalida:new Date().toISOString(),mod:Date.now(),pedidos:[{id:5,nombre:'Ana',total:654,estado:'pagado'}]});
   await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});
   borrados.push('en-ruta-x');
   const r=await guardarAhora('prueba'); borrados.pop(); window.__r=r;
 });
 ok('Ruta EN CALLE: se guarda igual y sigue protegida (no se borra)', (await p.evaluate(()=>window.__r))===true
    && NUBE[Object.keys(NUBE)[0]].estado.viajes.some(v=>v.uid==='en-ruta-x'));

 await p.evaluate(async()=>{
   const n=await (await fetch('/__nube')).json(); const k=Object.keys(n)[0];
   n[k].estado.viajes=n[k].estado.viajes.filter(v=>v.uid!=='en-ruta-x');
   n[k].estado.viajes.push({uid:'cobrada-x',id:2,rutero:'gerson',entradaLista:true,cerrado:true,recibidoPor:'Lesli',
     horaSalida:new Date().toISOString(),mod:Date.now(),pedidos:[{id:6,nombre:'Eben',total:714,estado:'pagado'}]});
   await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});
   borrados.push('cobrada-x');
   const r=await guardarAhora('prueba'); borrados.pop(); window.__r=r;
 });
 ok('Ruta YA COBRADA: se guarda igual y sigue protegida (no se borra)', (await p.evaluate(()=>window.__r))===true
    && NUBE[Object.keys(NUBE)[0]].estado.viajes.some(v=>v.uid==='cobrada-x'));

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
