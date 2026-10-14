# Repisa

Frontend para lanzar juegos en una Xbox Series X|S en **Modo Desarrollador**.
Lee tu biblioteca de **ES-DE** (gamelists y portadas) y abre cada juego en su
emulador: RetroArch, XBSX2, PPSSPP, etc.

Estilo visual lúdico y redondeado, pensado para verse en una TV a 3 metros y
manejarse con el control.

## Cómo funciona

```
┌────────────────────── App UWP "Repisa" (Xbox) ──────────────────────┐
│                                                                     │
│   Shell en C# (Etapa 2)                 Interfaz en Svelte (esto)   │
│   ─────────────────────                 ─────────────────────────   │
│   · Lee el USB (gamelists, portadas)  ◄──  bridge.loadLibrary()     │
│   · Abre emuladores por URI           ◄──  bridge.launch(uri)       │
│   · Vuelve al frente con repisa:          (mensajes de WebView2)    │
│                                                                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ Launcher.LaunchUriAsync(...)
                                  ▼
     xbsx2:?cmd=xbsx2.exe "E:\roms\ps2\Okami.chd"&launchOnExit=repisa:
                                  │
                                  ▼
                 XBSX2 abre el juego; al salir, Xbox vuelve a Repisa
```

- **Lanzar un juego** es abrir una URI con el protocolo del emulador. El formato
  es el mismo que usan otros frontends para Xbox (verificado en el código de
  RetroPass). Ver `src/lib/core/launchUri.js`.
- **`launchOnExit=repisa:`** hace que la consola vuelva sola a Repisa al cerrar
  el emulador.
- **La interfaz corre en WebView2** (Chromium), soportado en apps UWP de Xbox
  y depurable con las DevTools de Edge desde el PC.

## Estructura

```
src/
  lib/core/          lógica pura, sin interfaz (con tests)
    platforms.js     consolas, colores y cómo se lanza cada emulador
    launchUri.js     arma la URI de lanzamiento
    esde.js          lee gamelist.xml de ES-DE y calcula rutas de ROMs/portadas
    bridge.js        habla con el shell en C# (o usa datos de prueba en el navegador)
  lib/ui/            piezas de interfaz: entrada del control, sonidos, portadas…
  screens/           Home (repisa de canales), Library (grilla), LaunchOverlay
  mock/gamelists/    gamelists de ejemplo con el formato real de ES-DE
tests/               tests de launchUri y esde (vitest)
```

## Comandos

```bash
npm install
npm run dev            # abre en el navegador con datos de prueba
npm test               # corre los tests
npm run build          # dist/ para empaquetar dentro de la app UWP
npm run build:single   # dist-single/index.html autocontenido (demo)
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
| Portadas | `E:\ES-DE\downloaded_media\<sistema>\covers\` |

`<sistema>` usa los nombres de ES-DE: `psx`, `psp`, `ps2`, `gc`, `wiiu`.
Así puedes escanear y descargar portadas con ES-DE en el PC y copiar las
carpetas tal cual al disco USB.

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

## Etapas

- [x] **Etapa 1: interfaz.** Pantallas, navegación con control, favoritos,
      "seguir jugando", lector de ES-DE y generador de URIs con tests.
- [ ] **Etapa 2: shell UWP en C#.** Proyecto en Visual Studio con WebView2.
  - Declarar el protocolo `repisa` y la capacidad `removableStorage` en el
    manifiesto, con las asociaciones de tipo de archivo que exige UWP para
    leer el USB (`.xml`, `.png`, `.jpg`…).
  - Servir `dist/` dentro de la app y responder los mensajes `loadLibrary`
    y `launch` del puente.
  - Servir portadas desde el USB a la interfaz (a validar en la consola).
  - Ajustes de Xbox: desactivar el modo mouse, que B no cierre la app,
    pantalla completa sin márgenes de TV, y marcar la app como **Game**.
- [ ] **Etapa 3: tu biblioteca real.** Escanear con ES-DE en el PC, copiar al
      USB y probar cada emulador de punta a punta.
- [ ] **Etapa 4: pulido.** Búsqueda, ajustes de rutas desde la interfaz,
      silenciar sonidos, temas por consola y videos de vista previa.
