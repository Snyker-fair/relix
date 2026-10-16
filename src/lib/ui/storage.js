/**
 * Guardado local de lo que haces en Relix (favoritos, ocultos, tiempo de
 * juego, preferencias...). En la Xbox, el localStorage de WebView2 vive en
 * los datos de la app; en el navegador puede no estar disponible, así que
 * todo va en try/catch y la app funciona igual sin él.
 *
 * Las claves de SYNCED_KEYS además se respaldan en el USB (E:\relix\datos.json):
 * cada vez que cambia una, se anota la hora y se avisa a userData.svelte.js,
 * que guarda el archivo unos segundos después.
 */
import { SYNCED_KEYS } from '../core/userData.js'

const PREFIX = 'relix:'
const SYNCED = new Set(/** @type {readonly string[]} */ (SYNCED_KEYS))
/** Cuándo cambió por última vez algo de lo que se respalda (ms) */
const SAVED_AT = 'dataSavedAt'
/** De qué USB son los datos guardados en la app */
const DRIVE = 'dataDrive'
/** Fecha (savedAt) del último datos.json que la app escribió o leyó */
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
    // sin almacenamiento: seguimos solo en memoria
  }
}

/** @param {string} key */
function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // nada que borrar
  }
}

/** Avisa cuando cambia algo que se respalda en el USB. @param {(key: string) => void} fn */
export function watchSynced(fn) {
  onSyncedChange = fn
}

/**
 * Para que un estado vuelva a leer sus claves cuando llegan los datos del USB
 * (al iniciar, o si el USB aparece después).
 * @param {() => void} fn
 */
export function onReplaced(fn) {
  onReplacedFns.add(fn)
}

/** Lo que se respalda, tal como está guardado en la app */
export function readSynced() {
  /** @type {Record<string, unknown>} */
  const values = {}
  for (const key of SYNCED_KEYS) {
    const value = load(key, undefined)
    if (value !== undefined) values[key] = value
  }
  return values
}

/** Fecha, sincronía y USB de los datos que tiene la app */
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

/** El USB quedó con los datos de esta fecha. @param {number} savedAt */
export function markSynced(savedAt) {
  write(SYNCED_AT, savedAt)
}

/**
 * Reemplaza lo que tiene la app por los datos del USB y avisa a cada estado
 * para que los vuelva a leer.
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
