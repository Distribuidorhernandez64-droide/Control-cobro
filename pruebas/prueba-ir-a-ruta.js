const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8876);
const FAKE=`function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
async function _get(){return (await fetch('/__nube')).json();}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
 async maybeSingle(){if(st.t!=='dias')return {data:null,error:null};const n=await _get();return {data:n[st.f.fecha]||null,error:null};},
 then:r=>Promise.resolve({data:[],error:null}).then(r),
 async upsert(o){const n=await _get();n[o.fecha]=_cp(o);await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});return {error:null};},
 insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8876/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 // El día de gerson: 11 viajes recibidos + el 12 en ruta con "1 caja" sin revisar. Seleccionado: Cesar.
 const vid=await p.evaluate(async()=>{
   ruteros=['gerson','Cesar'];const t=new Date(Date.now()-120000).toISOString();
   const ped=(n,m)=>[{id:nuevoId(),nombre:n,total:m,estado:'pagado',devolucion:0,descuento:0,vuelto:0}];
   viajes=[];
   for(let i=1;i<=11;i++)viajes.push({id:nuevoId(),uid:'g'+i,rutero:'gerson',pedidos:ped('c'+i,100+i),cerrado:true,entradaLista:true,pedidosListos:true,horaSalida:t,horaRecibido:t,recibidoPor:'Lesli',envases:'',envOk:false,mod:Date.now()-100000});
   const V={id:nuevoId(),uid:'g12',rutero:'gerson',pedidos:ped('Monica xicay',231.75),cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:t,envases:'1 caja',envOk:false,mod:Date.now()-60000};
   viajes.push(V);selRutero='Cesar';await guardarAhora('inicio');renderRuteros();renderZona();return V.id;});
 await p.waitForTimeout(400);
 // tocar "gerson" en Rutas en curso
 const nodoAntes=await p.evaluateHandle(()=>document.querySelector('#alerta .rb-p'));
 await p.tap('#alerta .rb-p');await p.waitForTimeout(900);
 ok('Lleva a gerson', await p.evaluate(()=>selRutero)==='gerson');
 ok('El botón tocado NO se destruyó (no se redibuja bajo el dedo)', await p.evaluate(n=>n.isConnected,nodoAntes));
 const vis=await p.evaluate(id=>{const r=document.getElementById('rec-'+id).getBoundingClientRect();return r.top>0&&r.bottom<innerHeight;},vid);
 ok('Bajó hasta la ruta: "Dinero recibido" queda a la vista', vis);
 await p.screenshot({path:'ira-1.png'});
 // tocar Dinero recibido
 await p.tap('#rec-'+vid);await p.waitForTimeout(500);
 ok('"Dinero recibido" responde (pregunta por los envases)', (await p.textContent('#modalRecibeBody')).includes('vinieron completos'));
 await p.tap('#modalRecibeBody button:has-text("Sí, completos")');await p.waitForTimeout(400);
 await p.tap('#modalRecibeBody button:has-text("Lesli")');await p.waitForTimeout(1300);
 const V=NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid==='g12');
 ok('Queda recibido en la nube, con envases revisados', V.cerrado===true&&V.envOk===true&&V.recibidoPor==='Lesli');
 // repetir el gesto varias veces seguidas no traba nada
 for(let k=0;k<4;k++){await p.evaluate(()=>{selRutero='Cesar';renderRuteros();renderZona();});await p.waitForTimeout(150);}
 ok('Sin errores', errs.length===0);
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
