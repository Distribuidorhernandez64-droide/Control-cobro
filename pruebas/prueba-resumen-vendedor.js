const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8882);
const FAKE=`window.supabase={createClient:()=>({from(){const a={select:()=>a,eq:()=>a,order:()=>a,limit:()=>a,
maybeSingle:()=>Promise.resolve({data:null,error:null}),then:r=>Promise.resolve({data:[],error:null}).then(r),
upsert:()=>Promise.resolve({error:null}),insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8882/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 await p.evaluate(()=>{
   ruteros=['gerson','Milton'];const t=new Date().toISOString();
   const ped=(n,m,e)=>({id:nuevoId(),nombre:n,total:m,estado:e||'pagado',devolucion:0,descuento:0,vuelto:0});
   const vj=(ps,cer)=>({id:nuevoId(),uid:uid(),rutero:'gerson',pedidos:ps,cerrado:cer,entradaLista:true,pedidosListos:true,horaSalida:t,horaRecibido:cer?t:null,recibidoPor:cer?'César':null,envases:'',envOk:false});
   viajes=[vj([ped('a',110)],true),vj([ped('b',345)],true),vj([ped('c',519.5)],true),vj([ped('d',645)],true),
     vj([ped('e',300.75),ped('f',0.0)],true),vj([ped('Tadeo',5657.9,'credito')],true),vj([ped('Silvia',110,'credito')],true),
     vj([ped('Marta mox',170.75)],false)];
   selRutero='gerson';renderRuteros();renderZona();
 });
 await p.waitForTimeout(400);
 const txt=await p.textContent('.resR');
 ok('Muestra 8 viajes y 1 en ruta', /8\s*Viajes/i.test(txt.replace(/\s+/g,' '))&&txt.includes('1 en ruta'));
 ok('Muestra 9 pedidos', /9\s*Pedidos/i.test(txt.replace(/\s+/g,' ')));
 ok('Entregado = efectivo + crédito (Q7,688.15)', txt.includes('Q7,688.15'));
 ok('Efectivo Q1,920.25 y Crédito Q5,767.90', txt.includes('Efectivo Q1,920.25')&&txt.includes('Crédito Q5,767.90'));
 ok('Ya no está el nombre grande ni "+ Nuevo viaje"', !(await p.isVisible('.prHead')) && !(await p.isVisible('button.nb')));
 ok('Chips solo con el nombre (sin total)', !(await p.textContent('#ruteros')).includes('Q'));
 ok('Ya no está "+ Agregar vendedor"', !(await p.isVisible('#newRutero')) && !(await p.textContent('#ruteros')).includes('Agregar'));
 await p.screenshot({path:'res-final.png'});
 // vendedor sin viajes
 await p.evaluate(()=>{selRutero='Milton';renderRuteros();renderZona();});await p.waitForTimeout(300);
 ok('Vendedor sin viajes: invita a tocar +', (await p.textContent('#zona')).includes('para empezar'));
 await p.screenshot({path:'res-vacio.png'});
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
