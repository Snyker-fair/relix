/**
 * Your Relix data, saved on the USB drive so it travels with your games:
 *
 *   E:\relix\data.json                  the latest (saved by itself after each change)
 *   E:\relix\data.previous.json         the version right before the latest
 *   E:\relix\backups\data-<day>.json    a copy per day, the last 7
 *
 * Games are identified by their path inside the USB drive ("ps2/Okami.chd"),
 * so the drive letter can change without losing anything.
 *
 * This module doesn't touch files: it builds and reads the content, decides which
 * copy rules (the USB drive's or the app's) and adds up each session's time.
 */

import { cleanPlayDays } from './playDays.js'

export const DATA_VERSION = 1

/**
 * What gets backed up. Each key is also the one storage.js uses in the app.
 * The caches (scanned list, thumbnails) don't go: they rebuild themselves.
 */
export const SYNCED_KEYS = /** @type {const} */ ([
  'favorites',
  'hidden',
  'recent',
  'lastPlayed',
  'playtime',
  'playDays',
  'newGames',
  'session',
  'coverChoices',
  'coverSkipped',
  'coverResults',
  'settings',
  'emulators',
  'gameEmulators',
  'renameSkipped',
  'infoSkipped',
])

/** A session shorter than this doesn't count (the emulator didn't open, or it was a quick look) */
export const MIN_SESSION_SECONDS = 60
/** A session longer than this is dropped: it surely stayed open without playing */
export const MAX_SESSION_SECONDS = 12 * 60 * 60

/** @typedef {{ seconds: number, plays: number }} PlayStats */
/**
 * @typedef {{ id: string, startedAt: number, from?: import('./place.js').Place }} Session
 *   from: where you were when it opened (to go back there if the Xbox closes Relix)
 */
/** @typedef {Partial<Record<typeof SYNCED_KEYS[number], any>>} SyncedValues */

const isObject = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringArray = (/** @type {unknown} */ v) => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Checks each key separately: a damaged one doesn't drag down the others */
const CHECKS = {
  favorites: isObject,
  hidden: isStringArray,
  recent: isStringArray,
  lastPlayed: isObject,
  playtime: isObject,
  playDays: isObject,
  newGames: isObject,
  session: (/** @type {any} */ v) => v === null || (isObject(v) && typeof v.id === 'string' && Number.isFinite(v.startedAt)),
  coverChoices: isObject,
  coverSkipped: isStringArray,
  coverResults: isObject,
  settings: isObject,
  emulators: isObject,
  gameEmulators: isObject,
  renameSkipped: isStringArray,
  infoSkipped: isStringArray,
}

/**
 * The content of data.json, readable if you open it on the PC.
 * @param {SyncedValues} values
 * @param {number} savedAt  ms
 */
export function serializeUserData(values, savedAt) {
  /** @type {Record<string, unknown>} */
  const data = { app: 'relix', version: DATA_VERSION, savedAt: new Date(savedAt).toISOString() }
  for (const key of SYNCED_KEYS) {
    if (values[key] !== undefined) data[key] = values[key]
  }
  return JSON.stringify(data, null, 2) + '\n'
}

/**
 * Reads data.json. Returns null if it isn't a Relix file.
 * @param {string|null|undefined} text
 * @returns {{ savedAt: number, values: SyncedValues } | null}
 */
export function parseUserData(text) {
  if (!text) return null
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(data) || data.app !== 'relix') return null

  /** @type {SyncedValues} */
  const values = {}
  for (const key of SYNCED_KEYS) {
    if (key in data && CHECKS[key](data[key])) values[key] = data[key]
  }
  if (values.playtime) values.playtime = cleanPlaytime(values.playtime)
  if (values.playDays) values.playDays = cleanPlayDays(values.playDays)
  return { savedAt: Date.parse(data.savedAt) || 0, values }
}

/** @param {Record<string, any>} playtime @returns {Record<string, PlayStats>} */
function cleanPlaytime(playtime) {
  /** @type {Record<string, PlayStats>} */
  const clean = {}
  for (const [id, stats] of Object.entries(playtime)) {
    const seconds = Math.round(Number(stats?.seconds))
    const plays = Math.round(Number(stats?.plays))
    if (seconds > 0) clean[id] = { seconds, plays: plays > 0 ? plays : 1 }
  }
  return clean
}

/**
 * Which copy rules at startup. The USB drive is the main copy:
 *   'usb'    the USB drive's. Whenever the file changed outside this app
 *            (another Xbox, or a backup you copied over it on the PC), if the app
 *            has nothing new, or if the app's data was from another USB drive.
 *   'local'  the app's: the USB drive is as Relix left it and the app has
 *            newer changes (e.g. the drive couldn't be written to), or the drive
 *            has no data yet (the first time: they're copied).
 *   'fresh'  the USB drive has no data and the app's is from ANOTHER drive: this
 *            one starts from scratch (only the preferences are kept).
 *
 * @param {{ savedAt: number } | null} usb   what was read from the USB drive (null = no file)
 * @param {{ savedAt: number, synced: number, drive: string }} local
 *   savedAt: the last change in the app; synced: the date of the last data.json
 *   the app wrote or read; an empty drive = data from before the backup existed
 * @param {string} drive  the USB drive plugged in now
 * @returns {'usb'|'local'|'fresh'}
 */
export function chooseSource(usb, local, drive) {
  const sameDrive = !local.drive || local.drive === drive
  if (!sameDrive) return usb ? 'usb' : 'fresh'
  if (!usb) return 'local'
  if (usb.savedAt !== local.synced) return 'usb'
  return local.savedAt > usb.savedAt ? 'local' : 'usb'
}

/**
 * Closes the session in progress and adds its time to the game.
 * @param {Record<string, PlayStats>} playtime
 * @param {Session|null} session
 * @param {number} now  ms
 * @returns {{ playtime: Record<string, PlayStats>, seconds: number }}
 *   seconds: what was added (0 if the session doesn't count)
 */
export function closeSession(playtime, session, now) {
  if (!session) return { playtime, seconds: 0 }
  const seconds = Math.round((now - session.startedAt) / 1000)
  if (seconds < MIN_SESSION_SECONDS || seconds > MAX_SESSION_SECONDS) return { playtime, seconds: 0 }
  const before = playtime[session.id] ?? { seconds: 0, plays: 0 }
  return {
    playtime: { ...playtime, [session.id]: { seconds: before.seconds + seconds, plays: before.plays + 1 } },
    seconds,
  }
}

/**
 * The games with the most time, from most to least.
 * @param {Record<string, PlayStats>} playtime
 * @param {(id: string) => boolean} [keep]  e.g. only the ones still on the USB drive
 * @param {number} [limit]
 */
export function mostPlayed(playtime, keep = () => true, limit = 3) {
  return Object.entries(playtime)
    .filter(([id, stats]) => stats.seconds > 0 && keep(id))
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, limit)
    .map(([id, stats]) => ({ id, ...stats }))
}

/**
 * Total time played.
 * @param {Record<string, PlayStats>} playtime
 * @param {(id: string) => boolean} [keep]
 */
export function totalSeconds(playtime, keep = () => true) {
  return Object.entries(playtime).reduce((sum, [id, s]) => sum + (keep(id) ? s.seconds : 0), 0)
}
