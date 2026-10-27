"""The README's screenshots and tour (docs/media), from the demo: in English,
with a fixed clock, 1280 x 720.

Once:     pip install playwright pillow
          python -m playwright install chromium
Each time, with the demo served in another terminal:
          npm run build && npx vite preview --port 5200
          python scripts/readme-media.py [docs/media] [--url http://localhost:5200/]

It writes home, library, game-menu, sheet, checkup, guide, library-dark and
welcome-app (.png) and tour.webp. If the interface changed, the steps below
(which keys, how long to wait) may need a touch.
"""
import argparse
import io
from datetime import datetime, timezone, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
args.add_argument('out', nargs='?', default=str(ROOT / 'docs' / 'media'))
args.add_argument('--url', default='http://localhost:5200/')
options = args.parse_args()
URL = options.url
OUT = options.out
W, H = 1280, 720
# Saturday, 24 October 2026, 7:30 PM in Chile
NOW = datetime(2026, 10, 24, 19, 30, tzinfo=timezone(timedelta(hours=-3)))
KEY = {'a': 'Enter', 'b': 'Escape', 'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
       'rb': 'e', 'lb': 'q', 'start': 'm', 'y': 'y', 'x': 'x', 'rs': 'f', 'ls': 'r', 'view': 'v'}
# the notices and the keyboard help (it's only in the browser, not on the Xbox)
HIDE_TOASTS = '.toast, .kbd-help { display: none !important }'


def new_page(p, query=''):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, locale='en-US', timezone_id='America/Santiago')
    pg = ctx.new_page()
    pg.clock.set_fixed_time(NOW)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*libretro.com/**', lambda r: r.abort())
    pg.route('**/*wikidata.org/**', lambda r: r.abort())
    pg.goto(URL + query)
    pg.wait_for_timeout(6000)
    return b, pg, errs


def press(pg, *keys, wait=350):
    for k in keys:
        pg.keyboard.press(KEY[k])
        pg.wait_for_timeout(wait)


def setup(pg, theme='light'):
    """Skips the welcome tour, marks two PS2 games as New and hides the notices."""
    press(pg, 'start')
    pg.wait_for_timeout(1500)
    now_ms = int(NOW.timestamp() * 1000)
    pg.evaluate(
        """([now, theme]) => {
          const fresh = { 'ps2/Persona 4 (USA).chd': now - 2 * 864e5, 'ps2/Shadow of the Colossus (USA).chd': now - 864e5 }
          localStorage.setItem('relix:newGames', JSON.stringify(fresh))
          localStorage.setItem('relix:newsSeen', JSON.stringify('9.9.9'))
          const settings = { ...JSON.parse(localStorage.getItem('relix:settings') || '{}'), theme, screensaverMinutes: 0 }
          localStorage.setItem('relix:settings', JSON.stringify(settings))
          const data = JSON.parse(localStorage.getItem('relix:demo-userdata') || '{}')
          data.newGames = fresh
          data.settings = settings
          data.savedAt = new Date(now).toISOString()
          localStorage.setItem('relix:demo-userdata', JSON.stringify(data))
        }""",
        [now_ms, theme],
    )
    pg.reload()
    pg.wait_for_timeout(6000)
    pg.add_style_tag(content=HIDE_TOASTS)


def home_to(pg, index):
    for _ in range(18):
        pg.keyboard.press('ArrowLeft')
        pg.wait_for_timeout(40)
    for _ in range(index):
        press(pg, 'right', wait=180)
    pg.wait_for_timeout(900)


def channel_index(pg, name):
    names = pg.evaluate("() => [...document.querySelectorAll('.shelf .channel .label')].map(e => e.textContent.trim())")
    return names.index(name)


def focus_game(pg, name):
    """Row by row, left to right (the grid doesn't wrap at the end of a row)."""
    current = lambda: pg.evaluate("() => document.querySelector('.detail h1, .detail h2')?.textContent ?? ''")
    for _ in range(8):
        for col in range(5):
            if name in current():
                return
            if col < 4:
                press(pg, 'right', wait=160)
        press(pg, 'down', wait=250)
        for _ in range(4):
            press(pg, 'left', wait=120)
    raise RuntimeError(f'no {name}')


def shot(pg, name, wait=700):
    pg.wait_for_timeout(wait)
    pg.screenshot(path=f'{OUT}/{name}.png')


def frame(pg, frames, ms, wait=650):
    pg.wait_for_timeout(wait)
    img = Image.open(io.BytesIO(pg.screenshot())).convert('RGB').resize((960, 540), Image.LANCZOS)
    frames.append((img, ms))


with sync_playwright() as p:
    # ── Stills, light theme ──
    b, pg, errs = new_page(p)
    setup(pg)
    home_to(pg, channel_index(pg, 'PS2'))
    shot(pg, 'home')
    press(pg, 'a', wait=1200)
    focus_game(pg, 'kami')
    shot(pg, 'library')
    press(pg, 'y')
    shot(pg, 'game-menu')
    press(pg, 'b')
    press(pg, 'rs', wait=900)
    shot(pg, 'sheet')
    press(pg, 'b', 'b')
    press(pg, 'start', wait=700)
    press(pg, 'rb', 'rb', wait=500)
    shot(pg, 'checkup')
    press(pg, 'lb', wait=500)  # Consoles: PS1 first, Y opens its guide
    press(pg, 'y', wait=1200)
    shot(pg, 'guide')
    print('light errors:', errs)
    b.close()

    # ── Dark theme ──
    b, pg, errs = new_page(p)
    setup(pg, theme='dark')
    home_to(pg, channel_index(pg, 'N64'))
    press(pg, 'a', wait=1200)
    shot(pg, 'library-dark')
    print('dark errors:', errs)
    b.close()

    # ── The welcome tour's "Relix as App" step, as Game ──
    b, pg, errs = new_page(p, '?apptype=game')
    press(pg, 'a', wait=1200)
    shot(pg, 'welcome-app')
    print('welcome errors:', errs)
    b.close()

    # ── The animated tour ──
    b, pg, errs = new_page(p)
    setup(pg)
    frames = []
    home_to(pg, 0)
    frame(pg, frames, 1600)
    press(pg, 'right', 'right', wait=250)
    frame(pg, frames, 900)
    press(pg, 'right', wait=250)
    frame(pg, frames, 1300)
    press(pg, 'a', wait=1100)
    frame(pg, frames, 1500)
    press(pg, 'right', 'right', 'right', 'right', wait=220)
    frame(pg, frames, 1100)
    press(pg, 'down', wait=300)
    frame(pg, frames, 1100)
    press(pg, 'rs', wait=900)
    frame(pg, frames, 2000)
    press(pg, 'b', wait=500)
    press(pg, 'y', wait=400)
    frame(pg, frames, 1700)
    press(pg, 'b', 'b', wait=500)
    frame(pg, frames, 900)
    for _ in range(18):
        press(pg, 'right', wait=60)
    press(pg, 'left', wait=600)  # the die, before Options
    frame(pg, frames, 1400)
    press(pg, 'a', wait=1000)
    frame(pg, frames, 2000)
    press(pg, 'b', wait=500)
    press(pg, 'start', wait=700)
    press(pg, 'rb', wait=500)
    frame(pg, frames, 1300)
    press(pg, 'x', 'down', wait=450)
    frame(pg, frames, 1500)
    press(pg, 'b', wait=300)
    press(pg, 'rb', wait=500)
    frame(pg, frames, 1700)
    imgs = [f[0] for f in frames]
    imgs[0].save(f'{OUT}/tour.webp', save_all=True, append_images=imgs[1:], duration=[f[1] for f in frames],
                 loop=0, quality=78, method=6)
    print('tour frames:', len(frames), 'errors:', errs)
    b.close()

# 1280 × 720 PNGs, a bit smaller
for name in ['home', 'library', 'game-menu', 'sheet', 'checkup', 'guide', 'library-dark', 'welcome-app']:
    path = f'{OUT}/{name}.png'
    Image.open(path).convert('RGB').save(path, optimize=True)
