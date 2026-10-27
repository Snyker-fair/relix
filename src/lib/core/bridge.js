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
 *     { id, type: 'readGamelist', payload: { system: 'ps2' } }
 *        -> { id, ok: true, result: { text } }      (ES-DE's gamelist.xml; null if there's none)
 *     { id, type: 'writeGamelist', payload: { system: 'ps2', text } }
 *        -> { id, ok: true, result: true }          (through a temporary file; the first time,
 *             the original stays as gamelist.xml.relix-backup)
 *     { id, type: 'renameGame', payload: { system, folder, files, media, gamelist, saves } }
 *        -> { id, ok: true, result: { files, media, thumbnails, gamelist, saves, savesFolder, failed, errors } }
 *             (core/rename.js plans it; 'renamePreview' answers the same without renaming)
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
 * In the browser (development / demo) there's no shell: lib/demo/demo.js answers
 * instead, with test data, and a launch is only shown on screen.
 */

import * as demo from '../demo/demo.js'
import { t } from '../i18n/i18n.svelte.js'
import { MEDIA_LISTED } from './media.js'
import { PLATFORMS } from './platforms.js'

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

/**
 * Adds lines to the log. No answer: it never makes anyone wait, and an
 * older shell simply ignores them.
 * @param {string[]} lines
 */
export function appendLog(lines) {
  if (lines.length === 0) return
  if (mode === 'xbox') webview().postMessage({ type: 'appendLog', payload: { lines } })
  else demo.appendLog(lines)
}

/**
 * The last lines of the log, oldest to newest.
 * @param {number} count
 * @returns {Promise<string[]>}
 */
export async function readLog(count) {
  if (mode === 'xbox') return (await request('readLog', { count }, { timeout: 10_000 })).lines
  return demo.readLog(count)
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
  if (mode === 'xbox') return request('loadLibrary', { systems: PLATFORMS.map(systemRequest) })
  return demo.loadLibrary()
}

/**
 * Walks the roms folders of the given consoles.
 * @param {string[]} systemIds
 * @returns {Promise<Record<string, RomScan>>}
 */
export async function scanRoms(systemIds) {
  const platforms = PLATFORMS.filter((p) => systemIds.includes(p.id))
  if (mode === 'xbox') return (await request('scanRoms', { systems: platforms.map(systemRequest) })).roms
  return demo.scanRoms(platforms)
}

/**
 * Opens the emulator. In the browser it emits an event to show the URI.
 * @param {string} uri
 * @param {string} romPath  The game's path; the shell checks it exists before launching
 */
export async function launch(uri, romPath) {
  if (mode === 'xbox') return request('launch', { uri, romPath })
  demo.launch(uri)
}

// ── Covers ──────────────────────────────────────────────────────────────

/**
 * Covers already on the USB drive, with their extension.
 * @param {string[]} systemIds
 * @returns {Promise<Record<string, string[]>>}
 */
export async function listCovers(systemIds) {
  if (mode === 'xbox') return (await request('listCovers', { systems: systemIds })).covers
  return demo.coverFiles(systemIds)
}

/**
 * The names of a console's covers on libretro (without ".png").
 * @param {import('./platforms.js').Platform} platform
 * @returns {Promise<string[]>}
 */
export async function coverIndex(platform) {
  if (mode === 'xbox') return (await request('coverIndex', { system: platform.id, libretro: platform.libretro })).names
  return demo.coverIndex(platform)
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
  if (mode !== 'xbox') return demo.downloadCovers(platform, items, onProgress, kind)
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

// ── Backgrounds, logos and videos (ES-DE/downloaded_media) ──────────────

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
  return demo.listMedia(systemIds)
}

/**
 * The URL of an image or video in downloaded_media.
 * @param {string} system
 * @param {string} type   screenshots, fanart, marquees, videos…
 * @param {string} file   relative to that folder, with the extension
 * @param {string|null} mediaBase
 */
export function mediaFileUrl(system, type, file, mediaBase) {
  if (mode === 'browser') return demo.mediaFileUrl(system, type, file)
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
  if (mode === 'browser') return demo.coverUrls(system, file)
  const path = file.split('/').map(encodeURIComponent).join('/')
  const cover = `${mediaBase}/${system}/covers/${path}`
  return { cover, thumb: thumbBase ? `${thumbBase}/${system}/${path}` : cover }
}

/**
 * Deletes a game's cover (the color one is left).
 * @param {string} system
 * @param {string} key  the game's path without its extension
 */
export async function deleteCover(system, key) {
  if (mode === 'xbox') return request('deleteCover', { system, key })
  return demo.deleteCover(system, key)
}

// ── Collections (ES-DE/collections/custom-*.cfg) ────────────────────────

/** @typedef {{ file: string, text: string }} CollectionFile */

/** @returns {Promise<CollectionFile[]>} */
export async function listCollections() {
  if (mode === 'xbox') return (await request('listCollections')).collections
  return demo.listCollections()
}

/**
 * Saves a collection; with an empty text, it deletes it.
 * @param {string} file  "custom-Name.cfg"
 * @param {string} text
 */
export async function saveCollection(file, text) {
  if (mode === 'xbox') return request('saveCollection', { file, text })
  return demo.saveCollection(file, text)
}

// ── ES-DE's gamelists ───────────────────────────────────────────────────

/**
 * A console's gamelist.xml as it is on the USB drive right now.
 * @param {string} system
 * @returns {Promise<string | null>}  null if it has none
 */
export async function readGamelist(system) {
  if (mode === 'xbox') return (await request('readGamelist', { system })).text ?? null
  return demo.readGamelist(system)
}

/**
 * Writes the list of a game's discs (core/discs.js) in E:\relix\discs\<console> and
 * returns its full path, the one the emulator opens.
 * @param {string} system
 * @param {string} name  disc 1's, without its extension
 * @param {string} text  one disc per line, with its full path
 * @returns {Promise<string>}
 */
export async function writeDiscList(system, name, text) {
  if (mode === 'xbox') return (await request('writeDiscList', { system, name, text })).path
  return `E:\\relix\\discs\\${system}\\${name}.m3u`
}

/**
 * Saves a console's gamelist.xml (the shell writes it safely; see GamelistWriter.cs).
 * @param {string} system
 * @param {string} text
 */
export async function writeGamelist(system, text) {
  if (mode === 'xbox') return request('writeGamelist', { system, text })
  return demo.writeGamelist(system, text)
}

/**
 * @typedef {{ files: number, media: number, thumbnails: number, gamelist: number, saves: number,
 *   savesFolder: boolean, failed: number, errors?: string[] }} RenameResult
 *   how much moved (with preview: how much would move); savesFolder: RetroArch's
 *   saves are on the USB drive; failed: steps after the game itself that went wrong;
 *   errors: "step: message" for each of them (core/rename.js › RENAME_STEPS)
 */

/**
 * Renames a game on the USB drive, and everything tied to its name (see core/rename.js).
 * An older shell doesn't know it: it answers with an error.
 * @param {string} system
 * @param {string} folder  its console's real folder inside roms
 * @param {import('./rename.js').RenamePlan} plan
 * @param {{ preview?: boolean }} [options]  preview: only count what would move
 * @returns {Promise<RenameResult>}
 */
export async function renameGame(system, folder, plan, { preview = false } = {}) {
  const payload = { system, folder, files: plan.files, media: plan.media, gamelist: plan.gamelist, saves: plan.saves }
  if (mode === 'xbox') return request(preview ? 'renamePreview' : 'renameGame', payload)
  return demo.renameGame(system, plan, preview)
}

// ── Installed emulators ─────────────────────────────────────────────────

/**
 * Which emulators the Xbox has, by protocol.
 * @param {string[]} protocols
 * @returns {Promise<Record<string, boolean>>}
 */
export async function emulatorStatus(protocols) {
  if (mode === 'xbox') return (await request('emulatorStatus', { protocols })).status
  return demo.emulatorStatus(protocols)
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
  return demo.systemCheck(folders)
}

/**
 * How much memory Relix uses now and how much the Xbox gives it (see SystemCheck.cs).
 * null in the demo, and with a shell from before 1.3.0.
 * @returns {Promise<import('./systemCheck.js').ShellMemory | null>}
 */
export async function memoryUsage() {
  if (mode !== 'xbox') return null
  return request('memory', {}, { timeout: 3000 }).catch(() => null)
}

// ── Your data (E:\relix\data.json) ──────────────────────────────────────

/** @typedef {{ driveId: string, text: string|null, source: string|null }} UserDataFile */

/** @returns {Promise<UserDataFile>} */
export async function loadUserData() {
  if (mode === 'xbox') return request('loadUserData')
  return demo.loadUserData()
}

/** @param {string} text  the whole content of data.json */
export async function saveUserData(text) {
  if (mode === 'xbox') return request('saveUserData', { text })
  return demo.saveUserData(text)
}
