# Marca Relix

![Logo de Relix](relix-logo.png)

**Tus reliquias, listas para jugar.**

## La idea

**Relix** viene de *reliquias*: esos juegos que guardaste por años, en disco o
en cartucho, y que aquí vuelven a brillar. La marca es una **gema**, una
reliquia pulida, con un **destello en forma de X**. Esa X es la del nombre, el
brillo de la piedra y un guiño a la consola donde vive la app.

El punto de la "i" es una gemita del mismo rosa, para que el nombre y el
símbolo se lean como una sola pieza.

## Logo

| Archivo | Uso |
|---|---|
| `relix-mark.svg` | Fuente única del símbolo. Todo lo demás se genera desde aquí. |
| `relix-logo.png` | Logo horizontal (gema + nombre), fondo transparente. |
| `uwp/*.png` | Íconos de la app para Visual Studio (ver abajo). |
| `build-assets.py` | Regenera los PNG si cambias el SVG: `python3 brand/build-assets.py` |

- El nombre se escribe siempre en **minúsculas** en el logo: `relix`. En textos
  corridos se escribe **Relix**.
- No cambies los colores de la gema ni pongas el logo sobre fotos o fondos
  oscuros sin un recuadro claro detrás.
- Tamaño mínimo del símbolo solo: 24 px. Del logo con nombre: 30 px de alto.

## Colores

| Nombre | Hex | Uso |
|---|---|---|
| Cielo | `#DDEBF7` | Fondo de la app, tiles y pantalla de carga |
| Cielo hondo | `#C6DBEF` | Trama de puntos del fondo |
| Tinta | `#23304A` | Textos y el nombre en el logo |
| Tinta suave | `#56647E` | Textos secundarios |
| Gema | `#FF4F87` | Foco, favoritos, el punto de la i |
| Destello | `#FFC23D` | Solo el destello en X del logo |

Cada consola además tiene su propio color de canal (ver `src/lib/core/platforms.js`).

## Tipografía

- **Baloo 2** (600–800): títulos, nombres de juegos y el logo.
- **Nunito** (400–700): textos, etiquetas y ayudas.

Ambas son libres (licencia SIL OFL) y vienen empaquetadas dentro de la app.

## Voz

Cercana y breve, como alguien que te pasa el control:

- Botones con verbos claros: **Jugar**, **Volver**, **Favorito**, **Abrir**.
- Esperas con un guiño a la marca: *Desempolvando tus reliquias…*
- Los errores dicen qué pasó y qué hacer: *No se pudo abrir XBSX2. Revisa que esté instalado en la consola.*

## Íconos para Visual Studio (Etapa 2)

Los archivos de `uwp/` tienen los nombres exactos de la plantilla **UWP Blank App**.
Copia todos a la carpeta `Assets` del proyecto **RelixShell** y acepta reemplazar.

| Archivo | Tamaño | Dónde se ve |
|---|---|---|
| `Square150x150Logo.scale-200.png` | 300×300 | Tile en Dev Home |
| `Wide310x150Logo.scale-200.png` | 620×300 | Tile ancho |
| `Square44x44Logo.scale-200.png` | 88×88 | Listas de apps |
| `Square44x44Logo.targetsize-24_altform-unplated.png` | 24×24 | Íconos pequeños |
| `SplashScreen.scale-200.png` | 1240×600 | Pantalla de carga |
| `StoreLogo.png` | 50×50 | Instalador |
| `LockScreenLogo.scale-200.png` | 48×48 | Pantalla de bloqueo (Windows) |

En `Package.appxmanifest` (pestaña *Recursos visuales*):

- **Nombre para mostrar:** `Relix`
- **Color de fondo del tile:** `#DDEBF7`
- **Color de fondo de la pantalla de presentación:** `#DDEBF7`
- **Mostrar nombre en:** desmarca el tile ancho (el logo ya lo trae)

En la pestaña *Declaraciones*, el protocolo se llama **`relix`**. Es el que usan
los emuladores para devolverte a la app al cerrar un juego.
