![Relix](brand/relix-logo.png)

# Relix

**Tus reliquias, listas para jugar.**

Frontend para lanzar juegos en una Xbox Series X|S en **Modo Desarrollador**.
Escanea la carpeta `roms` de tu USB, lista cada juego en su consola y lo abre
en su emulador: RetroArch, XBSX2, PPSSPP, etc. Descarga las portadas desde la
misma consola (libretro-thumbnails, las de RetroArch) y, si además copias la
carpeta de **ES-DE**, usa sus portadas, descripciones y favoritos.

Estilo visual lúdico y redondeado, pensado para verse en una TV a 3 metros y
manejarse con el control. Logo, colores, tipografía y voz de la marca están en
[`brand/`](brand/README.md).

## Cómo funciona

```
┌─────────────────────── App UWP "Relix" (Xbox) ──────────────────────┐
│                                                                     │
│   Shell en C# (shell/)                  Interfaz en Svelte (src/)   │
│   ─────────────────────                 ─────────────────────────   │
│   · Lee el control (nativo)           ──►  evento 'input'           │
│   · Lee el USB (gamelists, portadas)  ◄──  bridge.loadLibrary()     │
│   · Abre emuladores por URI           ◄──  bridge.launch(uri)       │
│   · Vuelve al frente con relix:       ──►  evento 'resumed'         │
│                                                                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ Launcher.LaunchUriAsync(...)
                                  ▼
     xbsx2:?cmd=xbsx2.exe "E:\roms\ps2\Okami.chd"&launchOnExit=relix:
                                  │
                                  ▼
                 XBSX2 abre el juego; al salir, Xbox vuelve a Relix
```

- **Lanzar un juego** es abrir una URI con el protocolo del emulador. El formato
  es el mismo que usan otros frontends para Xbox (verificado en el código de
  RetroPass). Ver `src/lib/core/launchUri.js`.
- **`launchOnExit=relix:`** hace que la consola vuelva sola a Relix al cerrar
  el emulador.
- **La interfaz corre en WebView2** (Chromium), soportado en apps UWP de Xbox
  y depurable con las DevTools de Edge desde el PC.
- **El control se lee en C#** (`Windows.Gaming.Input`) y llega a la interfaz
  como mensajes. Así se evita el cursor del "modo mouse" y un bug conocido de
  WebView2 en Xbox con el foco y el botón B.
- **La biblioteca se guarda.** El primer inicio (o un disco nuevo) escanea todas
  las consolas; después Relix abre al instante con la lista guardada. Desde
  **Opciones** (ícono de engranaje o botón Menú ≡) se re-escanea consola por consola.
- **La interfaz y las portadas se sirven desde `https://relix.example`**, una
  dirección interna que responde el shell sin salir a internet.
- **Portadas sin cuentas.** En **Opciones › Portadas** Relix baja las portadas de
  [libretro-thumbnails](https://github.com/libretro-thumbnails) por consola: nombre
  exacto (Redump) o mismo título con la región preferida. Si el nombre es dudoso
  ("GT4", "Persona 4"), no adivina: lo deja para **Elegir a mano** con las
  candidatas más parecidas. La grilla usa miniaturas JPG que el shell crea una vez.
  En grillas y listas todas las portadas miden lo mismo; el panel de detalle
  muestra la caja completa con su forma real (PS1 cuadrada, PSP alta).
- **Tus datos viajan con el USB.** Favoritos, ocultos, tiempo de juego, portadas
  elegidas y preferencias se guardan solos en `E:\relix\datos.json` (2 segundos
  después de cada cambio, y en el acto al lanzar un juego). Si reinstalas Relix o
  cambias de Xbox, siguen ahí. Hay una copia de la versión anterior y un respaldo
  por día de los últimos 7; si `datos.json` se daña, Relix usa la copia más nueva
  que sirva.
- **Tiempo de juego.** Relix anota la hora al lanzar y la hora al volver, sea
  saliendo del emulador o con el botón Xbox. Las partidas de menos de 1 minuto no
  cuentan y las de más de 12 horas se descartan. Si la Xbox cierra Relix mientras
  juegas, la partida se cierra la próxima vez que abra.
- **Juegos que no abren.** El emulador no le avisa a Relix cuando falla (se cierra
  y la Xbox vuelve sola). Si vuelves antes de 15 segundos, Relix lo toma como un
  juego que no abrió y dice qué revisar: en PS1, la BIOS exacta según la región
  del archivo (`scph5500.bin` Japón, `scph5501.bin` EE. UU., `scph5502.bin` Europa)
  en la carpeta `system` de RetroArch.
- **Revisión del sistema.** Al abrir, Relix revisa que el USB deje guardar, el
  espacio libre, las carpetas de `roms` que no reconoce, qué emuladores faltan para
  las consolas con juegos, las BIOS en las carpetas de las guías
  (`E:\RetroArch\system`, `E:\DuckStation\bios`, `E:\XBSX2\BIOS`, según la región
  de tus juegos de PS1) y si llega al servidor de portadas. Si algo falta, avisa una
  vez y lo muestra en **Opciones › Revisión**, con la guía que lo arregla. Una BIOS
  puesta dentro del emulador no se puede ver desde Relix: sale como información.
- **Primer uso guiado.** La primera vez aparece un recorrido de cinco pantallas
  (hola, tu USB, emuladores, portadas, botones). Se salta con ≡ y se repite desde
  Opciones › Revisión.

## Estructura

```
src/
  lib/core/          lógica pura, sin interfaz (con tests)
    platforms.js     consolas, colores y cómo se lanza cada emulador
    launchUri.js     arma la URI de lanzamiento
    esde.js          lee gamelist.xml de ES-DE y calcula rutas de ROMs/portadas
    scan.js          convierte los archivos de roms en juegos (nombres, multidisco, Wii U)
    coverMatch.js    busca la portada de cada juego en la lista de libretro
    search.js        búsqueda por comienzo de palabra (sin tildes; II = 2)
    sorting.js       orden A–Z / recientes / más jugados / año y saltos con LT/RT
    userData.js      formato de datos.json, qué copia manda y tiempo de cada partida
    quickExit.js     aviso cuando un juego se cierra al abrir (BIOS según la región)
    guides.js        guías de instalación por consola y emulador (DevStore, BIOS, carpetas)
    systemCheck.js   revisión del sistema: qué está bien, qué falta y qué guía lo arregla
    collections.js   lee y escribe colecciones en el formato de ES-DE
    bridge.js        habla con el shell en C# (o usa datos de prueba en el navegador)
  lib/ui/            piezas de interfaz: entrada del control, sonidos, portadas…
  screens/           Home, Library (grilla), Search, GameMenu (Y), Options, Guide, Welcome
                     (primer uso), CoverPicker, LaunchOverlay
  mock/gamelists/    gamelists de ejemplo con el formato real de ES-DE
  mock/libretro-names.json  nombres reales de libretro (demo y tests)
tests/               tests de la lógica y del puente con el shell (vitest)
brand/               logo, íconos de la app y guía de marca
shell/               el shell en C# (RelixShell) y la guía para Visual Studio
scripts/             copy-to-shell.mjs: copia la interfaz al proyecto de Visual Studio
```

## Comandos

```bash
npm install
npm run dev            # abre en el navegador con datos de prueba
npm test               # corre los tests
npm run build          # dist/ para empaquetar dentro de la app UWP
npm run build:single   # dist-single/index.html autocontenido (demo)
npm run build:shell -- "C:\Proyectos\RelixShell\RelixShell"   # compila y copia a Visual Studio
```

**Controles en el navegador:** flechas para moverte, Enter para elegir, Esc para
volver, X para favorito, Q y E para cambiar de consola. Un control de Xbox
conectado al PC también funciona.

**Probarla en la TV antes de la Etapa 2:** corre `npm run dev -- --host` y abre
`http://<IP-de-tu-PC>:5173` en el Edge de la Xbox (modo normal). Si el control
mueve el cursor de Edge en lugar de la interfaz, es lo esperado: en la app UWP
se desactiva ese "modo mouse".

## Rutas en la consola (por defecto)

| Qué | Dónde |
|---|---|
| ROMs | `E:\roms\<sistema>\` |
| Gamelists | `E:\ES-DE\gamelists\<sistema>\gamelist.xml` |
| Portadas | `E:\ES-DE\downloaded_media\<sistema>\covers\` (las de ES-DE y las que baja Relix) |
| Colecciones | `E:\ES-DE\collections\custom-<Nombre>.cfg` (las ve también ES-DE) |
| Tus datos | `E:\relix\datos.json` (y `datos.anterior.json`) |
| Respaldos diarios | `E:\relix\respaldos\datos-AAAA-MM-DD.json` (los últimos 7) |
| Caché de Relix | `E:\relix\cache\` (listas de libretro y miniaturas; se puede borrar) |

**Volver a un respaldo:** en el PC, copia el `datos-<día>.json` que quieras
encima de `E:\relix\datos.json` y abre Relix. Cuando el archivo del USB cambia por
fuera de la app (un respaldo, u otra Xbox), Relix usa el del USB.

`<sistema>` usa los nombres de ES-DE: `psx`, `ps2`, `psp`, `snes`, `n64`, `gba`, `gc`,
`wiiu`, `n3ds`, `megadrive`, `dreamcast`, `xbox360` (también acepta `ps1`, `genesis`,
`3ds`, `dc`...). Los juegos de Xbox 360 y Dreamcast pueden ir en carpetas
(`Halo 3 (USA)/default.xex`, `Shenmue (USA)/disc.gdi`): el nombre sale de la carpeta.
Así puedes escanear y descargar portadas con ES-DE en el PC y copiar las
carpetas tal cual al disco USB, y lo que baja Relix también lo ve ES-DE.

## Emuladores configurados

El primero de cada fila es el recomendado. En **Opciones › Consolas** eliges el de
cada consola (con A pasas al siguiente) y con **Y › Abrir con…** uno distinto para
un juego puntual. Si no elegiste, Relix usa el primero que tengas instalado: le
pregunta a la Xbox qué protocolos hay (Acerca de muestra cuáles).

| Consola | Emuladores (protocolo) |
|---|---|
| PS1 | RetroArch SwanStation, RetroArch Beetle PSX HW, DuckStation (`duckstation:`) |
| PS2 | XBSX2 (`xbsx2:`) |
| PSP | PPSSPP (`ppsspp:`), RetroArch PPSSPP |
| SNES | RetroArch Snes9x, RetroArch bsnes |
| N64 | RetroArch Mupen64Plus-Next, RetroArch ParaLLEl N64 |
| GBA | RetroArch mGBA, gpSP, VBA-M |
| GameCube | RetroArch Dolphin, Dolphin (`dolphin:`; su última versión no abre juegos desde otras apps) |
| Wii U | ninguno: el port de Cemu no registra un protocolo, se abre desde Dev Home |
| 3DS | RetroArch 3DS (`citrara:`), Panda3DS (`panda:`), los dos experimentales |
| Mega Drive | RetroArch Genesis Plus GX, RetroArch PicoDrive |
| Dreamcast | RetroArch Flycast, Flycast (`flycast:`) |
| Xbox 360 | Xenia Canary (`xeniacanary:`), Xenia (`xenia:`) |

Los de RetroArch se abren con `retroarch:` y su núcleo (`cores\<núcleo>.dll`). Los
protocolos de los emuladores sueltos son los mismos que usa
[RetroPass](https://github.com/retropassdev/RetroPass) (`UrlSchemeGenerator.cs`).
Se configuran en `src/lib/core/platforms.js`.

**Switch:** existe [NXbox](https://github.com/NspxMiguel/NXbox), un port de Eden con
protocolo `nxbox://`, pero todavía no tiene un juego jugable de punta a punta ni
versión pública. Se suma como una consola más cuando madure.

## Hecho

- [x] **Interfaz:** inicio con canales, biblioteca en grilla, favoritos, "Seguir jugando".
- [x] **Identidad Relix:** logo, íconos de la app y guía de marca en `brand/`.
- [x] **Shell en C#:** WebView2, control nativo sin modo mouse, lectura del USB,
      lanzamiento de emuladores y regreso con `relix:`. Validado en la consola.
- [x] **Escaneo de `roms`:** nombres limpios, multidisco, Wii U en carpetas, ES-DE opcional.
- [x] **Opciones:** biblioteca guardada y escaneo por consola.
- [x] **Arreglos rápidos:** Reintentar cuando no hay USB, ocultar consolas vacías,
      avance del primer escaneo, posición en la grilla.
- [x] **Portadas desde internet:** libretro sin cuentas, elegir a mano, miniaturas,
      tamaño parejo en la grilla, caja real en el detalle y región preferida.
- [x] **Encontrar juegos:** saltos por letra (LT/RT), menú del juego (Y), búsqueda con
      teclado en pantalla (⧉), orden A–Z / recientes / año, colecciones en formato
      ES-DE y juegos ocultos.
- [x] **Acerca de:** versión y fecha de compilación, emuladores instalados,
      rutas en el USB, resumen de la biblioteca y créditos (Opciones › Acerca de).
- [x] **Tus datos en el USB y tiempo de juego:** respaldo automático con copias
      diarias, tiempo y partidas por juego (detalle, Seguir jugando, Acerca de) y
      orden "Más jugados".
- [x] **Más consolas y elegir emulador:** SNES, N64, GBA, 3DS, Mega Drive, Dreamcast
      y Xbox 360; emulador por consola (Opciones › Consolas) o por juego (Y › Abrir
      con…); Relix revisa cuáles están instalados; el inicio y las pestañas se
      deslizan cuando no caben.
- [x] **Guías por consola:** qué emulador instalar (desde DevStore y el Device Portal),
      qué archivos pide y dónde van, dónde van los juegos y cómo probar; con lo que
      Relix ya sabe (emulador instalado, juegos encontrados) y un QR a DevStore.
      Se abren con Y en Opciones › Consolas o desde una consola sin juegos.
- [x] **Revisión del sistema y primer uso:** Opciones › Revisión (USB, espacio,
      carpetas, emuladores, BIOS por región, internet y respaldo) con la guía de cada
      cosa; aviso al abrir y número en el ícono de Opciones; recorrido de bienvenida
      de cinco pantallas que se puede saltar y repetir.

## Controles

| Botón | Qué hace |
|---|---|
| A | Abrir / jugar |
| B | Volver |
| X | Favorito (en la búsqueda: borrar letra) |
| Y | Menú del juego: jugar, abrir con…, favorito, colecciones, cambiar portada, ocultar, ordenar. En Opciones › Consolas, o en una consola sin juegos: la guía |
| LB / RB | Consola anterior / siguiente (o colección, dentro de Colecciones) |
| LT / RT | Letra anterior / siguiente (año, si ordenas por año) |
| Vista ⧉ | Buscar en todas las consolas |
| Menú ≡ | Opciones |

En el navegador: flechas, Enter, Esc, X, Y, Q/E, Z/C, V y M.

## Hoja de ruta

1. ~~Arreglos rápidos~~ (hecho)
2. ~~Portadas desde internet~~ (hecho)
3. ~~Encontrar juegos~~ (hecho; filtros por género/jugadores quedan para el paso 7)
4. ~~Respaldo en el USB y tiempo de juego~~ (hecho)
5. ~~Más consolas y elegir emulador~~ (hecho; Switch cuando NXbox sea jugable)
6. ~~Revisión del sistema y primer uso guiado~~ (hecho)
7. **Ficha más viva:** fanart de fondo, video de vista previa, protector de pantalla.
   Con ScreenScraper, que además completa las portadas de PSP que libretro no tiene.
8. **Portafolio:** GitHub público, tests en GitHub Actions, releases instalables,
   interfaz en inglés.

Más adelante: RetroAchievements, administrar la biblioteca desde el celular, perfiles.

---

Creado por **snyker-fair** ([GitHub](https://github.com/snyker-fair)).

Los códigos QR se generan con [uqr](https://github.com/unjs/uqr) (MIT).
