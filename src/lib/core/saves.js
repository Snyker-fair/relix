/**
 * A game's saves in RetroArch's folders on the USB drive (the shell lists them,
 * see SaveIndex.cs): when you last saved, how many quick saves there are and the
 * picture of the newest one, like a memory card's icons.
 *
 * RetroArch names them after the game's file, the same names renaming moves
 * (RomRenamer.cs): "Crash Bandicoot (USA).srm", ".state1", ".state1.png"...
 */
import { fileStem } from './esde.js'

/** @typedef {{ path: string, size: number, modified: number }} SaveFile  path: "states/SwanStation/Game.state1" */
/** @typedef {SaveFile & { name: string, kind: 'save' | 'state' | 'picture' }} SaveEntry */
/**
 * @typedef {Object} GameSaves
 * @property {number | null} save        when the game's own save last changed (ms)
 * @property {number} states             how many quick saves it has
 * @property {number | null} lastState   when the newest quick save was made (ms)
 * @property {SaveFile | null} picture   the newest quick save's picture
 */

/**
 * The name split into the game and the kind of save.
 *   .srm .sav .rtc .eep .sra .fla .mpk .mcd .mcr .ldci   the game's own save (battery, memory card…)
 *   .state .state1… .state.auto                          RetroArch's quick saves
 *   the same + .png                                      their pictures
 */
const SAVE_NAME = /^(.+?)(\.state(?:\d+|\.auto)?\.png|\.state(?:\d+|\.auto)?|\.(?:srm|sav|rtc|eep|sra|fla|mpk|mcd|mcr|ldci))$/i

/**
 * "Game.state1.png" -> { stem: "Game", kind: "picture" }; null if it isn't a save.
 * @param {string} name
 * @returns {{ stem: string, kind: SaveEntry['kind'] } | null}
 */
export function saveName(name) {
  const match = SAVE_NAME.exec(name)
  if (!match) return null
  const suffix = match[2].toLowerCase()
  return { stem: match[1], kind: suffix.endsWith('.png') ? 'picture' : suffix.startsWith('.state') ? 'state' : 'save' }
}

/**
 * The files grouped by game: by the name before the save's extension, in lowercase
 * (the Xbox doesn't tell letter case apart).
 * @param {SaveFile[]} files
 * @returns {Map<string, SaveEntry[]>}
 */
export function indexSaves(files) {
  /** @type {Map<string, SaveEntry[]>} */
  const index = new Map()
  for (const file of files) {
    const name = file.path.split('/').pop() ?? ''
    const parsed = saveName(name)
    if (!parsed || !(file.modified > 0)) continue
    const key = parsed.stem.toLowerCase()
    const list = index.get(key) ?? []
    list.push({ ...file, name, kind: parsed.kind })
    index.set(key, list)
  }
  return index
}

/**
 * What a game has saved: RetroArch uses the name of the file it opened (for a
 * game with several discs, the .m3u).
 * @param {{ path: string }} game
 * @param {Map<string, SaveEntry[]>} index
 * @returns {GameSaves | null}  null if it has nothing saved
 */
export function savesFor(game, index) {
  const entries = index.get(fileStem(game.path).toLowerCase())
  if (!entries) return null
  const saves = entries.filter((e) => e.kind === 'save')
  const states = entries.filter((e) => e.kind === 'state').sort((a, b) => b.modified - a.modified)
  if (saves.length === 0 && states.length === 0) return null
  const newest = states[0]
  const picture = newest
    ? (entries.find((e) => e.kind === 'picture' && e.name.toLowerCase() === `${newest.name.toLowerCase()}.png`) ?? null)
    : null
  return {
    save: saves.length > 0 ? Math.max(...saves.map((s) => s.modified)) : null,
    states: states.length,
    lastState: newest ? newest.modified : null,
    picture: picture ? { path: picture.path, size: picture.size, modified: picture.modified } : null,
  }
}
