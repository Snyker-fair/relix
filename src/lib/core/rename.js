/**
 * Renaming a game's file on the USB drive (Y › Rename file…, and Options ›
 * Library › File names for the ones without a standard name).
 *
 * What gets renamed is the part of the path the game's name comes from:
 *   "kingdom_hearts_2.iso"          -> the file:   "Kingdom Hearts II (USA).iso"
 *   "Halo 3/default.xex"            -> the folder: "Halo 3 (USA)/default.xex"
 *   "Zelda [ABC]/code/zelda.rpx"    -> the folder (Wii U in folders)
 *   "ff7 (Disc 1).chd"              -> every disc: "Final Fantasy VII (USA) (Disc 1).chd",
 *                                      "... (Disc 2).chd"...
 * A .cue, .gdi or .m3u is renamed alone: it points to its tracks or discs by
 * their own names, which don't change.
 *
 * Everything tied to the old name moves with it. The shell renames the files on
 * the drive (the game, ES-DE's images, Relix's thumbnails, its entry in ES-DE's
 * gamelist.xml and RetroArch's saves); this module plans that and moves Relix's
 * own data (playtime, favorites, collections...) to the new id.
 */
import { lineForGame, resolveLine } from './collections.js'
import { fileStem, normalizeRelativePath, titleFolderIndex } from './esde.js'
import { renameInPlayDays } from './playDays.js'

const DISC = /\s*\(Disc\s*(\d+)(?:\s*of\s*\d+)?\)/i
/** Windows doesn't accept these in a file or folder name */
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/
/** Names Windows keeps for devices ("con", "nul.txt"...) */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
export const MAX_NAME_LENGTH = 120

/** What each step moves, for the log when one fails (translated with t()) */
export const RENAME_STEPS = {
  media: 'las imágenes de ES-DE',
  thumbnails: 'las miniaturas de Relix',
  gamelist: 'su ficha en gamelist.xml',
  saves: 'las partidas de RetroArch',
  collections: 'las colecciones',
}

/** What each error means, in words (the screens translate it with t()) */
export const RENAME_ERRORS = /** @type {Record<RenameError, string>} */ ({
  empty: 'Escribe un nombre.',
  chars: 'El nombre no puede llevar ninguno de estos signos: \\ / : * ? " < > |',
  reserved: 'Windows no deja usar ese nombre.',
  long: 'El nombre es demasiado largo (120 letras como mucho).',
  dot: 'El nombre no puede terminar en punto ni en espacio.',
  same: 'El archivo ya se llama así.',
  exists: 'Ya hay otro archivo con ese nombre en la carpeta.',
})

/**
 * @typedef {{ from: string, to: string }} Rename
 *   paths relative to the console's folder in roms (or stems, for saves), with "/"
 * @typedef {{ from: string, to: string, folder: boolean }} PathRename
 *   folder: a whole folder is renamed (and everything inside it moves along)
 *
 * @typedef {Object} RenamePlan
 * @property {'file'|'folder'} kind
 * @property {string} newPath        the game's new path
 * @property {Rename[]} files        what's renamed in roms\<console>\
 * @property {PathRename[]} media    in downloaded_media\<console>\<type>\ and the thumbnails:
 *                                   paths without extension (any extension moves) or folders
 * @property {PathRename[]} gamelist the <path> entries of ES-DE's gamelist.xml
 * @property {Rename[]} saves        file stems for RetroArch's saves and states
 *
 * @typedef {'empty'|'chars'|'reserved'|'long'|'dot'|'same'|'exists'} RenameError
 */

/** "Sub/Game.chd" -> ".chd" (with its case); "" if there's none */
function extensionOf(/** @type {string} */ path) {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : ''
}

/** "Sub/Game.chd" -> "Sub/Game" */
function withoutExtension(/** @type {string} */ path) {
  const ext = extensionOf(path)
  return ext ? path.slice(0, -ext.length) : path
}

/** "Sub/Game.chd" -> "sub" */
function folderOf(/** @type {string} */ path) {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(0, i) : ''
}

/**
 * What a game's name comes from, and what it's called now.
 * @param {{ path: string }} game
 * @returns {{ kind: 'file'|'folder', name: string, extension: string, index: number }}
 *   index: for a folder, its position in the path's parts
 */
export function renameTarget(game) {
  const path = normalizeRelativePath(game.path)
  const index = titleFolderIndex(path)
  if (index >= 0) return { kind: 'folder', name: path.split('/')[index], extension: '', index }
  return { kind: 'file', name: fileStem(path), extension: extensionOf(path), index: -1 }
}

/**
 * Whether a name can be a file or folder name on the USB drive. null if it can.
 * @param {string} name  without the extension
 * @returns {RenameError | null}
 */
export function checkName(name) {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'
  if (FORBIDDEN.test(trimmed)) return 'chars'
  if (RESERVED.test(trimmed)) return 'reserved'
  if (trimmed.length > MAX_NAME_LENGTH) return 'long'
  if (/[. ]$/.test(trimmed)) return 'dot'
  return null
}

/**
 * Everything that has to be renamed so the game is called `newName`.
 * @param {{ path: string }} game
 * @param {string} newName  without the extension (it stays the same)
 * @param {string[]} files  every file in the console's folder (the scan), relative with "/"
 * @returns {{ plan: RenamePlan, error?: undefined } | { plan?: undefined, error: RenameError }}
 */
export function planRename(game, newName, files) {
  const name = newName.trim()
  const invalid = checkName(name)
  if (invalid) return { error: invalid }

  const target = renameTarget(game)
  if (name === target.name) return { error: 'same' }

  const path = normalizeRelativePath(game.path)
  const paths = files.map(normalizeRelativePath)
  const parts = path.split('/')

  if (target.kind === 'folder') {
    const from = parts.slice(0, target.index + 1).join('/')
    const renamed = [...parts]
    renamed[target.index] = name
    const to = renamed.slice(0, target.index + 1).join('/')
    const caseOnly = from.toLowerCase() === to.toLowerCase()
    const prefix = `${to.toLowerCase()}/`
    if (!caseOnly && paths.some((p) => p.toLowerCase().startsWith(prefix))) return { error: 'exists' }
    return {
      plan: {
        kind: 'folder',
        newPath: renamed.join('/'),
        files: [{ from, to }],
        media: [{ from, to, folder: true }],
        gamelist: [{ from, to, folder: true }],
        saves: [],
      },
    }
  }

  // A file: and, if it's disc 1 without an .m3u, its other discs too
  const dir = folderOf(path)
  const prefix = dir ? `${dir}/` : ''
  const disc = DISC.exec(target.name)
  /** @type {Rename[]} */
  let renames
  if (disc && !/\.m3u$/i.test(path)) {
    const base = target.name.replace(DISC, '').toLowerCase()
    const extension = target.extension.toLowerCase()
    const template = DISC.test(name) ? name : `${name} (Disc 1)`
    renames = paths
      .filter((p) => {
        const stem = fileStem(p)
        return (
          folderOf(p).toLowerCase() === dir.toLowerCase() &&
          extensionOf(p).toLowerCase() === extension &&
          DISC.test(stem) &&
          stem.replace(DISC, '').toLowerCase() === base
        )
      })
      .map((p) => {
        const number = DISC.exec(fileStem(p))?.[1] ?? '1'
        return { from: p, to: `${prefix}${template.replace(DISC, ` (Disc ${number})`)}${extensionOf(p)}` }
      })
    if (!renames.some((r) => r.from.toLowerCase() === path.toLowerCase())) {
      renames.unshift({ from: path, to: `${prefix}${template.replace(DISC, ` (Disc ${disc[1]})`)}${target.extension}` })
    }
  } else {
    renames = [{ from: path, to: `${prefix}${name}${target.extension}` }]
  }

  // The new names can't be taken by another file (a case-only change is fine)
  const existing = new Set(paths.map((p) => p.toLowerCase()))
  const moving = new Set(renames.map((r) => r.from.toLowerCase()))
  if (renames.some((r) => existing.has(r.to.toLowerCase()) && !moving.has(r.to.toLowerCase()))) {
    return { error: 'exists' }
  }

  const self = renames.find((r) => r.from.toLowerCase() === path.toLowerCase())
  return {
    plan: {
      kind: 'file',
      newPath: self?.to ?? path,
      files: renames,
      media: renames.map((r) => ({ from: withoutExtension(r.from), to: withoutExtension(r.to), folder: false })),
      gamelist: renames.map((r) => ({ ...r, folder: false })),
      saves: renames.map((r) => ({ from: fileStem(r.from), to: fileStem(r.to) })),
    },
  }
}

/**
 * Relix's data moved from a game's old id to its new one: favorites, hidden,
 * playtime (and its days), recent, the session in progress, the cover choices and its emulator.
 * Only the keys that change come back.
 * @param {Record<string, any>} values  as readSynced() returns them
 * @param {string} oldId
 * @param {string} newId
 * @returns {Record<string, any>}
 */
export function renameInUserData(values, oldId, newId) {
  /** @type {Record<string, any>} */
  const changed = {}
  /** @param {string} key @param {any} value */
  const set = (key, value) => (changed[key] = value)

  for (const key of ['favorites', 'lastPlayed', 'playtime', 'gameEmulators']) {
    const obj = values[key]
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && oldId in obj) {
      const { [oldId]: value, ...rest } = obj
      set(key, { ...rest, [newId]: value })
    }
  }
  for (const key of ['hidden', 'recent', 'coverSkipped', 'renameSkipped', 'infoSkipped']) {
    const list = values[key]
    if (Array.isArray(list) && list.includes(oldId)) set(key, list.map((id) => (id === oldId ? newId : id)))
  }
  const days = values.playDays
  if (days && typeof days === 'object' && !Array.isArray(days)) {
    const next = renameInPlayDays(days, oldId, newId)
    if (next) set('playDays', next)
  }
  const session = values.session
  if (session && typeof session === 'object' && session.id === oldId) set('session', { ...session, id: newId })
  const choices = values.coverChoices
  if (choices && typeof choices === 'object' && !Array.isArray(choices)) {
    let touched = false
    const next = Object.fromEntries(
      Object.entries(choices).map(([system, ids]) => {
        if (!Array.isArray(ids) || !ids.includes(oldId)) return [system, ids]
        touched = true
        return [system, ids.map((id) => (id === oldId ? newId : id))]
      }),
    )
    if (touched) set('coverChoices', next)
  }
  return changed
}

/**
 * A collection's lines with the game at its new path, in the same place.
 * @param {string[]} lines
 * @param {{ system: string, path: string }} game  as it was before
 * @param {string} newPath
 * @param {string} folder  its console's real folder inside roms
 * @param {Map<string, string>} folderToSystem
 * @param {string} [romRoot]
 * @returns {string[] | null}  null if the game isn't in it
 */
export function renameInCollection(lines, game, newPath, folder, folderToSystem, romRoot) {
  const key = `${game.system}/${game.path}`.toLowerCase()
  let found = false
  const next = lines.map((line) => {
    const resolved = resolveLine(line, folderToSystem, romRoot)
    if (!resolved || `${resolved.system}/${resolved.path}`.toLowerCase() !== key) return line
    found = true
    return lineForGame(folder, newPath)
  })
  return found ? next : null
}

/**
 * A path under its new name, or null if the renames don't touch it.
 * @param {string} path  relative to the console's folder, with "/"
 * @param {Array<{ from: string, to: string, folder?: boolean }>} renames
 */
export function movedPath(path, renames) {
  const normalized = normalizeRelativePath(path)
  const lower = normalized.toLowerCase()
  for (const r of renames) {
    if (lower === r.from.toLowerCase()) return r.to
    if (r.folder && lower.startsWith(`${r.from.toLowerCase()}/`)) return r.to + normalized.slice(r.from.length)
  }
  return null
}
