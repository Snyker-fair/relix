/**
 * After a scan, Relix also looks for what the scanned consoles' games are missing:
 * covers and screenshots (libretro) and descriptions (Wikipedia, only the sure
 * matches). That way copying the games and scanning is all there is to do. What it
 * isn't sure of stays to pick by hand, as before. The work is in ui/afterScan.svelte.js;
 * here is what it says when it's done.
 */
import { listJoin, plural, t } from '../i18n/i18n.svelte.js'

/**
 * @typedef {Object} AfterScanResult
 * @property {number} covers        covers saved
 * @property {number} info          games that got their description
 * @property {number} coversToChoose  covers with only similar names (Options › Covers › Pick by hand)
 * @property {number} infoToChoose  games with only similar names (Options › Library › Game info)
 * @property {boolean} offline      it couldn't connect: only the scan was done
 */

/** @returns {AfterScanResult} */
export const emptyAfterScan = () => ({ covers: 0, info: 0, coversToChoose: 0, infoToChoose: 0, offline: false })

/**
 * The notice when it's done, or null if there's nothing to say.
 * @param {AfterScanResult} result
 */
export function afterScanText(result) {
  if (result.offline) {
    return t('Sin conexión a internet: tus juegos ya están, pero sus portadas y su información quedan para después.')
  }
  const saved = [
    result.covers > 0 ? plural(result.covers, 'portada', 'portadas') : '',
    result.info > 0 ? plural(result.info, 'descripción', 'descripciones') : '',
  ].filter(Boolean)
  const toChoose = [
    result.coversToChoose > 0
      ? t('{covers} en Portadas', { covers: plural(result.coversToChoose, 'portada', 'portadas') })
      : '',
    result.infoToChoose > 0
      ? t('{games} en Información de los juegos', { games: plural(result.infoToChoose, 'juego', 'juegos') })
      : '',
  ].filter(Boolean)
  const parts = [
    saved.length > 0 ? t('Listo: {saved}.', { saved: listJoin(saved) }) : '',
    toChoose.length > 0 ? t('Por elegir a mano: {list}.', { list: listJoin(toChoose) }) : '',
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}
