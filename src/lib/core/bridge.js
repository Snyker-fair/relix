/**
 * Puente entre la interfaz (Svelte) y el "shell" nativo en C#.
 *
 * En la Xbox, la interfaz vive dentro de un control WebView2 de una app UWP.
 * La web no puede leer el USB ni abrir otras apps, así que se lo pide al shell
 * con mensajes:
 *
 *   web  -> shell   { id, type, payload }
 *   shell -> web    { id, ok: true, result }  |  { id, ok: false, error }
 *
 * Tipos de mensaje (el shell en C# se implementa en la Etapa 2):
 *   'loadLibrary'  -> { romRoot, systems: { [id]: gamelistXml } , media: {...} }
 *   'launch'       -> { uri }   abre el emulador con Launcher.LaunchUriAsync
 *
 * En el navegador (desarrollo / demo) no hay shell: usamos datos de prueba
 * y el lanzamiento solo se muestra en pantalla.
 */

import psx from '../../mock/gamelists/psx/gamelist.xml?raw'
import psp from '../../mock/gamelists/psp/gamelist.xml?raw'
import ps2 from '../../mock/gamelists/ps2/gamelist.xml?raw'
import gc from '../../mock/gamelists/gc/gamelist.xml?raw'
import wiiu from '../../mock/gamelists/wiiu/gamelist.xml?raw'

const MOCK_GAMELISTS = { psx, psp, ps2, gc, wiiu }

/** @returns {any} */
function webview() {
  return /** @type {any} */ (globalThis).chrome?.webview ?? null
}

export const mode = webview() ? 'xbox' : 'browser'

let nextId = 1
/** @type {Map<number, {resolve: Function, reject: Function}>} */
const pending = new Map()

if (webview()) {
  webview().addEventListener('message', (/** @type {MessageEvent} */ e) => {
    const msg = e.data
    const waiter = pending.get(msg?.id)
    if (!waiter) return
    pending.delete(msg.id)
    msg.ok ? waiter.resolve(msg.result) : waiter.reject(new Error(msg.error ?? 'Error del shell'))
  })
}

/** @param {string} type @param {any} [payload] */
function request(type, payload) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    webview().postMessage({ id, type, payload })
  })
}

/**
 * @typedef {Object} RawLibrary
 * @property {string} romRoot                 Carpeta de ROMs en la consola
 * @property {Record<string, string>} gamelists  XML de ES-DE por sistema
 * @property {Record<string, string>} [covers]   id de juego -> URL de portada
 */

/** @returns {Promise<RawLibrary>} */
export async function loadLibrary() {
  if (mode === 'xbox') return request('loadLibrary')
  return { romRoot: 'E:\\roms', gamelists: MOCK_GAMELISTS, covers: {} }
}

/**
 * Abre el emulador. En el navegador emite un evento para mostrar la URI.
 * @param {string} uri
 */
export async function launch(uri) {
  if (mode === 'xbox') return request('launch', { uri })
  window.dispatchEvent(new CustomEvent('relix:launch-preview', { detail: { uri } }))
}
