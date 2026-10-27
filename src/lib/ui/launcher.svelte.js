/**
 * Opening a game and coming back from it: the emulator's URI, the "Opening…"
 * screen, the session that counts the time played, and what Relix says when you
 * come back (the time played, or what to check if the game didn't start).
 */
import { launch, ShellError, writeDiscList } from '../core/bridge.js'
import { shortDuration } from '../core/diagnostics.js'
import { discCount, discListName, discListText, discSwapHint } from '../core/discs.js'
import { buildLaunchUri } from '../core/launchUri.js'
import { playtimeNotice } from '../core/notices.js'
import { getPlatform } from '../core/platforms.js'
import { QUICK_EXIT_SECONDS, quickExitMessage } from '../core/quickExit.js'
import { t } from '../i18n/i18n.svelte.js'
import { activity } from './activity.svelte.js'
import { diagnostics } from './diagnostics.svelte.js'
import { emulators } from './emulators.svelte.js'
import { formatPlaytime } from './format.js'
import { library } from './library.svelte.js'
import { memory } from './memory.svelte.js'
import { sound } from './sound.js'
import { PLAYTIME_MS, toasts } from './toasts.svelte.js'
import { userData } from './userData.svelte.js'

/** "Ōkami (PS2)", for the log @param {string} id */
export function gameLabel(id) {
  const game = library.byId.get(id)
  if (!game) return id
  return `${game.name} (${getPlatform(game.system)?.shortName ?? game.system})`
}

/**
 * @typedef {{ game: any, uri: string, emulatorName: string, note?: string }} Launching
 *   note: how to change discs, for a game on several (core/discs.js)
 */

class Launcher {
  /** The game that's opening (the "Opening…" screen), or null */
  launching = $state(/** @type {Launching | null} */ (null))

  /** @param {Launching | null} value */
  #set(value) {
    this.launching = value
    // A game is opening: nothing should move underneath
    activity.launching = value !== null
  }

  /**
   * Opens a game with its emulator.
   * @param {any} game
   * @param {import('../core/place.js').Place} place  where you are: if the Xbox closes Relix, it opens there again
   */
  async start(game, place) {
    const platform = getPlatform(game.system)
    // That game's, its console's or the recommended one (see emulators.svelte.js)
    const emulator = emulators.forGame(game)
    if (!platform || !emulator) {
      sound.error()
      toasts.show(
        platform?.noEmulatorNote ? t(platform.noEmulatorNote) : t('Esta consola todavía no tiene un emulador para abrir juegos.'),
      )
      return
    }
    // A game on several discs without an .m3u opens with the list Relix makes (core/discs.js)
    const romPath = await launchPath(game)
    let uri
    try {
      uri = buildLaunchUri(emulator.launcher, romPath)
    } catch (e) {
      sound.error()
      const message = e instanceof Error ? e.message : String(e)
      diagnostics.log(
        'error',
        t('No se pudo armar la URI de {game} con {emulator}: {message}', { game: gameLabel(game.id), emulator: emulator.name, message }),
      )
      toasts.show(message)
      return
    }
    sound.select()
    const discs = discCount(game)
    this.#set({ game, uri, emulatorName: emulator.name, note: discs ? discSwapHint(discs, emulator) : '' })
    // The session starts counting and is on the USB drive before the Xbox switches to the
    // emulator, with where you were
    library.startSession(game, place)
    diagnostics.log('launch', t('{game} con {emulator} · {uri}', { game: gameLabel(game.id), emulator: emulator.name, uri }))
    await memory.beforeGame(gameLabel(game.id))
    diagnostics.flush()
    await userData.flush()
    try {
      await launch(uri, romPath)
      library.markPlayed(game)
    } catch (e) {
      this.#set(null)
      library.endSession(false)
      sound.error()
      const code = e instanceof ShellError ? ` [${e.code}]` : ''
      diagnostics.log(
        'error',
        t('No se pudo abrir {game} con {emulator}: {message}', {
          game: gameLabel(game.id),
          emulator: emulator.name,
          message: (e instanceof Error ? e.message : String(e)) + code,
        }),
      )
      diagnostics.flush()
      toasts.show(launchErrorMessage(e, emulator.name, platform.emulators.length > 1))
    }
  }

  /**
   * Back in Relix: closes the session in progress (if there was one) and counts the
   * time played. If you came back from the emulator after a few seconds, the game
   * didn't open: it says what to check (the emulator doesn't tell Relix anything).
   * @param {{ fromEmulator?: boolean }} [how]  false = you closed the "Opening…" notice with B
   */
  back({ fromEmulator = false } = {}) {
    this.#set(null)
    const finished = library.endSession()
    if (!finished) return
    const quick = fromEmulator && finished.elapsed < QUICK_EXIT_SECONDS
    const game = library.byId.get(finished.id)
    const emulatorName = game ? (emulators.forGame(game)?.name ?? '') : ''
    const label = gameLabel(finished.id)
    diagnostics.log(
      quick ? 'quickExit' : 'back',
      quick
        ? t('{game} con {emulator}: volvió a Relix a los {n} s', { game: label, emulator: emulatorName, n: finished.elapsed })
        : [
            t('{game} tras {time}', { game: label, time: shortDuration(finished.elapsed) }),
            fromEmulator ? '' : ` ${t('(cerraste el aviso "Abriendo…")')}`,
            finished.seconds > 0 ? '' : ` · ${t('no se cuenta (menos de 1 min)')}`,
          ].join(''),
    )
    if (quick) warnQuickExit(finished.id)
    else announcePlaytime(finished)
  }
}

export const launcher = new Launcher()

/**
 * "Okami: 45 min played · 12 h in total", after a game.
 * @param {{ id: string, seconds: number }} finished
 */
export function announcePlaytime({ id, seconds }) {
  const game = library.byId.get(id)
  if (!game || seconds <= 0) return
  toasts.show(playtimeNotice(game.name, seconds, library.playtime[id]?.seconds ?? 0, formatPlaytime), PLAYTIME_MS)
}

/** The game closed within seconds: what to check @param {string} id */
function warnQuickExit(id) {
  const game = library.byId.get(id)
  const platform = game && getPlatform(game.system)
  const emulator = game && emulators.forGame(game)
  if (!game || !platform || !emulator) return
  sound.error()
  toasts.show(quickExitMessage(game, platform, emulator), 9000)
}

/**
 * The file the emulator opens: the game's, or the list of its discs, written right
 * before so it follows the discs that are there. If it can't be written, disc 1.
 * @param {any} game
 */
async function launchPath(game) {
  if (!discCount(game)) return library.romPath(game)
  try {
    return await writeDiscList(game.system, discListName(game.discs[0]), discListText(library.discPaths(game)))
  } catch (e) {
    diagnostics.log(
      'error',
      t('No se pudo armar la lista de discos de {game}: {message}', {
        game: gameLabel(game.id),
        message: e instanceof Error ? e.message : String(e),
      }),
    )
    return library.romPath(game)
  }
}

/** @param {unknown} e @param {string} emulatorName @param {boolean} hasOthers */
function launchErrorMessage(e, emulatorName, hasOthers) {
  if (e instanceof ShellError) {
    if (e.code === 'emulator-missing') {
      return hasOthers
        ? t('{emulator} no está instalado en la consola. Instálalo, o elige otro en Opciones › Consolas.', { emulator: emulatorName })
        : t('{emulator} no está instalado en la consola. Instálalo desde el Device Portal.', { emulator: emulatorName })
    }
    return e.message
  }
  return t('No se pudo abrir {emulator}. Revisa que esté instalado en la consola.', { emulator: emulatorName })
}
