# Pruebas

Sirven para comprobar que un cambio no rompe el guardado ni pierde datos.

    cd pruebas && npm i playwright-core && node prueba-fusion.js && node prueba-navegador.js

- `prueba-fusion.js` — las reglas que deciden qué versión de un viaje gana
  cuando dos aparatos tienen copias distintas.
- `prueba-navegador.js` — abre la app de verdad en un navegador con una nube
  simulada y hace el recorrido completo: entrar, anotar, enviar ruta, recibir
  dinero, y recuperar un respaldo.

Correrlas antes de subir cualquier cambio al guardado.
