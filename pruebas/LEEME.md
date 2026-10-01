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
