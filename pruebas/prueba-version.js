const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let VER_NAV=null, VER_FETCH=null;   // qué versión sirve el "GitHub" falso (null = la real)
const BASE=fs.readFileSync(path.join(ROOT,'control-cobro-app.html'),'utf8');
const REAL=BASE.match(/const VERSION='([^']+)'/)[1];
const conVer=v=>v?BASE.replace(/const VERSION='[^']+'/,"const VERSION='"+v+"'"):BASE;
const srv=http.createServer((q,r)=>{
 const u=q.url;
 if(u.startsWith('/control-cobro-app.html')){
   const esFetch=u.includes('nv=');
   r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return r.end(conVer(esFetch?VER_FETCH:VER_NAV));}
 const f=path.join(ROOT,decodeURIComponent(u.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8877);
const FAKE=`window.supabase={createClient:()=>({from(){const a={select:()=>a,eq:()=>a,order:()=>a,limit:()=>a,
maybeSingle:()=>Promise.resolve({data:null,error:null}),then:r=>Promise.resolve({data:[],error:null}).then(r),
upsert:()=>Promise.resolve({error:null}),insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 const ctx=await b.newContext({viewport:{width:390,height:780}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8877/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.click('#loginScreen button');await p.waitForTimeout(500);
 ok('Muestra la versión al lado del nombre (v'+REAL+')', (await p.textContent('#verApp'))==='v'+REAL);
 await p.waitForTimeout(4500);
 ok('Si no hay versión nueva, no recarga ni avisa', await p.evaluate(v=>VERSION===v,REAL) && await p.isHidden('#avisoVersion'));

 // Se publica una versión nueva y se vuelve a la app
 VER_NAV=VER_FETCH='2099-01-01.1';
 await Promise.all([p.waitForNavigation({timeout:8000}).catch(()=>null), p.evaluate(()=>revisarVersion(true))]);
 await p.waitForTimeout(800);
 ok('Versión nueva publicada: se actualiza sola', await p.evaluate(()=>VERSION)==='2099-01-01.1');
 ok('Sigue con la sesión abierta (no pide clave otra vez)', await p.isHidden('#loginScreen'));

 // Sin ciclo: GitHub sigue dando la vieja al abrir, pero la revisión ve otra más nueva
 VER_NAV='2099-01-01.1'; VER_FETCH='2099-01-01.2';
 let navs=0;p.on('framenavigated',f=>{if(f===p.mainFrame())navs++;});
 await p.evaluate(()=>revisarVersion(true));await p.waitForTimeout(1500);
 await p.evaluate(()=>revisarVersion(true));await p.waitForTimeout(1500);
 await p.evaluate(()=>revisarVersion(true));await p.waitForTimeout(1500);
 ok('Si la página nueva no llega, recarga UNA sola vez (sin ciclo): '+navs, navs<=1);
 ok('Y deja el aviso "Tocá para actualizar"', await p.isVisible('#avisoVersion'));

 // Con una ruta a medio armar NO recarga sola
 VER_NAV=VER_FETCH='2099-01-01.3';
 await p.evaluate(()=>{ruteros=['gerson'];selRutero='gerson';viajes=[{id:nuevoId(),uid:'P',rutero:'gerson',pedidos:[{id:1,nombre:'x',total:5,estado:'pagado'}],cerrado:false,entradaLista:false,pedidosListos:false}];renderRuteros();renderZona();
   document.getElementById('avisoVersion').style.display='none';});
 const antes=navs;
 await p.evaluate(()=>revisarVersion(true));await p.waitForTimeout(1500);
 ok('Con una ruta a medio armar NO recarga sola', navs===antes);
 ok('Solo muestra el aviso', await p.isVisible('#avisoVersion'));
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
