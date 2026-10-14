"""
Genera los íconos de Relix a partir de brand/relix-mark.svg.

  python3 brand/build-assets.py

Salida:
  brand/uwp/   -> los PNG con los nombres de la plantilla UWP de Visual Studio.
                  Se copian tal cual a la carpeta Assets del proyecto RelixShell.
  brand/       -> relix-logo.png (logo horizontal, fondo transparente)

Requiere: pip install playwright  (y npm install, por las fuentes)
"""

import base64
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "brand"
OUT = BRAND / "uwp"
FONTS = ROOT / "node_modules" / "@fontsource" / "baloo-2" / "files"

SKY = "#DDEBF7"
INK = "#23304A"
POP = "#FF4F87"

MARK = (BRAND / "relix-mark.svg").read_text(encoding="utf-8")

# Silueta blanca de la gema (Windows exige blanco puro en el logo de bloqueo)
MARK_WHITE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<path d="M36 30H76L96 50L56 100L16 50Z" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>
<path d="M98 2Q98 24 120 24Q98 24 98 46Q98 24 76 24Q98 24 98 2Z" fill="#fff" transform="rotate(45 98 24)"/>
</svg>"""

def _font(name: str) -> str:
    # Las fuentes van incrustadas: Chromium no carga fuentes file:// en una página local
    data = base64.b64encode((FONTS / name).read_bytes()).decode()
    return f"url(data:font/woff2;base64,{data}) format('woff2')"


# El subconjunto latino básico ya trae la "ı" sin punto que usa el logo
FONT_CSS = f"""
@font-face {{ font-family: 'Baloo 2'; font-weight: 800;
  src: {_font('baloo-2-latin-800-normal.woff2')}; }}
"""


def lockup(mark_px: int) -> str:
    """Gema + nombre, con la i punteada por una gemita (igual que Logo.svelte)."""
    word = mark_px / 1.15 * 0.92
    return f"""
<div class="lockup" style="gap:{mark_px * 0.16}px">
  <div style="width:{mark_px}px;height:{mark_px}px">{MARK}</div>
  <div class="word" style="font-size:{word}px;padding-top:{word * 0.11}px">rel<span class="i">ı<span class="dot"></span></span>x</div>
</div>"""


def page(w: int, h: int, bg: str | None, inner: str) -> str:
    background = bg or "transparent"
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{FONT_CSS}
html,body{{margin:0;width:{w}px;height:{h}px;background:{background};overflow:hidden}}
body{{display:grid;place-items:center}}
svg{{display:block;width:100%;height:100%;overflow:visible}}
.lockup{{display:flex;align-items:center}}
.word{{font-family:'Baloo 2';font-weight:800;color:{INK};letter-spacing:-0.035em;line-height:1}}
.i{{position:relative}}
.dot{{position:absolute;left:50%;top:0.38em;width:0.17em;height:0.17em;border-radius:0.04em;
  background:{POP};transform:translateX(-50%) rotate(45deg)}}
</style></head><body>{inner}</body></html>"""


def mark_box(px: int, svg: str = MARK) -> str:
    return f'<div style="width:{px}px;height:{px}px">{svg}</div>'


# nombre de archivo -> (ancho, alto, fondo o None, contenido)
ASSETS = {
    # Ícono de la lista de apps (Dev Home) y barra de tareas
    "Square44x44Logo.scale-200.png": (88, 88, None, mark_box(84)),
    "Square44x44Logo.targetsize-24_altform-unplated.png": (24, 24, None, mark_box(24)),
    # Tile cuadrado: es lo que más vas a ver en la Xbox
    "Square150x150Logo.scale-200.png": (300, 300, SKY, mark_box(200)),
    # Tile ancho
    "Wide310x150Logo.scale-200.png": (620, 300, SKY, lockup(150)),
    # Pantalla de carga (el fondo lo pone el manifiesto: #DDEBF7)
    "SplashScreen.scale-200.png": (1240, 600, None, lockup(190)),
    "StoreLogo.png": (50, 50, SKY, mark_box(40)),
    "LockScreenLogo.scale-200.png": (48, 48, None, mark_box(44, MARK_WHITE)),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, (w, h, bg, inner) in ASSETS.items():
            pg = browser.new_page(viewport={"width": w, "height": h})
            pg.set_content(page(w, h, bg, inner))
            pg.evaluate("document.fonts.ready")
            pg.screenshot(path=str(OUT / name), omit_background=bg is None)
            pg.close()
            print("  ", name, f"{w}x{h}")

        pg = browser.new_page(viewport={"width": 1200, "height": 420})
        pg.set_content(page(1200, 420, None, lockup(300)))
        pg.evaluate("document.fonts.ready")
        pg.screenshot(path=str(BRAND / "relix-logo.png"), omit_background=True)
        print("   relix-logo.png 1200x420")
        browser.close()


if __name__ == "__main__":
    main()
