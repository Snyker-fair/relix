<script>
  import { untrack } from 'svelte'
  import { launch, mode, notifyReady, onShellEvent, ShellError } from './lib/core/bridge.js'
  import { buildLaunchUri } from './lib/core/launchUri.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { QUICK_EXIT_SECONDS, quickExitMessage } from './lib/core/quickExit.js'
  import { COLLECTIONS, COLLECTION_PREFIX, isCollectionId } from './lib/ui/channels.js'
  import { collections } from './lib/ui/collections.svelte.js'
  import { emulators } from './lib/ui/emulators.svelte.js'
  import { dispatch, startInput } from './lib/ui/input.js'
  import { library } from './lib/ui/library.svelte.js'
  import { sound } from './lib/ui/sound.js'
  import { userData } from './lib/ui/userData.svelte.js'
  import { formatPlaytime } from './lib/ui/format.js'
  import Stage from './lib/ui/Stage.svelte'
  import CoverPicker from './screens/CoverPicker.svelte'
  import GameMenu from './screens/GameMenu.svelte'
  import Home from './screens/Home.svelte'
  import LaunchOverlay from './screens/LaunchOverlay.svelte'
  import Library from './screens/Library.svelte'
  import Options from './screens/Options.svelte'
  import Search from './screens/Search.svelte'
  import Status from './screens/Status.svelte'

  /**
   * Pantallas. Las que se abren "encima" recuerdan desde dónde, para volver con B.
   * @typedef {{ name: 'home' }
   *   | { name: 'library', systemId: string }
   *   | { name: 'search', from: any }
   *   | { name: 'options', from: any, section?: string }
   *   | { name: 'coverPicker', back: any, gameId?: string }} Screen
   */
  /** @type {Screen} */
  let screen = $state({ name: 'home' })
  /** Menú del juego (Y), encima de la pantalla actual */
  /** @type {{ game: any, sortOptions?: import('./lib/core/sorting.js').SortOrder[] } | null} */
  let menu = $state(null)
  /** Canal con el foco en el inicio (id de consola, 'favorites' u 'options'). null = el primero */
  /** @type {string|null} */
  let focusedId = $state(null)
  let boot = $state(true)

  /** @type {{ game: any, uri: string, emulatorName: string } | null} */
  let launching = $state(null)
  let toast = $state('')
  /** @type {ReturnType<typeof setTimeout>} */
  let toastTimer

  // En el navegador: teclado y control con la Gamepad API.
  // En la Xbox: el control lo lee el shell en C# y llega como evento 'input'.
  startInput({ keyboard: mode === 'browser', gamepad: mode === 'browser' })

  onShellEvent((e) => {
    if (e.event === 'input' && e.action) dispatch(/** @type {any} */ (e.action))
    // Volviste a Relix: al cerrar el emulador (resumed) o por otro camino, como el botón Xbox (visible)
    else if (e.event === 'resumed' || e.event === 'visible') backInRelix({ fromEmulator: true })
  })

  /**
   * Partida que terminó con Relix cerrado (la Xbox lo cerró mientras jugabas):
   * se cierra al abrir y se avisa cuando la biblioteca esté lista.
   */
  let finishedWhileClosed = library.endSession()

  library.load().finally(notifyReady)

  // Al tener la biblioteca: colecciones del USB, tus datos (si el USB apareció
  // recién, con Reintentar) y el aviso de la partida que quedó pendiente
  $effect(() => {
    if (library.status !== 'ready') return
    untrack(() => {
      collections.load()
      userData.resync()
      emulators.check()
      if (finishedWhileClosed) {
        announcePlaytime(finishedWhileClosed)
        finishedWhileClosed = null
      }
      if (userData.recoveredFrom) showToast(`Tus datos se recuperaron de relix\\${userData.recoveredFrom}`)
    })
  })

  // Si el USB no deja guardar tus datos, se avisa una vez
  let warnedSave = false
  $effect(() => {
    if (userData.status === 'error' && !warnedSave) {
      warnedSave = true
      untrack(() => showToast(userData.error))
    }
  })

  /**
   * Cierra la partida en curso (si había) y cuenta lo jugado. Si volviste
   * desde el emulador a los pocos segundos, el juego no abrió: se avisa qué
   * revisar (el emulador no le dice nada a Relix).
   * @param {{ fromEmulator?: boolean }} [how]  false = cerraste el aviso "Abriendo…" con B
   */
  function backInRelix({ fromEmulator = false } = {}) {
    launching = null
    const finished = library.endSession()
    if (!finished) return
    if (fromEmulator && finished.elapsed < QUICK_EXIT_SECONDS) warnQuickExit(finished.id)
    else announcePlaytime(finished)
  }

  /** @param {string} id */
  function warnQuickExit(id) {
    const game = library.byId.get(id)
    const platform = game && getPlatform(game.system)
    const emulator = game && emulators.forGame(game)
    if (!game || !platform || !emulator) return
    sound.error()
    showToast(quickExitMessage(game, platform, emulator), 9000)
  }

  /** "Okami: 45 min jugados · 12 h en total" @param {{ id: string, seconds: number }} finished */
  function announcePlaytime({ id, seconds }) {
    const game = library.byId.get(id)
    const total = library.playtime[id]?.seconds ?? 0
    if (!game || seconds <= 0) return
    showToast(
      total > seconds
        ? `${game.name}: ${formatPlaytime(seconds)} jugados · ${formatPlaytime(total)} en total`
        : `${game.name}: ${formatPlaytime(seconds)} jugados`,
    )
  }

  $effect(() => {
    const t = setTimeout(() => (boot = false), 1400)
    return () => clearTimeout(t)
  })

  /** @param {string} message @param {number} [duration] ms */
  function showToast(message, duration = 3500) {
    toast = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = ''), duration)
  }

  function openOptions() {
    if (screen.name === 'home' || screen.name === 'library') screen = { name: 'options', from: screen }
  }

  function openSearch() {
    if (screen.name !== 'search') screen = { name: 'search', from: screen }
  }

  /**
   * Abre un canal. "Colecciones" abre la primera colección; en el inicio,
   * el foco queda en el canal Colecciones.
   * @param {string} systemId
   */
  function openLibrary(systemId) {
    let id = systemId
    if (id === COLLECTIONS.id) {
      const first = collections.visible[0]
      if (!first) return
      id = `${COLLECTION_PREFIX}${first.name}`
    }
    focusedId = isCollectionId(id) ? COLLECTIONS.id : id
    screen = { name: 'library', systemId: id }
  }

  /**
   * @param {any} game
   * @param {import('./lib/core/sorting.js').SortOrder[]} [sortOptions]
   */
  function openMenu(game, sortOptions) {
    menu = { game, sortOptions }
  }

  /** @param {any} game */
  function changeCover(game) {
    screen = { name: 'coverPicker', back: screen, gameId: game.id }
  }

  /** @param {any} game */
  async function startGame(game) {
    const platform = getPlatform(game.system)
    // El de ese juego, el de su consola o el recomendado (ver emulators.svelte.js)
    const emulator = emulators.forGame(game)
    if (!platform || !emulator) {
      sound.error()
      showToast(platform?.noEmulatorNote ?? 'Esta consola todavía no tiene un emulador para abrir juegos.')
      return
    }
    let uri
    try {
      uri = buildLaunchUri(emulator.launcher, library.romPath(game))
    } catch (e) {
      sound.error()
      showToast(e instanceof Error ? e.message : String(e))
      return
    }
    sound.select()
    launching = { game, uri, emulatorName: emulator.name }
    // La partida empieza a contar y queda en el USB antes de que la Xbox pase al emulador
    library.startSession(game)
    await userData.flush()
    try {
      await launch(uri, library.romPath(game))
      library.markPlayed(game)
    } catch (e) {
      launching = null
      library.endSession(false)
      sound.error()
      showToast(launchErrorMessage(e, emulator.name, platform.emulators.length > 1))
    }
  }

  /** @param {unknown} e @param {string} emulatorName @param {boolean} hasOthers */
  function launchErrorMessage(e, emulatorName, hasOthers) {
    if (e instanceof ShellError) {
      if (e.code === 'emulator-missing') {
        return hasOthers
          ? `${emulatorName} no está instalado en la consola. Instálalo, o elige otro en Opciones › Consolas.`
          : `${emulatorName} no está instalado en la consola. Instálalo desde el Device Portal.`
      }
      return e.message
    }
    return `No se pudo abrir ${emulatorName}. Revisa que esté instalado en la consola.`
  }
</script>

<Stage>
  {#if library.status !== 'ready'}
    <Status />
  {:else if screen.name === 'home'}
    <Home
      {focusedId}
      {boot}
      onFocusChange={(id) => (focusedId = id)}
      onOpen={openLibrary}
      onLaunch={startGame}
      onOptions={openOptions}
      onSearch={openSearch}
      onMenu={(game) => openMenu(game)}
    />
  {:else if screen.name === 'library'}
    <Library
      systemId={screen.systemId}
      onBack={() => (screen = { name: 'home' })}
      onSwitch={openLibrary}
      onLaunch={startGame}
      onOptions={openOptions}
      onMenu={openMenu}
      onSearch={openSearch}
    />
  {:else if screen.name === 'search'}
    {@const from = screen.from}
    <Search onBack={() => (screen = from)} onLaunch={startGame} onMenu={(game) => openMenu(game)} />
  {:else if screen.name === 'options'}
    {@const from = screen.from}
    {@const options = screen}
    <Options
      initialSection={screen.section}
      onBack={() => (screen = from)}
      onToast={showToast}
      onPickCovers={() => (screen = { name: 'coverPicker', back: { ...options, section: 'covers' } })}
    />
  {:else}
    {@const back = screen.back}
    <CoverPicker gameId={screen.gameId} onBack={() => (screen = back)} onToast={showToast} />
  {/if}

  {#if menu}
    <GameMenu
      game={menu.game}
      sortOptions={menu.sortOptions}
      onClose={() => (menu = null)}
      onLaunch={startGame}
      onChangeCover={changeCover}
      onToast={showToast}
    />
  {/if}

  {#if launching}
    <LaunchOverlay
      game={launching.game}
      uri={launching.uri}
      emulatorName={launching.emulatorName}
      onClose={() => backInRelix()}
    />
  {/if}

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}
</Stage>

<style>
  .toast {
    position: absolute;
    /* arriba al centro: tapa por un momento la barra superior, nunca el contenido */
    top: 44px;
    left: 50%;
    translate: -50% 0;
    /* entre el logo y el reloj: hasta los avisos largos caben en dos líneas
       (max-content: sin él, al estar anclado al centro no pasaría de 960 px) */
    width: max-content;
    max-width: 1180px;
    padding: 18px 32px;
    border-radius: 999px;
    background: var(--ink);
    color: white;
    font-weight: 700;
    font-size: 24px;
    line-height: 1.3;
    animation: toast-in 300ms var(--spring) both;
    z-index: 20;
  }
  @keyframes toast-in {
    from {
      transform: translateY(-30px);
      opacity: 0;
    }
  }
</style>
