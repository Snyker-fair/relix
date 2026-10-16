import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Simula el shell en C#: guarda lo que la interfaz envía y permite responder
 * o mandar eventos como lo haría MainPage.xaml.cs.
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

describe('bridge con el shell de Xbox', () => {
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

  it('detecta que corre dentro de la Xbox', () => {
    expect(bridge.mode).toBe('xbox')
  })

  it('pide la biblioteca con la lista de consolas y recibe la respuesta', async () => {
    const pending = bridge.loadLibrary()
    const msg = shell.sent.at(-1)
    expect(msg.type).toBe('loadLibrary')
    expect(msg.payload.systems.map((s) => s.id)).toEqual(['psx', 'psp', 'ps2', 'gc', 'wiiu'])
    expect(msg.payload.systems[0].folders).toEqual(['psx', 'ps1', 'playstation'])

    shell.emit({ id: msg.id, ok: true, result: { romRoot: 'F:\\roms', mediaBase: 'https://relix.example/media', gamelists: {} } })
    await expect(pending).resolves.toMatchObject({ romRoot: 'F:\\roms' })
  })

  it('escanea solo las consolas pedidas, con sus nombres de carpeta', async () => {
    const pending = bridge.scanRoms(['ps2'])
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'scanRoms', payload: { systems: [{ id: 'ps2', folders: ['ps2', 'playstation2'] }] } })
    shell.emit({ id: msg.id, ok: true, result: { roms: { ps2: { folder: 'ps2', files: ['Okami (USA).chd'] } } } })
    await expect(pending).resolves.toEqual({ ps2: { folder: 'ps2', files: ['Okami (USA).chd'] } })
  })

  it('envía la URI y la ruta del juego al lanzar', async () => {
    const pending = bridge.launch('xbsx2:?cmd=xbsx2.exe "x"&launchOnExit=relix:', 'F:\\roms\\ps2\\x.chd')
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'launch', payload: { romPath: 'F:\\roms\\ps2\\x.chd' } })
    shell.emit({ id: msg.id, ok: true, result: true })
    await expect(pending).resolves.toBe(true)
  })

  it('convierte los errores del shell en ShellError con código', async () => {
    const pending = bridge.launch('ppsspp:?x', 'F:\\roms\\psp\\x.iso')
    const msg = shell.sent.at(-1)
    shell.emit({ id: msg.id, ok: false, error: 'No hay ninguna app instalada que abra ppsspp:', code: 'emulator-missing' })
    const error = await pending.catch((e) => e)
    expect(error).toBeInstanceOf(bridge.ShellError)
    expect(error.code).toBe('emulator-missing')
  })

  it('entrega los eventos del control y del regreso', () => {
    /** @type {any[]} */
    const got = []
    const stop = bridge.onShellEvent((e) => got.push(e))
    shell.emit({ event: 'input', action: 'down' })
    shell.emit({ event: 'resumed' })
    stop()
    shell.emit({ event: 'input', action: 'a' })
    expect(got).toEqual([{ event: 'input', action: 'down' }, { event: 'resumed' }])
  })

  it('avisa que la interfaz está lista', () => {
    bridge.notifyReady()
    expect(shell.sent.at(-1)).toEqual({ type: 'ready' })
  })

  it('pide la lista de portadas de libretro con el nombre de carpeta de la consola', async () => {
    const ps2 = (await import('../src/lib/core/platforms.js')).getPlatform('ps2')
    const pending = bridge.coverIndex(/** @type {any} */ (ps2))
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'coverIndex', payload: { system: 'ps2', libretro: 'Sony - PlayStation 2' } })
    shell.emit({ id: msg.id, ok: true, result: { names: ['Ookami (USA)'] } })
    await expect(pending).resolves.toEqual(['Ookami (USA)'])
  })

  it('baja portadas y reporta el avance solo de esa consola', async () => {
    const ps2 = (await import('../src/lib/core/platforms.js')).getPlatform('ps2')
    /** @type {number[][]} */
    const progress = []
    const items = [{ key: 'Okami (USA)', remote: 'Ookami (USA)' }]
    const pending = bridge.downloadCovers(/** @type {any} */ (ps2), items, (done, total) => progress.push([done, total]))
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'downloadCovers', payload: { system: 'ps2', libretro: 'Sony - PlayStation 2', items } })

    shell.emit({ event: 'coverProgress', system: 'psx', done: 1, total: 9 }) // otra consola: se ignora
    shell.emit({ event: 'coverProgress', system: 'ps2', done: 1, total: 1 })
    shell.emit({ id: msg.id, ok: true, result: { saved: ['Okami (USA)'], failed: [] } })
    await expect(pending).resolves.toEqual({ saved: ['Okami (USA)'], failed: [] })
    expect(progress).toEqual([[1, 1]])

    shell.emit({ event: 'coverProgress', system: 'ps2', done: 2, total: 2 }) // ya terminó: no escucha
    expect(progress).toEqual([[1, 1]])
  })

  it('pide qué portadas hay en el USB', async () => {
    const pending = bridge.listCovers(['psx'])
    const msg = shell.sent.at(-1)
    expect(msg).toMatchObject({ type: 'listCovers', payload: { systems: ['psx'] } })
    shell.emit({ id: msg.id, ok: true, result: { covers: { psx: ['FF7 (USA)/FF7 (USA).png'] } } })
    await expect(pending).resolves.toEqual({ psx: ['FF7 (USA)/FF7 (USA).png'] })
  })

  it('lee y guarda colecciones, y borra portadas', async () => {
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

  it('lee y guarda tus datos en el USB', async () => {
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

  it('arma las URLs de la portada y su miniatura', () => {
    const bases = { mediaBase: 'https://relix.example/media', thumbBase: 'https://relix.example/thumb' }
    expect(bridge.coverUrls('psx', 'FF7 (USA)/FF7 #1.png', bases)).toEqual({
      cover: 'https://relix.example/media/psx/covers/FF7%20(USA)/FF7%20%231.png',
      thumb: 'https://relix.example/thumb/psx/FF7%20(USA)/FF7%20%231.png',
    })
    // Shell anterior sin miniaturas: usa la original
    expect(bridge.coverUrls('ps2', 'Okami.jpg', { mediaBase: bases.mediaBase }).thumb).toBe(
      'https://relix.example/media/ps2/covers/Okami.jpg',
    )
  })
})
