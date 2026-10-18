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
 *     { id, type: 'systemCheck', payload: { folders: ['RetroArch\\system', ...] } }
 *        -> { id, ok: true, result: { drive, writable, space: { free, total } | null,
 *             romFolders: ['psx', 'nes'], folders: { 'RetroArch\\system': ['scph5501.bin'] | null },
 *             internet } }                       (Opciones › Revisión)
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

import { i18n, t } from '../i18n/i18n.svelte.js'
import { remoteCoverUrl } from './coverMatch.js'
import { MEDIA_LISTED } from './media.js'
import { getPlatform, PLATFORMS } from './platforms.js'
import mockCoverNames from '../../mock/libretro-names.json'
import mockEnglish from '../../mock/en.json'
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

/**
 * Los gamelists de prueba de la demo. En inglés, con sus descripciones y
 * géneros en inglés (src/mock/en.json): con tu USB, Relix muestra lo que dejó ES-DE.
 * @returns {Record<string, string>}
 */
function demoGamelists() {
  if (i18n.current !== 'en') return MOCK_GAMELISTS
  /** @type {{ descriptions: Record<string, string>, genres: Record<string, string> }} */
  const english = mockEnglish
  /** @param {string} xml */
  const swap = (xml) =>
    xml
      .replace(/<desc>(.*?)<\/desc>/g, (_, text) => `<desc>${english.descriptions[text] ?? text}</desc>`)
      .replace(/<genre>(.*?)<\/genre>/g, (_, text) => `<genre>${english.genres[text] ?? text}</genre>`)
  return Object.fromEntries(Object.entries(MOCK_GAMELISTS).map(([id, xml]) => [id, swap(xml)]))
}

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
/** @type {Map<number, {resolve: Function, reject: Function, type: string}>} */
const pending = new Map()
/** @typedef {{ event: string, action?: string, system?: string, done?: number, total?: number }} ShellEvent */
/** @type {Set<(e: ShellEvent) => void>} */
const listeners = new Set()

/**
 * Quién se entera de los errores del shell (el registro de diagnóstico).
 * @type {((type: string, error: ShellError) => void) | null}
 */
let errorListener = null

/** @param {(type: string, error: ShellError) => void} fn */
export function onShellError(fn) {
  errorListener = fn
}

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
    else waiter.reject(reportError(waiter.type, new ShellError(msg.error ?? t('El shell no respondió.'), msg.code)))
  })
}

/**
 * @param {string} type @param {any} [payload]
 * @param {{ timeout?: number }} [options]  timeout (ms): para mensajes que un
 *   shell anterior no conoce y nunca respondería
 */
function request(type, payload, { timeout = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject, type })
    webview().postMessage({ id, type, payload })
    if (timeout > 0) {
      setTimeout(() => {
        if (!pending.delete(id)) return
        reject(reportError(type, new ShellError(t('El shell no respondió a tiempo.'), 'timeout')))
      }, timeout)
    }
  })
}

/** Avisa del error a quien escucha y lo devuelve @param {string} type @param {ShellError} error */
function reportError(type, error) {
  try {
    errorListener?.(type, error)
  } catch {
    // el registro nunca rompe un pedido
  }
  return error
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

// ── Registro de diagnóstico (E:\relix\registro.txt) ─────────────────

const DEMO_LOG_KEY = 'relix:demo-log'
const DEMO_LOG_MAX = 300

/**
 * Agrega líneas al registro. Sin respuesta: nunca hace esperar a nadie, y un
 * shell anterior simplemente las ignora.
 * @param {string[]} lines
 */
export function appendLog(lines) {
  if (lines.length === 0) return
  if (mode === 'xbox') {
    webview().postMessage({ type: 'appendLog', payload: { lines } })
    return
  }
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_LOG_KEY) ?? '[]')
    localStorage.setItem(DEMO_LOG_KEY, JSON.stringify([...saved, ...lines].slice(-DEMO_LOG_MAX)))
  } catch {
    // sin almacenamiento: la demo no guarda el registro
  }
}

/**
 * Las últimas líneas del registro, de la más vieja a la más nueva.
 * @param {number} count
 * @returns {Promise<string[]>}
 */
export async function readLog(count) {
  if (mode === 'xbox') return (await request('readLog', { count }, { timeout: 10_000 })).lines
  try {
    return JSON.parse(localStorage.getItem(DEMO_LOG_KEY) ?? '[]').slice(-count)
  } catch {
    return []
  }
}

/**
 * El idioma de la interfaz ('es' o 'en'), para que el shell escriba sus
 * mensajes en el mismo. Sin respuesta: un shell anterior lo ignora.
 * @param {'es'|'en'} language
 */
export function setShellLanguage(language) {
  if (mode !== 'xbox') return
  webview().postMessage({ type: 'setLanguage', payload: { language } })
}

/**
 * Color de fondo del shell la próxima vez que abra (el del tema, AARRGGBB).
 * Sin respuesta: si el shell es anterior, simplemente no lo usa.
 * @param {string} color
 */
export function setShellBackground(color) {
  if (mode === 'xbox') webview().postMessage({ type: 'setBackground', payload: { color } })
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
    gamelists: demoGamelists(),
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
 * Baja portadas (o capturas) de libretro al USB.
 * @param {import('./platforms.js').Platform} platform
 * @param {CoverDownload[]} items
 * @param {(done: number, total: number) => void} [onProgress]
 * @param {'covers'|'screenshots'|'titlescreens'} [kind]  carpeta de ES-DE donde se guardan
 * @returns {Promise<CoverDownloadResult>}
 */
export async function downloadCovers(platform, items, onProgress, kind = 'covers') {
  if (mode === 'xbox') {
    const stop = onShellEvent((e) => {
      if (e.event === 'coverProgress' && e.system === platform.id) onProgress?.(e.done ?? 0, e.total ?? 0)
    })
    try {
      // Sin "kind" el shell baja portadas: así un shell anterior sigue sirviendo para ellas
      const payload = { system: platform.id, libretro: platform.libretro, items }
      return await request('downloadCovers', kind === 'covers' ? payload : { ...payload, kind })
    } finally {
      stop()
    }
  }
  // Navegador: "guarda" la imagen recordando su nombre en libretro
  const saved = kind === 'covers' ? demoCovers() : demoMedia()
  const prefix = kind === 'covers' ? '' : `${kind}/`
  for (const [i, item] of items.entries()) {
    await new Promise((resolve) => setTimeout(resolve, kind === 'covers' ? 90 : 40))
    saved[`${prefix}${platform.id}/${item.key}`] = item.remote
    onProgress?.(i + 1, items.length)
  }
  if (kind === 'covers') saveDemoCovers(saved)
  else saveDemo(DEMO_MEDIA_KEY, saved)
  return { saved: items.map((i) => i.key), failed: [] }
}

// ── Fondos, logos y videos (ES-DE/downloaded_media) ─────────────────────

/** Carpeta de libretro de cada tipo que se puede bajar (para la demo) */
const LIBRETRO_FOLDERS = /** @type {Record<string, string>} */ ({ screenshots: 'Named_Snaps', titlescreens: 'Named_Titles' })

/**
 * Lo que hay en downloaded_media de cada consola: capturas, fanart, logos y videos.
 * Un shell anterior no lo conoce: responde un error (o no responde) y la
 * interfaz sigue solo con portadas.
 * @param {string[]} systemIds
 * @returns {Promise<Record<string, import('./media.js').MediaFiles>>}
 */
export async function listMedia(systemIds) {
  if (mode === 'xbox') {
    return (await request('listMedia', { systems: systemIds, types: MEDIA_LISTED }, { timeout: 30_000 })).media
  }
  const saved = Object.keys(demoMedia())
  return Object.fromEntries(
    systemIds.map((id) => [
      id,
      Object.fromEntries(
        MEDIA_LISTED.map((type) => [
          type,
          saved.filter((k) => k.startsWith(`${type}/${id}/`)).map((k) => `${k.slice(type.length + id.length + 2)}.png`),
        ]),
      ),
    ]),
  )
}

/**
 * URL de una imagen o video de downloaded_media.
 * @param {string} system
 * @param {string} type   screenshots, fanart, marquees, videos…
 * @param {string} file   relativo a esa carpeta, con extensión
 * @param {string|null} mediaBase
 */
export function mediaFileUrl(system, type, file, mediaBase) {
  if (mode === 'browser') {
    const remote = demoMedia()[`${type}/${system}/${file.replace(/\.[^./]+$/, '')}`]
    const platform = getPlatform(system)
    return remote && platform && LIBRETRO_FOLDERS[type] ? remoteCoverUrl(platform.libretro, remote, LIBRETRO_FOLDERS[type]) : ''
  }
  if (!mediaBase) return ''
  return `${mediaBase}/${system}/${type}/${file.split('/').map(encodeURIComponent).join('/')}`
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
const DEMO_MEDIA_KEY = 'relix:demo-media'

/** @returns {Record<string, string>} "<tipo>/<consola>/<clave>" -> nombre en libretro */
function demoMedia() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_MEDIA_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** @param {string} key @param {Record<string, string>} value */
function saveDemo(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sin almacenamiento: se olvidan al recargar
  }
}

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

/**
 * En la demo hay una colección de ejemplo (con un juego de una consola que Relix
 * no maneja). Su nombre, en el idioma con que se abrió la demo por primera vez.
 * @returns {Record<string, string>}
 */
const demoSeed = () => ({
  [`custom-${t('Con amigos')}.cfg`]: [
    '%ROMPATH%/ps2/Burnout 3 - Takedown (USA).chd',
    '%ROMPATH%/gc/F-Zero GX (USA).rvz',
    '%ROMPATH%/wiiu/Splatoon (USA).wua',
    '%ROMPATH%/psx/Tekken 3 (USA).chd',
    '%ROMPATH%/snes/Super Mario Kart (USA).sfc',
    '',
  ].join('\n'),
})

/** @returns {Record<string, string>} */
function demoCollections() {
  try {
    const saved = localStorage.getItem(DEMO_COLLECTIONS_KEY)
    return saved ? JSON.parse(saved) : demoSeed()
  } catch {
    return demoSeed()
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

// ── Revisión del sistema ─────────────────────────────────────────────────

/**
 * Mide el USB y la consola (ver SystemCheck.cs).
 * @param {string[]} folders  carpetas de BIOS a listar, relativas al USB
 * @returns {Promise<import('./systemCheck.js').ShellCheck>}
 */
export async function systemCheck(folders) {
  // La prueba de internet espera hasta 6 s; un shell anterior al paso 6 no responde
  if (mode === 'xbox') return request('systemCheck', { folders }, { timeout: 15_000 })
  // Demo: un USB de 465 GB con la BIOS de EE. UU. de PS1 (falta la europea) y una carpeta de NES
  await new Promise((resolve) => setTimeout(resolve, 300))
  return {
    drive: 'E:\\',
    writable: true,
    space: { free: 182 * 1024 ** 3, total: 465 * 1024 ** 3 },
    romFolders: [...PLATFORMS.map((p) => p.id), 'nes'],
    folders: Object.fromEntries(
      folders.map((f) => [f, f === 'RetroArch\\system' ? ['scph5501.bin'] : f === 'XBSX2\\BIOS' ? ['SCPH-70012_BIOS_V12_USA_200.BIN'] : null]),
    ),
    internet: true,
  }
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
  return { driveId: 'demo', text: text ?? DEMO_USERDATA, source: 'data.json' }
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
