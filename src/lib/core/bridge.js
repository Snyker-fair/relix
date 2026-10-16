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
 *             romRoot, driveId, mediaBase, thumbBase,
 *             gamelists: { psx: '<xml>' },                          (los que existan)
 *             covers: { psx: ['Okami (USA).png', 'Sub/Juego.jpg'] }  (portadas en el USB)
 *           } }
 *     { id, type: 'scanRoms', payload: { systems: [{ id: 'ps2', folders: ['ps2', 'playstation2'] }] } }
 *        -> { id, ok: true, result: {
 *             roms: { ps2: { folder: 'ps2', files: ['Okami (USA).chd', 'Sub/Juego.iso'] } }
 *           } }                                                   (solo las consolas pedidas)
 *     { id, type: 'launch', payload: { uri, romPath } }
 *        -> { id, ok: true, result: true }
 *     { id, type: 'listCovers', payload: { systems: ['ps2'] } }
 *        -> { id, ok: true, result: { covers: { ps2: ['Okami (USA).png'] } } }
 *     { id, type: 'coverIndex', payload: { system: 'ps2', libretro: 'Sony - PlayStation 2' } }
 *        -> { id, ok: true, result: { names: ['Ookami (USA)', ...] } }   (sin ".png")
 *     { id, type: 'downloadCovers', payload: { system, libretro, items: [{ key, remote }] } }
 *        -> { id, ok: true, result: { saved: ['Okami (USA)'], failed: [{ key, error }] } }
 *     { id, type: 'deleteCover', payload: { system: 'ps2', key: 'Okami (USA)' } }
 *        -> { id, ok: true, result: true }                       (y su miniatura)
 *     { id, type: 'listCollections' }
 *        -> { id, ok: true, result: { collections: [{ file: 'custom-Con amigos.cfg', text }] } }
 *     { id, type: 'saveCollection', payload: { file: 'custom-Con amigos.cfg', text } }
 *        -> { id, ok: true, result: true }                       (text vacío = borrar)
 *     { id, type: 'emulatorStatus', payload: { protocols: ['retroarch', 'duckstation'] } }
 *        -> { id, ok: true, result: { status: { retroarch: true, duckstation: false } } }
 *     { id, type: 'loadUserData' }
 *        -> { id, ok: true, result: { driveId, text, source } }  (E:\relix\datos.json;
 *             text null si aún no hay; source: 'datos.json', 'datos.anterior.json' o un respaldo)
 *     { id, type: 'saveUserData', payload: { text } }
 *        -> { id, ok: true, result: true }      (guarda la anterior y un respaldo por día)
 *     Error: { id, ok: false, error: 'mensaje para el jugador', code: 'rom-missing' | ... }
 *
 *   Avisos (web -> shell, sin respuesta):
 *     { type: 'ready' }                  la interfaz ya puede recibir el control
 *
 *   Eventos (shell -> web):
 *     { event: 'input', action: 'up' }   botón del control (leído en C#)
 *     { event: 'resumed' }               la consola volvió a Relix desde un emulador
 *     { event: 'visible' }               Relix volvió a verse (por cualquier camino)
 *     { event: 'coverProgress', system, done, total }   avance de downloadCovers
 *
 * En el navegador (desarrollo / demo) no hay shell: se usan datos de prueba y
 * el lanzamiento solo se muestra en pantalla.
 */

import { remoteCoverUrl } from './coverMatch.js'
import { getPlatform, PLATFORMS } from './platforms.js'
import mockCoverNames from '../../mock/libretro-names.json'
import psx from '../../mock/gamelists/psx/gamelist.xml?raw'
import psp from '../../mock/gamelists/psp/gamelist.xml?raw'
import ps2 from '../../mock/gamelists/ps2/gamelist.xml?raw'
import gc from '../../mock/gamelists/gc/gamelist.xml?raw'
import wiiu from '../../mock/gamelists/wiiu/gamelist.xml?raw'
import snes from '../../mock/gamelists/snes/gamelist.xml?raw'
import n64 from '../../mock/gamelists/n64/gamelist.xml?raw'
import gba from '../../mock/gamelists/gba/gamelist.xml?raw'
import n3ds from '../../mock/gamelists/n3ds/gamelist.xml?raw'
import megadrive from '../../mock/gamelists/megadrive/gamelist.xml?raw'
import dreamcast from '../../mock/gamelists/dreamcast/gamelist.xml?raw'
import xbox360 from '../../mock/gamelists/xbox360/gamelist.xml?raw'

const MOCK_GAMELISTS = { psx, psp, ps2, gc, wiiu, snes, n64, gba, n3ds, megadrive, dreamcast, xbox360 }

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
/** @typedef {{ event: string, action?: string, system?: string, done?: number, total?: number }} ShellEvent */
/** @type {Set<(e: ShellEvent) => void>} */
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
 * @param {(e: ShellEvent) => void} fn
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
 * @typedef {{folder: string, files: string[]}} RomScan
 *
 * @typedef {Object} RawLibrary
 * @property {string} romRoot                  Carpeta de ROMs en la consola
 * @property {string} driveId                  Identifica el disco (si cambia, se vuelve a escanear)
 * @property {string|null} mediaBase           URL base de las imágenes de ES-DE (null = sin portadas)
 * @property {string|null} [thumbBase]         URL base de las miniaturas
 * @property {Record<string, string>} gamelists  XML de ES-DE por sistema
 * @property {Record<string, string[]>} [covers] Portadas en el USB por consola (falta si el shell es anterior)
 */

/** @param {import('./platforms.js').Platform} p */
const systemRequest = (p) => ({ id: p.id, folders: p.folders })

/** @returns {Promise<RawLibrary>} */
export async function loadLibrary() {
  if (mode === 'xbox') {
    return request('loadLibrary', { systems: PLATFORMS.map(systemRequest) })
  }
  return {
    romRoot: 'E:\\roms',
    driveId: 'demo',
    mediaBase: null,
    thumbBase: null,
    gamelists: MOCK_GAMELISTS,
    covers: demoCoverFiles(PLATFORMS.map((p) => p.id)),
  }
}

/**
 * Recorre las carpetas de roms de las consolas indicadas.
 * @param {string[]} systemIds
 * @returns {Promise<Record<string, RomScan>>}
 */
export async function scanRoms(systemIds) {
  const platforms = PLATFORMS.filter((p) => systemIds.includes(p.id))
  if (mode === 'xbox') {
    const result = await request('scanRoms', { systems: platforms.map(systemRequest) })
    return result.roms
  }
  // Navegador: "encuentra" los juegos de los gamelists de prueba, con una pausa
  // para que se vea el estado de escaneo en la demo.
  await new Promise((resolve) => setTimeout(resolve, 150))
  /** @type {Record<string, RomScan>} */
  const roms = {}
  for (const p of platforms) {
    const xml = /** @type {Record<string, string>} */ (MOCK_GAMELISTS)[p.id] ?? ''
    const files = [...xml.matchAll(/<path>\.\/(.*?)<\/path>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
    roms[p.id] = { folder: p.id, files }
  }
  return roms
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

// ── Portadas ─────────────────────────────────────────────────────────────

/**
 * Portadas que ya están en el USB, con su extensión.
 * @param {string[]} systemIds
 * @returns {Promise<Record<string, string[]>>}
 */
export async function listCovers(systemIds) {
  if (mode === 'xbox') return (await request('listCovers', { systems: systemIds })).covers
  return demoCoverFiles(systemIds)
}

/**
 * Nombres de las portadas de una consola en libretro (sin ".png").
 * @param {import('./platforms.js').Platform} platform
 * @returns {Promise<string[]>}
 */
export async function coverIndex(platform) {
  if (mode === 'xbox') {
    return (await request('coverIndex', { system: platform.id, libretro: platform.libretro })).names
  }
  await new Promise((resolve) => setTimeout(resolve, 400))
  return /** @type {Record<string, string[]>} */ (mockCoverNames)[platform.id] ?? []
}

/**
 * @typedef {{ key: string, remote: string }} CoverDownload
 * @typedef {{ saved: string[], failed: Array<{ key: string, error: string }> }} CoverDownloadResult
 */

/**
 * Baja portadas de libretro al USB.
 * @param {import('./platforms.js').Platform} platform
 * @param {CoverDownload[]} items
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<CoverDownloadResult>}
 */
export async function downloadCovers(platform, items, onProgress) {
  if (mode === 'xbox') {
    const stop = onShellEvent((e) => {
      if (e.event === 'coverProgress' && e.system === platform.id) onProgress?.(e.done ?? 0, e.total ?? 0)
    })
    try {
      return await request('downloadCovers', { system: platform.id, libretro: platform.libretro, items })
    } finally {
      stop()
    }
  }
  // Navegador: "guarda" la portada recordando su nombre en libretro
  const saved = demoCovers()
  for (const [i, item] of items.entries()) {
    await new Promise((resolve) => setTimeout(resolve, 90))
    saved[`${platform.id}/${item.key}`] = item.remote
    onProgress?.(i + 1, items.length)
  }
  saveDemoCovers(saved)
  return { saved: items.map((i) => i.key), failed: [] }
}

/**
 * URLs de una portada que está en el USB: la original y su miniatura.
 * @param {string} system
 * @param {string} file          relativa a covers, con extensión
 * @param {{ mediaBase: string|null, thumbBase?: string|null }} bases
 */
export function coverUrls(system, file, { mediaBase, thumbBase }) {
  if (mode === 'browser') {
    const remote = demoCovers()[`${system}/${file.replace(/\.[^./]+$/, '')}`]
    const platform = getPlatform(system)
    const url = remote && platform ? remoteCoverUrl(platform.libretro, remote) : ''
    return { cover: url, thumb: url }
  }
  const path = file.split('/').map(encodeURIComponent).join('/')
  const cover = `${mediaBase}/${system}/covers/${path}`
  return { cover, thumb: thumbBase ? `${thumbBase}/${system}/${path}` : cover }
}

// En el navegador las portadas "descargadas" se recuerdan en el navegador
const DEMO_KEY = 'relix:demo-covers'

/** @returns {Record<string, string>} "<consola>/<clave>" -> nombre en libretro */
function demoCovers() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** @param {Record<string, string>} covers */
function saveDemoCovers(covers) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(covers))
  } catch {
    // sin almacenamiento: se olvidan al recargar
  }
}

/** @param {string[]} systemIds */
function demoCoverFiles(systemIds) {
  const saved = Object.keys(demoCovers())
  return Object.fromEntries(
    systemIds.map((id) => [
      id,
      saved.filter((k) => k.startsWith(`${id}/`)).map((k) => `${k.slice(id.length + 1)}.png`),
    ]),
  )
}

/**
 * Borra la portada de un juego (queda la de color).
 * @param {string} system
 * @param {string} key  ruta del juego sin extensión
 */
export async function deleteCover(system, key) {
  if (mode === 'xbox') return request('deleteCover', { system, key })
  const saved = demoCovers()
  delete saved[`${system}/${key}`]
  saveDemoCovers(saved)
  return true
}

// ── Colecciones (ES-DE/collections/custom-*.cfg) ─────────────────────────

/** @typedef {{ file: string, text: string }} CollectionFile */

/** @returns {Promise<CollectionFile[]>} */
export async function listCollections() {
  if (mode === 'xbox') return (await request('listCollections')).collections
  return Object.entries(demoCollections()).map(([file, text]) => ({ file, text }))
}

/**
 * Guarda una colección; con texto vacío, la borra.
 * @param {string} file  "custom-Nombre.cfg"
 * @param {string} text
 */
export async function saveCollection(file, text) {
  if (mode === 'xbox') return request('saveCollection', { file, text })
  const all = demoCollections()
  if (text) all[file] = text
  else delete all[file]
  try {
    localStorage.setItem(DEMO_COLLECTIONS_KEY, JSON.stringify(all))
  } catch {
    // sin almacenamiento: se olvidan al recargar
  }
  return true
}

const DEMO_COLLECTIONS_KEY = 'relix:demo-collections'

/** En la demo hay una colección de ejemplo (con un juego de una consola que Relix no maneja) */
const DEMO_SEED = {
  'custom-Con amigos.cfg': [
    '%ROMPATH%/ps2/Burnout 3 - Takedown (USA).chd',
    '%ROMPATH%/gc/F-Zero GX (USA).rvz',
    '%ROMPATH%/wiiu/Splatoon (USA).wua',
    '%ROMPATH%/psx/Tekken 3 (USA).chd',
    '%ROMPATH%/snes/Super Mario Kart (USA).sfc',
    '',
  ].join('\n'),
}

/** @returns {Record<string, string>} */
function demoCollections() {
  try {
    const saved = localStorage.getItem(DEMO_COLLECTIONS_KEY)
    return saved ? JSON.parse(saved) : { ...DEMO_SEED }
  } catch {
    return { ...DEMO_SEED }
  }
}

// ── Emuladores instalados ────────────────────────────────────────────────

/**
 * Qué emuladores tiene la Xbox, por protocolo.
 * @param {string[]} protocols
 * @returns {Promise<Record<string, boolean>>}
 */
export async function emulatorStatus(protocols) {
  if (mode === 'xbox') return (await request('emulatorStatus', { protocols })).status
  // Demo: una Xbox con RetroArch, PPSSPP, XBSX2 y Xenia Canary
  const demo = new Set(['retroarch', 'ppsspp', 'xbsx2', 'xeniacanary'])
  return Object.fromEntries(protocols.map((p) => [p, demo.has(p)]))
}

// ── Tus datos (E:\relix\datos.json) ─────────────────────────────────────

/** @typedef {{ driveId: string, text: string|null, source: string|null }} UserDataFile */

/** @returns {Promise<UserDataFile>} */
export async function loadUserData() {
  if (mode === 'xbox') return request('loadUserData')
  let text = null
  try {
    text = localStorage.getItem(DEMO_USERDATA_KEY)
  } catch {
    // sin almacenamiento: la demo parte con los datos de ejemplo
  }
  return { driveId: 'demo', text: text ?? DEMO_USERDATA, source: 'datos.json' }
}

/** @param {string} text  contenido completo de datos.json */
export async function saveUserData(text) {
  if (mode === 'xbox') return request('saveUserData', { text })
  try {
    localStorage.setItem(DEMO_USERDATA_KEY, text)
  } catch {
    // sin almacenamiento: se olvida al recargar
  }
  return true
}

// En la demo, el "USB" es el navegador. Trae algo de tiempo jugado de ejemplo.
const DEMO_USERDATA_KEY = 'relix:demo-userdata'
const DEMO_USERDATA = JSON.stringify({
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
})
