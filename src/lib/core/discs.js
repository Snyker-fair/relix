/**
 * Games on several discs (PS1, Dreamcast) copied without an .m3u: Final Fantasy
 * VII as three .chd files. To change discs the emulator needs the list of all of
 * them, an .m3u, and making one by hand is a step outside Relix. So Relix makes
 * it when you open the game, in its own folder, without touching your games:
 *
 *   E:\relix\discs\psx\Final Fantasy VII (USA) (Disc 1).m3u
 *     E:\roms\psx\Final Fantasy VII (USA) (Disc 1).chd
 *     E:\roms\psx\Final Fantasy VII (USA) (Disc 2).chd
 *     ...
 *
 * It's named like disc 1 so the emulator keeps using the same saves (memory
 * card, save states) as when it opened disc 1 alone. The scan gathers the discs
 * (core/scan.js › discs); the shell writes the file (DiscLists.cs).
 */
import { fileStem } from './esde.js'
import { t } from '../i18n/i18n.svelte.js'

/**
 * The list's name: disc 1's, without its extension.
 * @param {string} disc1  disc 1's relative path ("Sub/Game (USA) (Disc 1).chd")
 */
export function discListName(disc1) {
  return fileStem(disc1)
}

/**
 * The .m3u's content: one disc per line, with its full path.
 * @param {string[]} absolutePaths  in order
 */
export function discListText(absolutePaths) {
  return absolutePaths.map((p) => `${p}\r\n`).join('')
}

/**
 * How many discs a game has, if it's more than one (an .m3u you made doesn't count:
 * Relix doesn't read it).
 * @param {{ discs?: string[] }} game
 */
export function discCount(game) {
  return game.discs && game.discs.length > 1 ? game.discs.length : 0
}

/**
 * Where to change discs, said when the game opens.
 * @param {number} discs
 * @param {{ launcher: { kind: string } }} emulator
 */
export function discSwapHint(discs, emulator) {
  return emulator.launcher.kind === 'retroarch'
    ? t('Tiene {n} discos: cuando pida otro, cámbialo en el menú de RetroArch › Disc Control.', { n: discs })
    : t('Tiene {n} discos: cuando pida otro, cámbialo desde el menú del emulador.', { n: discs })
}
