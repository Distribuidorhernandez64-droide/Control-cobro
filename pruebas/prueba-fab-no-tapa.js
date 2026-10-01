// El menú del botón (+), aunque esté cerrado, NO debe tapar "Dinero recibido".
// Antes: después de usar el (+) una vez, el menú cerrado seguía ocupando
// espacio invisible encima del (+) y se tragaba los toques de la esquina
// derecha (el botón "Dinero recibido" quedaba muerto hasta recargar la app).
const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8891);
const FAKE=`function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
async function _get(){return (await fetch('/__nube')).json();}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
 async maybeSingle(){if(st.t!=='dias')return {data:null,error:null};const n=await _get();return {data:n[st.f.fecha]||null,error:null};},
 then:r=>Promise.resolve({data:[],error:null}).then(r),
 async upsert(o){const n=await _get();n[o.fecha]=_cp(o);await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});return {error:null};},
 insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8891/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 const id=await p.evaluate(async()=>{
   ruteros=['gerson'];
   const muchos=[];for(let i=0;i<10;i++)muchos.push({id:nuevoId(),uid:'C'+i,rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:true,
     horaSalida:new Date(Date.now()-3600000).toISOString(),horaRecibido:new Date(Date.now()-3000000).toISOString(),recibidoPor:'César',mod:Date.now(),
     pedidos:[{id:nuevoId(),nombre:'Cliente '+i,total:100,estado:'pagado',devolucion:0,descuento:0,vuelto:0}]});
   const R={id:nuevoId(),uid:'R',rutero:'gerson',entradaLista:true,pedidosListos:true,cerrado:false,
     horaSalida:new Date(Date.now()-60000).toISOString(),envases:'',envOk:false,mod:Date.now(),
     pedidos:[{id:nuevoId(),nombre:'Dorcas',total:186.25,estado:'pagado',devolucion:0,descuento:0,vuelto:0}]};
   viajes=[...muchos,R];selRutero='gerson';await guardarAhora('inicio');renderRuteros();renderZona();return R.id;});
 await p.waitForTimeout(300);
 // Usar el (+) y cerrarlo, como cuando se crea un viaje
 await p.tap('#fab');await p.waitForTimeout(400);
 await p.tap('#fab');await p.waitForTimeout(400);
 // Ir a la ruta tocando la carita de gerson y bajar al final
 await p.evaluate(id=>irA('gerson',id),id);await p.waitForTimeout(900);
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(400);
 const bb=await p.locator('#rec-'+id).boundingBox();
 const quien=await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e?(e.id||e.className||e.tagName):'nada';},[bb.x+bb.width/2,bb.y+bb.height/2]);
 console.log('   en el centro del botón está:',quien);
 ok('Nada tapa "Dinero recibido" después de usar el (+)',quien==='rec-'+id);
 await p.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(500);
 ok('Al tocarlo sale "¿Quién recibió?"',await p.isVisible('#modalRecibe.open'));
 if(await p.isVisible('#modalRecibe.open')){await p.tap('#modalRecibeBody button:has-text("César")');await p.waitForTimeout(1200);}
 ok('Y queda recibido',await p.evaluate(id=>viajes.find(x=>x.id===id).cerrado===true,id));
 // El (+) sigue funcionando y su menú se puede usar
 await p.tap('#fab');await p.waitForTimeout(400);
 ok('El (+) sigue abriendo su menú',await p.evaluate(()=>_fabAbierto===true));
 ok('Y los vendedores del menú se pueden tocar',await p.evaluate(()=>{const e=document.querySelector('.fabit');if(!e)return false;const r=e.getBoundingClientRect();const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!(h&&e.contains(h));}));
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();process.exit(fail?1:0);
})();
