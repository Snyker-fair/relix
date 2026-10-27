/**
 * What the demo starts with: an Xbox and a USB drive made up, so every screen
 * has something to show (src/mock has the gamelists and the libretro names).
 */
import { t } from '../i18n/i18n.svelte.js'
import { dayKey } from '../core/playDays.js'
import { PLATFORMS } from '../core/platforms.js'

/**
 * Demo games ES-DE didn't scrape (they're not in its gamelists), to try
 * Y › Find info… in the browser.
 */
export const DEMO_UNSCRAPED = /** @type {Record<string, string[]>} */ ({
  psx: ['Silent Hill (USA).chd'],
  ps2: ['Final Fantasy X (USA).chd'],
  gc: ['Super Smash Bros. Melee (USA).rvz'],
})

/** The emulators the demo's Xbox has: RetroArch, PPSSPP, XBSX2 and Xenia Canary */
export const DEMO_EMULATORS = new Set(['retroarch', 'ppsspp', 'xbsx2', 'xeniacanary'])

/**
 * The demo has a sample collection (with a game from a console Relix
 * doesn't handle). Its name is in the language the demo first opened in.
 * @returns {Record<string, string>}
 */
export const demoCollectionSeed = () => ({
  [`custom-${t('Con amigos')}.cfg`]: [
    '%ROMPATH%/ps2/Burnout 3 - Takedown (USA).chd',
    '%ROMPATH%/gc/F-Zero GX (USA).rvz',
    '%ROMPATH%/wiiu/Splatoon (USA).wua',
    '%ROMPATH%/psx/Tekken 3 (USA).chd',
    '%ROMPATH%/snes/Super Mario Kart (USA).sfc',
    '',
  ].join('\n'),
})

/**
 * The checkup's measures: a 465 GB USB drive with the US PS1 BIOS (the European one
 * is missing) and a NES folder, on an Xbox where Relix is of the App type
 * (?apptype=game in the address: of the Game type).
 * @param {string[]} folders  the BIOS folders asked for
 * @returns {import('../core/systemCheck.js').ShellCheck}
 */
export function demoSystemCheck(folders) {
  const game = new URLSearchParams(globalThis.location?.search ?? '').get('apptype') === 'game'
  return {
    drive: 'E:\\',
    writable: true,
    space: { free: 182 * 1024 ** 3, total: 465 * 1024 ** 3 },
    romFolders: [...PLATFORMS.map((p) => p.id), 'nes'],
    folders: Object.fromEntries(
      folders.map((f) => [f, f === 'RetroArch\\system' ? ['scph5501.bin'] : f === 'XBSX2\\BIOS' ? ['SCPH-70012_BIOS_V12_USA_200.BIN'] : null]),
    ),
    internet: true,
    memory: { xbox: true, expectedLimit: (game ? 5 : 1) * 1024 ** 3, limit: 512 * 1024 ** 2, usage: 310 * 1024 ** 2 },
  }
}

/** The demo's days played, counted back from today so the charts always have weeks */
function demoPlayDays() {
  /** @type {Array<[number, string, number]>} days ago, game, seconds */
  const sessions = [
    [1, 'ps2/Okami (USA).chd', 3_900],
    [2, 'gc/F-Zero GX (USA).rvz', 1_500],
    [4, 'ps2/Okami (USA).chd', 5_400],
    [9, 'psx/Tekken 3 (USA).chd', 2_700],
    [11, 'ps2/Okami (USA).chd', 7_200],
    [12, 'gc/F-Zero GX (USA).rvz', 2_400],
    [17, 'ps2/Burnout 3 - Takedown (USA).chd', 3_000],
    [23, 'ps2/Okami (USA).chd', 4_500],
    [30, 'gc/F-Zero GX (USA).rvz', 3_600],
    [38, 'ps2/Okami (USA).chd', 2_100],
    [45, 'psx/Tekken 3 (USA).chd', 4_800],
  ]
  /** @type {Record<string, Record<string, number>>} */
  const days = {}
  for (const [ago, id, seconds] of sessions) {
    const key = dayKey(Date.now() - ago * 86_400_000)
    days[key] = { ...days[key], [id]: (days[key]?.[id] ?? 0) + seconds }
  }
  return days
}

/** The demo's data.json: some sample playtime */
export const DEMO_USERDATA = JSON.stringify({
  app: 'relix',
  version: 1,
  savedAt: '2026-10-01T12:00:00.000Z',
  playtime: {
    'ps2/Okami (USA).chd': { seconds: 151_200, plays: 23 },
    'gc/F-Zero GX (USA).rvz': { seconds: 46_800, plays: 31 },
    'psx/Tekken 3 (USA).chd': { seconds: 27_000, plays: 18 },
    'ps2/Burnout 3 - Takedown (USA).chd': { seconds: 12_600, plays: 9 },
    'wiiu/Splatoon (USA).wua': { seconds: 2_700, plays: 2 },
  },
  lastPlayed: {
    'ps2/Okami (USA).chd': Date.parse('2026-09-30T23:10:00Z'),
    'gc/F-Zero GX (USA).rvz': Date.parse('2026-09-28T21:00:00Z'),
    'psx/Tekken 3 (USA).chd': Date.parse('2026-09-20T19:30:00Z'),
  },
  recent: ['ps2/Okami (USA).chd', 'gc/F-Zero GX (USA).rvz', 'psx/Tekken 3 (USA).chd'],
  playDays: demoPlayDays(),
})
