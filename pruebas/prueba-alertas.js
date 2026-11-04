// Alertas de Facturación rápida en Cobros (1/11/2026): campanita solo para el maestro,
// gris sin nada nuevo, roja con número si hay; al abrir se marcan vistas; lista y PDF.
let chromium;try{({chromium}=require('playwright-core'));}catch(e){({chromium}=require('playwright'));}
const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','control-cobro-app.html'),'utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8897);
const EXE=['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>fs.existsSync(p));

// Nube falsa genérica: cualquier tabla, filtros eq/gte/in/is, select, update, upsert
const FAKE=`
window.__DB={alertas:[]};
function _cp(x){return x==null?x:JSON.parse(JSON.stringify(x));}
window.supabase={createClient:()=>({
 rpc(){return Promise.resolve({data:null,error:null});},
 channel(){const c={on(){return c;},subscribe(){return c;}};return c;},
 from(t){const st={t,f:[],upd:null};
  const filas=()=>(window.__DB[t]||[]).filter(r=>st.f.every(([op,k,v])=>op==='eq'?r[k]===v:op==='gte'?String(r[k])>=String(v):op==='in'?v.includes(r[k]):op==='is'?(v===null?r[k]==null:r[k]===v):op==='neq'?r[k]!==v:true));
  const fin=()=>{if(st.upd){const fs=filas();fs.forEach(r=>Object.assign(r,_cp(st.upd)));return {data:_cp(fs),error:null};}return {data:_cp(filas()),error:null};};
  const api={select(){return api;},order(){return api;},limit(){return api;},
   eq(k,v){st.f.push(['eq',k,v]);return api;},neq(k,v){st.f.push(['neq',k,v]);return api;},gte(k,v){st.f.push(['gte',k,v]);return api;},
   in(k,v){st.f.push(['in',k,v]);return api;},is(k,v){st.f.push(['is',k,v]);return api;},
   update(o){st.upd=o;return api;},upsert(){return Promise.resolve({data:null,error:null});},insert(){return Promise.resolve({data:null,error:null});},
   maybeSingle(){const d=fin().data;return Promise.resolve({data:d[0]||null,error:null});},single(){return api.maybeSingle();},
   then(res,rej){return Promise.resolve(fin()).then(res,rej);}};
  return api;}})};
`;
const hoy=new Date().toLocaleDateString('en-CA');
const ALERTAS=[
  {clave:'b|22211|401',tipo:'poca',fecha:hoy,hora:'13:28',nro:22211,cliente:'tienda santa ana',que:'orange 3lt 6ud · 1 × Q90.00 · desc. Q2.00',quien:'caja',monto:2,vigente:true,visto_en:null},
  {clave:'d|22100|01',tipo:'tope',fecha:hoy,hora:'09:10',nro:22100,cliente:'Tienda C',que:'coca cola 12onz 24ud · 2 × Q82.00 · desc. Q5.00',quien:'tienda2',monto:5,vigente:true,visto_en:null},
  {clave:'v|22050|x',tipo:'vendedor',fecha:hoy,hora:'08:00',nro:22050,cliente:'Tienda V',que:'Vendedor lesli → silvia',quien:'caja',monto:300,vigente:true,visto_en:'2026-11-01T14:00:00Z'},
  {clave:'c|1|vieja',tipo:'pct',fecha:hoy,hora:'07:00',nro:1,cliente:'No vigente',que:'x',quien:'',monto:1,vigente:false,visto_en:null},
];

(async()=>{
  const b=await chromium.launch(EXE?{executablePath:EXE}:{});
  const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)process.exitCode=1;};
  const abrir=async(usuario,pass)=>{
    const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];
    p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
    await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
    await p.route('**/jspdf/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'),'utf8')}).catch(()=>r.abort()));
    await p.addInitScript(a=>{window.__ALERTAS=a;},ALERTAS);
    await p.goto('http://localhost:8897/',{waitUntil:'domcontentloaded'});
    await p.evaluate(()=>{window.__DB.alertas=JSON.parse(JSON.stringify(window.__ALERTAS));});
    await p.fill('#loginUser',usuario);await p.fill('#loginPin',pass);await p.click('#loginScreen button');await p.waitForTimeout(500);
    return {p,errs};
  };
  // Maestro
  const {p,errs}=await abrir('cesar','19881987');
  await p.waitForTimeout(300);
  ok('No hay tarjeta en la lista',!(await p.$('.al-aviso')));
  ok('Arriba: "Cambios 2" con punto rojo (no cuenta vistas ni no vigentes)',await p.isVisible('#btnAL')&&(await p.textContent('#btnAL')).replace(/\s/g,'')==='Cambios2'&&!(await p.$('#btnAL.visto')));
  await p.screenshot({path:'/tmp/al-cab.png',clip:{x:0,y:0,width:390,height:150}}).catch(()=>{});
  await p.click('#btnAL');await p.waitForTimeout(500);
  ok('Abre el panel de alertas',await p.isVisible('#alPanel .al-lista'));
  const txt=await p.textContent('#alPanel');
  ok('Muestra Santa Ana con su descuento',txt.includes('tienda santa ana')&&txt.includes('desc. Q2.00'));
  ok('No muestra alertas que ya no aplican',!txt.includes('No vigente'));
  ok('Total de lo que se dejó de cobrar (−Q7.00)',txt.includes('Q7.00'));
  ok('Nuevas marcadas con la raya roja',(await p.$$('#alPanel .al-fila.nueva')).length===2);
  ok('Al abrir quedan vistas en la nube',await p.evaluate(()=>window.__DB.alertas.filter(a=>a.vigente&&!a.visto_en).length===0));
  ok('Se anota quién la vio',await p.evaluate(()=>window.__DB.alertas.find(a=>a.clave==='b|22211|401').visto_por==='César'));

  await p.screenshot({path:'/tmp/al-panel.png'}).catch(()=>{});
  await p.click('#alPanel .pe-cerrar');await p.waitForTimeout(200);
  ok('Cierra el panel',!(await p.isVisible('#alPanel .al-lista')));
  await p.waitForTimeout(100);
  ok('Ya vistas: "Cambios" se queda en gris, sin número',await p.isVisible('#btnAL.visto')&&(await p.textContent('#btnAL')).trim()==='Cambios');
  await p.screenshot({path:'/tmp/al-visto.png',clip:{x:0,y:0,width:390,height:150}}).catch(()=>{});
  // Un día sin alertas: no aparece nada
  const sinNada=await p.evaluate(()=>{const g=AL.filas;AL.filas=[];alRenderCampana();const r=!document.getElementById('btnAL').classList.contains('ver');AL.filas=g;alRenderCampana();return r;});
  ok('Sin alertas hoy: no aparece nada',sinNada);
  // Llega una nueva
  await p.evaluate(h=>{window.__DB.alertas.push({clave:'p|9|z',tipo:'precio',fecha:h,hora:'15:00',nro:9,cliente:'Nueva',que:'pepsi · 1 × Q45.00 → Q40.00',quien:'caja',monto:5,vigente:true,visto_en:null});return alCargar();},hoy);
  await p.waitForTimeout(200);
  ok('Alerta nueva: vuelve el punto con 1',(await p.textContent('#btnAL')).replace(/\s/g,'')==='Cambios1'&&!(await p.$('#btnAL.visto')));
  // Anulación con productos: tocarla muestra lo que tenía
  await p.evaluate(h=>{window.__DB.alertas.push({clave:'a|factura1|22300',tipo:'anulada',fecha:h,hora:'16:00',nro:22300,cliente:'NANCY SAJAR',que:'Anularon la nota de entrega',quien:'caja',monto:164,vigente:true,visto_en:null,
    detalle:[{c:'01',d:'----coca-cola 12onz 24ud',q:2,p:82,x:0}]});return alCargar();},hoy);
  await p.click('#btnAL');await p.waitForTimeout(400);
  ok('Con ojito visible en las que tienen nota',(await p.$$('#alPanel .al-ojo')).length>0);
  const fila=await p.$('.al-fila.al-tap');const bx=await fila.boundingBox();
  await p.mouse.click(bx.x+bx.width/2,bx.y+bx.height/2);await p.waitForTimeout(400);
  ok('Un toque abre la nota',!!(await p.$('#alVista.open')));
  const vt=await p.textContent('#alVista').catch(()=>'');
  ok('Muestra los productos de lo anulado',vt.includes('NANCY SAJAR')&&vt.includes('coca-cola 12onz')&&vt.includes('anulada')&&vt.includes('Q164.00'));
  await p.screenshot({path:'/tmp/al-anul.png'}).catch(()=>{});
  // Otra alerta (no anulada): también trae la nota, con el producto de la alerta marcado
  await p.evaluate(h=>{alVerCerrar();window.__DB.alertas.push({clave:'d|22316|900',tipo:'tope',fecha:h,hora:'13:15',nro:22316,cliente:'ERICKA BARRIOS 2',que:'deporade 625ml uva · compró 1.5 · Q100.00 c/u · desc. Q2.50 c/u',quien:'tienda2',monto:3.75,vigente:true,visto_en:null,
    detalle:[{c:'900',d:'---deporade 625ml uva 24ud',q:1.5,p:100,x:3.75,a:1},{c:'01',d:'----coca-cola 12onz 24ud',q:1,p:82,x:0,a:0}]});return alCargar();},hoy);
  await p.waitForTimeout(300);
  await p.evaluate(()=>{AL.nuevas.add('d|22316|900');alRenderPanel();});
  const rojoAntes=await p.evaluate(()=>AL.nuevas.has('d|22316|900')&&!!document.querySelector('#alPanel .al-fila.nueva[onclick*="22316"]'));
  await p.evaluate(()=>alVerDet('d|22316|900'));await p.waitForTimeout(400);
  ok('Al abrirla se le quita el rojo (ya la revisó)',rojoAntes&&await p.evaluate(()=>!AL.nuevas.has('d|22316|900')&&!document.querySelector('#alPanel .al-fila.nueva[onclick*="22316"]')&&!!document.querySelector('#alPanel .al-fila[onclick*="22316"]')));
  const v2=await p.textContent('#alVista').catch(()=>'');
  ok('Alerta de descuento: muestra la nota completa y el total',v2.includes('ERICKA BARRIOS 2')&&v2.includes('coca-cola 12onz')&&v2.includes('Nota 22316')&&!v2.includes('anulada')&&v2.includes('Q228.25'));
  ok('El producto de la alerta va marcado',(await p.$$('#alVista .pv-l.al-marca')).length===1);
  await p.screenshot({path:'/tmp/al-nota.png'}).catch(()=>{});
  await p.evaluate(()=>{alVerCerrar();alCerrar();});await p.waitForTimeout(300);
  // PDF
  await p.click('#btnAL');await p.waitForTimeout(400);
  const pdfOk=await p.evaluate(async()=>{let n=null;await csCargarPdf();if(!window.jspdf)return 'sin jspdf';const O=window.jspdf.jsPDF;window.jspdf.jsPDF=function(...a){const d=new O(...a);d.save=x=>{n=x;};return d;};navigator.canShare=null;await alPdf();window.jspdf.jsPDF=O;return n;}).catch(e=>'err '+e.message);
  ok('PDF se genera ('+pdfOk+')',typeof pdfOk==='string'&&pdfOk.startsWith('Alertas'));
  ok('Sin errores de la página (maestro)',errs.length===0);if(errs.length)console.log(errs);
  // Anotador
  const o=await abrir('rolvin','0000');
  const usuarios=await o.p.evaluate(()=>USUARIOS.filter(u=>u.rol!=='maestro').map(u=>[u.usuario,u.pass]));
  if(usuarios.length){await o.p.close();const q=await abrir(usuarios[0][0],usuarios[0][1]);
    await q.p.waitForTimeout(300);ok('El otro usuario NO ve "Cambios"',!(await q.p.isVisible('#btnAL')));
    ok('El otro usuario no lee alertas',await q.p.evaluate(()=>AL.filas.length===0));
  }else ok('Hay un usuario no maestro para probar',false);
  await b.close();srv.close();
})();
