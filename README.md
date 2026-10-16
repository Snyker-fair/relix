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
    sorting.js       orden A–Z / recientes / año y saltos con LT/RT
    collections.js   lee y escribe colecciones en el formato de ES-DE
    bridge.js        habla con el shell en C# (o usa datos de prueba en el navegador)
  lib/ui/            piezas de interfaz: entrada del control, sonidos, portadas…
  screens/           Home, Library (grilla), Search, GameMenu (Y), Options, CoverPicker, LaunchOverlay
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
| Caché de Relix | `E:\relix\cache\` (listas de libretro y miniaturas; se puede borrar) |

`<sistema>` usa los nombres de ES-DE: `psx`, `psp`, `ps2`, `gc`, `wiiu`.
Así puedes escanear y descargar portadas con ES-DE en el PC y copiar las
carpetas tal cual al disco USB, y lo que baja Relix también lo ve ES-DE.

## Emuladores configurados

| Consola | Emulador | Protocolo |
|---|---|---|
| PS1 | RetroArch + SwanStation | `retroarch:` (núcleo `swanstation_libretro.dll`) |
| PSP | PPSSPP | `ppsspp:` |
| PS2 | XBSX2 | `xbsx2:` |
| GameCube | RetroArch + Dolphin | `retroarch:` (núcleo `dolphin_libretro.dll`) |
| Wii U | Cemu | sin protocolo documentado todavía |

Para GameCube se usa el núcleo de RetroArch porque el Dolphin standalone tiene
roto el lanzamiento desde frontends en su última versión. Se cambia en
`platforms.js`.

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

## Controles

| Botón | Qué hace |
|---|---|
| A | Abrir / jugar |
| B | Volver |
| X | Favorito (en la búsqueda: borrar letra) |
| Y | Menú del juego: jugar, favorito, colecciones, cambiar portada, ocultar, ordenar |
| LB / RB | Consola anterior / siguiente (o colección, dentro de Colecciones) |
| LT / RT | Letra anterior / siguiente (año, si ordenas por año) |
| Vista ⧉ | Buscar en todas las consolas |
| Menú ≡ | Opciones |

En el navegador: flechas, Enter, Esc, X, Y, Q/E, Z/C, V y M.

## Hoja de ruta

1. ~~Arreglos rápidos~~ (hecho)
2. ~~Portadas desde internet~~ (hecho)
3. ~~Encontrar juegos~~ (hecho; filtros por género/jugadores quedan para el paso 7)
4. **Respaldo en el USB** (`E:\relix\`) y **tiempo de juego** por juego, con
   "ordenar por más jugados".
5. **Más consolas** (SNES, GBA, N64, Mega Drive, Dreamcast, Xbox 360, 3DS) y
   **elegir emulador** por consola o por juego.
6. **Revisión del sistema** (USB, carpetas, emuladores instalados) y **primer uso guiado**.
7. **Ficha más viva:** fanart de fondo, video de vista previa, protector de pantalla.
   Con ScreenScraper, que además completa las portadas de PSP que libretro no tiene.
8. **Portafolio:** GitHub público, tests en GitHub Actions, releases instalables,
   interfaz en inglés.

Más adelante: RetroAchievements, administrar la biblioteca desde el celular, perfiles.
