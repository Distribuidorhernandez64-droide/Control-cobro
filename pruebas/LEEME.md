# Pruebas

Sirven para comprobar que un cambio no rompe el guardado ni pierde datos.

    cd pruebas && npm i playwright-core && node prueba-fusion.js && node prueba-navegador.js

- `prueba-fusion.js` — las reglas que deciden qué versión de un viaje gana
  cuando dos aparatos tienen copias distintas.
- `prueba-navegador.js` — abre la app de verdad en un navegador con una nube
  simulada y hace el recorrido completo: entrar, anotar, enviar ruta, recibir
  dinero, y recuperar un respaldo.

Correrlas antes de subir cualquier cambio al guardado.

## Antes de publicar

1. Cambiar `const VERSION='...'` en `control-cobro-app.html` (por ejemplo
   `2026-10-01.3`). Los aparatos comparan su versión con la publicada y se
   actualizan solos; si no se cambia, nadie se entera de la versión nueva.
2. Correr todas las pruebas.

`prueba-dos-aparatos.js` simula celular y PC a la vez contra la misma nube,
con la PC 3 minutos adelantada. Es la prueba más importante del dinero.

## Por entregar (notas de Monica)

`prueba-por-entregar.js` — campanita, buscar, escoger, mandar a un rutero,
montos que siguen a Monica hasta que sale la ruta, aviso de cambios al enviar
candado de las notas ya enviadas y el aviso "cambió en Monica" cuando la nota se modifica después de salir. También "Para mañana" (mantener presionada una nota, solo maestro) y que regrese sola al otro día. Tiempo en espera de cada nota y la vista previa de la nota (productos, precios, total) al mantenerla presionada. Usa la librería real de Supabase contra
una base local (Postgres + PostgREST) con `supabase/pendientes_entrega.sql`.

`prueba-devoluciones.js` — si en Monica bajan cantidades de una nota que ya salió, la ruta (mientras no se
reciba) lo descuenta sola en "Devolución" a precio de salida, se ajusta si Monica cambia otra vez, respeta lo
escrito a mano, no descuenta cambios de precio y no toca rutas ya recibidas. "No se entregó" regresa la nota a
Por entregar (tarjeta "regresó · rutero"), se puede deshacer solo si nadie la volvió a mandar, y avisa
"regresó y la anularon" si después la anulan en Monica. Necesita la misma base local que `prueba-por-entregar.js`.

`prueba-consolidado.js` — en Por entregar, al escoger notas aparece "Consolidado" arriba: mismo armado que el
Consolidado de Facturación rápida (solo guiones, excluidos, grupo 1/2, alfabético, sabores por renglón,
Bonificaciones aparte), "Solo cajas" se puede apagar, Copiar texto y PDF. Necesita jsPDF local:
`JSPDF=/ruta/jspdf.umd.min.js` (npm i jspdf@2.5.1).

`prueba-ticket.js` — Cambios › pestañas Notas · Ticket (3/11/2026): arriba sigue una sola palabra "Cambios" con el total sin ver;
adentro cada pestaña con su lista, su PDF y sus vistas (ver Notas no marca las de Ticket); abre en la pestaña que tiene algo nuevo.
Ticket: producto eliminado (F9) tachado en la vista previa y sin sumar, venta cancelada sin ticket, precio subido en gris.
  Historial (6/11): al sacar un consolidado se guarda en el teléfono; sus notas quedan con tono suave y el
  reloj arriba abre "Consolidados" (Ver consolidado / Escoger otra vez).
