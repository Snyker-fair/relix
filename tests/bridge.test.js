import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Simulates the C# shell: keeps what the interface sends and lets you answer
 * or send events the way MainPage.xaml.cs would.
 */
function fakeShell() {
  /** @type {Array<(e: {data: any}) => void>} */
  const listeners = []
  /** @type {any[]} */
  const sent = []
  return {
    sent,
    webview: {
      addEventListener: (_type, fn) => listeners.push(fn),
      postMessage: (msg) => sent.push(msg),
    },
    /** @param {any} data */
    emit: (data) => listeners.forEach((fn) => fn({ data })),
  }
}

describe('bridge with the Xbox shell', () => {
  const shell = fakeShell()
  /** @type {typeof import('../src/lib/core/bridge.js')} */
  let bridge

  beforeAll(async () => {
    globalThis.chrome = { webview: shell.webview }
    bridge = await import('../src/lib/core/bridge.js')
  })
  afterAll(() => {
    delete globalThis.chrome
  })

  it('detects that it runs inside the Xbox', () => {
    expect(bridge.mode).toBe('xbox')
  })

  it('asks for the library with the list of consoles and gets the answer', async () => {
    const pending = bridge.loadLibrary()
    const msg = shell.sent.at(-1)
    expect(msg.type).toBe('loadLibrary')
    expect(msg.payload.systems.map((s) => s.id)).toEqual([
      'psx', 'ps2', 'psp', 'snes', 'n64', 'gba', 'gc', 'wiiu', 'n3ds', 'megadrive', 'dreamcast', 'xbox360',
    ])
    expect(msg.payload.systems[0].folders).toEqual(['psx', 'ps1', 'playstation'])

    shell.emit({ id: msg.id, ok: true, result: { romRoot: 'F:\\roms', mediaBase: 'https://relix.example/media', gamelists: {} } })
    await expect(pending).resolves.toMatchObject({ romRoot: 'F:\\roms' })
  })

  it('scans only the consoles asked for, with their folder names', async () => {
    const pending = bridge.scanRoms(['ps2'])
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'scanRoms', payload: { systems: [{ id: 'ps2', folders: ['ps2', 'playstation2'] }] } })
    shell.emit({ id: msg.id, ok: true, result: { roms: { ps2: { folder: 'ps2', files: ['Okami (USA).chd'] } } } })
    await expect(pending).resolves.toEqual({ ps2: { folder: 'ps2', files: ['Okami (USA).chd'] } })
  })

  it("sends the URI and the game's path when launching", async () => {
    const pending = bridge.launch('xbsx2:?cmd=xbsx2.exe "x"&launchOnExit=relix:', 'F:\\roms\\ps2\\x.chd')
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'launch', payload: { romPath: 'F:\\roms\\ps2\\x.chd' } })
    shell.emit({ id: msg.id, ok: true, result: true })
    await expect(pending).resolves.toBe(true)
  })

  it("turns the shell's errors into a ShellError with a code", async () => {
    const pending = bridge.launch('ppsspp:?x', 'F:\\roms\\psp\\x.iso')
    const msg = shell.sent.at(-1)
    shell.emit({ id: msg.id, ok: false, error: 'No hay ninguna app instalada que abra ppsspp:', code: 'emulator-missing' })
    const error = await pending.catch((e) => e)
    expect(error).toBeInstanceOf(bridge.ShellError)
    expect(error.code).toBe('emulator-missing')
  })

  it('delivers the controller and return events', () => {
    /** @type {any[]} */
    const got = []
    const stop = bridge.onShellEvent((e) => got.push(e))
    shell.emit({ event: 'input', action: 'down' })
    shell.emit({ event: 'resumed' })
    stop()
    shell.emit({ event: 'input', action: 'a' })
    expect(got).toEqual([{ event: 'input', action: 'down' }, { event: 'resumed' }])
  })

  it('says the interface is ready', () => {
    bridge.notifyReady()
    expect(shell.sent.at(-1)).toEqual({ type: 'ready' })
  })

  it("asks for libretro's list of covers with the console's folder name", async () => {
    const ps2 = (await import('../src/lib/core/platforms.js')).getPlatform('ps2')
    const pending = bridge.coverIndex(/** @type {any} */ (ps2))
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'coverIndex', payload: { system: 'ps2', libretro: 'Sony - PlayStation 2' } })
    shell.emit({ id: msg.id, ok: true, result: { names: ['Ookami (USA)'] } })
    await expect(pending).resolves.toEqual(['Ookami (USA)'])
  })

  it('downloads covers and reports progress only for that console', async () => {
    const ps2 = (await import('../src/lib/core/platforms.js')).getPlatform('ps2')
    /** @type {number[][]} */
    const progress = []
    const items = [{ key: 'Okami (USA)', remote: 'Ookami (USA)' }]
    const pending = bridge.downloadCovers(/** @type {any} */ (ps2), items, (done, total) => progress.push([done, total]))
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'downloadCovers', payload: { system: 'ps2', libretro: 'Sony - PlayStation 2', items } })

    shell.emit({ event: 'coverProgress', system: 'psx', done: 1, total: 9 }) // another console: ignored
    shell.emit({ event: 'coverProgress', system: 'ps2', done: 1, total: 1 })
    shell.emit({ id: msg.id, ok: true, result: { saved: ['Okami (USA)'], failed: [] } })
    await expect(pending).resolves.toEqual({ saved: ['Okami (USA)'], failed: [] })
    expect(progress).toEqual([[1, 1]])

    shell.emit({ event: 'coverProgress', system: 'ps2', done: 2, total: 2 }) // already finished: not listening
    expect(progress).toEqual([[1, 1]])
  })

  it('asks which covers are on the USB drive', async () => {
    const pending = bridge.listCovers(['psx'])
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'listCovers', payload: { systems: ['psx'] } })
    shell.emit({ id: msg.id, ok: true, result: { covers: { psx: ['FF7 (USA)/FF7 (USA).png'] } } })
    await expect(pending).resolves.toEqual({ psx: ['FF7 (USA)/FF7 (USA).png'] })
  })

  it('reads and saves collections, and deletes covers', async () => {
    const listing = bridge.listCollections()
    let msg = shell.sent.at(-1)
    expect(msg.type).toBe('listCollections')
    shell.emit({ id: msg.id, ok: true, result: { collections: [{ file: 'custom-A.cfg', text: 'x\n' }] } })
    await expect(listing).resolves.toEqual([{ file: 'custom-A.cfg', text: 'x\n' }])

    const saving = bridge.saveCollection('custom-A.cfg', '')
    msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'saveCollection', payload: { file: 'custom-A.cfg', text: '' } })
    shell.emit({ id: msg.id, ok: true, result: true })
    await expect(saving).resolves.toBe(true)

    const deleting = bridge.deleteCover('ps2', 'Okami (USA)')
    msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'deleteCover', payload: { system: 'ps2', key: 'Okami (USA)' } })
    shell.emit({ id: msg.id, ok: true, result: true })
    await expect(deleting).resolves.toBe(true)
  })

  it('reads and saves your data on the USB drive', async () => {
    const loading = bridge.loadUserData()
    let msg = shell.sent.at(-1)
    expect(msg.type).toBe('loadUserData')
    shell.emit({ id: msg.id, ok: true, result: { driveId: 'E:\\|RELIX', text: null, source: null } })
    await expect(loading).resolves.toEqual({ driveId: 'E:\\|RELIX', text: null, source: null })

    const saving = bridge.saveUserData('{"app":"relix"}')
    msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'saveUserData', payload: { text: '{"app":"relix"}' } })
    shell.emit({ id: msg.id, ok: false, error: 'No pude guardar tus datos en el USB.', code: 'usb-readonly' })
    await expect(saving).rejects.toMatchObject({ code: 'usb-readonly' })
  })

  it("reads and writes a console's gamelist", async () => {
    const reading = bridge.readGamelist('ps2')
    const asked = shell.sent.at(-1)
    expect(asked).toMatchObject({ type: 'readGamelist', payload: { system: 'ps2' } })
    shell.emit({ id: asked.id, ok: true, result: { text: null } })
    await expect(reading).resolves.toBeNull()

    const writing = bridge.writeGamelist('ps2', '<gameList></gameList>')
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'writeGamelist', payload: { system: 'ps2', text: '<gameList></gameList>' } })
    shell.emit({ id: msg.id, ok: true, result: true })
    await expect(writing).resolves.toBe(true)
  })

  it('asks what a rename would move, then renames', async () => {
    const plan = {
      kind: /** @type {const} */ ('file'),
      newPath: 'Ookami (USA).chd',
      files: [{ from: 'okami.chd', to: 'Ookami (USA).chd' }],
      media: [{ from: 'okami', to: 'Ookami (USA)', folder: false }],
      gamelist: [{ from: 'okami.chd', to: 'Ookami (USA).chd', folder: false }],
      saves: [{ from: 'okami', to: 'Ookami (USA)' }],
    }
    const answer = { files: 1, media: 2, thumbnails: 1, gamelist: 1, saves: 1, savesFolder: true, failed: 0 }

    const preview = bridge.renameGame('ps2', 'ps2', plan, { preview: true })
    const asked = shell.sent.at(-1)
    expect(asked).toMatchObject({
      type: 'renamePreview',
      payload: { system: 'ps2', folder: 'ps2', files: plan.files, media: plan.media, gamelist: plan.gamelist, saves: plan.saves },
    })
    expect(asked.payload).not.toHaveProperty('newPath')
    shell.emit({ id: asked.id, ok: true, result: answer })
    await expect(preview).resolves.toEqual(answer)

    const renaming = bridge.renameGame('ps2', 'ps2', plan)
    const msg = shell.sent.at(-1)
    expect(msg.type).toBe('renameGame')
    shell.emit({ id: msg.id, ok: false, error: 'Ya hay un archivo llamado Ookami (USA).chd.', code: 'rename-exists' })
    expect((await renaming.catch((e) => e)).code).toBe('rename-exists')
  })

  it("checks the system and doesn't keep waiting for an older shell", async () => {
    vi.useFakeTimers()
    try {
      const checking = bridge.systemCheck(['RetroArch\\system'])
      const msg = shell.sent.at(-1)
      expect(msg).toMatchObject({ type: 'systemCheck', payload: { folders: ['RetroArch\\system'] } })
      const result = { drive: 'E:\\', writable: true, space: null, romFolders: [], folders: { 'RetroArch\\system': null }, internet: true }
      shell.emit({ id: msg.id, ok: true, result })
      await expect(checking).resolves.toEqual(result)

      // A shell that doesn't know the message doesn't answer: after 15 s it gives up
      const silent = bridge.systemCheck([])
      const assertion = expect(silent).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(15_000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('builds the URLs of the cover and its thumbnail', () => {
    const bases = { mediaBase: 'https://relix.example/media', thumbBase: 'https://relix.example/thumb' }
    expect(bridge.coverUrls('psx', 'FF7 (USA)/FF7 #1.png', bases)).toEqual({
      cover: 'https://relix.example/media/psx/covers/FF7%20(USA)/FF7%20%231.png',
      thumb: 'https://relix.example/thumb/psx/FF7%20(USA)/FF7%20%231.png',
    })
    // An older shell without thumbnails: the original is used
    expect(bridge.coverUrls('ps2', 'Okami.jpg', { mediaBase: bases.mediaBase }).thumb).toBe(
      'https://relix.example/media/ps2/covers/Okami.jpg',
    )
  })
})
