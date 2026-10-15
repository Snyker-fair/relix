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
    expect(msg.payload.systems).toEqual(['psx', 'psp', 'ps2', 'gc', 'wiiu'])

    shell.emit({ id: msg.id, ok: true, result: { romRoot: 'F:\\roms', mediaBase: 'https://relix.example/media', gamelists: {} } })
    await expect(pending).resolves.toMatchObject({ romRoot: 'F:\\roms' })
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
})
