// Cambios Ticket (3/11/2026): alertas del vigilante de Ticket aparte de las normales: su palabra "Ticket" arriba,
// su pantalla, sus vistas y su PDF; producto eliminado (F9) tachado en la vista previa; venta cancelada sin ticket.
let chromium;try{({chromium}=require('playwright-core'));}catch(e){({chromium}=require('playwright'));}
const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','control-cobro-app.html'),'utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8898);
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
  {clave:'b|22211|401',tipo:'poca',fecha:hoy,hora:'13:28',nro:22211,cliente:'tienda santa ana',que:'orange 3lt 6ud · compró 1 · Q90.00 c/u · desc. Q2.00 c/u',quien:'caja',monto:2,vigente:true,visto_en:null},
  {clave:'t|e|35561|06',tipo:'t_eliminado',fecha:hoy,hora:'22:01',nro:35561,cliente:'CLIENTE',que:'coca cola 1.5lt 6ud · lo pasaron (22:00) y lo quitaron · 1 de Q73.50 c/u',quien:'tienda',monto:73.5,vigente:true,visto_en:null,
   detalle:[{c:'01',d:'----coca-cola 12onz 24ud',q:1,p:82,x:0,a:0},{c:'05',d:'----coca cola 1lt 12ud',q:1,p:72,x:0,a:0},{c:'08',d:'---coca cola 2.5lt 6ud',q:2,p:102.75,x:0,a:0},{c:'06',d:'---coca cola 1.5lt 6ud',q:1,p:73.5,x:0,a:1,e:1}]},
  {clave:'t|c|DESKTOP|2026-11-03 22:20:05.100',tipo:'t_cancelada',fecha:hoy,hora:'22:20',nro:null,cliente:'Venta sin ticket',que:'Cancelaron la venta · 2 productos · pasados 22:15–22:15',quien:'tienda',monto:103.5,vigente:true,visto_en:null,
   detalle:[{c:'06',d:'---coca cola 1.5lt 6ud',q:1,p:73.5,x:0,a:1},{c:'013',d:'jugos hic',q:1,p:30,x:0,a:1}]},
  {clave:'t|p|35563|05|70.0000',tipo:'t_precio',fecha:hoy,hora:'22:30',nro:35563,cliente:'CLIENTE',que:'coca cola 1lt 12ud · compró 1 · Q72.00 → Q70.00 c/u',quien:'tienda',monto:2,vigente:true,visto_en:null,
   detalle:[{c:'05',d:'----coca cola 1lt 12ud',q:1,p:70,x:0,a:1}]},
  {clave:'t|p|35564|05|75.0000',tipo:'t_subio',fecha:hoy,hora:'22:31',nro:35564,cliente:'CLIENTE',que:'coca cola 1lt 12ud · compró 1 · Q72.00 → Q75.00 c/u',quien:'tienda',monto:3,vigente:true,visto_en:null},
  {clave:'a|factura|35562',tipo:'t_anulada',fecha:hoy,hora:'22:40',nro:35562,cliente:'CLIENTE',que:'Anularon el ticket',quien:'cesar',monto:30,vigente:true,visto_en:null,detalle:[{c:'013',d:'jugos hic',q:1,p:30,x:0}]},
];

(async()=>{
  const b=await chromium.launch(EXE?{executablePath:EXE}:{});
  const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)process.exitCode=1;};
  const abrir=async(usuario,pass,w)=>{
    const p=await b.newPage({viewport:{width:w||390,height:844}});const errs=[];
    p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
    await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
    await p.route('**/jspdf/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'),'utf8')}).catch(()=>r.abort()));
    await p.addInitScript(a=>{window.__ALERTAS=a;},ALERTAS);
    await p.goto('http://localhost:8898/',{waitUntil:'domcontentloaded'});
    await p.evaluate(()=>{window.__DB.alertas=JSON.parse(JSON.stringify(window.__ALERTAS));});
    await p.fill('#loginUser',usuario);await p.fill('#loginPin',pass);await p.click('#loginScreen button');await p.waitForTimeout(600);
    return {p,errs};
  };
  const {p,errs}=await abrir('cesar','19881987');
  const t=async s=>(await p.textContent(s)).replace(/\s/g,'');
  ok('Arriba sigue UNA palabra: "Cambios 6" (notas + ticket sin ver)',await p.isVisible('#btnAL')&&await t('#btnAL')==='Cambios6'&&!(await p.$('#btnALT')));
  await p.screenshot({path:'/tmp/tk-cab.png',clip:{x:0,y:0,width:390,height:120}}).catch(()=>{});
  await p.click('#btnAL');await p.waitForTimeout(500);
  ok('Abre en la pestaña Notas (tiene algo sin ver)',await p.isVisible('.al-tab.on')&&(await p.textContent('.al-tab.on')).startsWith('Notas'));
  let txt=await p.textContent('#alPanel .al-lista');
  ok('Notas: solo Santa Ana, nada de Ticket',txt.includes('santa ana')&&!txt.includes('lo quitaron'));
  ok('Pestaña Ticket con punto rojo (5 sin ver)',!!(await p.$('.al-tab:not(.on) i'))&&(await p.textContent('.al-tab:not(.on)')).includes('5'));
  await p.click('#alPanel .al-fila:has-text("santa ana")');await p.waitForTimeout(300);
  ok('Tocar la de Notas no marca las de Ticket',await p.evaluate(()=>!!window.__DB.alertas.find(a=>a.clave==='b|22211|401').visto_en&&window.__DB.alertas.filter(a=>a.tipo.startsWith('t_')&&!a.visto_en).length===5));
  await p.screenshot({path:'/tmp/tk-notas.png'}).catch(()=>{});
  await p.click('.al-tab:not(.on)');await p.waitForTimeout(500);
  txt=await p.textContent('#alPanel .al-lista');
  ok('Pestaña Ticket: eliminado, cancelada, precio, subido, anulado',txt.includes('lo quitaron')&&txt.includes('Cancelaron la venta')&&txt.includes('Q72.00 → Q70.00')&&txt.includes('Anularon el ticket')&&!txt.includes('santa ana'));
  ok('Venta cancelada dice "sin ticket"',txt.includes('sin ticket'));
  ok('Precio subido en gris con +',txt.includes('+Q3.00'));
  ok('Total que se dejó de cobrar: −Q179.00 (73.50+103.50+2; sin anulada ni subido)',(await p.textContent('#alPanel .al-sub')).includes('Q179.00'));
  ok('Ver la pestaña Ticket NO las marca (se marcan al tocarlas)',await p.evaluate(()=>window.__DB.alertas.filter(a=>a.vigente&&!a.visto_en).length===5));
  await p.screenshot({path:'/tmp/tk-panel.png'}).catch(()=>{});
  const fila=(await p.$$('.al-fila.al-tap'));let fe=null;
  for(const f of fila){if((await f.textContent()).includes('lo quitaron')){fe=f;break;}}
  const bx=await fe.boundingBox();await p.mouse.click(bx.x+bx.width/2,bx.y+bx.height/2);await p.waitForTimeout(400);
  ok('Un toque abre el ticket',!!(await p.$('#alVista.open')));
  const v=await p.textContent('#alVista').catch(()=>'');
  ok('Ticket 35561 con el producto quitado',v.includes('Ticket 35561')&&v.includes('lo quitaron')&&v.includes('1.5lt'));
  ok('El total es lo cobrado (Q359.50), el quitado no suma',v.includes('Q359.50')&&v.includes('3 productos'));
  ok('El quitado va tachado',(await p.$$('#alVista .pv-l.al-elim')).length===1);
  await p.screenshot({path:'/tmp/tk-elim.png'}).catch(()=>{});
  await p.evaluate(()=>alVerCerrar());await p.waitForTimeout(250);
  await p.evaluate(()=>alVerDet('t|c|DESKTOP|2026-11-03 22:20:05.100'));await p.waitForTimeout(400);
  const vc=await p.textContent('#alVista').catch(()=>'');
  ok('Venta cancelada: lo que pasaron y "No se cobró" Q103.50',vc.includes('Venta cancelada')&&vc.includes('jugos hic')&&vc.includes('No se cobró')&&vc.includes('Q103.50'));
  await p.screenshot({path:'/tmp/tk-cancel.png'}).catch(()=>{});
  await p.evaluate(()=>alVerCerrar());await p.waitForTimeout(250);
  const pdf=await p.evaluate(async()=>{let n=null;await csCargarPdf();const O=window.jspdf.jsPDF;window.jspdf.jsPDF=function(...a){const d=new O(...a);d.save=x=>{n=x;};return d;};navigator.canShare=null;await alPdf();window.jspdf.jsPDF=O;return n;}).catch(e=>'err '+e.message);
  ok('PDF de Ticket ('+pdf+')',typeof pdf==='string'&&pdf.startsWith('Cambios Ticket'));
  await p.click('.al-tab:not(.on)');await p.waitForTimeout(300);
  const pdf2=await p.evaluate(async()=>{let n=null;const O=window.jspdf.jsPDF;window.jspdf.jsPDF=function(...a){const d=new O(...a);d.save=x=>{n=x;};return d;};navigator.canShare=null;await alPdf();window.jspdf.jsPDF=O;return n;}).catch(e=>'err '+e.message);
  ok('PDF de Notas sigue igual ('+pdf2+')',typeof pdf2==='string'&&pdf2.startsWith('Alertas'));
  await p.evaluate(async()=>{for(const f of AL.filas.filter(x=>!x.visto_en))await alMarcarUna(f.clave);});await p.waitForTimeout(250);
  await p.click('#alPanel .pe-cerrar');await p.waitForTimeout(250);
  ok('Todas tocadas: "Cambios" en gris sin número',await p.isVisible('#btnAL.visto')&&(await p.textContent('#btnAL')).trim()==='Cambios');
  // Solo hay de Ticket sin ver: abre directo en Ticket
  await p.evaluate(h=>{window.__DB.alertas.push({clave:'t|d|35570|01|2.00',tipo:'t_descuento',fecha:h,hora:'23:00',nro:35570,cliente:'CLIENTE',que:'coca-cola 12onz 24ud · compró 1 · Q82.00 c/u · desc. Q2.00 c/u',quien:'tienda',monto:2,vigente:true,visto_en:null});return alCargar();},hoy);
  await p.waitForTimeout(200);
  ok('Nueva de Ticket: "Cambios 1"',await t('#btnAL')==='Cambios1');
  await p.click('#btnAL');await p.waitForTimeout(400);
  ok('Abre directo en la pestaña Ticket',(await p.textContent('.al-tab.on')).startsWith('Ticket')&&(await p.textContent('#alPanel .al-lista')).includes('desc. Q2.00'));
  await p.click('#alPanel .pe-cerrar');await p.waitForTimeout(200);
  // Fecha cambiada: nota en Notas, ticket en Ticket, en gris (total del documento)
  await p.evaluate(h=>{window.__DB.alertas.push({clave:'f|factura1|22400|2026-11-01',tipo:'fecha',fecha:h,hora:'10:00',nro:22400,cliente:'TIENDA X',que:'Lo hicieron el 03/11 10:00 con fecha 01/11',quien:'caja',monto:100,vigente:true,visto_en:null},
    {clave:'f|factura|35562|2026-11-02',tipo:'t_fecha',fecha:h,hora:'22:02',nro:35562,cliente:'CLIENTE',que:'Lo hicieron el 03/11 22:02 con fecha 02/11',quien:'tienda',monto:30,vigente:true,visto_en:null});return alCargar();},hoy);
  await p.waitForTimeout(200);await p.click('#btnAL');await p.waitForTimeout(400);
  const fN=await p.textContent('#alPanel .al-lista');
  ok('Fecha cambiada de nota sale en Notas, en gris',(await p.textContent('.al-tab.on')).startsWith('Notas')&&fN.toLowerCase().includes('fecha cambiada')&&fN.includes('con fecha 01/11')&&!fN.includes('con fecha 02/11'));
  await p.click('.al-tab:not(.on)');await p.waitForTimeout(400);
  const fT=await p.textContent('#alPanel .al-lista');
  ok('Fecha cambiada de ticket sale en Ticket',fT.includes('con fecha 02/11')&&!fT.includes('con fecha 01/11'));
  await p.click('#alPanel .pe-cerrar');await p.waitForTimeout(200);
  ok('Sin errores de la página',errs.length===0);if(errs.length)console.log(errs);
  // Celular angosto
  const n=await abrir('cesar','19881987',360);
  await n.p.screenshot({path:'/tmp/tk-cab360.png',clip:{x:0,y:0,width:360,height:120}}).catch(()=>{});
  const usuarios=await n.p.evaluate(()=>USUARIOS.filter(u=>u.rol!=='maestro').map(u=>[u.usuario,u.pass]));
  const q=await abrir(usuarios[0][0],usuarios[0][1]);
  ok('El otro usuario NO ve "Cambios"',!(await q.p.isVisible('#btnAL')));
  await b.close();srv.close();
})();
