// Kardex ⚙️ (25/11/2026): proveedores con productos, existencia y ventas de 28 días que manda la PC (kx_existencia),
// pedido sugerido = venta diaria × (visita + entrega) × (1 + reserva) − existencia, redondeado hacia arriba;
// sin días no sugiere; existencia negativa = revisar; buscar en Monica (kx_catalogo) y agregar; quitar y deshacer;
// cuadrar (kx_ajuste) con doble confirmación; pedido para WhatsApp que queda en el historial.
let chromium;try{({chromium}=require('playwright-core'));}catch(e){({chromium}=require('playwright'));}
const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','control-cobro-app.html'),'utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8899);
const EXE=['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>fs.existsSync(p));
const FAKE=`
window.__DB={reportes_pedidos:[],alertas:[],kardex_pedidos:[],kardex_proveedores:[
 {id:'aje',nombre:'AJE',orden:1,cada_dias:null,entrega_dias:null,reserva:25,existencia:null,productos:[
  {c:'090',fam:'BIG / CIFRUT',k:1,n:'---Big 1.3 cola 9ud'},{c:'033',fam:'BIG / CIFRUT',k:1,n:'---Big 1.3lt cifrut 9ud'},
  {c:'035',fam:'BIG / CIFRUT',k:2,n:'---Big cifrut 500ml 24ud'},{c:'091',fam:'DEPORADE',k:2,n:'---deporade 360ml chicle 24 ud'},
  {c:'999',fam:'DEPORADE',k:1,n:'---producto que no existe'}]},
 {id:'coca',nombre:'Coca-Cola',orden:2,cada_dias:8,entrega_dias:0,reserva:25,existencia:null,productos:[{c:'09',fam:'LATA',k:1,n:'---coca cola lata 24ud'}]}]};
window.__seq=100;window.__MON={'090':[21,56],'033':[3,84],'035':[5,28],'091':[30,0],'09':[-3.5,40],'336':[12,70]};
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
setInterval(()=>{for(const p of window.__DB.reportes_pedidos){if(p.estado!=='pedido')continue;const d=p.datos||{};
  if(p.tipo==='kx_existencia'){const items={};(d.codigos||[]).forEach(c=>{const m=window.__MON[c];if(m)items[c]={ex:m[0],vend:m[1]};});
    p.resultado={ok:true,at:new Date().toISOString(),dias:d.dias,items};}
  else if(p.tipo==='kx_catalogo')p.resultado={ok:true,productos:[{c:'336',n:'----pepsi retornable 2lt 8ud'},{c:'337',n:'---pepsi 3lt 6ud'},{c:'090',n:'---Big 1.3 cola 9ud'}]};
  else if(p.tipo==='kx_ajuste')p.resultado={ok:true,lineas:(d.ajustes||[]).map(a=>{const m=window.__MON[a.codigo];const antes=m[0];m[0]=a.real;return {codigo:a.codigo,ok:true,antes,despues:a.real,kardex:76500};})};
  p.estado='listo';}},500);
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null}),
   signInWithPassword:async()=>({data:{session:{user:{email:'cesar@cobros.local'}}},error:null})},
 rpc(){return Promise.resolve({data:null,error:null});},
 channel(){const c={on(){return c;},subscribe(){return c;}};return c;},removeChannel(){},
 from(t){const st={t,f:[],upd:null,ins:null,del:false,ord:null,lim:null};
  const filas=()=>(window.__DB[t]||[]).filter(r=>st.f.every(([op,k,v])=>op==='eq'?r[k]===v:true));
  const fin=()=>{if(st.ins){const o=Object.assign({id:window.__seq++},t==='reportes_pedidos'?{estado:'pedido'}:{},t==='kardex_pedidos'?{at:new Date().toISOString()}:{},_cp(st.ins));(window.__DB[t]=window.__DB[t]||[]).push(o);return {data:[_cp(o)],error:null};}
    if(st.del){const fs=filas();window.__DB[t]=(window.__DB[t]||[]).filter(r=>!fs.includes(r));return {data:null,error:null};}
    if(st.upd){const fs=filas();fs.forEach(r=>Object.assign(r,_cp(st.upd)));return {data:_cp(fs),error:null};}
    let d=_cp(filas());if(st.ord){const [k,asc]=st.ord;d.sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*(asc?1:-1));}if(st.lim)d=d.slice(0,st.lim);return {data:d,error:null};};
  const api={select(){return api;},order(k,o){st.ord=[k,!(o&&o.ascending===false)];return api;},limit(n){st.lim=n;return api;},
   eq(k,v){st.f.push(['eq',k,v]);return api;},neq(){return api;},gte(){return api;},in(){return api;},is(){return api;},
   update(o){st.upd=o;return api;},insert(o){st.ins=o;return api;},delete(){st.del=true;return api;},upsert(){return Promise.resolve({data:null,error:null});},
   maybeSingle(){const d=fin().data;return Promise.resolve({data:d&&d[0]||null,error:null});},single(){return api.maybeSingle();},
   then(res,rej){return Promise.resolve(fin()).then(res,rej);}};
  return api;}})};
`;
(async()=>{
  const b=await chromium.launch(EXE?{executablePath:EXE,args:['--no-proxy-server']}:{});
  const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)process.exitCode=1;};
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route(u=>!u.href.startsWith('http://localhost'),r=>{const u=r.request().url();if(/@supabase/.test(u))return r.fulfill({status:200,contentType:'application/javascript',body:FAKE});return r.fulfill({status:200,body:''});});
  await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.route('**/fonts.gstatic.com/**',r=>r.fulfill({status:200,body:''}));
  await p.route('**/unpkg.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await p.route('**/cdnjs.cloudflare.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await p.goto('http://localhost:8899/',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(800);await p.evaluate(()=>entrarListo({email:'cesar@cobros.local'},null));await p.waitForTimeout(600);
  await p.evaluate(()=>rpAbrir());await p.waitForTimeout(300);
  ok('En ⚙️ aparece la tarjeta Kardex',(await p.textContent('#rpPanel')).includes('Kardex'));
  await p.click('.rp-kx');await p.waitForTimeout(400);
  ok('Abre Kardex con AJE, Coca-Cola y +',await p.$$eval('#kxPanel .kx-tab',t=>t.map(x=>x.textContent).join('|'))==='AJE|Coca-Cola|+');
  await p.waitForTimeout(1800);
  const ped=await p.evaluate(()=>window.__DB.reportes_pedidos.filter(r=>r.tipo==='kx_existencia').map(r=>r.datos));
  ok('Al abrir sin datos pide la existencia una sola vez, solo de AJE, 28 días',ped.length===1&&ped[0].codigos.join()==='090,033,035,091,999'&&ped[0].dias===28);
  ok('Muestra existencia: 033 = 3 cja, 035 = 10 paq (5 cajas × 2)',await p.evaluate(()=>{const g=c=>document.querySelector(`.kx-sw[data-c="${c}"] .kx-ex`).textContent;return g('033')==='3cja'&&g('035')==='10paq';}));
  ok('Código que no está en Monica: "—" y lo dice',await p.evaluate(()=>{const s=document.querySelector('.kx-sw[data-c="999"]');return s.querySelector('.kx-ex').textContent.trim().startsWith('—')&&s.textContent.includes('no está en Monica');}));
  ok('Sin días: pide ponerlos y no sugiere nada',await p.isVisible('.kx-falta')&&await p.evaluate(()=>!document.querySelector('#kxPanel .kx-sug[data-q]')));
  await p.screenshot({path:'/tmp/kx-1-sin-dias.png'});
  // días
  await p.click('.kx-falta button');await p.waitForTimeout(350);
  await p.fill('#kxCada','4');await p.fill('#kxEnt','1');
  ok('El ejemplo de la hoja de días usa los números escritos',(await p.textContent('#kxEj')).includes('10 × 5 días + 25 % = 62,5')&&(await p.textContent('#kxEj')).includes('pides 38'));
  await p.screenshot({path:'/tmp/kx-2-dias.png'});
  await p.click('.kx-hpie .kx-b.osc');await p.waitForTimeout(400);
  ok('Guarda los días en Supabase',await p.evaluate(()=>{const a=window.__DB.kardex_proveedores.find(x=>x.id==='aje');return a.cada_dias===4&&a.entrega_dias===1&&a.reserva===25;}));
  const sug=await p.evaluate(()=>{const g=c=>{const b=document.querySelector(`.kx-sw[data-c="${c}"] .kx-sug`);return b?b.textContent:'';};return [g('090'),g('033'),g('035'),g('091')];});
  // 033: 84/28=3 al día × 5 días × 1.25 = 18.75 − 3 = 15.75 → 16 · 035: 1 caja/día × 5 × 1.25 = 6.25 − 5 = 1.25 cajas = 2.5 paq → 3
  // 090: 2 × 5 × 1.25 = 12.5 − 21 < 0 → alcanza · 091: sin ventas → alcanza
  ok('Sugeridos: 033 Pedir 16 cja, 035 Pedir 3 paq; 090 y 091 alcanzan (sin etiqueta) ('+sug.join(' | ')+')',sug[0]===''&&sug[1]==='Pedir 16 cja'&&sug[2]==='Pedir 3 paq'&&sug[3]==='');
  ok('Dice cuánto vende al día (033: 3, 035: 2 paq)',await p.evaluate(()=>document.querySelector('.kx-sw[data-c="033"] .kx-d').textContent.includes('vende 3 al día')&&document.querySelector('.kx-sw[data-c="035"] .kx-d').textContent.includes('vende 2 al día')));
  await p.screenshot({path:'/tmp/kx-3-sugeridos.png'});
  // tocar un sugerido lo pone; usar sugeridos
  await p.click('.kx-sw[data-c="033"] .kx-sug');
  ok('Tocar "Pedir 16" lo escribe en la casilla',await p.inputValue('.kx-q[data-c="033"]')==='16');
  await p.fill('.kx-q[data-c="090"]','2');await p.dispatchEvent('.kx-q[data-c="090"]','input');
  await p.click('#kxUsar');await p.waitForTimeout(200);
  ok('"Sugeridos" llena los que faltan sin borrar lo escrito (090=2, 033=16, 035=3)',await p.inputValue('.kx-q[data-c="090"]')==='2'&&await p.inputValue('.kx-q[data-c="033"]')==='16'&&await p.inputValue('.kx-q[data-c="035"]')==='3');
  ok('Barra: 18 cja + 3 paq · 3 productos',(await p.textContent('#kxCnt')).replace(/\s+/g,' ').includes('18 cja + 3 paq3 productos'));
  ok('La pestaña AJE muestra cuántos productos lleva el pedido',(await p.textContent('#kxPanel .kx-tab.on b'))==='3');
  // pedido
  await p.click('#kxOk');await p.waitForTimeout(350);
  const txt=await p.textContent('.kx-txt');
  ok('Texto del pedido para WhatsApp',/^\*PEDIDO AJE \d\d\/\d\d\/\d{4}\*/.test(txt)&&txt.includes('*BIG / CIFRUT*\n2 cja - Big 1.3 cola 9ud\n16 cja - Big 1.3lt cifrut 9ud\n3 paq - Big cifrut 500ml 24ud')&&txt.endsWith('*TOTAL: 18 cja + 3 paq*'));
  await p.screenshot({path:'/tmp/kx-4-pedido.png'});
  await p.evaluate(()=>{window.__copiado=null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copiado=t;}},configurable:true});});
  await p.click('.kx-hpie button:has-text("Copiar")');await p.waitForTimeout(400);
  ok('Copiar: copia el texto, lo guarda en el historial y vacía el pedido',await p.evaluate(()=>window.__copiado&&window.__DB.kardex_pedidos.length===1&&window.__DB.kardex_pedidos[0].items.length===3&&window.__DB.kardex_pedidos[0].items[1].sug===16&&!KX.draft.aje)&&(await p.inputValue('.kx-q[data-c="033"]'))==='');
  ok('Después dice "pediste 16"',(await p.textContent('.kx-sw[data-c="033"] .kx-d')).includes('pediste 16'));
  // cuadrar
  await p.click('.kx-sw[data-c="033"] .kx-ex');await p.waitForTimeout(350);
  await p.fill('#kxCont','5');await p.dispatchEvent('#kxCont','input');
  ok('Cuadrar: dice cuánto entra a Monica',(await p.textContent('#kxCuDif')).includes('Entra 2 cja'));
  await p.screenshot({path:'/tmp/kx-5-cuadrar.png'});
  await p.click('#kxCuBtn');await p.waitForTimeout(300);
  ok('Primer toque solo pide confirmar (no manda nada)',await p.evaluate(()=>!window.__DB.reportes_pedidos.some(r=>r.tipo==='kx_ajuste'))&&(await p.textContent('#kxCuBtn')).includes('Sí, dejar 5'));
  await p.click('#kxCuBtn');await p.waitForTimeout(1800);
  ok('Segundo toque manda el cuadre: código 033, real 5',await p.evaluate(()=>{const r=window.__DB.reportes_pedidos.find(r=>r.tipo==='kx_ajuste');return r&&r.datos.ajustes.length===1&&r.datos.ajustes[0].codigo==='033'&&r.datos.ajustes[0].real===5&&r.datos.motivo==='cuadre de mercaderia';}));
  await p.waitForTimeout(800);
  ok('Queda 5 en pantalla y el sugerido baja a 14',await p.evaluate(()=>document.querySelector('.kx-sw[data-c="033"] .kx-ex').textContent==='5cja'&&document.querySelector('.kx-sw[data-c="033"] .kx-sug').textContent==='Pedir 14 cja'));
  // paquetes: cuadrar 035 a 7 paquetes = 3.5 cajas en Monica
  await p.click('.kx-sw[data-c="035"] .kx-ex');await p.waitForTimeout(350);await p.fill('#kxCont','7');await p.dispatchEvent('#kxCont','input');
  await p.click('#kxCuBtn');await p.click('#kxCuBtn');await p.waitForTimeout(1800);
  ok('Cuadre en paquetes se manda en cajas a Monica (7 paq = 3.5)',await p.evaluate(()=>window.__DB.reportes_pedidos.filter(r=>r.tipo==='kx_ajuste')[1].datos.ajustes[0].real===3.5));
  // buscar y agregar
  await p.click('.kx-fab');await p.waitForTimeout(1500);
  await p.fill('#kxQ','pepsi');await p.dispatchEvent('#kxQ','input');
  ok('Buscar "pepsi" muestra los 2 productos de Monica',await p.$$eval('#kxRes .kx-ri',x=>x.length)===2);
  await p.fill('#kxQ','big');await p.dispatchEvent('#kxQ','input');
  ok('Lo que ya está en la lista sale como "Ya está"',(await p.textContent('#kxRes')).includes('Ya está'));
  await p.fill('#kxQ','pepsi 2lt');await p.dispatchEvent('#kxQ','input');await p.click('#kxRes .kx-ri');await p.waitForTimeout(350);
  await p.click('#kxFams .kx-chip:has-text("Otra")');await p.fill('#kxFamN','pepsi');
  await p.click('#kxUni button[data-k="2"]');await p.fill('#kxK','4');
  await p.screenshot({path:'/tmp/kx-6-agregar.png'});
  await p.click('.kx-hpie .kx-b.osc');await p.waitForTimeout(1800);
  ok('Agrega 336 con familia PEPSI, 4 paquetes por caja',await p.evaluate(()=>{const x=window.__DB.kardex_proveedores.find(a=>a.id==='aje').productos.find(y=>y.c==='336');return x&&x.fam==='PEPSI'&&x.k===4;}));
  ok('Lee la existencia solo del nuevo (12 cajas = 48 paq)',await p.evaluate(()=>{const r=window.__DB.reportes_pedidos.filter(r=>r.tipo==='kx_existencia');return r[r.length-1].datos.codigos.join()==='336';})&&(await p.textContent('.kx-sw[data-c="336"] .kx-ex'))==='48paq');
  // quitar y deshacer
  await p.evaluate(()=>kxQuitar('091'));await p.waitForTimeout(300);
  ok('Quitar saca el producto',await p.evaluate(()=>!window.__DB.kardex_proveedores.find(a=>a.id==='aje').productos.some(y=>y.c==='091')));
  await p.click('#kxToast button');await p.waitForTimeout(300);
  ok('Deshacer lo regresa en su lugar',await p.evaluate(()=>window.__DB.kardex_proveedores.find(a=>a.id==='aje').productos.map(y=>y.c).join())==='090,033,035,091,999,336');
  // deslizar
  const box=await p.locator('.kx-sw[data-c="090"] .kx-fila').boundingBox();
  await p.evaluate(({x,y})=>{const f=document.querySelector('.kx-sw[data-c="090"] .kx-fila');const T=(t,xx)=>f.dispatchEvent(new TouchEvent(t,{bubbles:true,touches:t==='touchend'?[]:[new Touch({identifier:1,target:f,clientX:xx,clientY:y})]}));
    T('touchstart',x);T('touchmove',x-30);T('touchmove',x-100);T('touchend',x-100);},{x:box.x+200,y:box.y+20});
  await p.waitForTimeout(300);
  ok('Deslizar a la izquierda muestra "Quitar"',await p.evaluate(()=>document.querySelector('.kx-sw[data-c="090"]').classList.contains('abierto')));
  await p.screenshot({path:'/tmp/kx-7-deslizar.png'});
  // Coca-Cola: existencia negativa
  await p.click('#kxPanel .kx-tab:has-text("Coca-Cola")');await p.waitForTimeout(1600);
  ok('Existencia negativa: rojo y "revisar", sin sugerido',await p.evaluate(()=>{const s=document.querySelector('.kx-sw[data-c="09"]');return s.querySelector('.kx-ex.bajo')&&s.textContent.includes('revisar')&&!s.querySelector('.kx-sug[data-q]');}));
  ok('Plan de Coca-Cola: cada 8 días, el mismo día',(await p.textContent('.kx-plan')).includes('8 días')&&(await p.textContent('.kx-plan')).includes('el mismo día'));
  // nuevo proveedor
  await p.click('#kxPanel .kx-tab.mas');await p.waitForTimeout(300);await p.fill('#kxNP','Pepsi');await p.click('.kx-hpie .kx-b.osc');await p.waitForTimeout(300);
  ok('Nuevo proveedor Pepsi queda seleccionado y vacío',(await p.textContent('#kxPanel .kx-tab.on'))==='Pepsi'&&(await p.textContent('#kxLista')).includes('Sin productos'));
  await p.screenshot({path:'/tmp/kx-8-pepsi.png'});
  // historial
  await p.click('#kxPanel .kx-tab:has-text("AJE")');await p.waitForTimeout(300);
  await p.evaluate(()=>kxHistorial());await p.waitForTimeout(300);
  ok('Historial muestra el pedido de AJE',(await p.textContent('#kxOv')).includes('18 cja + 3 paq'));
  ok('Sin errores de la página',errs.length===0);if(errs.length)console.log(errs);
  await b.close();srv.close();
})().catch(e=>{console.error(e);process.exitCode=1;srv.close();});
