![Relix](brand/relix-logo.png)

# Relix

**Tus reliquias, listas para jugar.**

Frontend para lanzar juegos en una Xbox Series X|S en **Modo Desarrollador**.
Lee tu biblioteca de **ES-DE** (gamelists y portadas) y abre cada juego en su
emulador: RetroArch, XBSX2, PPSSPP, etc.

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
- **La interfaz y las portadas se sirven desde `https://relix.example`**, una
  dirección interna que responde el shell sin salir a internet.

## Estructura

```
src/
  lib/core/          lógica pura, sin interfaz (con tests)
    platforms.js     consolas, colores y cómo se lanza cada emulador
    launchUri.js     arma la URI de lanzamiento
    esde.js          lee gamelist.xml de ES-DE y calcula rutas de ROMs/portadas
    bridge.js        habla con el shell en C# (o usa datos de prueba en el navegador)
  lib/ui/            piezas de interfaz: entrada del control, sonidos, portadas…
  screens/           Home (fila de canales), Library (grilla), LaunchOverlay
  mock/gamelists/    gamelists de ejemplo con el formato real de ES-DE
tests/               tests de launchUri y esde (vitest)
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
- [x] **Identidad Relix.** Logo, íconos de la app y guía de marca en `brand/`.
- [ ] **Etapa 2: shell UWP en C#.** Código listo en `shell/` y probado contra
      un shell simulado. **Falta validarlo en la consola** siguiendo
      [`shell/README.md`](shell/README.md): control sin cursor, B sin salir,
      lectura del USB, portadas y regreso desde el emulador.
- [ ] **Etapa 3: tu biblioteca real.** Escanear con ES-DE en el PC, copiar al
      USB y probar cada emulador de punta a punta.
- [ ] **Etapa 4: pulido.** Búsqueda, ajustes de rutas desde la interfaz,
      silenciar sonidos, temas por consola y videos de vista previa.
