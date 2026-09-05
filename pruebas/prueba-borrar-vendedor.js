const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs');
const HTML=fs.readFileSync('/home/user/Control-cobro/control-cobro-app.html','utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8897);
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
 const p=await b.newPage({viewport:{width:412,height:900},deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0; const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8897/',{waitUntil:'networkidle'});
 const login=async(u,pw)=>{await p.fill('#loginUser',u);await p.fill('#loginPin',pw);await p.click('#loginScreen button');await p.waitForTimeout(300);};
 await login('cesar','19881987');
 await p.evaluate(()=>{
   ruteros=['Keny','Gerson','Antonio chip'];
   viajes=[{id:nuevoId(),uid:uid(),rutero:'Keny',pedidos:[{id:nuevoId(),nombre:'Ana',total:654,estado:'pagado'}],
     cerrado:true,entradaLista:true,pedidosListos:true,horaSalida:new Date().toISOString(),horaRecibido:new Date().toISOString(),recibidoPor:'César'}];
   selRutero='Keny';renderRuteros();renderZona();
 });
 // mantener presionado sobre un vendedor SIN rutas
 const chip=n=>p.locator('.rchip',{hasText:n}).first();
 const press=async n=>{const bx=await chip(n).boundingBox();
   await p.mouse.move(bx.x+bx.width/2,bx.y+bx.height/2);await p.mouse.down();
   await p.waitForTimeout(800);await p.mouse.up();await p.waitForTimeout(250);};

 await press('Antonio chip');
 ok('Pulsación larga abre el aviso', (await p.textContent('#modalRecibeBody')).includes('¿Eliminar a Antonio chip?'));
 await p.click('#modalRecibeBody button:has-text("Cancelar")');await p.waitForTimeout(200);
 ok('Cancelar no borra nada', (await p.evaluate(()=>ruteros.length))===3);

 // vendedor CON rutas -> no se puede
 await press('Keny');
 const txt=await p.textContent('#modalRecibeBody');
 ok('Con rutas dice que NO se puede', txt.includes('No se puede eliminar')&&txt.includes('1 ya recibida'));
 await p.click('#modalRecibeBody button:has-text("Entendido")');await p.waitForTimeout(200);
 ok('El vendedor con rutas sigue ahi', (await p.evaluate(()=>ruteros.includes('Keny'))));

 // borrar de verdad
 await press('Antonio chip');
 await p.click('#modalRecibeBody button:has-text("Eliminar")');await p.waitForTimeout(900);
 ok('Elimina al vendedor sin rutas', !(await p.evaluate(()=>ruteros.includes('Antonio chip'))));
 ok('Desaparece de la pantalla', !(await p.textContent('#ruteros')).includes('Antonio chip'));
 ok('Se guardo en la nube sin el', !(await p.evaluate(()=>window.__DB.dias[HOY].estado.ruteros.includes('Antonio chip'))));

 // que NO reviva al sincronizar desde otro aparato
 await p.evaluate(async()=>{window.__DB.dias[HOY].estado.ruteros.push('Antonio chip');await actualizarYa();});
 await p.waitForTimeout(400);
 ok('NO revive al sincronizar', !(await p.evaluate(()=>ruteros.includes('Antonio chip'))));

 // pero SI vuelve si otro aparato le anoto una ruta
 await p.evaluate(async()=>{
   window.__DB.dias[HOY].estado.ruteros.push('Antonio chip');
   window.__DB.dias[HOY].estado.viajes.push({uid:'x1',rutero:'Antonio chip',cerrado:true,mod:Date.now(),
     pedidos:[{id:7,nombre:'z',total:50,estado:'pagado'}]});
   await guardarAhora('prueba');
 });
 await p.waitForTimeout(400);
 ok('Vuelve si otro aparato le anoto una ruta', (await p.evaluate(()=>ruteros.includes('Antonio chip'))));

 // un toque normal solo selecciona, no borra
 await p.click('.rchip:has-text("Gerson")');await p.waitForTimeout(300);
 ok('Toque normal solo selecciona', (await p.evaluate(()=>selRutero))==='Gerson'
    && !(await p.isVisible('#modalRecibe.open')));

 // el anotador no puede
 await p.evaluate(()=>{cerrarSesion&&0;});
 await p.click('text=salir');await p.waitForTimeout(600);
 await login('tienda','123');
 await p.evaluate(()=>{ruteros=['Keny','Gerson','Nuevo'];selRutero='Keny';renderRuteros();renderZona();});
 await press('Nuevo');
 ok('El anotador no puede eliminar', (await p.textContent('#modalRecibeBody')).includes('Sólo el maestro'));

 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
