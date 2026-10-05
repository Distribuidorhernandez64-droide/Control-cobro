const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8873);
const FAKE=`window.supabase={createClient:()=>({from(){const a={select:()=>a,eq:()=>a,order:()=>a,limit:()=>a,
maybeSingle:()=>Promise.resolve({data:null,error:null}),then:r=>Promise.resolve({data:[],error:null}).then(r),
upsert:()=>Promise.resolve({error:null}),insert:()=>Promise.resolve({error:null})};return a;}})};`;
const UA_IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,hasTouch:true,isMobile:true,userAgent:UA_IPHONE});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8873/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 await p.evaluate(()=>{
   ruteros=['Gerson'];const h=m=>new Date(Date.now()-m*60000).toISOString();
   const ped=(n,m)=>({id:nuevoId(),nombre:n,total:m,estado:'pagado',devolucion:0,descuento:0,vuelto:0});
   viajes=[];for(let i=0;i<2;i++)viajes.push({id:nuevoId(),uid:uid(),rutero:'Gerson',pedidos:[ped('a'+i,100),ped('b'+i,200)],cerrado:true,entradaLista:true,pedidosListos:true,horaSalida:h(300-i*100),horaRecibido:h(250-i*100),recibidoPor:'César',envases:'',envOk:false,mod:1});
   viajes.push({id:nuevoId(),uid:uid(),rutero:'Gerson',pedidos:[ped('Pricila',150),ped('La nueva',220),ped('Ana Gonzales',95),ped('Israel perez',310)],cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:h(20),envases:'',envOk:false,mod:1});
   vistaDetalle=false;renderZona();});
 await p.tap('.vrow:has-text("Gerson")');await p.waitForTimeout(900);
 await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(300);
 const t=await p.evaluate(()=>[...document.querySelectorAll('.panelR .vcard')].map(c=>c.innerText.split('\n').slice(0,2).join(' | ')));
 console.log(t);
 ok('Orden: Viaje 3, 2, 1',/Viaje 3/.test(t[0])&&/Viaje 2/.test(t[1])&&/Viaje 1/.test(t[2]));
 ok('En ruta dice 4 pedidos',/En ruta · 4 pedidos · salió/.test(t[0]));
 await p.screenshot({path:'orden.png'});
 console.log(errs.length?errs:'Sin errores de JavaScript');console.log(fail?fail+' FALLARON':'Todas pasaron');await b.close();srv.close();})();
