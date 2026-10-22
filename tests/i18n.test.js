import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectKeys, placeholders } from '../scripts/i18n.mjs'
import { REGION_NAMES, regionLabel } from '../src/lib/core/coverMatch.js'
import { LOG_KINDS, logLine, parseLogLine } from '../src/lib/core/diagnostics.js'
import { DEVSTORE_LABEL, guideSteps } from '../src/lib/core/guides.js'
import { effectiveLanguage, interpolate, systemLanguage } from '../src/lib/core/language.js'
import { buildLaunchUri } from '../src/lib/core/launchUri.js'
import { getEmulator, getPlatform, PLATFORMS } from '../src/lib/core/platforms.js'
import { PS1_BIOS, quickExitMessage } from '../src/lib/core/quickExit.js'
import { INFO_FIELD_NAMES } from '../src/lib/core/gameInfo.js'
import { RENAME_ERRORS, RENAME_STEPS } from '../src/lib/core/rename.js'
import { sectionOf, SORT_NAMES } from '../src/lib/core/sorting.js'
import { buildChecks, formatBytes } from '../src/lib/core/systemCheck.js'
import { THEME_NAMES } from '../src/lib/core/theme.js'
import { NEWS, updateCheck } from '../src/lib/core/updates.js'
import EN from '../src/lib/i18n/en.js'
import { i18n, listJoin, plural, t, tn } from '../src/lib/i18n/i18n.svelte.js'
import { coverSummary, formatHour, formatPlaytime, scanSummary, timeAgo } from '../src/lib/ui/format.js'

describe('which language applies', () => {
  it('Automatic follows the console: Spanish if it prefers Spanish, otherwise English', () => {
    expect(systemLanguage(['es-CL', 'en-US'])).toBe('es')
    expect(systemLanguage(['es'])).toBe('es')
    expect(systemLanguage(['en-GB', 'es-ES'])).toBe('en')
    expect(systemLanguage(['fr-FR'])).toBe('en')
    expect(systemLanguage(['estonian-ish'])).toBe('en')
    expect(systemLanguage([])).toBe('en')
    expect(effectiveLanguage('auto', ['es-MX'])).toBe('es')
    expect(effectiveLanguage('en', ['es-MX'])).toBe('en')
    expect(effectiveLanguage('es', ['en-US'])).toBe('es')
    expect(effectiveLanguage('otro', ['en-US'])).toBe('en')
  })

  it('{name} is replaced; one without a value stays visible', () => {
    expect(interpolate('{n} de {total}', { n: 3, total: 9 })).toBe('3 de 9')
    expect(interpolate('Hola {nombre}', {})).toBe('Hola {nombre}')
  })
})

describe('the English catalog', () => {
  it('has every text that goes through t(), tn() or plural() in the code', () => {
    const { keys, problems } = collectKeys()
    expect(problems).toEqual([])
    const missing = [...keys].filter(([key]) => !(key in EN)).map(([key, where]) => `${where[0]}  ${key}`)
    expect(missing).toEqual([])
  })

  it('each translation has the same {names} as its Spanish text', () => {
    const wrong = Object.entries(EN).filter(([es, en]) => placeholders(es).join() !== placeholders(en).join())
    expect(wrong).toEqual([])
  })

  it('no empty translations or ones with Spanish text', () => {
    const suspicious = Object.entries(EN).filter(
      ([, en]) => en.trim() === '' || /[áéíóúñ¿¡]/i.test(en.replace(/Español|Ōkami|Pokémon/g, '')),
    )
    expect(suspicious).toEqual([])
  })
})

describe('in English', () => {
  beforeEach(() => {
    i18n.choice = 'en'
    i18n.missing.clear()
  })
  afterEach(() => {
    i18n.choice = 'auto'
  })

  it('t, tn and plural', () => {
    expect(t('Volver')).toBe('Back')
    expect(t('Juego que no existe en el catálogo')).toBe('Juego que no existe en el catálogo')
    expect(i18n.missing.has('Juego que no existe en el catálogo')).toBe(true)
    i18n.missing.clear()
    expect(tn(1, '{n} juego nuevo', '{n} juegos nuevos')).toBe('1 new game')
    expect(plural(3, 'juego', 'juegos')).toBe('3 games')
    expect(listJoin(['a', 'b', 'c'])).toBe('a, b, and c')
    expect(formatHour(20)).toBe('8 PM')
    expect(formatHour(0)).toBe('12 AM')
  })

  it('the log lines: the kind in English and in its 9 columns', () => {
    for (const kind of /** @type {Array<keyof typeof LOG_KINDS>} */ (Object.keys(LOG_KINDS))) {
      const line = logLine(kind, 'x', new Date(2026, 9, 17, 6, 40, 12))
      expect(t(LOG_KINDS[kind]).length).toBeLessThanOrEqual(9)
      expect(parseLogLine(line).kind).toBe(t(LOG_KINDS[kind]))
      expect(parseLogLine(line).text).toBe('x')
    }
  })

  /**
   * The guides, the checkup and the notices build their texts at runtime: every
   * variant is gone through and none may be left untranslated.
   */
  it('guides, checkup, notices and name tables: nothing untranslated', () => {
    // Guides: each console with each emulator, and Wii U (no emulator)
    for (const platform of PLATFORMS) {
      const options = platform.emulators.length > 0 ? platform.emulators : [null]
      for (const emulator of options) {
        for (const status of [
          { folder: 'E:\\roms\\x', installed: true, games: 3 },
          { folder: 'E:\\roms\\x', installed: false, games: 0 },
          { folder: 'E:\\roms\\x', installed: null, games: 0 },
        ]) {
          guideSteps(platform, emulator, status)
        }
      }
    }

    // Checkup: every path
    const GB = 1024 ** 3
    const platform = (/** @type {string} */ id) => /** @type {any} */ (getPlatform(id))
    const consoles = [
      { platform: platform('psx'), games: [{ path: 'RE3 (Europe).chd' }, { path: 'Crash (USA).chd' }], emulator: platform('psx').emulators[0], installed: true },
      { platform: platform('ps2'), games: [{ path: 'Okami (USA).chd' }], emulator: platform('ps2').emulators[0], installed: false },
      { platform: platform('snes'), games: [{ path: 'Mario.sfc' }], emulator: platform('snes').emulators[0], installed: null },
      { platform: platform('wiiu'), games: [{ path: 'Zelda.wua' }], emulator: null, installed: null },
    ]
    const base = { romRoot: 'E:\\roms', knownFolders: ['psx'], consoles }
    const shells = [
      { drive: 'E:\\', writable: true, space: { free: 1.5 * GB, total: 64 * GB }, romFolders: ['psx', 'nes', 'a', 'b', 'c', 'd'], folders: { 'RetroArch\\system': ['scph5501.bin'], 'XBSX2\\BIOS': ['bios.nvm'] }, internet: true },
      { drive: 'E:\\', writable: false, space: { free: 100 * GB, total: 465 * GB }, romFolders: [], folders: { 'RetroArch\\system': null, 'XBSX2\\BIOS': null }, internet: false },
      { drive: 'E:\\', writable: true, space: null, romFolders: [], folders: { 'RetroArch\\system': ['scph5502.bin'], 'XBSX2\\BIOS': ['bios.zip'] }, internet: true },
      { drive: 'E:\\', writable: true, space: null, romFolders: [], folders: { 'RetroArch\\system': [], 'XBSX2\\BIOS': [] }, internet: true },
      { drive: 'E:\\', writable: true, space: null, romFolders: [], folders: { 'RetroArch\\system': ['x'], 'XBSX2\\BIOS': ['scph39001.bin'] }, internet: true },
    ]
    for (const dataStatus of /** @type {const} */ (['saved', 'error', 'off'])) {
      for (const shell of shells) buildChecks({ ...base, shell, dataStatus })
      buildChecks({ ...base, shell: null, shellFailed: true, dataStatus })
      buildChecks({ ...base, consoles: [{ ...consoles[0], games: [{ path: 'Tetris.chd' }] }], shell: shells[3], dataStatus })
      buildChecks({ ...base, consoles: [{ ...consoles[0], games: [{ path: 'Tetris.chd' }] }], shell: shells[0], dataStatus })
      buildChecks({ ...base, consoles: [], shell: null, dataStatus })
    }
    formatBytes(1.5 * GB)

    // "Closed right away" notices
    const emu = (/** @type {string} */ p, /** @type {string} */ e) => /** @type {any} */ (getEmulator(platform(p), e))
    for (const [p, e, path] of [
      ['psx', 'swanstation', 'RE3 (Europe).chd'],
      ['psx', 'swanstation', 'RE3 (Japan).chd'],
      ['psx', 'swanstation', 'Crash (USA).chd'],
      ['psx', 'duckstation', 'Tetris.chd'],
      ['ps2', 'xbsx2', 'Okami.chd'],
      ['n64', 'mupen64plus', 'Mario.z64'],
      ['psp', 'ppsspp', 'Patapon.cso'],
      ['gc', 'dolphin', 'F-Zero.rvz'],
    ]) {
      quickExitMessage({ name: 'Juego', path }, platform(p), emu(p, e))
    }

    // Texts built by the format functions
    scanSummary('PS2', { added: 1, removed: 0, total: 1 })
    scanSummary('PS2', { added: 2, removed: 1, total: 9 })
    scanSummary('PS2', { added: 0, removed: 2, total: 9 })
    scanSummary('PS2', { added: 0, removed: 0, total: 1 })
    coverSummary('PS2', { saved: 1, failed: 1, toChoose: 2, notFound: 1, shots: 1 })
    coverSummary('PS2', { saved: 3, failed: 2, toChoose: 0, notFound: 0, shots: 2 })
    coverSummary('PS2', { saved: 0, failed: 0, toChoose: 0, notFound: 0 })
    for (const minutes of [0, 5, 90, 60 * 30, 60 * 24 * 3]) timeAgo(Date.now() - minutes * 60_000)
    formatPlaytime(10)

    // Launch errors
    for (const call of [
      () => buildLaunchUri(null, 'E:\\a.chd'),
      () => buildLaunchUri(/** @type {any} */ ({ kind: 'retroarch', protocol: 'retroarch', core: 'x.dll' }), ''),
      () => buildLaunchUri(/** @type {any} */ ({ kind: 'otro' }), 'E:\\a.chd'),
    ]) {
      expect(call).toThrow()
    }

    // Name tables the screens translate when showing them
    for (const name of [
      ...Object.values(THEME_NAMES),
      ...Object.values(REGION_NAMES),
      ...Object.values(SORT_NAMES),
      ...Object.values(RENAME_ERRORS),
      ...Object.values(RENAME_STEPS),
      ...Object.values(INFO_FIELD_NAMES),
      ...Object.values(NEWS).flat(),
      ...Object.values(PS1_BIOS).map((b) => b.label),
      ...PLATFORMS.flatMap((p) => [p.noEmulatorNote ?? '', ...p.emulators.map((e) => e.note ?? '')]).filter(Boolean),
      DEVSTORE_LABEL,
    ]) {
      t(name)
    }
    for (const tag of ['USA', 'Canada', 'Europe', 'Japan', 'World', 'Spain', 'France', 'Germany', 'Italy', 'UK', 'Asia', 'Korea', 'China', 'Australia', 'Brazil']) {
      expect(regionLabel(`Juego (${tag}).chd`)).not.toBe('')
    }
    updateCheck({ version: '9.9.9' }, '1.0.0')
    sectionOf(/** @type {any} */ ({ sortName: 'x', year: undefined }), 'year')

    expect([...i18n.missing]).toEqual([])
  })
})
