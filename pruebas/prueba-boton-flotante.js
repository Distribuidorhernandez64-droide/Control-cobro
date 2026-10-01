const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8893);
const FAKE=`window.__DB={dias:{},respaldos:[],seq:1};
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
function _res(d,e){return Promise.resolve({data:_cp(d),error:e||null});}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
maybeSingle(){return _res(st.t==='dias'?(window.__DB.dias[st.f.fecha]||null):null);},
then:r=>Promise.resolve({data:[],error:null}).then(r),
upsert(o){window.__DB.dias[o.fecha]=_cp(o);return _res(null);},
insert(o){const c=_cp(o);c.id=window.__DB.seq++;window.__DB.respaldos.push(c);return _res(null);}};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:412,height:860},deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8893/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.click('#loginScreen button');await p.waitForTimeout(400);
 await p.evaluate(()=>{
   ruteros=['Gerson','Milton','Keny'];
   const t=new Date().toISOString();
   const mk=(r,m,cer)=>({id:nuevoId(),uid:uid(),rutero:r,pedidos:[{id:nuevoId(),nombre:'Cliente',total:m,estado:'pagado',devolucion:0,descuento:0,vuelto:0}],
     cerrado:cer,entradaLista:true,pedidosListos:true,horaSalida:t,horaRecibido:cer?t:null,recibidoPor:cer?'César':null});
   viajes=[mk('Gerson',110,true),mk('Gerson',345,true),mk('Milton',519.5,true)];
   selRutero='Gerson';renderRuteros();renderZona();
 });
 await p.waitForTimeout(400);
 ok('El botón + se ve', await p.isVisible('#fab'));
 await p.screenshot({path:'fab-1-cerrado.png'});

 await p.click('#fab');await p.waitForTimeout(700);
 ok('Se abre el menú', await p.evaluate(()=>document.getElementById('fabMenu').classList.contains('abierto')));
 const rot=await p.evaluate(()=>getComputedStyle(document.querySelector('#fab svg')).transform);
 ok('La cruz gira a X', rot!=='none'&&rot!=='matrix(1, 0, 0, 1, 0, 0)');
 const m=await p.textContent('#fabMenu');
 ok('Lista los 3 vendedores del día', ['Gerson','Milton','Keny'].every(n=>m.includes(n)));
 ok('Ofrece crear vendedor nuevo', m.includes('Nuevo vendedor'));
 await p.screenshot({path:'fab-2-abierto.png'});

 // elegir un vendedor que NO es el seleccionado
 await p.click('#fabMenu .fabit:has-text("Keny")');await p.waitForTimeout(700);
 ok('Cambia al vendedor elegido', (await p.evaluate(()=>selRutero))==='Keny');
 ok('Crea el viaje nuevo ahí', (await p.evaluate(()=>viajes.filter(v=>v.rutero==='Keny').length))===1);
 ok('Se esconde mientras anotás', await p.isHidden('#fab'));
 await p.screenshot({path:'fab-3-viaje.png'});

 // cerrar con el fondo
 await p.evaluate(()=>{viajes=viajes.filter(v=>v.rutero!=='Keny');selRutero='Gerson';renderZona();});
 await p.waitForTimeout(300);
 await p.click('#fab');await p.waitForTimeout(500);
 await p.click('#fabBg',{position:{x:60,y:120}});await p.waitForTimeout(500);
 ok('Se cierra tocando afuera', !(await p.evaluate(()=>document.getElementById('fabMenu').classList.contains('abierto'))));

 // vendedor nuevo
 await p.click('#fab');await p.waitForTimeout(500);
 await p.click('#fabMenu .fabit.nuevo');await p.waitForTimeout(500);
 ok('Abre el cuadro de vendedor nuevo', await p.isVisible('#fabNom'));
 await p.screenshot({path:'fab-4-nuevo.png'});
 await p.fill('#fabNom','Rolvin');
 await p.click('#modalRecibeBody button:has-text("Crear")');await p.waitForTimeout(700);
 ok('Crea el vendedor', await p.evaluate(()=>ruteros.includes('Rolvin')));
 ok('Y le arranca el viaje', (await p.evaluate(()=>viajes.filter(v=>v.rutero==='Rolvin').length))===1);
 ok('Queda seleccionado', (await p.evaluate(()=>selRutero))==='Rolvin');

 // día anterior: no debe aparecer
 await p.evaluate(()=>{viajes=viajes.filter(v=>v.rutero!=='Rolvin');modoLectura=true;renderZona();});
 await p.waitForTimeout(300);
 ok('No aparece viendo un día anterior', await p.isHidden('#fab'));

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
