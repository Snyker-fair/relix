import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendLog,
  coverUrls,
  downloadCovers,
  listCollections,
  listCovers,
  loadLibrary,
  readLog,
  renameGame,
  saveCollection,
  scanRoms,
  systemCheck,
} from '../src/lib/core/bridge.js'
import { getPlatform } from '../src/lib/core/platforms.js'

// Without RelixShell, the bridge answers with the demo (src/lib/demo): its
// "USB drive" is localStorage
const ps2 = /** @type {import('../src/lib/core/platforms.js').Platform} */ (getPlatform('ps2'))

beforeEach(() => localStorage.clear())

describe('the demo, in the browser', () => {
  it('finds the test games, also the ones ES-DE did not scrape', async () => {
    const { ps2: found } = await scanRoms(['ps2'])
    expect(found.folder).toBe('ps2')
    expect(found.files).toContain('Okami (USA).chd')
    expect(found.files).toContain('Final Fantasy X (USA).chd')
    const library = await loadLibrary()
    expect(library.romRoot).toBe('E:\\roms')
    expect(library.gamelists.ps2).toContain('<path>./Okami (USA).chd</path>')
  })

  it('"downloads" a cover by remembering its name on libretro', async () => {
    const progress = /** @type {number[]} */ ([])
    const result = await downloadCovers(ps2, [{ key: 'Okami (USA)', remote: 'Ookami (USA)' }], (done) => progress.push(done))
    expect(result).toEqual({ saved: ['Okami (USA)'], failed: [] })
    expect(progress).toEqual([1])
    expect((await listCovers(['ps2'])).ps2).toEqual(['Okami (USA).png'])
    expect(coverUrls('ps2', 'Okami (USA).png', { mediaBase: null }).cover).toContain('Ookami%20(USA).png')
  })

  it('renaming moves the game and its cover', async () => {
    await downloadCovers(ps2, [{ key: 'Okami (USA)', remote: 'Ookami (USA)' }])
    const plan = {
      kind: /** @type {const} */ ('file'),
      newPath: 'Okami HD (USA).chd',
      files: [{ from: 'Okami (USA).chd', to: 'Okami HD (USA).chd' }],
      media: [{ from: 'Okami (USA)', to: 'Okami HD (USA)' }],
      gamelist: [{ from: 'Okami (USA).chd', to: 'Okami HD (USA).chd' }],
      saves: [],
    }
    const preview = await renameGame('ps2', 'ps2', plan, { preview: true })
    expect(preview).toMatchObject({ files: 1, media: 1, gamelist: 1 })
    expect((await listCovers(['ps2'])).ps2).toEqual(['Okami (USA).png'])

    await renameGame('ps2', 'ps2', plan)
    expect((await listCovers(['ps2'])).ps2).toEqual(['Okami HD (USA).png'])
    expect((await scanRoms(['ps2'])).ps2.files).toContain('Okami HD (USA).chd')
    expect((await loadLibrary()).gamelists.ps2).toContain('<path>./Okami HD (USA).chd</path>')
  })

  it('a sample collection, which can be changed and deleted', async () => {
    const [seed] = await listCollections()
    expect(seed.file).toBe('custom-Con amigos.cfg')
    await saveCollection('custom-RPG.cfg', '%ROMPATH%/ps2/Okami (USA).chd\n')
    expect((await listCollections()).map((c) => c.file)).toEqual(['custom-Con amigos.cfg', 'custom-RPG.cfg'])
    await saveCollection('custom-Con amigos.cfg', '')
    expect((await listCollections()).map((c) => c.file)).toEqual(['custom-RPG.cfg'])
  })

  it('keeps the last 300 lines of the log', async () => {
    appendLog(Array.from({ length: 310 }, (_, i) => `line ${i}`))
    expect(await readLog(2)).toEqual(['line 308', 'line 309'])
    expect((await readLog(1000)).length).toBe(300)
    localStorage.setItem('relix:demo-log', '{"broken": true}')
    expect(await readLog(5)).toEqual([])
  })

  it('a checkup with a BIOS missing, as App', async () => {
    const check = await systemCheck(['RetroArch\\system'])
    expect(check.folders['RetroArch\\system']).toEqual(['scph5501.bin'])
    expect(check.memory?.expectedLimit).toBe(1024 ** 3)
  })
})
