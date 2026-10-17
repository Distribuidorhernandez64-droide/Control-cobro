const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8877);
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
 await p.goto('http://localhost:8877/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(400);
 const vid=await p.evaluate(()=>{ruteros=['Milton'];
   const v={id:nuevoId(),uid:uid(),rutero:'Milton',pedidos:[{id:nuevoId(),nombre:'Marvin',total:178.25,estado:'pagado',devolucion:0,descuento:0,vuelto:0}],cerrado:false,entradaLista:false,pedidosListos:true,envases:'',envOk:false,mod:1};
   viajes=[v];selRutero='Milton';vistaDetalle=true;renderZona();return v.id;});
 const prueba=async(texto)=>{
   await p.evaluate(id=>{const v=viajes.find(x=>x.id===id);v.envases='';preguntarEnvases(id);anotarEnvases(id);},vid);
   const tipo=await p.evaluate(()=>document.getElementById('envModal').type);
   await p.keyboard.type(texto,{delay:30});
   const val=await p.evaluate(()=>{const e=document.getElementById('envModal');return [e.type,e.value];});
   await p.tap('#modalRecibe button:has-text("Listo")');await p.waitForTimeout(200);
   const g=await p.evaluate(id=>viajes.find(x=>x.id===id).envases,vid);
   return {tipo,val,g};};
 let r=await prueba('3.5');
 ok('Abre con teclado de números y guarda "3.5" '+JSON.stringify(r), r.tipo==='number'&&r.g==='3.5');
 r=await prueba('2 cajas retornables');
 ok('Al escribir letras pasa a texto sin perder nada '+JSON.stringify(r), r.val[0]==='text'&&r.g==='2 cajas retornables');
 r=await prueba('10cajas');
 ok('"10cajas" también '+JSON.stringify(r), r.g==='10cajas');
 // El botón abc / 123 cambia de teclado
 const bt=await p.evaluate(id=>{const v=viajes.find(x=>x.id===id);v.envases='';preguntarEnvases(id);anotarEnvases(id);
   const el=document.getElementById('envModal'),b=document.getElementById('envTec');const r=[el.type,b.textContent];
   b.click();r.push(el.type,b.textContent,document.activeElement===el);b.click();r.push(el.type,b.textContent);return r;},vid);
 ok('Botón abc pasa a letras y 123 regresa a números '+JSON.stringify(bt), bt.join()==='number,abc,text,123,true,number,abc');
 r=await (async()=>{await p.evaluate(id=>{preguntarEnvases(id);anotarEnvases(id);},vid);await p.keyboard.type('4');await p.tap('#envTec');await p.keyboard.type(' cajas');
   const v=await p.evaluate(()=>document.getElementById('envModal').value);await p.tap('#modalRecibe button:has-text("Listo")');return v;})();
 ok('4 → toca abc → " cajas" = "4 cajas" ('+r+')', r==='4 cajas');
 await p.evaluate(id=>{preguntarEnvases(id);anotarEnvases(id);},vid);await p.screenshot({path:'envtec.png'});
 // Si ya tenía texto con letras, abre normal (texto)
 const t=await p.evaluate(id=>{const v=viajes.find(x=>x.id===id);v.envases='2 cajas';anotarEnvases(id);return document.getElementById('envModal').type;},vid);
 ok('Si ya decía "2 cajas", abre como texto', t==='text');
 console.log(errs.length?errs:'Sin errores de JavaScript');console.log(fail?fail+' FALLARON':'Todas pasaron');await b.close();srv.close();})();
