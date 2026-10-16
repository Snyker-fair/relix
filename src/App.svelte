<script>
  import { launch, mode, notifyReady, onShellEvent, ShellError } from './lib/core/bridge.js'
  import { buildLaunchUri } from './lib/core/launchUri.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { dispatch, startInput } from './lib/ui/input.js'
  import { library } from './lib/ui/library.svelte.js'
  import { sound } from './lib/ui/sound.js'
  import Stage from './lib/ui/Stage.svelte'
  import CoverPicker from './screens/CoverPicker.svelte'
  import Home from './screens/Home.svelte'
  import LaunchOverlay from './screens/LaunchOverlay.svelte'
  import Library from './screens/Library.svelte'
  import Options from './screens/Options.svelte'
  import Status from './screens/Status.svelte'

  /** @typedef {{ name: 'home' } | { name: 'library', systemId: string }} MainScreen */
  /**
   * Opciones recuerda desde dónde se abrió, para volver ahí con B.
   * @type {MainScreen
   *   | { name: 'options', from: MainScreen, section?: string }
   *   | { name: 'coverPicker', from: MainScreen }}
   */
  let screen = $state({ name: 'home' })
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

  /** @param {string} systemId */
  function openLibrary(systemId) {
    focusedId = systemId
    screen = { name: 'library', systemId }
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
    />
  {:else if screen.name === 'library'}
    <Library
      systemId={screen.systemId}
      onBack={() => (screen = { name: 'home' })}
      onSwitch={openLibrary}
      onLaunch={startGame}
      onOptions={openOptions}
    />
  {:else if screen.name === 'options'}
    {@const from = screen.from}
    <Options
      initialSection={screen.section}
      onBack={() => (screen = from)}
      onToast={showToast}
      onPickCovers={() => (screen = { name: 'coverPicker', from })}
    />
  {:else}
    {@const from = screen.from}
    <CoverPicker onBack={() => (screen = { name: 'options', from, section: 'covers' })} onToast={showToast} />
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
