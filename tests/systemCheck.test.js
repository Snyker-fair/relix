import { describe, expect, it } from 'vitest'
import { getEmulator, getPlatform, PLATFORMS } from '../src/lib/core/platforms.js'
import { buildChecks, formatBytes, summarize } from '../src/lib/core/systemCheck.js'

const GB = 1024 ** 3
const platform = (/** @type {string} */ id) => /** @type {import('../src/lib/core/platforms.js').Platform} */ (getPlatform(id))
const games = (/** @type {string[]} */ ...paths) => paths.map((path) => ({ path }))

/** Una consola con juegos y su emulador recomendado @param {string} id @param {string[]} paths */
function console_(id, paths, { installed = /** @type {boolean | null} */ (true), emulator = '' } = {}) {
  const p = platform(id)
  return { platform: p, games: games(...paths), emulator: emulator ? getEmulator(p, emulator) : (p.emulators[0] ?? null), installed }
}

const shell = {
  drive: 'E:\\',
  writable: true,
  space: { free: 182 * GB, total: 465 * GB },
  romFolders: ['ps1', 'ps2', 'nes'],
  folders: { 'RetroArch\\system': ['SCPH5501.BIN'], 'DuckStation\\bios': null, 'XBSX2\\BIOS': [] },
  internet: true,
}
const base = {
  romRoot: 'E:\\roms',
  knownFolders: PLATFORMS.flatMap((p) => p.folders),
  dataStatus: /** @type {const} */ ('saved'),
}

describe('revisión del sistema', () => {
  it('todo en orden', () => {
    const checks = buildChecks({
      ...base,
      shell: { ...shell, romFolders: ['ps1'] },
      consoles: [console_('psx', ['Crash Bandicoot (USA).chd'])],
    })
    expect(checks.map((c) => c.id)).toEqual(['usb', 'write', 'space', 'emu:psx', 'bios:psx', 'internet', 'data'])
    expect(summarize(checks)).toEqual({ errors: 0, warnings: 0 })
    expect(checks.find((c) => c.id === 'space')?.detail).toBe('182 GB libres de 465 GB.')
  })

  it('juegos europeos sin scph5502.bin: dice cuál falta y para cuántos juegos', () => {
    const checks = buildChecks({
      ...base,
      shell,
      consoles: [
        console_('psx', ['Crash Bandicoot (USA).chd', 'Resident Evil 3 - Nemesis (Europe) (En,Fr,De,Es,It).chd', 'Tekken 3 (Europe).chd']),
      ],
    })
    const bios = checks.find((c) => c.id === 'bios:psx')
    expect(bios?.state).toBe('warn')
    expect(bios?.title).toBe('BIOS de PS1: falta scph5502.bin')
    expect(bios?.detail).toContain('2 juegos de Europa')
    expect(bios?.detail).toContain('E:\\RetroArch\\system')
    expect(bios?.action).toEqual({ kind: 'guide', systemId: 'psx' })
  })

  it('BIOS dentro del emulador: no es error, solo avisa que no la ve', () => {
    const checks = buildChecks({
      ...base,
      shell,
      consoles: [console_('psx', ['Crash Bandicoot (USA).chd'], { emulator: 'duckstation' })],
    })
    const bios = checks.find((c) => c.id === 'bios:psx')
    expect(bios?.state).toBe('info')
    expect(bios?.detail).toContain('E:\\DuckStation\\bios')
  })

  it('PS2 con la carpeta vacía, emulador sin instalar y USB sin permisos', () => {
    const checks = buildChecks({
      ...base,
      shell: { ...shell, writable: false, internet: false, space: { free: 1 * GB, total: 32 * GB } },
      consoles: [console_('ps2', ['Okami (USA).chd'], { installed: false })],
      dataStatus: 'error',
    })
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]))
    expect(byId.write.state).toBe('error')
    expect(byId['emu:ps2'].state).toBe('error')
    expect(byId['emu:ps2'].title).toBe('PlayStation 2: falta XBSX2')
    expect(byId['bios:ps2'].state).toBe('warn')
    expect(byId.space.state).toBe('warn')
    expect(byId.internet.state).toBe('warn')
    expect(byId.data.state).toBe('error')
    expect(summarize(checks)).toEqual({ errors: 3, warnings: 3 })
  })

  it('carpetas que Relix no usa y USB sin juegos', () => {
    const checks = buildChecks({ ...base, shell, consoles: [console_('psx', [])] })
    expect(checks[0].state).toBe('warn')
    expect(checks.find((c) => c.id === 'folders')?.title).toBe('Carpetas que Relix no usa: nes')
  })

  it('shell que no responde: lo dice en vez de dar todo por bueno', () => {
    const consoles = [console_('psx', ['Crash Bandicoot (USA).chd'])]
    expect(buildChecks({ ...base, shell: null, consoles }).some((c) => c.id === 'shell')).toBe(false)
    const checks = buildChecks({ ...base, shell: null, consoles, shellFailed: true })
    expect(checks.find((c) => c.id === 'shell')?.state).toBe('warn')
    expect(checks.some((c) => c.id === 'write' || c.id === 'bios:psx')).toBe(false)
  })

  it('Wii U: informa que se abre desde Dev Home', () => {
    const checks = buildChecks({ ...base, shell: null, consoles: [console_('wiiu', ['Pikmin 3 (USA).wua'])] })
    expect(checks.find((c) => c.id === 'emu:wiiu')?.state).toBe('info')
  })

  it('tamaños legibles', () => {
    expect(formatBytes(182 * GB)).toBe('182 GB')
    expect(formatBytes(1.5 * GB)).toBe('1,5 GB')
    expect(formatBytes(300 * 1024 ** 2)).toBe('300 MB')
  })
})
