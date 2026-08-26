const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs');
const HTML=fs.readFileSync('/home/user/Control-cobro/control-cobro-app.html','utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8898);
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
 const p=await b.newPage({viewport:{width:412,height:900},deviceScaleFactor:3});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8898/',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.click('#loginScreen button');await p.waitForTimeout(300);
 await p.evaluate(()=>{
   ruteros=['Milton','Lesli','Rolvin','César','Keny'];
   const mk=(r,m)=>({id:nuevoId(),uid:uid(),rutero:r,pedidos:[{id:nuevoId(),nombre:'x',total:m,estado:'pagado'}],
     cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:new Date().toISOString(),envases:'',envOk:false});
   viajes=[{id:nuevoId(),uid:uid(),rutero:'Milton',pedidos:[{id:1,nombre:'y',total:9951,estado:'pagado'}],cerrado:true,entradaLista:true,pedidosListos:true,horaSalida:new Date().toISOString(),horaRecibido:new Date().toISOString(),recibidoPor:'Lesli'},
    mk('Milton',300),mk('Lesli',420),mk('Rolvin',510),mk('César',260),mk('Keny',180)];
   selRutero='Milton';renderRuteros();renderZona();
 });
 await p.waitForTimeout(500);
 await p.locator('header').screenshot({path:'rutas-4.png'});
 
 await p.locator('header').screenshot({path:'rutas-todas.png'});
 // comprobar que la carita lleva a la ruta
 await p.click('.rb-p >> nth=2');await p.waitForTimeout(700);
 console.log('Vendedor tras tocar la 3a carita:',await p.evaluate(()=>selRutero));
 console.log('Scroll (0 = no se movio):',await p.evaluate(()=>Math.round(window.scrollY)));
 console.log(errs.length?'ERRORES: '+errs.join(' | '):'Sin errores');
 await b.close();srv.close();
})();
