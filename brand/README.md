# Relix brand

![The Relix logo](relix-logo.png)

**Your relics, ready to play.**

## The idea

**Relix** comes from *relics*: those games you kept for years, on discs or
cartridges, that shine again here. The mark is a **gem**, a polished relic, with
an **X-shaped sparkle**. That X is the one in the name, the stone's shine and a
nod to the console the app lives on.

The dot on the "i" is a small gem of the same pink, so the name and the symbol
read as one piece.

## Logo

| File | Use |
|---|---|
| `relix-mark.svg` | The symbol's only source. Everything else is made from it. |
| `relix-logo.png` | Horizontal logo (gem + name), transparent background. |
| `../shell/RelixShell/Assets/*.png` | The app icons (see below); `build-assets.py` makes them. |
| `build-assets.py` | Makes the PNGs again if you change the SVG: `python3 brand/build-assets.py` |

- In the logo, the name is always written in **lowercase**: `relix`. In running
  text it's written **Relix**.
- Don't change the gem's colors, and don't put the logo on photos or dark
  backgrounds without a light box behind it.
- Minimum size of the symbol alone: 24 px. Of the logo with the name: 30 px tall.

## Colors

| Name | Hex | Use |
|---|---|---|
| Sky | `#DDEBF7` | App background, tiles and loading screen |
| Deep sky | `#C6DBEF` | The background's dot pattern |
| Ink | `#23304A` | Text and the name in the logo |
| Soft ink | `#56647E` | Secondary text |
| Gem | `#FF4F87` | Focus, favorites, the dot on the i |
| Sparkle | `#FFC23D` | Only the logo's X sparkle |

Each console also has its own channel color (see `src/lib/core/platforms.js`).

## Typography

- **Baloo 2** (600–800): titles, game names and the logo.
- **Nunito** (400–700): text, labels and hints.

Both are free (SIL OFL license) and are bundled inside the app.

## Voice

Friendly and brief, like someone handing you the controller. Relix speaks
Spanish and English; the examples are in both:

- Buttons with clear verbs: **Play** / *Jugar*, **Back** / *Volver*,
  **Favorite** / *Favorito*, **Open** / *Abrir*.
- Waits with a nod to the brand: **Dusting off your relics…** / *Desempolvando
  tus reliquias…*
- Errors say what happened and what to do: **Couldn't open XBSX2. Make sure it's
  installed on the console.** / *No se pudo abrir XBSX2. Revisa que esté
  instalado en la consola.*

## App icons

They're in `shell/RelixShell/Assets/`, with the exact names of the **UWP Blank
App** template, and the project already includes them.

| File | Size | Where it shows |
|---|---|---|
| `Square150x150Logo.scale-200.png` | 300×300 | The app's card on the Xbox, Dev Home, pins (gem and name) |
| `Square310x310Logo.scale-200.png` | 620×620 | Large tile: the same image with more detail for 4K TVs |
| `Wide310x150Logo.scale-200.png` | 620×300 | Wide tile |
| `Square44x44Logo.scale-200.png` | 88×88 | App lists |
| `Square44x44Logo.targetsize-24_altform-unplated.png` | 24×24 | Small icons |
| `SplashScreen.scale-200.png` | 1240×600 | Loading screen |
| `StoreLogo.png` | 50×50 | Installer |
| `LockScreenLogo.scale-200.png` | 48×48 | Lock screen (Windows) |

In `Package.appxmanifest` (the *Visual Assets* tab):

- **Display name:** `Relix`
- **Tile background color:** `#DDEBF7`
- **Splash screen background color:** `#DDEBF7`
- **Show name on:** uncheck every tile (the images already have the name)

In the *Declarations* tab, the protocol is called **`relix`**. It's the one the
emulators use to send you back to the app when you close a game.
