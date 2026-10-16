<script>
  import { untrack } from 'svelte'
  import { launch, mode, notifyReady, onShellEvent, ShellError } from './lib/core/bridge.js'
  import { buildLaunchUri } from './lib/core/launchUri.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { COLLECTIONS, COLLECTION_PREFIX, isCollectionId } from './lib/ui/channels.js'
  import { collections } from './lib/ui/collections.svelte.js'
  import { dispatch, startInput } from './lib/ui/input.js'
  import { library } from './lib/ui/library.svelte.js'
  import { sound } from './lib/ui/sound.js'
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

  /** @type {{ game: any, uri: string } | null} */
  let launching = $state(null)
  let toast = $state('')
  /** @type {ReturnType<typeof setTimeout>} */
  let toastTimer

  // En el navegador: teclado y control con la Gamepad API.
  // En la Xbox: el control lo lee el shell en C# y llega como evento 'input'.
  startInput({ keyboard: mode === 'browser', gamepad: mode === 'browser' })

  onShellEvent((e) => {
    if (e.event === 'input' && e.action) dispatch(/** @type {any} */ (e.action))
    // La consola volvió a Relix al cerrar el emulador
    else if (e.event === 'resumed') launching = null
  })

  library.load().finally(notifyReady)

  // Las colecciones se leen del USB cuando la biblioteca está lista (también al reintentar)
  $effect(() => {
    if (library.status === 'ready') untrack(() => collections.load())
  })

  $effect(() => {
    const t = setTimeout(() => (boot = false), 1400)
    return () => clearTimeout(t)
  })

  /** @param {string} message */
  function showToast(message) {
    toast = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = ''), 3500)
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
    let uri
    try {
      uri = buildLaunchUri(platform.launcher, library.romPath(game))
    } catch (e) {
      sound.error()
      showToast(platform.launcherNote ?? (e instanceof Error ? e.message : String(e)))
      return
    }
    sound.select()
    launching = { game, uri }
    try {
      await launch(uri, library.romPath(game))
      library.markPlayed(game)
    } catch (e) {
      launching = null
      sound.error()
      showToast(launchErrorMessage(e, platform.emulatorName))
    }
  }

  /** @param {unknown} e @param {string} emulatorName */
  function launchErrorMessage(e, emulatorName) {
    if (e instanceof ShellError) {
      if (e.code === 'emulator-missing') {
        return `${emulatorName} no está instalado en la consola. Instálalo desde el Device Portal.`
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
    <LaunchOverlay game={launching.game} uri={launching.uri} onClose={() => (launching = null)} />
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
    max-width: 1000px;
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
