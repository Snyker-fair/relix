# Qué probar en la TV

Listas para revisar Relix en la Xbox después de compilar ([`COMPILAR.md`](COMPILAR.md)).
Empieza por la prueba rápida; las demás están ordenadas por el paso de la hoja de
ruta en que llegó cada función.

## Prueba rápida (lo primero, unos 15 minutos)

Si esto anda, lo demás casi seguro también. Si algo falla aquí, vale la pena
resolverlo antes de seguir con el resto.

Desde la 0.7.0, al abrir aparece una vez el **recorrido de bienvenida**: recórrelo
(son cinco pantallas) o sáltalo con **≡**; después sigue con la lista.

1. [ ] Relix abre y muestra tus juegos. La primera vez escanea las consolas nuevas
       (verás el avance en la pantalla de carga).
2. [ ] **≡ → RB hasta Acerca de → En tu USB** dice "Guardado hace…", y en el PC existe
       `E:\relix\datos.json`.
3. [ ] **≡ → Consolas**: los emuladores que tienes dicen **Instalado**.
4. [ ] Abre un juego de PS1 y otro de PS2 o PSP, juega **más de 1 minuto** y sal desde el
       menú del emulador: vuelves a Relix con el aviso "N min jugados".
5. [ ] Abre otro juego y vuelve con el **botón Xbox** → Relix: también se suma.
6. [ ] Un juego de PS1 europeo con `scph5502.bin` donde dice la guía de PS1
       (**≡ → Consolas → PlayStation → Y**): ¿abre? Si no, ¿aparece "se cerró enseguida"?
7. [ ] **≡ → RB hasta Portadas → A** en una consola: baja portadas y se ven en la grilla.
8. [ ] **≡ → RB hasta Revisión**: saca una foto de la lista (baja con ↓ hasta el final).
       Ahí se ve de una vez qué emuladores, BIOS y permisos detecta tu Xbox.

**Para reportar un problema:** abre un *issue* con una foto de la pantalla, qué
hiciste justo antes y la versión (**≡ → Acerca de**). Si Visual Studio se detiene
con un error, copia el mensaje de la ventana **Salida**.

## Paso 2 · Portadas
- [ ] **≡ → RB hasta Portadas**: cada consola dice "N de M con portada".
- [ ] **A** en una consola: "Buscando…", "Bajando X de Y" y el resumen.
- [ ] La grilla muestra las portadas (la primera vez tardan un poco: se crean las miniaturas).
- [ ] **Elegir a mano**: A guarda una candidata, X deja la de color.
- [ ] En el PC: portadas en `E:\ES-DE\downloaded_media\<consola>\covers\` y caché en `E:\relix\cache\`.

## Paso 3 · Encontrar juegos
- [ ] En una consola, **RT / LT** saltan de letra y aparece la letra grande.
- [ ] **Y** abre el menú del juego: favorito, colecciones, cambiar portada, ocultar, ordenar.
- [ ] **Y → Colecciones → Nueva colección…**: escribir un nombre con el teclado y **≡** para terminar.
- [ ] En el inicio aparece **Colecciones**; adentro, LB/RB cambia de colección.
- [ ] En el PC: `E:\ES-DE\collections\custom-<Nombre>.cfg`.
- [ ] **Vista ⧉** abre la búsqueda desde el inicio o la biblioteca; con → se pasa a los resultados.
- [ ] **Y → Ordenar biblioteca**: A–Z → Recientes (→ Año, si tus juegos traen año de ES-DE).
- [ ] **Y → Ocultar juego** y luego **≡ → Biblioteca → Juegos ocultos** para recuperarlo.

## Imagen de la app
- [ ] En la ficha de Relix de la Xbox (la de **Reanudar**), el cuadro muestra la gema y el nombre.

## Ajustes visuales (entre el paso 3 y el 4)
- [ ] En el inicio, al moverte entre canales el enfocado ya no toca a sus vecinos.
- [ ] En la búsqueda, el campo (blanco, con lupa) queda separado del teclado.
- [ ] En las grillas, el aro rosado del juego enfocado no toca la fila de arriba ni las portadas de al lado.

## Acerca de
- [ ] **≡ → RB hasta Acerca de** muestra la versión 0.8.1, la fecha de compilación y "Xbox · Modo Desarrollador".
- [ ] **En tu USB** muestra tu letra de disco real.
- [ ] Al pie del panel izquierdo dice **Creado por snyker-fair**.

## Paso 4 · Tus datos y tiempo de juego
- [ ] Al abrir la versión nueva, tus favoritos y ocultos de antes siguen ahí, y en el PC
      aparece `E:\relix\datos.json` con ellos.
- [ ] Juega **más de 1 minuto** y sal desde el menú del emulador: arriba aparece
      "<Juego>: N min jugados".
- [ ] Juega otra vez y vuelve con el **botón Xbox** → Relix: también se suma.
- [ ] El panel del juego muestra el reloj: tiempo · partidas · hace cuánto. En
      **Seguir jugando** dice "Jugado …".
- [ ] **Y → Ordenar biblioteca**: aparece **Más jugados** (solo en consolas donde ya jugaste).
- [ ] **Acerca de**: la tarjeta **Tiempo de juego** con el total y tus 3 más jugados;
      **En tu USB** dice "Guardado hace …".
- [ ] Un juego que no abre (por ejemplo, de PS1 europeo sin `scph5502.bin`): al volver,
      Relix avisa "se cerró enseguida" y dice qué BIOS revisar.
- [ ] Al día siguiente, en el PC: `E:\relix\respaldos\datos-AAAA-MM-DD.json`.
- [ ] Prueba fuerte (opcional): desinstala Relix desde Dev Home, vuelve a desplegar
      con **F5** y abre: favoritos y tiempo siguen ahí (vienen del USB).

## Paso 5 · Más consolas y elegir emulador
- [ ] Crea en el USB las carpetas de las consolas que quieras (`E:\roms\snes`, `n64`,
      `gba`, `n3ds`, `megadrive`, `dreamcast`, `xbox360`) con algunos juegos. Relix las
      escanea solo la primera vez que abre; después, **≡ → Biblioteca** para re-escanear.
- [ ] En el inicio, los canales se deslizan al moverte; en la biblioteca, también las pestañas (LB/RB).
- [ ] **≡ → RB → Consolas**: cada consola dice su emulador e **Instalado** / **No instalado**.
      A pasa al siguiente emulador.
- [ ] **≡ → Acerca de**: la tarjeta **Emuladores en la consola** marca con ✓ los que tienes.
- [ ] En un juego, **Y → Abrir con…** → elige otro emulador: el panel dice "solo este juego".
- [ ] Juegos de Xbox 360 en carpeta (`Halo 3 (USA)\default.xex`) aparecen con el nombre de la carpeta.

## Guías por consola
- [ ] **≡ → Consolas → Y** abre la guía de la consola enfocada; LB/RB pasan a otra y B vuelve a la misma fila.
- [ ] Arriba a la izquierda dice si el emulador está instalado y cuántos juegos encontró.
- [ ] El QR se abre con la cámara del celular (lleva a DevStore › Emuladores).
- [ ] En una consola sin juegos (con **Consolas sin juegos: Visibles** en Preferencias), **Y** abre su guía.

## Paso 6 · Revisión y primer uso
- [ ] La primera vez que abres la 0.7.0 aparece **Primeros pasos**: Hola, Tu USB,
      Emuladores, Portadas y Botones. **A** avanza, **B** vuelve, **≡** salta.
- [ ] **Tu USB** dice si Relix puede guardar, cuánto espacio queda y qué carpetas de
      `E:\roms` no usa (por ejemplo `nes`).
- [ ] **Emuladores**: tus consolas con juegos, cada una con **Instalado** / **Sin instalar**
      y la BIOS. **↑** elige una, **A** abre su guía y **B** vuelve al mismo paso.
- [ ] **Portadas → Buscar ahora**: puedes pasar a **Botones** mientras sigue buscando.
- [ ] Al terminar (o saltarlo), cierra y abre Relix: el recorrido **no** vuelve a aparecer.
- [ ] Si algo está por arreglar, al abrir aparece "Relix encontró N cosas por arreglar"
      y el ícono de **Opciones** en el inicio lleva un número rosado.
- [ ] **≡ → RB hasta Revisión**: primero lo que falta (✗ rosado), después los avisos
      (! amarillo), la información (i) y lo que está bien (✓ verde).
- [ ] Con un juego de PS1 europeo: si `scph5502.bin` está en `E:\RetroArch\system`, dice
      **BIOS de PS1 en su lugar**; si no, **falta scph5502.bin** y **A** abre la guía de PS1.
      Al volver con **B**, el foco queda en la misma fila.
- [ ] Si usas DuckStation y pusiste la BIOS dentro del emulador, dice "no la veo en el USB"
      como información, no como error.
- [ ] (0.7.1) La BIOS de PS2 en `E:\XBSX2\BIOS` con cualquier extensión (no solo `.bin`):
      dice **BIOS de PS2 en su lugar** con el nombre de tu archivo. Si está en `.zip`,
      avisa que hay que descomprimirla.
- [ ] **Revisar de nuevo** vuelve a medir (tarda unos segundos si no hay internet).
- [ ] **Recorrido de bienvenida** lo muestra otra vez; al terminar vuelves a Revisión.

## Paso 7 · Ficha viva, protector y filtros
- [ ] Prepara fondos, logos y videos con ES-DE en el PC (README › **Fondos, logos y
      videos con ES-DE**). Sin eso también se puede probar: **≡ → Portadas → A** ahora
      baja además una captura para los juegos sin fondo ("N capturas para el fondo").
- [ ] En una consola, el panel del juego muestra arriba el fanart (o la captura) con el
      logo encima; la portada queda chica, junto al nombre. Detrás, el color del juego
      difuminado.
- [ ] Quédate unos 2 segundos en un juego con video: empieza sin sonido, se repite y el
      logo se desvanece. Al moverte a otro juego se detiene. **Lo más importante de
      revisar en la Xbox: que el video se repita sin cortarse.**
- [ ] **≡ → Preferencias → Sonido de los videos**: con **Activado**, el video suena.
- [ ] **≡ → Preferencias → Protector de pantalla**: déjalo en 3 minutos y suelta el
      control. Aparecen tus juegos uno tras otro; **A** juega el que se ve y cualquier
      otro botón vuelve a donde estabas.
- [ ] **Y → Filtrar** (si tus gamelists traen género o jugadores): elige un género; la
      grilla muestra solo esos y arriba aparece el filtro. **Y → Filtrar → Todos los
      juegos** lo quita.
- [ ] Si un video no se ve, anota su nombre y extensión (`.mp4`, `.webm`…) al
      reportarlo: puede ser un formato que la Xbox no reproduce.

## Tema oscuro (0.8.1)
- [ ] **≡ → Preferencias → Tema** (la primera fila): **A** pasa de Claro a Oscuro y a
      Automático. El cambio se ve en el acto, en todas las pantallas.
- [ ] Con **Oscuro**, recorre inicio, una consola, el menú **Y**, la búsqueda, Opciones
      y una guía: ningún texto queda invisible ni un panel blanco "encandila". Si ves
      uno, una foto basta.
- [ ] Cierra Relix con el tema en **Oscuro** y ábrelo de nuevo: arranca en azul noche,
      sin el destello celeste (desde la segunda vez, cuando el shell ya lo recuerda).
- [ ] **Automático** dice "Oscuro de 20:00 a 7:00 · ahora …" y cambia solo a esa hora.

Si algo falla, la tabla **Si algo falla** de [`shell/README.md`](../shell/README.md) tiene las causas más comunes.
