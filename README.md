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

> **Antes de usarlo:** Relix no está afiliado a Microsoft, Sony, Nintendo, Sega ni a
> los autores de los emuladores. No incluye juegos, BIOS ni claves: los juegos y las
> BIOS deben salir de tus propias consolas. Solo funciona en una Xbox en **Modo
> Desarrollador**; no es una app de la Microsoft Store.

**Documentación:** armar el proyecto la primera vez en
[`shell/README.md`](shell/README.md) · compilar una versión nueva en
[`docs/COMPILAR.md`](docs/COMPILAR.md) · qué probar en la TV en
[`docs/PROBAR.md`](docs/PROBAR.md).

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
- **Ficha viva.** Si ES-DE escrapeó fanart, logo y video en el PC, el panel del juego
  los muestra: el fanart arriba con el logo encima y, tras 1,5 segundos en el juego,
  el video sin sonido (se repite; el sonido se activa en Preferencias). A los juegos
  sin fondo, **Opciones › Portadas** les baja además una captura de libretro.
- **Protector de pantalla.** Tras 3, 5 o 10 minutos sin tocar el control (o nunca),
  tus juegos uno tras otro: el fanart a pantalla completa o la captura enmarcada,
  con su nombre y consola. **A** juega el que se ve; cualquier otro botón vuelve.
- **Filtros.** **Y › Filtrar** muestra los géneros de la consola y "2 o más
  jugadores", con los datos de los gamelists de ES-DE. El filtro dura la sesión.
- **Tema claro u oscuro.** En **Opciones › Preferencias › Tema**: Claro, Oscuro
  ("Noche azul": fondo azul noche y paneles azul pizarra, con el rosa y los colores
  de cada consola de siempre) o Automático, que es oscuro de 20:00 a 7:00. El shell
  recuerda el fondo del tema, así de noche no hay destello celeste al abrir.

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
    media.js         fondo, logo y video de cada juego (downloaded_media de ES-DE)
    filters.js       filtros por género y jugadores (Y › Filtrar)
    theme.js         tema claro, oscuro o automático (los colores están en app.css)
    guides.js        guías de instalación por consola y emulador (DevStore, BIOS, carpetas)
    systemCheck.js   revisión del sistema: qué está bien, qué falta y qué guía lo arregla
    collections.js   lee y escribe colecciones en el formato de ES-DE
    bridge.js        habla con el shell en C# (o usa datos de prueba en el navegador)
  lib/ui/            piezas de interfaz: entrada del control, sonidos, portadas…
  screens/           Home, Library (grilla), Search, GameMenu (Y), Options, Guide, Welcome
                     (primer uso), Screensaver, CoverPicker, LaunchOverlay
  mock/gamelists/    gamelists de ejemplo con el formato real de ES-DE
  mock/libretro-names.json  nombres reales de libretro (demo y tests)
tests/               tests de la lógica y del puente con el shell (vitest)
brand/               logo, íconos de la app y guía de marca
shell/               el shell en C# (RelixShell) y la guía para Visual Studio
docs/                compilar una versión nueva (COMPILAR.md) y qué probar en la TV (PROBAR.md)
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
| Fondos | `…\fanart\` (ES-DE); si no hay, `…\screenshots\` (ES-DE o Relix) o `…\titlescreens\` |
| Logos | `…\marquees\` (ES-DE, "marquee (wheel)") |
| Videos | `…\videos\` (ES-DE; `.mp4`, `.webm` o `.m4v`) |
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

## Fondos, logos y videos con ES-DE (en el PC)

Relix no escrapea por su cuenta (ScreenScraper pide una clave de desarrollador):
usa lo que ES-DE deja en el USB. Una vez por consola:

1. Instala [ES-DE](https://es-de.org) en el PC y crea una cuenta gratis en
   [ScreenScraper](https://www.screenscraper.fr): con cuenta, ES-DE escrapea más
   rápido y con más cupo por día.
2. Conecta el USB y deja que ES-DE use `E:\roms` como carpeta de ROMs (la pide la
   primera vez). Así los archivos de ES-DE tienen el mismo nombre que ve la Xbox.
3. Menú de ES-DE → **SCRAPER**:
   - **SCRAPE FROM**: ScreenScraper.
   - **ACCOUNT SETTINGS**: activa **USE THIS ACCOUNT FOR SCREENSCRAPER** y escribe
     tu usuario y contraseña.
   - **CONTENT SETTINGS**: deja activados los videos, *fan art*, *marquee (wheel)*
     (el logo), *screenshots*, *box covers* y *other metadata* (descripción, género
     y jugadores, que usan los filtros).
   - **SCRAPE THESE SYSTEMS**: las consolas que quieras → **START**.
4. Copia al USB, desde la carpeta de datos de ES-DE en el PC (con el instalador,
   `C:\Users\<tu usuario>\ES-DE`), las carpetas `downloaded_media` y `gamelists`
   dentro de `E:\ES-DE\`. Si Windows pregunta, combina las carpetas: las portadas
   que bajó Relix ya están ahí.
5. Abre Relix: lee los fondos, logos y videos al iniciar.

Los nombres del menú son los de ES-DE en inglés y pueden cambiar un poco entre
versiones. Cada video pesa entre 5 y 20 MB: si el USB es chico, escrapea videos
solo de las consolas que más juegas.

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
- [x] **Ficha viva, protector y filtros:** fanart, logo y video de ES-DE en el panel
      del juego (capturas de libretro para los que no tienen fondo), protector de
      pantalla con tus juegos y Y › Filtrar por género o jugadores.
- [x] **Tema oscuro:** Claro, Oscuro o Automático (de noche) en Preferencias.

## Controles

| Botón | Qué hace |
|---|---|
| A | Abrir / jugar |
| B | Volver |
| X | Favorito (en la búsqueda: borrar letra) |
| Y | Menú del juego: jugar, abrir con…, favorito, colecciones, cambiar portada, ocultar, ordenar, filtrar. En Opciones › Consolas, o en una consola sin juegos: la guía |
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
7. ~~Ficha más viva, protector de pantalla y filtros~~ (hecho, con lo que escrapea
   ES-DE en el PC; ScreenScraper directo desde la Xbox queda para más adelante)
8. **Portafolio:** GitHub público, tests en GitHub Actions, releases instalables,
   interfaz en inglés.

Más adelante: RetroAchievements, administrar la biblioteca desde el celular, perfiles.

---

Creado por **snyker-fair** ([GitHub](https://github.com/Snyker-fair)).

## Licencia

Relix es software libre con la [licencia GPL-3.0](LICENSE) (o, a tu elección, una
versión posterior): puedes usarlo, estudiarlo, modificarlo y compartirlo. Si
distribuyes una versión modificada, debe llevar la misma licencia y su código.
Se entrega sin garantía.

Usa:

- [uqr](https://github.com/unjs/uqr) para los códigos QR (MIT).
- Las letras [Baloo 2](https://fonts.google.com/specimen/Baloo+2) y
  [Nunito](https://fonts.google.com/specimen/Nunito) (SIL Open Font License).
- Las portadas de [libretro-thumbnails](https://github.com/libretro-thumbnails),
  que se bajan desde la consola y no vienen en este repositorio.

Los nombres de consolas y emuladores son marcas de sus dueños y se usan solo para
decir con qué funciona Relix. Los íconos de las consolas están dibujados a mano y
no usan logos.
