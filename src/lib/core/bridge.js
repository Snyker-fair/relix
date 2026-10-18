/**
 * The bridge between the interface (Svelte) and the native C# shell (RelixShell).
 *
 * On the Xbox, the interface lives inside a WebView2 control in a UWP app.
 * The web page can't read the USB drive, open other apps or read the controller
 * reliably, so it talks to the shell through messages:
 *
 *   Requests (web -> shell, with an answer):
 *     { id, type: 'loadLibrary', payload: { systems: [{ id: 'psx', folders: ['psx', 'ps1'] }, ...] } }
 *        -> { id, ok: true, result: {
 *             romRoot, driveId, mediaBase, thumbBase,
 *             gamelists: { psx: '<xml>' },                          (the ones that exist)
 *             covers: { psx: ['Okami (USA).png', 'Sub/Game.jpg'] }   (covers on the USB drive)
 *           } }
 *     { id, type: 'scanRoms', payload: { systems: [{ id: 'ps2', folders: ['ps2', 'playstation2'] }] } }
 *        -> { id, ok: true, result: {
 *             roms: { ps2: { folder: 'ps2', files: ['Okami (USA).chd', 'Sub/Game.iso'] } }
 *           } }                                                   (only the consoles asked for)
 *     { id, type: 'launch', payload: { uri, romPath } }
 *        -> { id, ok: true, result: true }
 *     { id, type: 'listCovers', payload: { systems: ['ps2'] } }
 *        -> { id, ok: true, result: { covers: { ps2: ['Okami (USA).png'] } } }
 *     { id, type: 'coverIndex', payload: { system: 'ps2', libretro: 'Sony - PlayStation 2' } }
 *        -> { id, ok: true, result: { names: ['Ookami (USA)', ...] } }   (without ".png")
 *     { id, type: 'downloadCovers', payload: { system, libretro, items: [{ key, remote }] } }
 *        -> { id, ok: true, result: { saved: ['Okami (USA)'], failed: [{ key, error }] } }
 *     { id, type: 'deleteCover', payload: { system: 'ps2', key: 'Okami (USA)' } }
 *        -> { id, ok: true, result: true }                       (and its thumbnail)
 *     { id, type: 'listCollections' }
 *        -> { id, ok: true, result: { collections: [{ file: 'custom-With friends.cfg', text }] } }
 *     { id, type: 'saveCollection', payload: { file: 'custom-With friends.cfg', text } }
 *        -> { id, ok: true, result: true }                       (empty text = delete)
 *     { id, type: 'emulatorStatus', payload: { protocols: ['retroarch', 'duckstation'] } }
 *        -> { id, ok: true, result: { status: { retroarch: true, duckstation: false } } }
 *     { id, type: 'systemCheck', payload: { folders: ['RetroArch\\system', ...] } }
 *        -> { id, ok: true, result: { drive, writable, space: { free, total } | null,
 *             romFolders: ['psx', 'nes'], folders: { 'RetroArch\\system': ['scph5501.bin'] | null },
 *             internet } }                       (Options › Checkup)
 *     { id, type: 'loadUserData' }
 *        -> { id, ok: true, result: { driveId, text, source } }  (E:\relix\data.json;
 *             text null if there's none yet; source: 'data.json', 'data.previous.json' or a backup)
 *     { id, type: 'saveUserData', payload: { text } }
 *        -> { id, ok: true, result: true }      (keeps the previous one and a backup per day)
 *     Error: { id, ok: false, error: 'message for the player', code: 'rom-missing' | ... }
 *
 *   Notices (web -> shell, no answer):
 *     { type: 'ready' }                  the interface can now receive the controller
 *
 *   Events (shell -> web):
 *     { event: 'input', action: 'up' }   a controller button (read in C#)
 *     { event: 'resumed' }               the console came back to Relix from an emulator
 *     { event: 'visible' }               Relix is visible again (by any path)
 *     { event: 'coverProgress', system, done, total }   downloadCovers progress
 *
 * In the browser (development / demo) there's no shell: test data is used and
 * a launch is only shown on screen.
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
 * The demo's test gamelists. In English, with their descriptions and genres
 * translated (src/mock/en.json): with your USB drive, Relix shows what ES-DE left.
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

/** 'xbox' inside RelixShell; 'browser' on the PC or in the demo */
export const mode = webview() ? 'xbox' : 'browser'

/** An error that comes from the shell. `code` lets a tailored message be shown. */
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
 * Who hears about the shell's errors (the diagnostic log).
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
 * @param {{ timeout?: number }} [options]  timeout (ms): for messages an
 *   older shell doesn't know and would never answer
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

/** Reports the error to whoever listens and returns it @param {string} type @param {ShellError} error */
function reportError(type, error) {
  try {
    errorListener?.(type, error)
  } catch {
    // the log never breaks a request
  }
  return error
}

/**
 * Listens to the shell's events (controller, coming back from an emulator).
 * @param {(e: ShellEvent) => void} fn
 * @returns {() => void} to stop listening
 */
export function onShellEvent(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Tells the shell the interface is ready to receive the controller. */
export function notifyReady() {
  if (mode === 'xbox') webview().postMessage({ type: 'ready' })
}

// ── Diagnostic log (E:\relix\log.txt) ───────────────────────────────

const DEMO_LOG_KEY = 'relix:demo-log'
const DEMO_LOG_MAX = 300

/**
 * Adds lines to the log. No answer: it never makes anyone wait, and an
 * older shell simply ignores them.
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
    // no storage: the demo doesn't keep the log
  }
}

/**
 * The last lines of the log, oldest to newest.
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
 * The interface's language ('es' or 'en'), so the shell writes its messages
 * in the same one. No answer: an older shell ignores it.
 * @param {'es'|'en'} language
 */
export function setShellLanguage(language) {
  if (mode !== 'xbox') return
  webview().postMessage({ type: 'setLanguage', payload: { language } })
}

/**
 * The shell's background color the next time it opens (the theme's, AARRGGBB).
 * No answer: if the shell is older, it simply doesn't use it.
 * @param {string} color
 */
export function setShellBackground(color) {
  if (mode === 'xbox') webview().postMessage({ type: 'setBackground', payload: { color } })
}

/**
 * @typedef {{folder: string, files: string[]}} RomScan
 *
 * @typedef {Object} RawLibrary
 * @property {string} romRoot                  ROM folder on the console
 * @property {string} driveId                  Identifies the drive (if it changes, it's scanned again)
 * @property {string|null} mediaBase           Base URL of ES-DE's images (null = no covers)
 * @property {string|null} [thumbBase]         Base URL of the thumbnails
 * @property {Record<string, string>} gamelists  ES-DE's XML per system
 * @property {Record<string, string[]>} [covers] Covers on the USB drive per console (missing if the shell is older)
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
 * Walks the roms folders of the given consoles.
 * @param {string[]} systemIds
 * @returns {Promise<Record<string, RomScan>>}
 */
export async function scanRoms(systemIds) {
  const platforms = PLATFORMS.filter((p) => systemIds.includes(p.id))
  if (mode === 'xbox') {
    const result = await request('scanRoms', { systems: platforms.map(systemRequest) })
    return result.roms
  }
  // Browser: "finds" the games in the test gamelists, with a pause
  // so the scanning state shows in the demo.
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
 * Opens the emulator. In the browser it emits an event to show the URI.
 * @param {string} uri
 * @param {string} romPath  The game's path; the shell checks it exists before launching
 */
export async function launch(uri, romPath) {
  if (mode === 'xbox') return request('launch', { uri, romPath })
  window.dispatchEvent(new CustomEvent('relix:launch-preview', { detail: { uri } }))
}

// ── Covers ──────────────────────────────────────────────────────────────

/**
 * Covers already on the USB drive, with their extension.
 * @param {string[]} systemIds
 * @returns {Promise<Record<string, string[]>>}
 */
export async function listCovers(systemIds) {
  if (mode === 'xbox') return (await request('listCovers', { systems: systemIds })).covers
  return demoCoverFiles(systemIds)
}

/**
 * The names of a console's covers on libretro (without ".png").
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
 * Downloads covers (or screenshots) from libretro to the USB drive.
 * @param {import('./platforms.js').Platform} platform
 * @param {CoverDownload[]} items
 * @param {(done: number, total: number) => void} [onProgress]
 * @param {'covers'|'screenshots'|'titlescreens'} [kind]  the ES-DE folder they're saved in
 * @returns {Promise<CoverDownloadResult>}
 */
export async function downloadCovers(platform, items, onProgress, kind = 'covers') {
  if (mode === 'xbox') {
    const stop = onShellEvent((e) => {
      if (e.event === 'coverProgress' && e.system === platform.id) onProgress?.(e.done ?? 0, e.total ?? 0)
    })
    try {
      // Without "kind" the shell downloads covers: that way an older shell still works for them
      const payload = { system: platform.id, libretro: platform.libretro, items }
      return await request('downloadCovers', kind === 'covers' ? payload : { ...payload, kind })
    } finally {
      stop()
    }
  }
  // Browser: "saves" the image by remembering its name on libretro
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

// ── Backgrounds, logos and videos (ES-DE/downloaded_media) ──────────────

/** The libretro folder of each type that can be downloaded (for the demo) */
const LIBRETRO_FOLDERS = /** @type {Record<string, string>} */ ({ screenshots: 'Named_Snaps', titlescreens: 'Named_Titles' })

/**
 * What's in each console's downloaded_media: screenshots, fan art, logos and videos.
 * An older shell doesn't know it: it answers with an error (or doesn't answer) and
 * the interface carries on with covers only.
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
 * The URL of an image or video in downloaded_media.
 * @param {string} system
 * @param {string} type   screenshots, fanart, marquees, videos…
 * @param {string} file   relative to that folder, with the extension
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
 * The URLs of a cover on the USB drive: the original and its thumbnail.
 * @param {string} system
 * @param {string} file          relative to covers, with the extension
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

// In the browser, the "downloaded" covers are remembered in the browser
const DEMO_KEY = 'relix:demo-covers'
const DEMO_MEDIA_KEY = 'relix:demo-media'

/** @returns {Record<string, string>} "<type>/<console>/<key>" -> name on libretro */
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
    // no storage: forgotten on reload
  }
}

/** @returns {Record<string, string>} "<console>/<key>" -> name on libretro */
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
    // no storage: forgotten on reload
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
 * Deletes a game's cover (the color one is left).
 * @param {string} system
 * @param {string} key  the game's path without its extension
 */
export async function deleteCover(system, key) {
  if (mode === 'xbox') return request('deleteCover', { system, key })
  const saved = demoCovers()
  delete saved[`${system}/${key}`]
  saveDemoCovers(saved)
  return true
}

// ── Collections (ES-DE/collections/custom-*.cfg) ────────────────────────

/** @typedef {{ file: string, text: string }} CollectionFile */

/** @returns {Promise<CollectionFile[]>} */
export async function listCollections() {
  if (mode === 'xbox') return (await request('listCollections')).collections
  return Object.entries(demoCollections()).map(([file, text]) => ({ file, text }))
}

/**
 * Saves a collection; with an empty text, it deletes it.
 * @param {string} file  "custom-Name.cfg"
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
    // no storage: forgotten on reload
  }
  return true
}

const DEMO_COLLECTIONS_KEY = 'relix:demo-collections'

/**
 * The demo has a sample collection (with a game from a console Relix
 * doesn't handle). Its name is in the language the demo first opened in.
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

// ── Installed emulators ─────────────────────────────────────────────────

/**
 * Which emulators the Xbox has, by protocol.
 * @param {string[]} protocols
 * @returns {Promise<Record<string, boolean>>}
 */
export async function emulatorStatus(protocols) {
  if (mode === 'xbox') return (await request('emulatorStatus', { protocols })).status
  // Demo: an Xbox with RetroArch, PPSSPP, XBSX2 and Xenia Canary
  const demo = new Set(['retroarch', 'ppsspp', 'xbsx2', 'xeniacanary'])
  return Object.fromEntries(protocols.map((p) => [p, demo.has(p)]))
}

// ── System checkup ──────────────────────────────────────────────────────

/**
 * Measures the USB drive and the console (see SystemCheck.cs).
 * @param {string[]} folders  BIOS folders to list, relative to the USB drive
 * @returns {Promise<import('./systemCheck.js').ShellCheck>}
 */
export async function systemCheck(folders) {
  // The internet test waits up to 6 s; a shell from before step 6 doesn't answer
  if (mode === 'xbox') return request('systemCheck', { folders }, { timeout: 15_000 })
  // Demo: a 465 GB USB drive with the US PS1 BIOS (the European one is missing) and a NES folder
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

// ── Your data (E:\relix\data.json) ──────────────────────────────────────

/** @typedef {{ driveId: string, text: string|null, source: string|null }} UserDataFile */

/** @returns {Promise<UserDataFile>} */
export async function loadUserData() {
  if (mode === 'xbox') return request('loadUserData')
  let text = null
  try {
    text = localStorage.getItem(DEMO_USERDATA_KEY)
  } catch {
    // no storage: the demo starts with the sample data
  }
  return { driveId: 'demo', text: text ?? DEMO_USERDATA, source: 'data.json' }
}

/** @param {string} text  the whole content of data.json */
export async function saveUserData(text) {
  if (mode === 'xbox') return request('saveUserData', { text })
  try {
    localStorage.setItem(DEMO_USERDATA_KEY, text)
  } catch {
    // no storage: forgotten on reload
  }
  return true
}

// In the demo, the "USB drive" is the browser. It comes with some sample playtime.
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
