const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8879);
const FAKE=`function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
async function _get(){return (await fetch('/__nube')).json();}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
 async maybeSingle(){if(st.t!=='dias')return {data:null,error:null};const n=await _get();const row=n[st.f.fecha]||null;return {data:row,error:null};},
 then:r=>Promise.resolve({data:[],error:null}).then(r),
 async upsert(o){const n=await _get();n[o.fecha]=_cp(o);await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});return {error:null};},
 insert:()=>Promise.resolve({error:null})};return a;}})};`;
// Reloj desfasado para un aparato
const RELOJ=ms=>`(()=>{const D=Date,off=${ms};function F(...a){return a.length?new D(...a):new D(D.now()+off);}
 F.now=()=>D.now()+off;F.UTC=D.UTC;F.parse=D.parse;F.prototype=D.prototype;window.Date=F;})();`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 const abrir=async(nombre,offset)=>{
   const ctx=await b.newContext({viewport:{width:390,height:780},hasTouch:true,isMobile:true});
   if(offset)await ctx.addInitScript(RELOJ(offset));
   const p=await ctx.newPage();p.__errs=[];p.on('pageerror',e=>p.__errs.push(nombre+': '+e.message));
   await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
   await p.goto('http://localhost:8879/control-cobro-app.html',{waitUntil:'networkidle'});
   await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
   await p.tap('#loginScreen button');await p.waitForTimeout(500);return p;};
 const CEL=await abrir('celular',0);
 const PC=await abrir('PC',3*60*1000);   // PC 3 minutos adelantada
 const sync=async p=>{await p.evaluate(async()=>{await actualizarYa();});await p.waitForTimeout(300);};
 // ---- crear y enviar una ruta desde un aparato ----
 const enviar=async(p,vend,cli,monto)=>{
   await p.evaluate(n=>{if(!ruteros.includes(n))ruteros.push(n);selRutero=n;viajeAbierto=null;renderRuteros();renderZona();},vend);
   await p.evaluate(()=>nuevoViaje());await p.waitForTimeout(250);
   const vid=await p.evaluate(()=>viajes[viajes.length-1].id);
   await p.fill('#in-nom-'+vid,cli);await p.fill('#in-mon-'+vid,String(monto));await p.tap('.anotaadd');await p.waitForTimeout(150);
   await p.tap('text=Cerrar pedidos');await p.waitForTimeout(400);
   if(await p.isVisible('#modalRecibe.open'))await p.tap('#modalRecibeBody button:has-text("No lleva")');await p.waitForTimeout(300);
   await p.tap('#viaje-'+vid+' .btn-enviar',{force:true});await p.waitForTimeout(2300);
   return await p.evaluate(id=>viajes.find(v=>v.id===id).uid,vid);};
 // ---- recibir el dinero de una ruta (por uid) en un aparato ----
 const recibir=async(p,u,quien)=>{
   await sync(p);
   const vid=await p.evaluate(u=>{const v=viajes.find(x=>x.uid===u);selRutero=v.rutero;viajeAbierto=null;renderRuteros();renderZona();return v.id;},u);
   await p.waitForTimeout(250);
   await p.tap('#rec-'+vid);await p.waitForTimeout(400);
   if(await p.isVisible('#modalRecibeBody button:has-text("'+quien+'")'))await p.tap('#modalRecibeBody button:has-text("'+quien+'")');
   await p.waitForTimeout(1500);
   return await p.textContent('#toast');};
 const enNube=u=>NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.uid===u)||{};

 // 1) PC (adelantada) envía, celular recibe
 let u1=await enviar(PC,'gerson','Dina',582);
 let t=await recibir(CEL,u1,'César');
 ok('PC envía → celular recibe: queda recibido ('+t+')', enNube(u1).cerrado===true);
 await sync(PC);
 ok('  y la PC lo ve recibido', await PC.evaluate(u=>viajes.find(v=>v.uid===u).cerrado===true,u1));

 // 2) celular envía, PC (adelantada) recibe
 let u2=await enviar(CEL,'Cesar','Ana',300);
 t=await recibir(PC,u2,'Lesli');
 ok('Celular envía → PC recibe: queda recibido ('+t+')', enNube(u2).cerrado===true);
 await sync(CEL);
 ok('  y el celular lo ve recibido', await CEL.evaluate(u=>viajes.find(v=>v.uid===u).cerrado===true,u2));

 // 3) el mismo aparato envía y recibe (celular)
 let u3=await enviar(CEL,'gerson','Marta',170.75);
 t=await recibir(CEL,u3,'César');
 ok('Celular envía y recibe: queda recibido ('+t+')', enNube(u3).cerrado===true);

 // 4) PC envía, celular recibe SIN sincronizar antes (ve la ruta por la sincronización automática)
 let u4=await enviar(PC,'gerson','Pedro',400);
 await sync(CEL);
 await PC.evaluate(async()=>{await guardarAhora('otra cosa');});   // la PC sigue guardando cosas
 t=await recibir(CEL,u4,'Lesli');
 ok('PC sigue guardando mientras el celular recibe: queda recibido ('+t+')', enNube(u4).cerrado===true);
 await PC.evaluate(async()=>{await guardarAhora('otra cosa más');});
 ok('  y la PC NO lo deshace al guardar después', enNube(u4).cerrado===true);

 // 5) Las rutas anteriores siguen recibidas al final
 ok('Al final, las 4 rutas siguen recibidas en la nube', [u1,u2,u3,u4].every(u=>enNube(u).cerrado===true));
 const tot=await CEL.evaluate(()=>{recalc();return document.getElementById('tEfectivo').textContent;});
 ok('Efectivo del día en el celular = Q1,452.75 ('+tot+')', tot==='Q1,452.75');

 const errs=[...CEL.__errs,...PC.__errs];
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript en ningún aparato');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
