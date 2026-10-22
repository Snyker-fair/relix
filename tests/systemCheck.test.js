import { describe, expect, it } from 'vitest'
import { getEmulator, getPlatform, PLATFORMS } from '../src/lib/core/platforms.js'
import { appTypeOf, buildChecks, formatBytes, summarize } from '../src/lib/core/systemCheck.js'

const GB = 1024 ** 3
const platform = (/** @type {string} */ id) => /** @type {import('../src/lib/core/platforms.js').Platform} */ (getPlatform(id))
const games = (/** @type {string[]} */ ...paths) => paths.map((path) => ({ path }))

/** A console with games and its recommended emulator @param {string} id @param {string[]} paths */
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

describe('system checkup', () => {
  it('all in order', () => {
    const checks = buildChecks({
      ...base,
      shell: { ...shell, romFolders: ['ps1'] },
      consoles: [console_('psx', ['Crash Bandicoot (USA).chd'])],
    })
    expect(checks.map((c) => c.id)).toEqual(['usb', 'write', 'space', 'emu:psx', 'bios:psx', 'internet', 'data'])
    expect(summarize(checks)).toEqual({ errors: 0, warnings: 0 })
    expect(checks.find((c) => c.id === 'space')?.detail).toBe('182 GB libres de 465 GB.')
  })

  it('European games without scph5502.bin: says which one is missing and for how many games', () => {
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

  it("BIOS inside the emulator: not an error, it only warns that it can't see it", () => {
    const checks = buildChecks({
      ...base,
      shell,
      consoles: [console_('psx', ['Crash Bandicoot (USA).chd'], { emulator: 'duckstation' })],
    })
    const bios = checks.find((c) => c.id === 'bios:psx')
    expect(bios?.state).toBe('info')
    expect(bios?.detail).toContain('E:\\DuckStation\\bios')
  })

  it('PS2 with an empty folder, an emulator not installed and a USB drive without permissions', () => {
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

  it('PS2 BIOS: any extension works, but not a compressed one or the companion files', () => {
    /** @param {string[]} files */
    const ps2 = (files) =>
      buildChecks({
        ...base,
        shell: { ...shell, folders: { ...shell.folders, 'XBSX2\\BIOS': files } },
        consoles: [console_('ps2', ['Okami (USA).chd'])],
      }).find((c) => c.id === 'bios:ps2')
    expect(ps2(['SCPH-39001.rom0', 'SCPH-39001.NVM'])).toMatchObject({ state: 'ok', detail: 'SCPH-39001.rom0 en E:\\XBSX2\\BIOS' })
    expect(ps2(['ps2-0230a-20080220'])?.state).toBe('ok')
    expect(ps2(['SCPH-70012.zip'])?.title).toBe('BIOS de PS2: está comprimida')
    expect(ps2(['SCPH-70012.NVM', 'SCPH-70012.MEC'])?.title).toBe('BIOS de PS2: falta el archivo principal')
    expect(ps2(['.DS_Store'])?.title).toBe('BIOS de PS2: la carpeta está vacía')
  })

  it("folders Relix doesn't use and a USB drive without games", () => {
    const checks = buildChecks({ ...base, shell, consoles: [console_('psx', [])] })
    expect(checks[0].state).toBe('warn')
    expect(checks.find((c) => c.id === 'folders')?.title).toBe('Carpetas que Relix no usa: nes')
  })

  it("a shell that doesn't answer: it says so instead of calling everything fine", () => {
    const consoles = [console_('psx', ['Crash Bandicoot (USA).chd'])]
    expect(buildChecks({ ...base, shell: null, consoles }).some((c) => c.id === 'shell')).toBe(false)
    const checks = buildChecks({ ...base, shell: null, consoles, shellFailed: true })
    expect(checks.find((c) => c.id === 'shell')?.state).toBe('warn')
    expect(checks.some((c) => c.id === 'write' || c.id === 'bios:psx')).toBe(false)
  })

  it('Wii U: reports that it opens from Dev Home', () => {
    const checks = buildChecks({ ...base, shell: null, consoles: [console_('wiiu', ['Pikmin 3 (USA).wua'])] })
    expect(checks.find((c) => c.id === 'emu:wiiu')?.state).toBe('info')
  })

  it("Relix's type in Dev Home, by the memory the Xbox will give it", () => {
    const memory = (/** @type {number} */ expectedLimit, xbox = true) => ({ ...shell, memory: { xbox, expectedLimit, limit: 0.5 * GB, usage: 0.3 * GB } })
    expect(appTypeOf(memory(1 * GB))).toBe('app')
    expect(appTypeOf(memory(5 * GB))).toBe('game')
    // a PC gives it all its memory: that says nothing about Dev Home
    expect(appTypeOf(memory(16 * GB, false))).toBeNull()
    // a shell from before 1.2.0, or one that couldn't tell
    expect(appTypeOf(shell)).toBeNull()
    expect(appTypeOf(memory(0))).toBeNull()
    expect(appTypeOf(null)).toBeNull()

    const consoles = [console_('psx', ['Crash Bandicoot (USA).chd'])]
    const asApp = buildChecks({ ...base, shell: memory(1 * GB), consoles })
    expect(asApp.map((c) => c.id)).toEqual(['usb', 'write', 'space', 'folders', 'emu:psx', 'bios:psx', 'apptype', 'internet', 'data'])
    expect(asApp.find((c) => c.id === 'apptype')).toMatchObject({ state: 'ok', title: 'Relix está como App' })
    expect(asApp.find((c) => c.id === 'apptype')?.detail).toContain('hasta 1,0 GB')
    const asGame = buildChecks({ ...base, shell: memory(5 * GB), consoles }).find((c) => c.id === 'apptype')
    expect(asGame).toMatchObject({ state: 'warn', title: 'Relix está como Game' })
    expect(asGame?.detail).toContain('cambia el tipo a App')
    expect(buildChecks({ ...base, shell, consoles }).some((c) => c.id === 'apptype')).toBe(false)
  })

  it('readable sizes', () => {
    expect(formatBytes(182 * GB)).toBe('182 GB')
    expect(formatBytes(1.5 * GB)).toBe('1,5 GB')
    expect(formatBytes(300 * 1024 ** 2)).toBe('300 MB')
  })
})
