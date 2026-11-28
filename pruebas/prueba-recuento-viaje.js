// Consolidado y Recuento desde el viaje (28/11/2026). Nube simulada en memoria (nube-simulada.js).
// Necesita: npm i playwright-core @supabase/supabase-js@2.119.0 jspdf@2.5.1   (pdftotext para leer el PDF)
const {chromium}=require('playwright-core');
const http=require('http'),fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const nube=require('./nube-simulada');
const ROOT=path.join(__dirname,'..'),SHOTS=path.join(__dirname,'capturas');fs.mkdirSync(SHOTS,{recursive:true});
const JSPDF=process.env.JSPDF||require.resolve('jspdf/dist/jspdf.umd.min.js');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(fs.readFileSync(path.join(ROOT,'control-cobro-app.html')));}).listen(8896);
let fallas=0;const ok=(n,c,extra)=>{console.log((c?'✅ ':'❌ ')+n+(c||extra===undefined?'':'  → '+JSON.stringify(extra)));if(!c)fallas++;};
const hoy=new Date().toLocaleDateString('en-CA');
const L=(c,d,q,p,m,x)=>({c,d,q,p,x:x||0,m:m||''});
const tot=det=>Math.round(det.reduce((s,l)=>s+l.q*l.p-(l.x||0),0)*100)/100;
const nota=(nro,cliente,det)=>({nro,fecha:hoy,hora:'08:00',cliente,codigo_cliente:'10',vendedor:'lesli',vendedor_id:48,total:tot(det),lineas:det.length,envases:[],detalle:det,
  estado:'pendiente',anulada:false,regresada:false,pospuesta_hasta:null,monica_cambio:false});
const D1=[L('05','----coca cola 1lt 12ud',2,72,'',4),L('023','---jugo de la granja 500ml 12ud',1,50,'durazno'),L('748','Nachos diana 12ud',1,10.25),L('h1','---huevo 30ud',1,35)];
const D2=[L('333','----pepsi 1/2lt 24ud',1,85,'4 seven 4 mirinda'),L('05','----coca cola 1lt 12ud',1,72)];
const D3=[L('900','---bonificacion pepsi 1/2lt',1,0),L('333','----pepsi 1/2lt 24ud',0.5,85,'solo seven')];
(async()=>{
  const db=nube.nueva();
  db.tablas.pendientes_entrega.push(nota(22801,'CLIENTE wendy charuc',D1),nota(22802,'TIENDA EBEN EZER',D2),nota(22803,'CLTE GCO. dorcas zelada',D3),nota(22804,'TIENDA LA ESPERANZA',[L('05','----coca cola 1lt 12ud',1,72)]));
  db.tablas.puente.push({id:'facturacion',latido:1});
  const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true});
  await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://localhost:8896'});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await nube.conectar(p,db,{jspdf:JSPDF});
  await p.goto('http://localhost:8896/',{waitUntil:'load'});await p.waitForTimeout(1200);
  await nube.entrar(p);
  await p.evaluate(()=>peCargar());await p.waitForTimeout(500);
  // Mandar dos notas a Milton (viaje preparando)
  await p.evaluate(async()=>{PE.sel=new Set([22801,22802]);await peAsignar('Milton');abrirVendedor('Milton');});
  await p.waitForTimeout(800);
  ok('El viaje preparando tiene el botón Consolidado', await p.isVisible('.vhead-open .vc-b'));
  ok('Sin recuento todavía: sin puntito', !(await p.isVisible('.vc-b.aviso')));
  await p.screenshot({path:SHOTS+'/rv1-viaje-boton.png'});
  await p.click('.vhead-open .vc-b');await p.waitForTimeout(900);
  const filas=await p.$$eval('#peVista .cs-l',a=>a.map(x=>x.querySelector('.cs-q').textContent+' '+x.querySelector('.cs-n').textContent));
  ok('Consolidado del viaje: mismas reglas (solo guiones, sin Nachos)', JSON.stringify(filas)===JSON.stringify(['3.00 coca cola 1lt 12ud','1.00 pepsi 1/2lt 24ud','1.00 huevo 30ud','1.00 jugo de la granja 500ml 12ud']),filas);
  ok('Título con el viaje y el rutero', (await p.textContent('#peVista .pv-tit b'))==='Viaje 1 · Milton');
  await p.screenshot({path:SHOTS+'/rv2-consolidado.png'});
  const rc1=await p.evaluate(()=>{const v=viajes.find(x=>x.rutero==='Milton');return (v.rcs||[]).length;});
  ok('Al sacar el consolidado queda guardado el Recuento 1', rc1===1);
  const enNube=JSON.parse(JSON.stringify(db.tablas.dias[0]||{}));const vn=((enNube.estado||{}).viajes||[]).find(x=>x.rutero==='Milton');
  ok('El Recuento 1 está en la nube (dentro del viaje)', !!(vn&&vn.rcs&&vn.rcs.length===1&&vn.rcs[0].docs.length===2));
  ok('Se guarda solo lo de cajas (sin Nachos)', !!(vn&&!JSON.stringify(vn.rcs).includes('Nachos')));
  await p.click('#csTxt');await p.waitForTimeout(400);
  const txt=await p.evaluate(()=>navigator.clipboard.readText());
  ok('Copiar texto lleva "Ruta: Milton · Viaje 1"', txt.startsWith('*CONSOLIDADO DE CARGA*\nRuta: Milton · Viaje 1\n'),txt.slice(0,80));
  // Recuento sin cambios
  await p.click('.vc-tabs button:nth-child(2)');await p.waitForTimeout(300);
  ok('Recuento: "sin cambios desde entonces"', (await p.textContent('.rc-info')).includes('Recuento 1 de las')&&(await p.textContent('.rc-info')).includes('sin cambios'));
  const tot1=await p.$$eval('.rc-tot>div',a=>a.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
  // coca 3×72=216 − desc 4 · jugo 50 · pepsi 85 (huevo NO va en el recuento) = 351 − 4 = 347 · venta = 235.25 + 157 = 392.25
  ok('Completo: total 351.00, descuento −4.00, neto 347.00, venta total Q392.25', JSON.stringify(tot1)===JSON.stringify(['Total de estos productos · 3351.00','Descuentos−4.00','Neto347.00','Venta total de la ruta · 2 notasQ392.25']),tot1);
  ok('Descuento por caja como Monica: "2 cajas × Q2.00 c/u"', (await p.textContent('.rc-lista')).includes('Descuento: 2 cajas × Q2.00 c/u'));
  ok('El Recuento no lleva huevos', !(await p.textContent('.rc-lista')).includes('huevo'));
  await p.screenshot({path:SHOTS+'/rv3-recuento1.png'});
  await p.evaluate(()=>peVerCerrar());await p.waitForTimeout(300);
  // Cambian en Monica: 22801 baja 1 coca y cambia el sabor del jugo; y se agrega la 22803 al viaje
  const n1=db.tablas.pendientes_entrega.find(f=>f.nro===22801);
  n1.detalle=[L('05','----coca cola 1lt 12ud',1,72,'',2),L('023','---jugo de la granja 500ml 12ud',1,50,'manzana'),L('748','Nachos diana 12ud',1,10.25),L('h1','---huevo 30ud',1,35)];n1.total=tot(n1.detalle);
  await p.evaluate(async()=>{await peCargar();PE.sel=new Set([22803]);await peAsignar('Milton');abrirVendedor('Milton');});
  await p.waitForTimeout(500);await p.evaluate(()=>peCargar());await p.waitForTimeout(900);
  ok('Cambió después del Recuento 1: puntito rojo en Consolidado', await p.isVisible('.vc-b.aviso'));
  const tst=await p.textContent('#toast');
  ok('Aviso: "Viaje 1 · Milton: cambió después del Recuento 1 …"', /Viaje 1 · Milton: cambió después del Recuento 1/.test(tst),tst);
  await p.screenshot({path:SHOTS+'/rv4-puntito.png'});
  await p.click('.vhead-open .vc-b');await p.waitForTimeout(900);
  ok('En Consolidado: "Cambió después del Recuento 1 · Ver recuento"', (await p.textContent('.vc-cam')).includes('Cambió después del Recuento 1'));
  ok('No se guardó otro recuento solo por abrir', (await p.evaluate(()=>viajes.find(x=>x.rutero==='Milton').rcs.length))===1);
  await p.screenshot({path:SHOTS+'/rv5-consolidado-cambio.png'});
  await p.click('.vc-cam');await p.waitForTimeout(300);
  const lista=await p.textContent('.rc-lista');
  const secs=await p.$$eval('.rc-card:first-child .rc-sec',a=>a.map(x=>x.textContent));
  ok('Cambios: Agregar / Bajar / Mismo total cambió el sabor', JSON.stringify(secs)===JSON.stringify(['Agregar al carro','Bajar del carro','Mismo total, cambió el sabor']),secs);
  const fl=a=>a.filter(x=>!x.closest('.rc-prev')).map(x=>[...x.children].map(c=>c.textContent.trim()).join(' '));
  const qs=await p.$$eval('.rc-card:first-child .cs-l',fl);
  ok('Agregar +0.50 pepsi y +1 bonificación · Bajar −1 coca · sabor jugo', JSON.stringify(qs)===JSON.stringify(['+0.50 pepsi 1/2lt 24ud','+1 bonificacion pepsi 1/2lt','−1 coca cola 1lt 12ud','= jugo de la granja 500ml 12ud']),qs);
  ok('Sabores del jugo: durazno −1 y manzana +1', lista.includes('durazno')&&lista.includes('Cantidad = −1.00')&&lista.includes('manzana'));
  ok('Notas nuevas: 22803 · Modificadas: 22801', /Nuevas \(1\)22803/.test(lista.replace(/\s+/g,''))||lista.includes('Nuevas (1)'),lista.slice(0,200));
  ok('Chip "Recuento 2 · hay cambios"', (await p.textContent('.rc-chip.borr')).includes('Recuento 2'));
  await p.screenshot({path:SHOTS+'/rv6-recuento2-cambios.png',fullPage:false});
  await p.evaluate(()=>{const l=document.querySelector('.rc-lista');l.scrollTop=l.scrollHeight;});await p.waitForTimeout(200);
  await p.screenshot({path:SHOTS+'/rv7-recuento2-completo.png'});
  // PDF de cambios: guarda el Recuento 2
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('.rc-card:first-child .rc-bts .osc')]);
  const pdf=path.join(SHOTS,'rv-cambios.pdf');await dl.saveAs(pdf);
  ok('PDF: "Rec. 2 cambios Milton viaje 1 …"', /^Rec\. 2 cambios Milton viaje 1 \d+ [a-z]{3}\.pdf$/.test(dl.suggestedFilename()),dl.suggestedFilename());
  let ptxt='';try{ptxt=execSync(`pdftotext -layout "${pdf}" -`,{encoding:'utf8'});}catch(e){}
  ok('PDF de cambios: AGREGAR AL CARRO / BAJAR DEL CARRO y Ruta', /AGREGAR AL CARRO/.test(ptxt)&&/BAJAR DEL CARRO/.test(ptxt)&&/Ruta: Milton · Viaje 1/.test(ptxt),ptxt.slice(0,300));
  await p.waitForTimeout(500);
  ok('Se guardó el Recuento 2 y se quitó el puntito', (await p.evaluate(()=>viajes.find(x=>x.rutero==='Milton').rcs.length))===2&&!(await p.isVisible('.vc-b.aviso')));
  ok('La pestaña ya no lleva puntito y dice sin cambios', !(await p.isVisible('.vc-tabs i'))&&(await p.textContent('.rc-info')).includes('sin cambios'));
  const [dl2]=await Promise.all([p.waitForEvent('download'),p.click('.rc-card:last-child .rc-bts .osc')]);
  const pdf2=path.join(SHOTS,'rv-completo.pdf');await dl2.saveAs(pdf2);
  let p2='';try{p2=execSync(`pdftotext -layout "${pdf2}" -`,{encoding:'utf8'});}catch(e){}
  // ahora: coca 2×72=144 desc 2 · jugo 50 · pepsi 1.5×85=127.5 · bonif 0 → 321.50 − 2 = 319.50; venta: 22801 (72−2+50+10.25+35=165.25)+157+85=407.25? 22803 = 0+42.5
  ok('PDF completo: Recuento 2, neto y venta total', /Recuento 2/.test(p2)&&/321\.50/.test(p2)&&/319\.50/.test(p2)&&/Q364\.75/.test(p2),p2.slice(0,600));
  ok('No hubo más recuentos al sacar otro PDF sin cambios', (await p.evaluate(()=>viajes.find(x=>x.rutero==='Milton').rcs.length))===2);
  // Ver el Recuento 1 guardado
  await p.click('.rc-chip:first-child');await p.waitForTimeout(200);
  ok('Tocar "Recuento 1" lo muestra como estaba', (await p.textContent('.rc-info')).startsWith('Recuento 1 de las')&&(await p.$$eval('.rc-card',a=>a.length))===1);
  const txt2=await (async()=>{await p.click('.rc-card .rc-bts button:first-child');await p.waitForTimeout(300);return p.evaluate(()=>navigator.clipboard.readText());})();
  ok('Texto del Recuento 1 completo', txt2.startsWith('*RECUENTO 1*\nRuta: Milton · Viaje 1')&&txt2.includes('Venta total de la ruta (2 notas): Q392.25'),txt2);
  await p.evaluate(()=>peVerCerrar());await p.waitForTimeout(300);
  // Enviar la ruta y cambiar en Monica después de salir
  await p.evaluate(async()=>{const v=viajes.find(x=>x.rutero==='Milton');await terminarPedidos(v.id,true);});await p.waitForTimeout(1500);
  ok('Ruta enviada: notas en "enviada"', db.tablas.pendientes_entrega.filter(f=>[22801,22802,22803].includes(f.nro)).every(f=>f.estado==='enviada'));
  ok('En ruta: sigue el botón Consolidado, sin puntito', await p.isVisible('.vhead-open .vc-b')&&!(await p.isVisible('.vc-b.aviso')));
  const n2=db.tablas.pendientes_entrega.find(f=>f.nro===22802);
  n2.monica_cambio=true;n2.monica_detalle=[L('333','----pepsi 1/2lt 24ud',1,85,'4 seven 4 mirinda')];n2.monica_total=85;n2.monica_cambio_en=new Date().toISOString();n2.enviada_en=new Date().toISOString();
  db.tablas.pendientes_entrega.forEach(f=>{if(!f.enviada_en&&f.estado==='enviada')f.enviada_en=new Date().toISOString();});
  await p.evaluate(()=>peCargar());await p.waitForTimeout(1200);
  ok('Después de salir, cambio en Monica → puntito otra vez', await p.isVisible('.vc-b.aviso'));
  await p.click('.vhead-open .vc-b');await p.waitForTimeout(900);await p.click('.vc-tabs button:nth-child(2)');await p.waitForTimeout(300);
  const qs3=await p.$$eval('.rc-card:first-child .cs-l',fl);
  ok('Recuento 3: Bajar −1 coca (la quitaron de EBEN EZER)', JSON.stringify(qs3)===JSON.stringify(['−1 coca cola 1lt 12ud']),qs3);
  ok('Pasos de antes a la vista (Recuento 1 → 2)', (await p.textContent('.rc-lista')).includes('Antes · Recuento 1 → 2'));
  await p.screenshot({path:SHOTS+'/rv8-en-ruta-recuento3.png'});
  await p.evaluate(()=>peVerCerrar());
  // Dos aparatos: los recuentos de las dos copias se juntan y no pisan el cobro
  const mezcla=await p.evaluate(()=>{
    const base={uid:'u1',rutero:'X',pedidos:[{id:1,nombre:'a',total:10,estado:'pagado'}],mod:100};
    const mio=JSON.parse(JSON.stringify(base));mio.rcs=[{id:'r1',t:'2026-11-28T10:00:00Z',docs:[]}];
    const otro=JSON.parse(JSON.stringify(base));otro.mod=200;otro.pedidos[0].estado='credito';otro.rcs=[{id:'r2',t:'2026-11-28T11:00:00Z',docs:[]}];
    const r=combinarViajes([mio],[otro])[0];
    const mio2=JSON.parse(JSON.stringify(base));mio2.rcs=[{id:'r1',t:'2026-11-28T10:00:00Z',docs:[]}];   // mismo mod (recuento guardado sin tocar)
    const nubeV=JSON.parse(JSON.stringify(base));nubeV.pedidos[0].estado='credito';
    const r2=combinarViajes([mio2],[nubeV])[0];
    return {rcs:r.rcs.map(x=>x.id),est:r.pedidos[0].estado,rcs2:(r2.rcs||[]).map(x=>x.id),est2:r2.pedidos[0].estado};});
  ok('Dos aparatos: se juntan los recuentos (r1 y r2) y gana el cobro más nuevo', JSON.stringify(mezcla.rcs)==='["r1","r2"]'&&mezcla.est==='credito',mezcla);
  ok('Guardar un recuento no pisa el cobro del otro aparato', JSON.stringify(mezcla.rcs2)==='["r1"]'&&mezcla.est2==='credito',mezcla);
  // Por entregar sigue igual
  await p.evaluate(async()=>{await peCargar();peAbrir();});await p.waitForTimeout(600);
  await p.click('.pe-card:has-text("ESPERANZA")');await p.waitForTimeout(200);await p.click('#peConsBtn');await p.waitForTimeout(500);
  ok('Por entregar: Consolidado igual que antes (título y notas)', (await p.textContent('#peVista .pv-tit b'))==='Consolidado de carga'&&!(await p.isVisible('.vc-tabs')));
  await p.click('#csTxt');await p.waitForTimeout(300);
  const t3=await p.evaluate(()=>navigator.clipboard.readText());
  ok('Por entregar: texto sin línea de ruta', /^\*CONSOLIDADO DE CARGA\*\n\d+\/\d+\/\d{4} \d\d:\d\d\n1 nota: LA ESPERANZA\n\n1\.00  coca cola 1lt 12ud$/.test(t3),t3);
  const [dl3]=await Promise.all([p.waitForEvent('download'),p.click('#peVista .cs-btns .pv-btn:not(.quitar)')]);
  ok('Por entregar: PDF "Consolidado 22804.pdf"', dl3.suggestedFilename()==='Consolidado 22804.pdf',dl3.suggestedFilename());
  ok('Sin errores en la página', errs.length===0,errs);
  await b.close();srv.close();
  console.log(fallas?`\n${fallas} fallas`:'\nTodo bien');process.exit(fallas?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
