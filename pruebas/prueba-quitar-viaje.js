const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8886);
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
 await p.goto('http://localhost:8886/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 await p.evaluate(n=>{if(!ruteros.includes(n))ruteros.push(n);selRutero=n;vistaDetalle=true;viajeAbierto=null;renderRuteros();renderZona();},'Prueba cesar');await p.waitForTimeout(200);
 await p.evaluate(()=>nuevoViaje());await p.waitForTimeout(300);
 const vid=await p.evaluate(()=>viajes[0].id);
 // vacío desde el principio (fase 1)
 ok('Viaje vacío: botón Quitar viaje con ícono', await p.isVisible('#viaje-'+vid+' .btn-quitar svg'));
 await p.fill('#in-nom-'+vid,'Maria');await p.fill('#in-mon-'+vid,'250');await p.tap('.anotaadd');await p.waitForTimeout(200);
 ok('Con un cliente ya no aparece Quitar viaje', await p.isHidden('#viaje-'+vid+' .btn-quitar'));
 await p.tap('text=Cerrar pedidos');await p.waitForTimeout(400);
 await p.tap('#modalRecibeBody button:has-text("Sí")');await p.waitForTimeout(200);
 await p.fill('#envModal','3 cajas');await p.press('#envModal','Enter');await p.waitForTimeout(700);
 ok('Con clientes: Enviar ruta visible', await p.isVisible('#viaje-'+vid+' .btn-enviar'));
 // borrar el único cliente en el paso de envío
 await p.evaluate(v=>{const x=viajes.find(y=>y.id===v);borrarPedido(v,x.pedidos[0].id);},vid);await p.waitForTimeout(700);
 ok('Sin clientes: Enviar ruta DESAPARECE', await p.isHidden('#viaje-'+vid+' .btn-enviar'));
 ok('Sin clientes: el campo de envases desaparece', await p.isHidden('#env-'+vid));
 ok('Sin clientes: aparece Quitar viaje', await p.isVisible('#viaje-'+vid+' .btn-quitar'));
 ok('Sin clientes: puede volver a agregar pedidos', await p.isVisible('#viaje-'+vid+' button:has-text("Agregar pedidos")'));
 await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(200);
 await p.screenshot({path:'quitar-viaje.png'});
 await p.tap('#viaje-'+vid+' .btn-quitar');await p.waitForTimeout(800);
 ok('Quitar viaje lo elimina', (await p.evaluate(()=>viajes.length))===0);
 ok('Y se borra de la nube', !NUBE[Object.keys(NUBE)[0]].estado.viajes.some(v=>v.rutero==='Prueba cesar'));
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
