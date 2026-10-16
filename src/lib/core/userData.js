/**
 * Tus datos de Relix, guardados en el USB para que viajen con tus juegos:
 *
 *   E:\relix\datos.json                 lo último (se guarda solo tras cada cambio)
 *   E:\relix\datos.anterior.json        la versión justo antes de la última
 *   E:\relix\respaldos\datos-<día>.json una copia por día, las últimas 7
 *
 * Los juegos se identifican por su ruta dentro del USB ("ps2/Okami.chd"),
 * así que la letra del disco puede cambiar sin perder nada.
 *
 * Este módulo no toca archivos: arma y lee el contenido, decide qué copia
 * manda (la del USB o la de la app) y suma el tiempo de cada partida.
 */

export const DATA_VERSION = 1

/**
 * Lo que se respalda. Cada clave es también la que usa storage.js en la app.
 * No van los cachés (lista escaneada, miniaturas): se rearman solos.
 */
export const SYNCED_KEYS = /** @type {const} */ ([
  'favorites',
  'hidden',
  'recent',
  'lastPlayed',
  'playtime',
  'session',
  'coverChoices',
  'coverSkipped',
  'coverResults',
  'settings',
  'emulators',
  'gameEmulators',
])

/** Una partida de menos de esto no cuenta (el emulador no abrió, o fue un vistazo) */
export const MIN_SESSION_SECONDS = 60
/** Una partida de más de esto se descarta: seguro quedó abierta sin jugar */
export const MAX_SESSION_SECONDS = 12 * 60 * 60

/** @typedef {{ seconds: number, plays: number }} PlayStats */
/** @typedef {{ id: string, startedAt: number }} Session */
/** @typedef {Partial<Record<typeof SYNCED_KEYS[number], any>>} SyncedValues */

const isObject = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringArray = (/** @type {unknown} */ v) => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Revisa cada clave por separado: una dañada no arrastra a las demás */
const CHECKS = {
  favorites: isObject,
  hidden: isStringArray,
  recent: isStringArray,
  lastPlayed: isObject,
  playtime: isObject,
  session: (/** @type {any} */ v) => v === null || (isObject(v) && typeof v.id === 'string' && Number.isFinite(v.startedAt)),
  coverChoices: isObject,
  coverSkipped: isStringArray,
  coverResults: isObject,
  settings: isObject,
  emulators: isObject,
  gameEmulators: isObject,
}

/**
 * El contenido de datos.json, legible si lo abres en el PC.
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
 * Lee datos.json. Devuelve null si no es un archivo de Relix.
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
 * Qué copia manda al iniciar. El USB es la copia principal:
 *   'usb'    la del USB. Siempre que el archivo cambió por fuera de esta app
 *            (otra Xbox, o un respaldo que copiaste encima en el PC), si la app
 *            no tiene nada nuevo, o si lo de la app era de otro USB.
 *   'local'  la de la app: el USB sigue como Relix lo dejó y en la app hay
 *            cambios más nuevos (p. ej. el USB no dejaba escribir), o el USB
 *            aún no tiene datos (la primera vez: se copian).
 *   'fresh'  el USB no tiene datos y lo de la app es de OTRO USB: se parte de
 *            cero en este (solo se conservan las preferencias).
 *
 * @param {{ savedAt: number } | null} usb   lo leído del USB (null = no hay archivo)
 * @param {{ savedAt: number, synced: number, drive: string }} local
 *   savedAt: último cambio en la app; synced: fecha del último datos.json que
 *   la app escribió o leyó; drive vacío = datos de antes del respaldo
 * @param {string} drive  el USB conectado ahora
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
 * Cierra la partida en curso y suma su tiempo al juego.
 * @param {Record<string, PlayStats>} playtime
 * @param {Session|null} session
 * @param {number} now  ms
 * @returns {{ playtime: Record<string, PlayStats>, seconds: number }}
 *   seconds: lo que se sumó (0 si la partida no cuenta)
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
 * Juegos con más tiempo, de mayor a menor.
 * @param {Record<string, PlayStats>} playtime
 * @param {(id: string) => boolean} [keep]  p. ej. solo los que siguen en el USB
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
 * Tiempo total jugado.
 * @param {Record<string, PlayStats>} playtime
 * @param {(id: string) => boolean} [keep]
 */
export function totalSeconds(playtime, keep = () => true) {
  return Object.entries(playtime).reduce((sum, [id, s]) => sum + (keep(id) ? s.seconds : 0), 0)
}
