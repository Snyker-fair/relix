/**
 * Puente entre la interfaz (Svelte) y el shell nativo en C# (RelixShell).
 *
 * En la Xbox, la interfaz vive dentro de un control WebView2 de una app UWP.
 * La web no puede leer el USB, abrir otras apps ni leer el control de forma
 * confiable, así que se comunica con el shell por mensajes:
 *
 *   Pedidos (web -> shell, con respuesta):
 *     { id, type: 'loadLibrary', payload: { systems: [{ id: 'psx', folders: ['psx', 'ps1'] }, ...] } }
 *        -> { id, ok: true, result: {
 *             romRoot, mediaBase,
 *             gamelists: { psx: '<xml>' },                          (los que existan)
 *             roms: { psx: { folder: 'ps1', files: ['Crash (USA).chd', 'FF7/FF7.m3u'] } }
 *           } }
 *     { id, type: 'launch', payload: { uri, romPath } }
 *        -> { id, ok: true, result: true }
 *     Error: { id, ok: false, error: 'mensaje para el jugador', code: 'rom-missing' | ... }
 *
 *   Avisos (web -> shell, sin respuesta):
 *     { type: 'ready' }                  la interfaz ya puede recibir el control
 *
 *   Eventos (shell -> web):
 *     { event: 'input', action: 'up' }   botón del control (leído en C#)
 *     { event: 'resumed' }               la consola volvió a Relix desde un emulador
 *
 * En el navegador (desarrollo / demo) no hay shell: se usan datos de prueba y
 * el lanzamiento solo se muestra en pantalla.
 */

import { PLATFORMS } from './platforms.js'
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

/** 'xbox' dentro de RelixShell; 'browser' en el PC o en la demo */
export const mode = webview() ? 'xbox' : 'browser'

/** Error que viene del shell. `code` permite mostrar un mensaje a medida. */
export class ShellError extends Error {
  /** @param {string} message @param {string} [code] */
  constructor(message, code) {
    super(message)
    this.name = 'ShellError'
    this.code = code ?? 'error'
  }
}

let nextId = 1
/** @type {Map<number, {resolve: Function, reject: Function}>} */
const pending = new Map()
/** @type {Set<(e: {event: string, action?: string}) => void>} */
const listeners = new Set()

if (webview()) {
  webview().addEventListener('message', (/** @type {MessageEvent} */ e) => {
    const msg = e.data
    if (msg?.event) {
      for (const fn of listeners) fn(msg)
      return
    }
    const waiter = pending.get(msg?.id)
    if (!waiter) return
    pending.delete(msg.id)
    if (msg.ok) waiter.resolve(msg.result)
    else waiter.reject(new ShellError(msg.error ?? 'El shell no respondió.', msg.code))
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
 * Escucha los eventos del shell (control, regreso desde un emulador).
 * @param {(e: {event: string, action?: string}) => void} fn
 * @returns {() => void} para dejar de escuchar
 */
export function onShellEvent(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Avisa al shell que la interfaz está lista para recibir el control. */
export function notifyReady() {
  if (mode === 'xbox') webview().postMessage({ type: 'ready' })
}

/**
 * @typedef {Object} RawLibrary
 * @property {string} romRoot                  Carpeta de ROMs en la consola
 * @property {string|null} mediaBase           URL base de las imágenes de ES-DE (null = sin portadas)
 * @property {Record<string, string>} gamelists  XML de ES-DE por sistema
 * @property {Record<string, {folder: string, files: string[]}>} [roms]
 *   Archivos encontrados en roms\<carpeta>\ por sistema (solo en la Xbox)
 */

/** @returns {Promise<RawLibrary>} */
export async function loadLibrary() {
  if (mode === 'xbox') {
    return request('loadLibrary', {
      systems: PLATFORMS.map((p) => ({ id: p.id, folders: p.folders })),
    })
  }
  return { romRoot: 'E:\\roms', mediaBase: null, gamelists: MOCK_GAMELISTS }
}

/**
 * Abre el emulador. En el navegador emite un evento para mostrar la URI.
 * @param {string} uri
 * @param {string} romPath  Ruta del juego; el shell revisa que exista antes de lanzar
 */
export async function launch(uri, romPath) {
  if (mode === 'xbox') return request('launch', { uri, romPath })
  window.dispatchEvent(new CustomEvent('relix:launch-preview', { detail: { uri } }))
}
