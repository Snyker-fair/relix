<script>
  import { launch, mode, notifyReady, onShellEvent, ShellError } from './lib/core/bridge.js'
  import { buildLaunchUri } from './lib/core/launchUri.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { CHANNELS } from './lib/ui/channels.js'
  import { dispatch, startInput } from './lib/ui/input.js'
  import { library } from './lib/ui/library.svelte.js'
  import { sound } from './lib/ui/sound.js'
  import Stage from './lib/ui/Stage.svelte'
  import Home from './screens/Home.svelte'
  import LaunchOverlay from './screens/LaunchOverlay.svelte'
  import Library from './screens/Library.svelte'
  import Options from './screens/Options.svelte'

  /** @typedef {{ name: 'home' } | { name: 'library', systemId: string }} MainScreen */
  /** @type {MainScreen | { name: 'options', from: MainScreen }} */
  let screen = $state({ name: 'home' })
  let channelIndex = $state(1) // empieza en la primera consola, no en Favoritos
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
    if (screen.name !== 'options') screen = { name: 'options', from: screen }
  }

  /** @param {string} systemId */
  function openLibrary(systemId) {
    channelIndex = CHANNELS.findIndex((c) => c.id === systemId)
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
  {#if library.status === 'loading'}
    <p class="status">Desempolvando tus reliquias…</p>
  {:else if library.status === 'error'}
    <div class="status error">
      <h1>No pudimos leer tu biblioteca</h1>
      <p>{library.error}</p>
    </div>
  {:else if screen.name === 'home'}
    <Home
      {channelIndex}
      {boot}
      onChannelChange={(i) => (channelIndex = i)}
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
  {:else}
    {@const from = screen.from}
    <Options onBack={() => (screen = from)} onToast={showToast} />
  {/if}

  {#if launching}
    <LaunchOverlay game={launching.game} uri={launching.uri} onClose={() => (launching = null)} />
  {/if}

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}
</Stage>

<style>
  .status {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 56px;
    text-align: center;
  }
  .status.error h1 {
    margin: 0;
    font-size: 64px;
  }
  .status.error p {
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 28px;
    color: var(--ink-soft);
  }
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
