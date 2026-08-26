const {chromium}=require('playwright-core');
const http=require('http'),fs=require('fs');
const HTML=fs.readFileSync('/home/user/Control-cobro/control-cobro-app.html','utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8899);

// Nube falsa en memoria, con la misma forma que usa la app
const FAKE=`
window.__DB={dias:{},respaldos:[],seq:1};
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
function _res(d,e){return Promise.resolve({data:_cp(d),error:e||null});}
window.supabase={createClient:()=>({from(t){const st={t,f:{},ord:null,lim:null};
 const api={
  select(){return api;},
  eq(k,v){st.f[k]=v;return api;},
  order(k,o){st.ord=[k,o];return api;},
  limit(n){st.lim=n;return api;},
  maybeSingle(){
    if(st.t==='dias'){const row=window.__DB.dias[st.f.fecha];return _res(row||null);}
    if(st.t==='respaldos'){return _res(window.__DB.respaldos.find(x=>x.id===st.f.id)||null);}
    return _res(null);},
  then(res){ // await sin maybeSingle (listado)
    let d=[];
    if(st.t==='respaldos'){d=window.__DB.respaldos.filter(x=>x.fecha===st.f.fecha)
      .sort((a,b)=>String(b.creado_en).localeCompare(String(a.creado_en)));}
    return Promise.resolve({data:_cp(d),error:null}).then(res);},
  upsert(o){window.__DB.dias[o.fecha]=_cp(o);return _res(null);},
  insert(o){const c=_cp(o);c.id=window.__DB.seq++;window.__DB.respaldos.push(c);return _res(null);}
 };return api;}})};
`;

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await b.newPage();
  const errs=[];
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
  await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.goto('http://localhost:8899/',{waitUntil:'networkidle'});

  const ok=(n,c)=>console.log((c?'✅':'❌')+' '+n);
  const T=async s=>p.textContent(s).catch(()=>'');

  // login maestro
  await p.fill('#loginUser','cesar'); await p.fill('#loginPin','19881987');
  await p.click('#loginScreen button'); await p.waitForTimeout(400);
  ok('Entra con usuario maestro', await p.isHidden('#loginScreen'));

  // vendedor
  await p.fill('#newRutero','Rolvin'); await p.press('#newRutero','Enter'); await p.waitForTimeout(300);
  ok('Agrega vendedor', (await T('#ruteros')).includes('Rolvin'));

  // viaje + pedidos
  await p.click('button.nb'); await p.waitForTimeout(300);
  const vid=await p.evaluate(()=>viajes[0].id);
  ok('IDs unicos (grandes, no 1)', vid>1e12);
  for(const [n,m] of [['Tadeo','4672'],['Milton','110'],['Sonia','533']]){
    await p.fill('#in-nom-'+vid,n); await p.fill('#in-mon-'+vid,m);
    await p.click('.anotaadd'); await p.waitForTimeout(150);
  }
  ok('Agrega 3 pedidos', (await p.evaluate(()=>viajes[0].pedidos.length))===3);
  ok('IDs de pedidos unicos', (await p.evaluate(()=>new Set(viajes[0].pedidos.map(p=>p.id)).size))===3);

  await p.click('text=Cerrar pedidos'); await p.waitForTimeout(500);
  await p.click('.btn-enviar',{force:true}); await p.waitForTimeout(2200);
  ok('Envia la ruta', (await p.evaluate(()=>viajes[0].entradaLista))===true);

  await p.click('#rec-'+vid); await p.waitForTimeout(300);
  await p.click('#modalRecibe button:has-text("César")'); await p.waitForTimeout(800);
  const v0=await p.evaluate(()=>viajes[0]);
  ok('Recibe el dinero y cierra', v0.cerrado===true && v0.recibidoPor==='César');
  ok('Total correcto Q5,315', (await T('#tEfectivo'))==='Q5,315.00');

  // bitacora
  const rs=await p.evaluate(()=>window.__DB.respaldos.map(r=>r.motivo));
  ok('Bitacora graba cada paso ('+rs.length+')', rs.length>=3 && rs.some(m=>m.includes('DINERO RECIBIDO')));

  // red de seguridad
  const caso1=await p.evaluate(async()=>{
    const d=window.__DB.dias[HOY];
    d.estado.viajes.push({uid:'vacio',rutero:'Rolvin',cerrado:false,pedidos:[]});
    borrados.push('vacio');
    return await guardarAhora('prueba');
  });
  ok('Deja quitar un viaje vacio (uso normal)', caso1===true);

  const caso2=await p.evaluate(async()=>{
    const d=window.__DB.dias[HOY];
    d.estado.viajes.push({uid:'de-lesli',rutero:'Rolvin',cerrado:true,recibidoPor:'Lesli',
      mod:Date.now(),pedidos:[{id:99,nombre:'Ruta de Lesli',total:2814,estado:'pagado'}]});
    borrados.push('de-lesli');   // yo la mande a borrar, pero Lesli ya la cobro
    const r=await guardarAhora('prueba'); borrados.pop();
    return r;
  });
  ok('CANCELA el guardado si se perderia una ruta ya cobrada', caso2===false);
  ok('La ruta cobrada sigue en la nube',
     (await p.evaluate(()=>window.__DB.dias[HOY].estado.viajes.some(v=>v.uid==='de-lesli'))));

  // restaurar
  await p.click('.rep'); await p.waitForTimeout(400);
  ok('Reporte muestra el boton de respaldos', (await T('#sheet')).includes('Respaldos'));
  await p.click('#sheet button:has-text("Respaldos")'); await p.waitForTimeout(600);
  const sheet=await T('#sheet');
  ok('Lista los respaldos con hora y monto', sheet.includes('DINERO RECIBIDO'));
  p.on('dialog',d=>d.accept());
  const U=await p.evaluate(()=>viajes[0].uid);
  const antes=await p.evaluate(()=>viajes[0].pedidos.length);
  await p.evaluate(()=>{viajes[0].pedidos=[];});   // simulo la perdida
  await p.click('#sheet button.sec >> nth=0'); await p.waitForTimeout(900);
  const desp=await p.evaluate(u=>{const v=viajes.find(x=>x.uid===u);return v?v.pedidos.length:0;},U);
  ok('RESTAURAR recupera los pedidos perdidos ('+antes+' -> '+desp+')', desp===antes);
  ok('Restaurar deja copia de seguridad previa',
     (await p.evaluate(()=>window.__DB.respaldos.some(r=>String(r.motivo).includes('ANTES DE RESTAURAR')))));

  // La tabla 'respaldos' todavia no existe: la app debe seguir igual
  await p.evaluate(()=>{window.__DB.sinTabla=true;});
  await p.evaluate(()=>{const o=window.__DB.respaldos;Object.defineProperty(window.__DB,'respaldos',{get(){throw new Error('relation "respaldos" does not exist');},configurable:true});});
  const sigue=await p.evaluate(async()=>{
    const v=viajes[0]; v.pedidos.push({id:nuevoId(),nombre:'Nuevo',total:200,estado:'pagado'}); v.mod=Date.now();
    return await guardarAhora('sin tabla de respaldos');
  });
  ok('Guarda normal aunque NO exista la tabla de respaldos', sigue===true);
  ok('El pedido nuevo si quedo en la nube',
     (await p.evaluate(()=>window.__DB.dias[HOY].estado.viajes.some(v=>(v.pedidos||[]).some(p=>p.nombre==='Nuevo')))));

  console.log(errs.length? '\n⚠ Errores en consola:\n'+errs.join('\n') : '\nSin errores de JavaScript');
  await b.close(); srv.close();
})();
