/**
 * Local storage of what you do in Relix (favorites, hidden games, playtime,
 * preferences...). On the Xbox, WebView2's localStorage lives in the
 * app's data; in the browser it may not be available, so
 * everything goes in try/catch and the app works the same without it.
 *
 * The SYNCED_KEYS keys are also backed up on the USB drive (E:\relix\data.json):
 * each time one changes, the time is noted and userData.svelte.js is told,
 * and it saves the file a few seconds later.
 */
import { SYNCED_KEYS } from '../core/userData.js'

const PREFIX = 'relix:'
const SYNCED = new Set(/** @type {readonly string[]} */ (SYNCED_KEYS))
/** When something that gets backed up last changed (ms) */
const SAVED_AT = 'dataSavedAt'
/** Which USB drive the data saved in the app belongs to */
const DRIVE = 'dataDrive'
/** The date (savedAt) of the last data.json the app wrote or read */
const SYNCED_AT = 'dataSyncedAt'

/** @type {((key: string) => void) | null} */
let onSyncedChange = null
/** @type {Set<() => void>} */
const onReplacedFns = new Set()

/** @template T @param {string} key @param {T} fallback @returns {T} */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** @param {string} key @param {unknown} value */
export function save(key, value) {
  write(key, value)
  if (SYNCED.has(key)) {
    write(SAVED_AT, Date.now())
    onSyncedChange?.(key)
  }
}

/** @param {string} key @param {unknown} value */
function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // no storage: we carry on in memory only
  }
}

/** @param {string} key */
function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // nothing to delete
  }
}

/** Reports when something that's backed up on the USB drive changes. @param {(key: string) => void} fn */
export function watchSynced(fn) {
  onSyncedChange = fn
}

/**
 * So a state reads its keys again when the data from the USB drive arrives
 * (at startup, or if the drive shows up later).
 * @param {() => void} fn
 */
export function onReplaced(fn) {
  onReplacedFns.add(fn)
}

/** What gets backed up, as it's saved in the app */
export function readSynced() {
  /** @type {Record<string, unknown>} */
  const values = {}
  for (const key of SYNCED_KEYS) {
    const value = load(key, undefined)
    if (value !== undefined) values[key] = value
  }
  return values
}

/** The date, sync and USB drive of the data the app has */
export function localMeta() {
  return {
    savedAt: Number(load(SAVED_AT, 0)) || 0,
    synced: Number(load(SYNCED_AT, 0)) || 0,
    drive: String(load(DRIVE, '')),
  }
}

/** @param {string} drive */
export function setLocalDrive(drive) {
  write(DRIVE, drive)
}

/** The USB drive now has the data from this date. @param {number} savedAt */
export function markSynced(savedAt) {
  write(SYNCED_AT, savedAt)
}

/**
 * Replaces what the app has with the data from the USB drive and tells each state
 * to read it again.
 * @param {Record<string, unknown>} values
 * @param {number} savedAt
 * @param {string} drive
 */
export function replaceSynced(values, savedAt, drive) {
  for (const key of SYNCED_KEYS) {
    if (values[key] !== undefined) write(key, values[key])
    else remove(key)
  }
  write(SAVED_AT, savedAt)
  write(SYNCED_AT, savedAt)
  write(DRIVE, drive)
  for (const fn of onReplacedFns) fn()
}
