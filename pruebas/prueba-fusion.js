const fs=require('fs');
const src=fs.readFileSync('/tmp/claude-0/-home-user-Control-cobro/7eff3fe4-7c00-530c-90d6-76ca41811e4f/scratchpad/app.js','utf8');
eval(src.match(/function rescatarPedidos[\s\S]*?\n\}/)[0]);
const m=src.match(/function combinarViajes[\s\S]*?\n\}/)[0];
let borrados=[]; eval(m);
let fail=0;
const ok=(n,c)=>{if(!c)fail++;console.log((c?'✅':'❌')+' '+n);};
const P=(...ids)=>ids.map(i=>({id:i,total:100,estado:'pagado'}));
const C=o=>JSON.parse(JSON.stringify(o));

let r=combinarViajes(C([{uid:'A',cerrado:false,mod:9e12,pedidos:P(1)}]),C([{uid:'A',cerrado:true,recibidoPor:'Lesli',mod:1,pedidos:P(1)}]));
ok('Viaje ya cobrado NO se des-cobra por copia vieja', r[0].cerrado===true);

r=combinarViajes(C([{uid:'B',mod:9e12,pedidos:P(1)}]),C([{uid:'B',mod:1,pedidos:P(1,2,3)}]));
ok('Reloj adelantado NO borra pedidos de la nube', r[0].pedidos.length===3);

r=combinarViajes(C([{uid:'C',pedidos:P(1)}]),C([{uid:'C',pedidos:P(1,2)}]));
ok('En empate de reloj no se pierde nada', r[0].pedidos.length===2);

r=combinarViajes(C([{uid:'D',cerrado:false,modificado:true,mod:2,pedidos:P(1)}]),C([{uid:'D',cerrado:true,mod:1,pedidos:P(1)}]));
ok('Reabrir sigue funcionando', r[0].cerrado===false);

r=combinarViajes(C([{uid:'E',mod:5,pedidos:P(1,2,3)}]),C([{uid:'E',mod:1,pedidos:P(1)}]));
ok('Pedidos nuevos SI se guardan', r[0].pedidos.length===3);

r=combinarViajes(C([{uid:'F',pedidos:P(1)}]),C([{uid:'G',pedidos:P(9)}]));
ok('Viaje de otro aparato no se pierde', r.length===2);

borrados=['H']; r=combinarViajes([],C([{uid:'H',pedidos:P(1)}])); borrados=[];
ok('"Quitar viaje" sigue funcionando', r.length===0);

r=combinarViajes(C([{uid:'I',mod:5,pedidos:P(1,3),pedBorrados:[2]}]),C([{uid:'I',mod:1,pedidos:P(1,2,3)}]));
ok('Pedido borrado a proposito NO revive', r[0].pedidos.length===2 && !r[0].pedidos.some(p=>p.id===2));

// Dos aparatos anotan pedidos distintos en el MISMO viaje
r=combinarViajes(C([{uid:'J',mod:5,pedidos:P(1,2)}]),C([{uid:'J',mod:9,pedidos:P(1,3)}]));
ok('Pedidos de ambos aparatos se conservan', r[0].pedidos.length===3);

// El escenario de hoy: PC con copia vieja + celular que ya recibio el dinero
r=combinarViajes(C([{uid:'K',cerrado:false,mod:9e12,pedidos:P(1)}]),C([{uid:'K',cerrado:true,recibidoPor:'Cesar',mod:5,pedidos:P(1,2,3,4,5,6)}]));
ok('ESCENARIO DE HOY: ruta cobrada intacta', r[0].cerrado===true && r[0].pedidos.length===6);

console.log(fail? '\n'+fail+' PRUEBAS FALLARON':'\nTodas las pruebas pasaron');
