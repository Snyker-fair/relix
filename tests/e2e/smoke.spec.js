// What has already broken once, checked on the demo the way the Xbox uses it:
// with the controller (the keyboard: Enter = A, Escape = B, y = Y, x = X,
// f = right stick, m = Menu, q/e = LB/RB) and at 1920 × 1080.
import { expect, test } from '@playwright/test'

const DAY = 24 * 60 * 60 * 1000
/** The focus ring's width (app.css) */
const RING = 11
const SETTINGS = { onboarded: true, theme: 'light', language: 'es', screensaverMinutes: 0 }

/**
 * Opens the demo as if Relix had been used before: these saved keys (without the
 * "relix:" prefix) go in before it starts.
 * @param {import('@playwright/test').Page} page
 * @param {{ settings?: object, userData?: object, keys?: Record<string, unknown>, query?: string }} [options]
 */
async function open(page, { settings = SETTINGS, userData = {}, keys = {}, query = '' } = {}) {
  /** @type {string[]} */
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Only the demo itself: no covers or information from the internet
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort())
  const saved = {
    settings,
    'demo-userdata': { app: 'relix', version: 1, savedAt: '2026-10-01T12:00:00.000Z', settings, ...userData },
    // No "new in this version" notice
    newsSeen: '99.0.0',
    ...keys,
  }
  await page.addInitScript((values) => {
    // Only the first time: a reload keeps what the test did
    if (localStorage.getItem('relix:settings')) return
    for (const [key, value] of Object.entries(values)) localStorage.setItem(`relix:${key}`, JSON.stringify(value))
  }, saved)
  await page.goto(query)
  return errors
}

/** The home screen, once its tiles finished coming in @param {import('@playwright/test').Page} page */
async function home(page) {
  await expect(page.locator('.shelf .channel').first()).toBeVisible()
  await expect(page.locator('.channel.boot')).toHaveCount(0)
}

/** @param {import('@playwright/test').Page} page @param {string} key */
async function press(page, key, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key)
    await page.waitForTimeout(80)
  }
}

/** @param {import('@playwright/test').Locator} locator */
const box = async (locator) => {
  const found = await locator.boundingBox()
  if (!found) throw new Error('not on screen')
  return found
}

test('opens without errors and the screen stays still', async ({ page }) => {
  const errors = await open(page)
  await home(page)
  await expect(page.locator('.shelf .channel').filter({ hasText: 'PS1' })).toBeVisible()
  expect(await page.locator('.stage').evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  expect(errors).toEqual([])
})

test('Y on Continue playing: the menu stays against the right edge and the screen does not move', async ({ page }) => {
  const now = Date.now()
  const errors = await open(page, {
    userData: {
      recent: ['ps2/Okami (USA).chd', 'gc/F-Zero GX (USA).rvz'],
      lastPlayed: { 'ps2/Okami (USA).chd': now - DAY, 'gc/F-Zero GX (USA).rvz': now - 2 * DAY },
      playtime: { 'ps2/Okami (USA).chd': { seconds: 7200, plays: 3 } },
    },
  })
  await home(page)
  await expect(page.locator('.recent-item')).toHaveCount(2)
  await press(page, 'ArrowDown')
  await expect(page.locator('.recent-item.focused')).toHaveCount(1)
  await press(page, 'y')
  const sheet = page.locator('aside.sheet')
  await expect(sheet).toBeVisible()
  await page.waitForTimeout(500) // its entrance
  const { x, width } = await box(sheet)
  expect(Math.round(x + width)).toBe(1920)
  expect(await page.locator('.stage').evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  await press(page, 'Escape')
  await expect(sheet).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a console with 1,000 games only draws the rows on screen', async ({ page }) => {
  const files = Array.from({ length: 1000 }, (_, i) => `${String.fromCharCode(65 + Math.floor((i * 26) / 1000))} juego ${String(i).padStart(4, '0')} (USA).chd`)
  const errors = await open(page, {
    keys: { scans: { driveId: 'demo', systems: { psx: { folder: 'psx', files, scannedAt: Date.now() } } } },
  })
  await home(page)
  await press(page, 'Enter')
  const cells = page.locator('.grid-window .cell')
  await expect(cells.first()).toBeVisible()
  await expect(page.locator('.position')).toContainText('1000')
  expect(await cells.count()).toBeLessThanOrEqual(35)

  await press(page, 'ArrowDown', 40)
  await page.waitForTimeout(400)
  expect(await cells.count()).toBeLessThanOrEqual(35)
  const focused = await box(page.locator('.cell.focused'))
  const grid = await box(page.locator('.grid-window'))
  expect(focused.y).toBeGreaterThanOrEqual(grid.y - 1)
  expect(focused.y).toBeLessThan(1080)
  expect(errors).toEqual([])
})

test('the game sheet opens and closes with the right stick', async ({ page }) => {
  const errors = await open(page)
  await home(page)
  await press(page, 'Enter')
  await expect(page.locator('.cell.focused')).toBeVisible()
  await press(page, 'f')
  await expect(page.locator('.cover-area')).toBeVisible()
  await press(page, 'f')
  await expect(page.locator('.cover-area')).toHaveCount(0)
  await expect(page.locator('.cell.focused')).toBeVisible()
  expect(errors).toEqual([])
})

test('Options › Consoles: the console being moved keeps its whole ring inside the list', async ({ page }) => {
  const errors = await open(page)
  await home(page)
  await press(page, 'm')
  await expect(page.locator('.tab.active')).toHaveText(/Biblioteca/)
  await press(page, 'e')
  await expect(page.locator('.tab.active')).toHaveText(/Consolas/)
  await press(page, 'x')
  const moving = page.locator('.row.moving')
  await expect(moving).toBeVisible()
  const row = await box(moving)
  const list = await box(page.locator('.rows-window'))
  // The ring (11 px) is drawn outside the row: the list has to leave room for it on both sides
  expect(row.x - list.x).toBeGreaterThanOrEqual(RING)
  expect(list.x + list.width - (row.x + row.width)).toBeGreaterThanOrEqual(RING)
  await press(page, 'Escape')
  await expect(moving).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Options › About fits above the button bar', async ({ page }) => {
  const now = Date.now()
  const errors = await open(page, {
    userData: {
      playtime: { 'ps2/Okami (USA).chd': { seconds: 40000, plays: 9 }, 'gc/F-Zero GX (USA).rvz': { seconds: 9000, plays: 4 } },
      lastPlayed: { 'ps2/Okami (USA).chd': now - DAY, 'gc/F-Zero GX (USA).rvz': now - 3 * DAY },
    },
  })
  await home(page)
  await press(page, 'm')
  await press(page, 'e', 5)
  await expect(page.locator('.tab.active')).toHaveText(/Acerca de/)
  const columns = page.locator('.about .column')
  await expect(columns).toHaveCount(2)
  const hints = await box(page.locator('nav.hints'))
  for (const column of await columns.all()) {
    const { y, height } = await box(column)
    expect(y + height).toBeLessThanOrEqual(hints.y)
  }
  expect(errors).toEqual([])
})

test('as Game, the welcome says how to change it to App, step by step', async ({ page }) => {
  const settings = { theme: 'light', language: 'es', screensaverMinutes: 0 }
  const errors = await open(page, { settings, query: '?apptype=game' })
  await expect(page.locator('.intro')).toBeVisible()
  await press(page, 'Enter')
  await expect(page.locator('.steps li')).toHaveCount(5)
  await expect(page.locator('.steps')).toContainText('App')
  expect(errors).toEqual([])
})
