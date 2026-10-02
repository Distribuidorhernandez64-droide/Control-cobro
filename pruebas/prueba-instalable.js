const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const TIPO={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{
  const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
  r.writeHead(200,{'Content-Type':TIPO[path.extname(f)]||'application/octet-stream'});
  r.end(fs.readFileSync(f));
}).listen(8894);
const FAKE=`window.supabase={createClient:()=>({from(){const a={select:()=>a,eq:()=>a,order:()=>a,limit:()=>a,
maybeSingle:()=>Promise.resolve({data:null,error:null}),then:r=>Promise.resolve({data:[],error:null}).then(r),
upsert:()=>Promise.resolve({error:null}),insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:412,height:900}});
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 const errs=[],f404=[];
 p.on('pageerror',e=>errs.push(e.message));
 p.on('response',r=>{if(r.status()>=400)f404.push(r.status()+' '+r.url().split('/').pop());});
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8894/control-cobro-app.html',{waitUntil:'networkidle'});

 const man=await p.evaluate(async()=>{
   const l=document.querySelector('link[rel=manifest]');
   if(!l)return null;
   const r=await fetch(l.href);
   return {status:r.status, tipo:r.headers.get('content-type'), json:await r.json()};
 });
 ok('El manifest carga bien', man && man.status===200);
 ok('Se abre sin barra del navegador (standalone)', man.json.display==='standalone');
 ok('Abre en la pantalla correcta', man.json.start_url==='control-cobro-app.html');
 ok('Nombre en la pantalla de inicio: "'+man.json.short_name+'"', !!man.json.short_name);

 for(const ic of man.json.icons){
   const r=await p.evaluate(u=>fetch(u).then(r=>r.status),new URL(ic.src,'http://localhost:8894/').href);
   ok('Icono '+ic.sizes+' existe', r===200);
 }
 const at=await p.evaluate(()=>fetch(document.querySelector('link[rel="apple-touch-icon"]').href).then(r=>r.status));
 ok('Icono de iPhone (180px) existe', at===200);
 ok('Título en iPhone definido',
   (await p.getAttribute('meta[name="apple-mobile-web-app-title"]','content'))==='Cobros');

 // la app sigue funcionando igual
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.click('#loginScreen button');await p.waitForTimeout(500);
 ok('La app sigue entrando normal', await p.isHidden('#loginScreen'));
 await p.evaluate(n=>{if(!ruteros.includes(n))ruteros.push(n);selRutero=n;vistaDetalle=true;viajeAbierto=null;renderRuteros();renderZona();},'Prueba');await p.waitForTimeout(300);
 ok('Y sigue funcionando', (await p.textContent('#zona')).includes('Prueba'));

 console.log(f404.length?'\n⚠ Archivos que faltan: '+f404.join(', '):'\nNingún archivo faltante');
 console.log(errs.length?'⚠ '+errs.join(' | '):'Sin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
