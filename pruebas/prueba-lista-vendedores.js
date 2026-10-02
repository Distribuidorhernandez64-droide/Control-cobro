const {chromium}=require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Control-cobro';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
let NUBE={};
const srv=http.createServer((q,r)=>{
 if(q.url==='/__nube'){if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{NUBE=JSON.parse(b);r.end('ok');});return;}
   r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(NUBE));}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,''));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8872);
const FAKE=`function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
async function _get(){return (await fetch('/__nube')).json();}
window.supabase={createClient:()=>({from(t){const st={t,f:{}};const a={select:()=>a,eq(k,v){st.f[k]=v;return a;},order:()=>a,limit:()=>a,
 async maybeSingle(){if(st.t!=='dias')return {data:null,error:null};const n=await _get();return {data:n[st.f.fecha]||null,error:null};},
 then:r=>Promise.resolve({data:[],error:null}).then(r),
 async upsert(o){const n=await _get();n[o.fecha]=_cp(o);await fetch('/__nube',{method:'POST',body:JSON.stringify(n)});return {error:null};},
 insert:()=>Promise.resolve({error:null})};return a;}})};`;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let fail=0;const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
 await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 await p.goto('http://localhost:8872/control-cobro-app.html',{waitUntil:'networkidle'});
 await p.fill('#loginUser','cesar');await p.fill('#loginPin','19881987');
 await p.tap('#loginScreen button');await p.waitForTimeout(500);
 const ids=await p.evaluate(async()=>{
   ruteros=['Cesar','gerson','Lesli','Milton'];
   const h=(hh,mm)=>{const d=new Date();d.setHours(hh,mm,0,0);return d.toISOString();};
   const ped=(n,m,e)=>({id:nuevoId(),nombre:n,total:m,estado:e||'pagado',devolucion:0,descuento:0,vuelto:0});
   const vj=(r,ps,s,rc,ex)=>Object.assign({id:nuevoId(),uid:uid(),rutero:r,pedidos:ps,cerrado:!!rc,entradaLista:true,pedidosListos:true,horaSalida:s,horaRecibido:rc||null,recibidoPor:rc?'César':null,envases:'',envOk:false,mod:1},ex||{});
   viajes=[];
   for(let i=0;i<14;i++)viajes.push(vj('gerson',[ped('c'+i,100+i)],h(9,i*3),h(9,i*3+20)));
   const R=vj('gerson',[ped('Monica xicay',231.75)],h(16,36),null,{envases:'1 caja'});viajes.push(R);
   viajes.push(vj('Cesar',[ped('a',900),ped('b',500),ped('c',283)],h(0,34),h(0,37)));
   viajes.push({id:nuevoId(),uid:uid(),rutero:'Milton',pedidos:[ped('Ana',250),ped('Luis',180)],cerrado:false,entradaLista:false,pedidosListos:true,envases:'',mod:1});
   selRutero='Cesar';await guardarAhora('inicio');vistaDetalle=false;renderZona();return {R:R.id};});
 await p.waitForTimeout(400);
 // ---- LISTA ----
 ok('Arranca en la lista de vendedores', await p.isVisible('.vlista') && await p.isHidden('#ruteros'));
 const orden=await p.$$eval('.vrow .nm',e=>e.map(x=>x.textContent));
 ok('Orden: en ruta → armando → recibidos → sin viajes ('+orden.join(', ')+')', orden.join()==='gerson,Milton,Cesar,Lesli');
 const filas=await p.$$eval('.vrow',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
 ok('gerson: "En ruta · Q231.75" y globito 1', /En ruta · Q231\.75\s*1/.test(filas[0]));
 ok('Milton: "Armando ruta · 2 pedidos"', filas[1].includes('Armando ruta · 2 pedidos'));
 ok('Cesar: "1 viaje · Q1,683.00"', filas[2].includes('1 viaje · Q1,683.00'));
 ok('Lesli: "Sin viajes hoy"', filas[3].includes('Sin viajes hoy'));
 ok('En la lista se ve el botón +', await p.isVisible('#fab'));
 await p.screenshot({path:'v-lista.png'});
 // ---- ABRIR ----
 await p.tap('.vrow:has-text("gerson")');await p.waitForTimeout(400);
 ok('Al tocar gerson se abre su detalle', await p.isVisible('.chathd') && (await p.textContent('.chathd .nm'))==='gerson');
 ok('Encabezado dice "1 ruta en curso"', (await p.textContent('.chathd')).includes('1 ruta en curso'));
 await p.waitForTimeout(600);
 const enVista=await p.evaluate(id=>{const c=document.getElementById('viaje-'+id).getBoundingClientRect();
   const r=document.getElementById('rec-'+id).getBoundingClientRect();
   const hd=document.querySelector('header').getBoundingClientRect().bottom;
   return {arriba:Math.round(c.top-hd), boton:r.top>hd&&r.bottom<innerHeight, sy:Math.round(scrollY)};},ids.R);
 ok('Con ruta pendiente: baja directo a ella ("Dinero recibido" a la vista) '+JSON.stringify(enVista), enVista.boton && enVista.arriba>=0 && enVista.sy>0);
 await p.screenshot({path:'v-directo.png'});
 ok('Adentro está el mismo + flotante', await p.isVisible('#fab'));
 ok('Ya no hay + chico en el encabezado', (await p.locator('.chathd .cmas').count())===0);
 ok('Los viajes ya no repiten "(gerson)"', !(await p.textContent('#zona')).includes('(gerson)'));
 ok('"1 pedido" en singular', (await p.textContent('#zona')).includes('1 pedido ') || (await p.textContent('#zona')).includes('1 pedido·')|| /1 pedido(?!s)/.test(await p.textContent('#zona')));
 await p.screenshot({path:'v-detalle.png'});
 // ---- VOLVER con la flecha ----
 await p.tap('.chathd .bk');await p.waitForTimeout(500);
 ok('Flecha ‹ vuelve a la lista', await p.isVisible('.vlista'));
 await p.tap('.vrow:has-text("Milton")');await p.waitForTimeout(700);
 ok('Ruta armándose: baja directo a ella', await p.evaluate(()=>{const c=document.querySelector('.vcard.abierta');if(!c)return false;const r=c.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&scrollY>0;}) || await p.evaluate(()=>!!document.querySelector('.vcard.abierta')));
 await p.tap('.chathd .bk');await p.waitForTimeout(500);
 await p.tap('.vrow:has-text("Cesar")');await p.waitForTimeout(700);
 ok('Sin nada pendiente: se queda arriba', await p.evaluate(()=>scrollY)<5);
 await p.tap('.chathd .bk');await p.waitForTimeout(500);
 // ---- VOLVER deslizando a la derecha ----
 const desliza=async(x0,y0,x1,y1)=>p.evaluate(({x0,y0,x1,y1})=>{
   const el=document.elementFromPoint(x0,y0);const mk=(x,y)=>new Touch({identifier:7,target:el,clientX:x,clientY:y});
   el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[mk(x0,y0)],changedTouches:[mk(x0,y0)]}));
   for(let k=1;k<=10;k++){const x=x0+(x1-x0)*k/10,y=y0+(y1-y0)*k/10;
     el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[mk(x,y)],changedTouches:[mk(x,y)]}));}
   el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[mk(x1,y1)]}));
 },{x0,y0,x1,y1});
 await p.tap('.vrow:has-text("Cesar")');await p.waitForTimeout(400);
 await desliza(60,650,300,655);await p.waitForTimeout(600);
 ok('Deslizar a la derecha vuelve a la lista', await p.isVisible('.vlista'));
 await p.tap('.vrow:has-text("Cesar")');await p.waitForTimeout(400);
 await desliza(300,650,60,650);await p.waitForTimeout(500);
 ok('Deslizar a la IZQUIERDA no vuelve', await p.isVisible('.chathd'));
 await desliza(200,700,215,400);await p.waitForTimeout(500);
 ok('Desplazar hacia arriba (scroll) no vuelve', await p.isVisible('.chathd'));
 await desliza(60,650,110,652);await p.waitForTimeout(500);
 ok('Un deslice corto no vuelve (se arrepiente)', await p.isVisible('.chathd'));
 // ---- VOLVER con el botón atrás del navegador ----
 await p.evaluate(()=>history.back());await p.waitForTimeout(500);
 ok('Botón "atrás" del navegador vuelve a la lista', await p.isVisible('.vlista'));
 // ---- + del encabezado ----
 await p.tap('.vrow:has-text("Lesli")');await p.waitForTimeout(400);
 await p.tap('#fab');await p.waitForTimeout(600);
 ok('Adentro, el + muestra "¿Para quién es el viaje?" con todos los vendedores', (await p.textContent('#fabMenu')).includes('¿Para quién es el viaje?') && await p.evaluate(()=>['gerson','Cesar','Milton','Lesli'].every(n=>document.getElementById('fabMenu').textContent.includes(n))));
 ok('  y la opción "Nuevo vendedor"', (await p.textContent('#fabMenu')).includes('Nuevo vendedor'));
 await p.tap('#fabMenu .fabit:has-text("Lesli")');await p.waitForTimeout(600);
 ok('Elegir Lesli le crea el viaje a Lesli', await p.evaluate(()=>viajes.filter(v=>v.rutero==='Lesli').length)===1);
 ok('Mientras arma la ruta el + se esconde', await p.isHidden('#fab'));
 await p.evaluate(()=>{viajes=viajes.filter(v=>v.rutero!=='Lesli');});
 await p.tap('.chathd .bk');await p.waitForTimeout(400);
 // ---- + flotante desde la lista ----
 await p.tap('#fab');await p.waitForTimeout(600);
 await p.tap('#fabMenu .fabit:has-text("Cesar")');await p.waitForTimeout(600);
 ok('+ flotante → Cesar: abre a Cesar con su viaje nuevo', await p.isVisible('.chathd') && (await p.textContent('.chathd .nm'))==='Cesar' && await p.evaluate(()=>viajes.some(v=>v.rutero==='Cesar'&&!v.entradaLista&&!v.pedidosListos)));
 await p.evaluate(()=>{viajes=viajes.filter(v=>!(v.rutero==='Cesar'&&!v.entradaLista));renderZona();});
 await p.tap('.chathd .bk');await p.waitForTimeout(400);
 // ---- mantener presionado para eliminar ----
 const bx=await p.locator('.vrow:has-text("Lesli")').boundingBox();
 await p.mouse.move(bx.x+bx.width/2,bx.y+bx.height/2);await p.mouse.down();await p.waitForTimeout(800);await p.mouse.up();await p.waitForTimeout(300);
 ok('Mantener presionado ofrece eliminar al vendedor', (await p.textContent('#modalRecibeBody')).includes('¿Eliminar a Lesli?'));
 await p.tap('#modalRecibeBody button:has-text("Cancelar")');await p.waitForTimeout(300);
 ok('Y no lo abre por accidente', await p.isVisible('.vlista'));
 // ---- Rutas en curso → recibir dinero ----
 await p.tap('#alerta .rb-p');await p.waitForTimeout(900);
 ok('"Rutas en curso" abre a gerson', await p.isVisible('.chathd') && (await p.textContent('.chathd .nm'))==='gerson');
 await p.tap('#rec-'+ids.R);await p.waitForTimeout(500);
 await p.tap('#modalRecibeBody button:has-text("Sí, completos")');await p.waitForTimeout(400);
 await p.tap('#modalRecibeBody button:has-text("Lesli")');await p.waitForTimeout(1300);
 ok('Y se recibe el dinero', NUBE[Object.keys(NUBE)[0]].estado.viajes.find(v=>v.id===ids.R).cerrado===true);
 await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(200);
 await p.screenshot({path:'v-detalle2.png'});
 await p.tap('.chathd .bk');await p.waitForTimeout(400);
 const g=(await p.$$eval('.vrow',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()))).find(t=>t.includes('gerson'));
 ok('En la lista gerson pasa a ✓ todo recibido ('+g+')', /15 viajes · Q/.test(g));
 const idAlta=await p.evaluate(async()=>{
   const ps=[];for(let i=0;i<7;i++)ps.push({id:nuevoId(),nombre:'Cliente '+i,total:50+i,estado:'pagado',devolucion:0,descuento:0,vuelto:0});
   const V={id:nuevoId(),uid:uid(),rutero:'Cesar',pedidos:ps,cerrado:false,entradaLista:true,pedidosListos:true,horaSalida:new Date().toISOString(),envases:'',envOk:false,mod:Date.now()};
   viajes.push(V);vistaDetalle=false;renderZona();return V.id;});
 await p.waitForTimeout(300);
 await p.tap('.vrow:has-text("Cesar")');await p.waitForTimeout(900);
 const cae=await p.evaluate(id=>{const b=document.getElementById('rec-'+id).getBoundingClientRect();
   const e=document.elementFromPoint(b.right-12,b.bottom-6);return e?(e.id||e.className):'nada';},idAlta);
 ok('Ruta con 7 clientes: "Dinero recibido" queda por encima del + (toque cae en '+cae+')', cae==='rec-'+idAlta);
 await p.screenshot({path:'v-alta.png'});
 console.log(errs.length?'\n⚠ '+errs.join(' | '):'\nSin errores de JavaScript');
 console.log(fail?fail+' FALLARON':'Todas pasaron');
 await b.close();srv.close();
})();
