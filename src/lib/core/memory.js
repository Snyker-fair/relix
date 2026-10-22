/**
 * Relix's memory, for the diagnostic log. As an App on the Xbox it gets about
 * 1 GB (128 MB while a game plays), so what weighs is measured instead of guessed:
 * when it opens, before each game and every new peak, with what was on screen and
 * whether a preview video was playing. That's what says whether the videos stay.
 * The request is in ui/memory.svelte.js; here is the pure part.
 */
import { t } from '../i18n/i18n.svelte.js'
import { formatBytes } from './systemCheck.js'

/** A peak is logged again only once it's this much above the last one logged */
export const PEAK_STEP = 32 * 1024 ** 2

/**
 * Whether a sample is a peak worth logging.
 * @param {number} logged  the highest one logged (0: none yet)
 * @param {number} usage
 */
export function isNewPeak(logged, usage) {
  return usage > 0 && usage >= logged + PEAK_STEP
}

/**
 * A line for the log: "Peak: 412 MB of 1.0 GB · PS2 library · with a video".
 * @param {'start' | 'peak' | 'game' | 'high' | 'freed'} kind  start: when Relix opens; game: before
 *   one opens; high: the Xbox says it's near the limit and WebView2 lets go of what it keeps;
 *   freed: a moment later
 * @param {import('./systemCheck.js').ShellMemory} memory
 * @param {{ where?: string, video?: boolean, game?: string }} [context]
 */
export function memoryText(kind, memory, { where = '', video = false, game = '' } = {}) {
  const amounts = { usage: formatBytes(memory.usage), limit: formatBytes(memory.expectedLimit || memory.limit) }
  const first =
    kind === 'start'
      ? t('Al abrir Relix: {usage} de {limit}', amounts)
      : kind === 'game'
        ? t('Al abrir {game}: {usage} de {limit}', { ...amounts, game })
        : kind === 'high'
          ? t('Memoria alta, liberando: {usage} de {limit}', amounts)
          : kind === 'freed'
            ? t('Tras liberar: {usage} de {limit}', amounts)
            : t('Máximo: {usage} de {limit}', amounts)
  return [first, where, video ? t('con video') : ''].filter(Boolean).join(' · ')
}
