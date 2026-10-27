/**
 * The shell's side in the browser (development and the demo): what each request
 * of core/bridge.js does when there's no RelixShell. The games are the test
 * gamelists in src/mock, the "USB drive" is localStorage (demo/storage.js) and a
 * launch is only shown on screen.
 */
import mockCoverNames from '../../mock/libretro-names.json'
import mockEnglish from '../../mock/en.json'
import dreamcast from '../../mock/gamelists/dreamcast/gamelist.xml?raw'
import gba from '../../mock/gamelists/gba/gamelist.xml?raw'
import gc from '../../mock/gamelists/gc/gamelist.xml?raw'
import megadrive from '../../mock/gamelists/megadrive/gamelist.xml?raw'
import n3ds from '../../mock/gamelists/n3ds/gamelist.xml?raw'
import n64 from '../../mock/gamelists/n64/gamelist.xml?raw'
import ps2 from '../../mock/gamelists/ps2/gamelist.xml?raw'
import psp from '../../mock/gamelists/psp/gamelist.xml?raw'
import psx from '../../mock/gamelists/psx/gamelist.xml?raw'
import snes from '../../mock/gamelists/snes/gamelist.xml?raw'
import wiiu from '../../mock/gamelists/wiiu/gamelist.xml?raw'
import xbox360 from '../../mock/gamelists/xbox360/gamelist.xml?raw'
import { remoteCoverUrl } from '../core/coverMatch.js'
import { MEDIA_LISTED } from '../core/media.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { i18n } from '../i18n/i18n.svelte.js'
import { DEMO_KEYS, readDemo, writeDemo } from './storage.js'
import { DEMO_EMULATORS, DEMO_UNSCRAPED, DEMO_USERDATA, demoCollectionSeed, demoSystemCheck } from './samples.js'

/** @typedef {import('../core/bridge.js').RawLibrary} RawLibrary @typedef {import('../core/bridge.js').RomScan} RomScan */
/** @typedef {import('../core/bridge.js').CoverDownload} CoverDownload @typedef {import('../core/bridge.js').RenameResult} RenameResult */
/** @typedef {import('../core/platforms.js').Platform} Platform */

const MOCK_GAMELISTS = /** @type {Record<string, string>} */ ({ psx, psp, ps2, gc, wiiu, snes, n64, gba, n3ds, megadrive, dreamcast, xbox360 })
const LOG_MAX = 300
/** The libretro folder of each type that can be "downloaded" */
const LIBRETRO_FOLDERS = /** @type {Record<string, string>} */ ({ screenshots: 'Named_Snaps', titlescreens: 'Named_Titles' })

const pause = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ── Games ───────────────────────────────────────────────────────────────

/** The gamelists written in the browser (Y › Find info…) @returns {Record<string, string>} */
function writtenGamelists() {
  const saved = readDemo(DEMO_KEYS.gamelists, {})
  return saved && typeof saved === 'object' ? saved : {}
}

/**
 * The test gamelists. In English, with their descriptions and genres translated
 * (src/mock/en.json): with your USB drive, Relix shows what ES-DE left.
 * @returns {Record<string, string>}
 */
function gamelists() {
  const written = writtenGamelists()
  /** @type {{ descriptions: Record<string, string>, genres: Record<string, string> }} */
  const english = mockEnglish
  /** @param {string} xml */
  const swap = (xml) =>
    i18n.current !== 'en'
      ? xml
      : xml
          .replace(/<desc>([\s\S]*?)<\/desc>/g, (_, text) => `<desc>${english.descriptions[text] ?? text}</desc>`)
          .replace(/<genre>(.*?)<\/genre>/g, (_, text) => `<genre>${english.genres[text] ?? text}</genre>`)
  return Object.fromEntries(
    Object.entries(MOCK_GAMELISTS).map(([id, xml]) => [
      id,
      swap(written[id] ?? xml).replace(
        /<path>\.\/(.*?)<\/path>/g,
        (_, path) => `<path>./${renamed(id, path.replace(/&amp;/g, '&')).replace(/&/g, '&amp;')}</path>`,
      ),
    ]),
  )
}

/** @returns {RawLibrary} */
export function loadLibrary() {
  return {
    romRoot: 'E:\\roms',
    driveId: 'demo',
    mediaBase: null,
    thumbBase: null,
    gamelists: gamelists(),
    covers: coverFiles(PLATFORMS.map((p) => p.id)),
  }
}

/**
 * "Finds" the games in the test gamelists, with a pause so the scanning state shows.
 * @param {Platform[]} platforms
 */
export async function scanRoms(platforms) {
  await pause(150)
  /** @type {Record<string, RomScan>} */
  const roms = {}
  for (const p of platforms) {
    const xml = MOCK_GAMELISTS[p.id] ?? ''
    const listed = [...xml.matchAll(/<path>\.\/(.*?)<\/path>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
    const files = [...new Set([...listed, ...(DEMO_UNSCRAPED[p.id] ?? [])])].map((path) => renamed(p.id, path))
    roms[p.id] = { folder: p.id, files }
  }
  return roms
}

/** Shows the URI instead of opening an emulator @param {string} uri */
export function launch(uri) {
  window.dispatchEvent(new CustomEvent('relix:launch-preview', { detail: { uri } }))
}

/** @param {string} system */
export function readGamelist(system) {
  return gamelists()[system] ?? null
}

/** @param {string} system @param {string} text */
export async function writeGamelist(system, text) {
  await pause(150)
  writeDemo(DEMO_KEYS.gamelists, { ...writtenGamelists(), [system]: text })
  return true
}

// ── Covers and images ───────────────────────────────────────────────────
// A "downloaded" image is remembered by its name on libretro, and shown from there

/** @returns {Record<string, string>} "<console>/<key>" -> name on libretro */
const covers = () => readDemo(DEMO_KEYS.covers, {})
/** @returns {Record<string, string>} "<type>/<console>/<key>" -> name on libretro */
const media = () => readDemo(DEMO_KEYS.media, {})

/** @param {string[]} systemIds */
export function coverFiles(systemIds) {
  const saved = Object.keys(covers())
  return Object.fromEntries(
    systemIds.map((id) => [id, saved.filter((k) => k.startsWith(`${id}/`)).map((k) => `${k.slice(id.length + 1)}.png`)]),
  )
}

/** @param {Platform} platform */
export async function coverIndex(platform) {
  await pause(400)
  return /** @type {Record<string, string[]>} */ (mockCoverNames)[platform.id] ?? []
}

/**
 * @param {Platform} platform
 * @param {CoverDownload[]} items
 * @param {((done: number, total: number) => void) | undefined} onProgress
 * @param {'covers'|'screenshots'|'titlescreens'} kind
 */
export async function downloadCovers(platform, items, onProgress, kind) {
  const saved = kind === 'covers' ? covers() : media()
  const prefix = kind === 'covers' ? '' : `${kind}/`
  for (const [i, item] of items.entries()) {
    await pause(kind === 'covers' ? 90 : 40)
    saved[`${prefix}${platform.id}/${item.key}`] = item.remote
    onProgress?.(i + 1, items.length)
  }
  writeDemo(kind === 'covers' ? DEMO_KEYS.covers : DEMO_KEYS.media, saved)
  return { saved: items.map((i) => i.key), failed: [] }
}

/** @param {string} system @param {string} key */
export function deleteCover(system, key) {
  const saved = covers()
  delete saved[`${system}/${key}`]
  writeDemo(DEMO_KEYS.covers, saved)
  return true
}

/** @param {string[]} systemIds */
export function listMedia(systemIds) {
  const saved = Object.keys(media())
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

/** @param {string} system @param {string} type @param {string} file */
export function mediaFileUrl(system, type, file) {
  const remote = media()[`${type}/${system}/${file.replace(/\.[^./]+$/, '')}`]
  const platform = getPlatform(system)
  return remote && platform && LIBRETRO_FOLDERS[type] ? remoteCoverUrl(platform.libretro, remote, LIBRETRO_FOLDERS[type]) : ''
}

/** @param {string} system @param {string} file */
export function coverUrls(system, file) {
  const remote = covers()[`${system}/${file.replace(/\.[^./]+$/, '')}`]
  const platform = getPlatform(system)
  const url = remote && platform ? remoteCoverUrl(platform.libretro, remote) : ''
  return { cover: url, thumb: url }
}

// ── Collections ─────────────────────────────────────────────────────────

/** @returns {Record<string, string>} */
function collections() {
  return readDemo(DEMO_KEYS.collections, null) ?? demoCollectionSeed()
}

export function listCollections() {
  return Object.entries(collections()).map(([file, text]) => ({ file, text }))
}

/** @param {string} file @param {string} text  empty: delete it */
export function saveCollection(file, text) {
  const all = collections()
  if (text) all[file] = text
  else delete all[file]
  writeDemo(DEMO_KEYS.collections, all)
  return true
}

// ── Renaming ────────────────────────────────────────────────────────────

/** @returns {Array<{ system: string, from: string, to: string, folder: boolean }>} */
function renames() {
  const saved = readDemo(DEMO_KEYS.renames, [])
  return Array.isArray(saved) ? saved : []
}

/** A demo path with the renames done in the browser @param {string} system @param {string} path */
function renamed(system, path) {
  let current = path
  for (const r of renames()) {
    if (r.system !== system) continue
    const next = renamedKey(current, [r])
    if (next !== null) current = next
  }
  return current
}

/**
 * A path (or key) under its new name, or null if the renames don't touch it.
 * @param {string} key
 * @param {Array<{ from: string, to: string, folder?: boolean }>} list
 */
function renamedKey(key, list) {
  for (const r of list) {
    if (key.toLowerCase() === r.from.toLowerCase()) return r.to
    if (r.folder && key.toLowerCase().startsWith(`${r.from.toLowerCase()}/`)) return r.to + key.slice(r.from.length)
  }
  return null
}

/**
 * The browser remembers the new names, and the "downloaded" covers and images move along.
 * @param {string} system
 * @param {import('../core/rename.js').RenamePlan} plan
 * @param {boolean} preview  only count what would move
 * @returns {Promise<RenameResult>}
 */
export async function renameGame(system, plan, preview) {
  await pause(250)
  const coverStore = covers()
  const mediaStore = media()
  let movedMedia = 0
  /** @param {Record<string, string>} store @param {string} prefix */
  const move = (store, prefix) => {
    for (const key of Object.keys(store)) {
      if (!key.startsWith(prefix)) continue
      const next = renamedKey(key.slice(prefix.length), plan.media)
      if (next === null) continue
      movedMedia++
      if (!preview) {
        store[prefix + next] = store[key]
        delete store[key]
      }
    }
  }
  move(coverStore, `${system}/`)
  for (const type of new Set(Object.keys(mediaStore).map((k) => k.split('/')[0]))) move(mediaStore, `${type}/${system}/`)

  const listed = [...(gamelists()[system] ?? '').matchAll(/<path>\.\/(.*?)<\/path>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
  const gamelist = listed.filter((path) => renamedKey(path, plan.gamelist) !== null).length
  if (!preview) {
    writeDemo(DEMO_KEYS.covers, coverStore)
    writeDemo(DEMO_KEYS.media, mediaStore)
    writeDemo(DEMO_KEYS.renames, [
      ...renames(),
      ...plan.files.map((f) => ({ system, from: f.from, to: f.to, folder: plan.kind === 'folder' })),
    ])
  }
  return { files: plan.files.length, media: movedMedia, thumbnails: 0, gamelist, saves: 0, savesFolder: false, failed: 0, errors: [] }
}

// ── The Xbox ────────────────────────────────────────────────────────────

/** @param {string[]} protocols */
export function emulatorStatus(protocols) {
  return Object.fromEntries(protocols.map((p) => [p, DEMO_EMULATORS.has(p)]))
}

/** @param {string[]} folders */
export async function systemCheck(folders) {
  await pause(300)
  return demoSystemCheck(folders)
}

// ── Your data and the log ───────────────────────────────────────────────

/** @returns {import('../core/bridge.js').UserDataFile} */
export function loadUserData() {
  let text = null
  try {
    text = localStorage.getItem(DEMO_KEYS.userData)
  } catch {
    // no storage: the demo starts with the sample data
  }
  return { driveId: 'demo', text: text ?? DEMO_USERDATA, source: 'data.json' }
}

/** @param {string} text  the whole content of data.json */
export function saveUserData(text) {
  try {
    localStorage.setItem(DEMO_KEYS.userData, text)
  } catch {
    // no storage: forgotten on reload
  }
  return true
}

/** @returns {string[]} */
function log() {
  const saved = readDemo(DEMO_KEYS.log, [])
  return Array.isArray(saved) ? saved : []
}

/** @param {string[]} lines */
export function appendLog(lines) {
  writeDemo(DEMO_KEYS.log, [...log(), ...lines].slice(-LOG_MAX))
}

/** @param {number} count */
export function readLog(count) {
  return log().slice(-count)
}
