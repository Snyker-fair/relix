"""
Makes the Relix icons from brand/relix-mark.svg.

  python3 brand/build-assets.py

Output:
  shell/RelixShell/Assets/ -> the PNGs with the names of Visual Studio's UWP template.
                  The RelixShell project uses them as they are.
  brand/       -> relix-logo.png (horizontal logo, transparent background)

Needs: pip install playwright  (and npm install, for the fonts)
"""

import base64
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "brand"
OUT = BRAND.parent / "shell" / "RelixShell" / "Assets"
FONTS = ROOT / "node_modules" / "@fontsource" / "baloo-2" / "files"

SKY = "#DDEBF7"
INK = "#23304A"
POP = "#FF4F87"

MARK = (BRAND / "relix-mark.svg").read_text(encoding="utf-8")

# White silhouette of the gem (Windows requires pure white for the lock screen logo)
MARK_WHITE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<path d="M36 30H76L96 50L56 100L16 50Z" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>
<path d="M98 2Q98 24 120 24Q98 24 98 46Q98 24 76 24Q98 24 98 2Z" fill="#fff" transform="rotate(45 98 24)"/>
</svg>"""

def _font(name: str) -> str:
    # The fonts are embedded: Chromium doesn't load file:// fonts in a local page
    data = base64.b64encode((FONTS / name).read_bytes()).decode()
    return f"url(data:font/woff2;base64,{data}) format('woff2')"


# The basic Latin subset already has the dotless "ı" the logo uses
FONT_CSS = f"""
@font-face {{ font-family: 'Baloo 2'; font-weight: 800;
  src: {_font('baloo-2-latin-800-normal.woff2')}; }}
"""


def lockup(mark_px: int) -> str:
    """Gem + name, with the i dotted by a small gem (same as Logo.svelte)."""
    word = mark_px / 1.15 * 0.92
    return f"""
<div class="lockup" style="gap:{mark_px * 0.16}px">
  <div style="width:{mark_px}px;height:{mark_px}px">{MARK}</div>
  <div class="word" style="font-size:{word}px;padding-top:{word * 0.11}px">rel<span class="i">ı<span class="dot"></span></span>x</div>
</div>"""


def stacked(mark_px: int) -> str:
    """Gem on top and name below, centered: for the square tiles."""
    word = mark_px * 0.62
    return f"""
<div style="display:flex;flex-direction:column;align-items:center;gap:{mark_px * 0.06}px">
  <div style="width:{mark_px}px;height:{mark_px}px">{MARK}</div>
  <div class="word" style="font-size:{word}px">rel<span class="i">ı<span class="dot"></span></span>x</div>
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


# file name -> (width, height, background or None, content)
ASSETS = {
    # App list icon (Dev Home) and taskbar
    "Square44x44Logo.scale-200.png": (88, 88, None, mark_box(84)),
    "Square44x44Logo.targetsize-24_altform-unplated.png": (24, 24, None, mark_box(24)),
    # Square tile: what you'll see most on the Xbox (the app's card, Dev Home, pins)
    "Square150x150Logo.scale-200.png": (300, 300, SKY, stacked(160)),
    # Large tile: the same image with twice the detail, for 4K TVs
    "Square310x310Logo.scale-200.png": (620, 620, SKY, stacked(330)),
    # Wide tile
    "Wide310x150Logo.scale-200.png": (620, 300, SKY, lockup(150)),
    # Loading screen (the manifest sets the background: #DDEBF7)
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
