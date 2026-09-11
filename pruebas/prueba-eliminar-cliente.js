const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs');
const HTML=fs.readFileSync('/home/user/Control-cobro/control-cobro-app.html','utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8896);
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
 const p=await b.newPage({viewport:{width:412,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8896/',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.click('#loginScreen button');await p.waitForTimeout(300);
 await p.fill('#newRutero','Gerson');await p.press('#newRutero','Enter');await p.waitForTimeout(250);
 await p.click('button.nb');await p.waitForTimeout(250);
 const vid=await p.evaluate(()=>viajes[0].id);
 for(const [n,m] of [['Naty Ramírez','292'],['Otro cliente','150']]){
   await p.fill('#in-nom-'+vid,n);await p.fill('#in-mon-'+vid,m);
   await p.click('.anotaadd');await p.waitForTimeout(150);
 }
 const hayEliminar=async()=>await p.locator('.peddel').count()>0;

 // 1) ARMANDO la ruta -> si se puede
 ok('Armando la ruta: SI deja eliminar', await hayEliminar());

 await p.click('text=Cerrar pedidos');await p.waitForTimeout(400);
 ok('Cerrando pedidos (aun sin enviar): SI deja eliminar', await hayEliminar());

 // 2) RUTA ENVIADA -> no
 await p.click('.btn-enviar',{force:true});await p.waitForTimeout(2200);
 ok('Ruta enviada: NO deja eliminar', !(await hayEliminar()));
 const intento=await p.evaluate(v=>{const x=viajes.find(y=>y.id===v);const n=x.pedidos.length;
   borrarPedido(v,x.pedidos[0].id);return {antes:n,despues:viajes.find(y=>y.id===v).pedidos.length};},vid);
 ok('Ruta enviada: llamar a borrar NO hace nada', intento.antes===intento.despues);

 // 3) CORRIGIENDO -> si
 await p.click('text=Corregir pedidos o envases');await p.waitForTimeout(400);
 ok('Tras "Corregir pedidos o envases": SI deja eliminar', await hayEliminar());
 await p.evaluate(v=>{const x=viajes.find(y=>y.id===v);borrarPedido(v,x.pedidos[0].id);},vid);
 await p.waitForTimeout(700);
 ok('Elimina el cliente al corregir', (await p.evaluate(v=>viajes.find(y=>y.id===v).pedidos.length,vid))===1);
 ok('Y lo guarda en la nube de una vez',
    (await p.evaluate(()=>window.__DB.dias[HOY].estado.viajes[0].pedidos.length))===1);

 // 4) RECIBIDO -> no
 await p.click('.btn-enviar',{force:true});await p.waitForTimeout(2200);
 await p.click('#rec-'+vid);await p.waitForTimeout(300);
 await p.click('#modalRecibe button:has-text("César")');await p.waitForTimeout(800);
 await p.evaluate(v=>verViaje(v),vid);await p.waitForTimeout(400);
 ok('Ya recibido: NO deja eliminar', !(await hayEliminar()));

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
