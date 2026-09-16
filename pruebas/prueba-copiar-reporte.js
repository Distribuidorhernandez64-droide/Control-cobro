const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs');
const HTML=fs.readFileSync('/home/user/Control-cobro/control-cobro-app.html','utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8895);
const FAKE=`window.__DB={dias:{},respaldos:[],seq:1};
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
function _res(d,e){return Promise.resolve({data:_cp(d),error:e||null});}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const api={select(){return api;},eq(k,v){st.f[k]=v;return api;},order(){return api;},limit(){return api;},
maybeSingle(){return _res(st.t==='dias'?(window.__DB.dias[st.f.fecha]||null):null);},
then(res){return Promise.resolve({data:[],error:null}).then(res);},
upsert(o){window.__DB.dias[o.fecha]=_cp(o);return _res(null);},
insert(o){const c=_cp(o);c.id=window.__DB.seq++;window.__DB.respaldos.push(c);return _res(null);}};return api;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:412,height:900},permissions:['clipboard-read','clipboard-write']});
 const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8895/',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.click('#loginScreen button');await p.waitForTimeout(300);
 await p.evaluate(()=>{
   ruteros=['Milton','Gerson'];
   const t=new Date().toISOString();
   const ped=(n,m)=>[{id:nuevoId(),nombre:n,total:m,estado:'pagado',devolucion:0,descuento:0,vuelto:0}];
   viajes=[
    {id:nuevoId(),uid:uid(),rutero:'Milton',pedidos:ped('Eben',714),cerrado:true,entradaLista:true,pedidosListos:true,horaSalida:t,horaRecibido:t,recibidoPor:'Lesli'},
    {id:nuevoId(),uid:uid(),rutero:'Gerson',pedidos:ped('Tadeo',6185.80),cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:t,envases:'',envOk:false}];
   selRutero='Milton';viajeAbierto=null;renderRuteros();renderZona();
 });
 await p.waitForTimeout(300);
 await p.click('.rep');await p.waitForTimeout(400);
 await p.click('#sheet button:has-text("Copiar reporte")');await p.waitForTimeout(400);
 const m=await p.textContent('#modalRecibeBody');
 ok('Bloquea el copiado con una ruta pendiente', m.includes('Ruta pendiente de recibir'));
 ok('Dice el nombre del pendiente', m.includes('Gerson'));
 ok('Muestra el monto que falta', m.includes('6,185.80'));
 ok('No copio nada al portapapeles',
    (await p.evaluate(()=>navigator.clipboard.readText().catch(()=>'')))==='');

 // tocar el pendiente lleva a su ruta
 await p.click('#modalRecibeBody button:has-text("Gerson")');await p.waitForTimeout(900);
 ok('Lleva al vendedor pendiente', (await p.evaluate(()=>selRutero))==='Gerson');
 ok('Cierra el reporte y el aviso',
    !(await p.isVisible('#overlay.open')) && !(await p.isVisible('#modalRecibe.open')));

 // recibir el dinero y volver a intentar
 const vid=await p.evaluate(()=>viajes.find(v=>!v.cerrado).id);
 await p.click('#rec-'+vid);await p.waitForTimeout(300);
 await p.click('#modalRecibe button:has-text("César")');await p.waitForTimeout(900);
 await p.click('.rep');await p.waitForTimeout(400);
 await p.click('#sheet button:has-text("Copiar reporte")');await p.waitForTimeout(500);
 ok('Ya sin pendientes NO bloquea', !(await p.isVisible('#modalRecibe.open')));
 const txt=await p.evaluate(()=>navigator.clipboard.readText().catch(()=>''));
 ok('Copia el reporte de verdad', txt.includes('REPORTE DEL DÍA')&&txt.includes('Tadeo'));

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
