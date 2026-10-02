const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8871);
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
 await p.goto('http://localhost:8871/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 await p.evaluate(()=>{
   ruteros=['Cesar'];const t=new Date().toISOString();
   const ped=(n,m)=>({id:nuevoId(),nombre:n,total:m,estado:'pagado',devolucion:0,descuento:0,vuelto:0});
   viajes=[];for(let i=0;i<4;i++)viajes.push({id:nuevoId(),uid:uid(),rutero:'Cesar',pedidos:[ped('a'+i,100),ped('b'+i,200),ped('c'+i,300)],cerrado:true,entradaLista:true,pedidosListos:true,horaSalida:t,horaRecibido:t,recibidoPor:'César',envases:'',envOk:false,mod:1});
   viajes.push({id:nuevoId(),uid:uid(),rutero:'Cesar',pedidos:[ped('Julio',580),ped('Pedro',780)],cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:t,envases:'',envOk:false,mod:1});
   vistaDetalle=false;renderZona();});
 await p.tap('.vrow:has-text("Cesar")');await p.waitForTimeout(900);
 const r=await p.evaluate(()=>{const hd=document.querySelector('header').getBoundingClientRect(),ch=document.querySelector('.chathd').getBoundingClientRect();
   return {scroll:Math.round(scrollY),hdBottom:Math.round(hd.bottom),chTop:Math.round(ch.top),chBottom:Math.round(ch.bottom)};});
 ok('Desplazado hacia abajo, el círculo y el nombre siguen fijos bajo el encabezado '+JSON.stringify(r), r.scroll>200 && Math.abs(r.chTop-r.hdBottom)<=2);
 const card=await p.evaluate(()=>{const c=document.querySelector('.vcard.abierta').getBoundingClientRect(),ch=document.querySelector('.chathd').getBoundingClientRect();return {cardTop:Math.round(c.top),chBottom:Math.round(ch.bottom)};});
 ok('La ruta pendiente no queda escondida detrás del nombre fijo '+JSON.stringify(card), card.cardTop>=card.chBottom);
 await p.screenshot({path:'fijo-1.png'});
 // crear un viaje: la barra de anotar dice para quién es
 await p.evaluate(()=>{viajes=viajes.filter(v=>v.cerrado);renderZona();nuevoViaje();});await p.waitForTimeout(400);
 const vid=await p.evaluate(()=>viajes[viajes.length-1].id);
 await p.fill('#in-nom-'+vid,'Tadeo');await p.fill('#in-mon-'+vid,'580');await p.tap('.anotaadd');await p.waitForTimeout(300);
 const barra=await p.textContent('.anotacont');
 ok('La barra de anotar dice para quién es ("'+barra.trim()+'")', barra.includes('Cesar') && barra.includes('1 cliente ·'));
 // teclado abierto en iPhone: la barra sube por encima de la barrita flotante de Safari
 const tr=await p.evaluate(()=>{
   Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:470,offsetTop:0,width:393,addEventListener(){}}});
   ajustarBarraTeclado();return document.querySelector('.anotabar').style.transform;});
 const esperado='translateY(-'+(852-470+50)+'px)';
 ok('iPhone con teclado: la barra sube 50px extra sobre la barrita de Safari ('+tr+')', tr===esperado);
 await p.screenshot({path:'fijo-2.png'});
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
