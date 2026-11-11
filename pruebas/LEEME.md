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

`prueba-mapa.js` — Mapa en Por entregar (7/11/2026): botón de mapa arriba, un punto por cliente (varias notas del mismo
cliente = un punto con el número), tocar escoge/quita, punto gris = ya va en una ruta que se prepara, "N sin ubicación"
con sus notas para escogerlas a mano, filtro y búsqueda, arrastrar el mapa no cierra el panel, al refrescar no se mueve.
Al mandar a un rutero las notas quedan en el orden en que se escogieron y con su ubicación; en el viaje, "Ruta en Google
Maps": paradas en orden (mismo cliente = una parada), enlaces de 10 en 10, WhatsApp y Copiar. Misma base local que
`prueba-por-entregar.js` y Leaflet local (`npm i leaflet@1.9.4`).
  Cambió después (7/11): si quitan/agregan productos de cajas a una nota de un consolidado de hoy (antes de salir),
  el reloj lleva puntito, el historial dice "Cambió después −0.50 … · cliente" y al enviar la ruta sale un aviso corto.

## Inicio de sesión con Supabase (10/11/2026)

Desde la v2026-11-10.1 las contraseñas ya no están en el código: Cobros entra con
`sb.auth.signInWithPassword` (usuario@cobros.local, usuarios creados en Supabase →
Authentication) y la base solo deja leer/cambiar a quien inició sesión
(`supabase/seguridad.sql`). Las pruebas viejas que escriben un PIN en `#loginPin`
ya no entran: hay que darles una sesión simulada como en `prueba-login-supabase.js`.

`prueba-login-supabase.js` — sin sesión no se lee nada; usuario o contraseña mala no
entra; con la buena entra con su rol, todo va con la sesión (no con la clave pública),
al volver a abrir no pide contraseña, "salir" la borra. Necesita
`npm i playwright-core @supabase/supabase-js@2`.

## Entrar con Face ID / huella (10/11/2026, v2026-11-10.2)

La sesión vive solo mientras la app está abierta (sessionStorage): al cerrarla pide
entrar otra vez, como antes. "Entrar con Face ID" usa las llaves de acceso de Supabase
(beta, `experimental.passkey`, supabase-js fijado en 2.119.0); la contraseña siempre queda
de respaldo. El formulario tiene autocomplete username/current-password para que el
teléfono guarde y llene la contraseña.

`prueba-faceid.js` — con un autenticador virtual de Chrome: ofrece activar después de
entrar con contraseña, registra, al reabrir entra con Face ID, "Ahora no" no insiste,
si Supabase apaga la beta la contraseña sigue funcionando.

`prueba-kml-reporte.js` — Reportes ⚙️ › Mapeo por vendedor › "Archivo Organic Maps" (10/11/2026): con los datos del
PDF (lat/lon de cada cliente que manda la PC) arma el .kml igual al de la ruta ("01. CLIENTE - Q total", mismo cliente =
un punto con la suma), nombre `mapeo_<vendedor>_<día><mes>.kml` (rangos "8al10noviembre"), avisa los que no tienen
ubicación, compartir directo, y la ruta del viaje sigue igual. Base falsa en la página (no necesita Postgres).
Nota: prueba-mapa.js y prueba-reportes.js entran con el PIN viejo; desde el cambio de seguridad hay que adaptarlas.
