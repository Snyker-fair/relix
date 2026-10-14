<script>
  import { launch } from './lib/core/bridge.js'
  import { buildLaunchUri } from './lib/core/launchUri.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { CHANNELS } from './lib/ui/channels.js'
  import { startInput } from './lib/ui/input.js'
  import { library } from './lib/ui/library.svelte.js'
  import { sound } from './lib/ui/sound.js'
  import Stage from './lib/ui/Stage.svelte'
  import Home from './screens/Home.svelte'
  import LaunchOverlay from './screens/LaunchOverlay.svelte'
  import Library from './screens/Library.svelte'

  /** @type {{ name: 'home' } | { name: 'library', systemId: string }} */
  let screen = $state({ name: 'home' })
  let channelIndex = $state(1) // empieza en la primera consola, no en Favoritos
  let boot = $state(true)

  /** @type {{ game: any, uri: string } | null} */
  let launching = $state(null)
  let toast = $state('')
  /** @type {ReturnType<typeof setTimeout>} */
  let toastTimer

  startInput()
  library.load()

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
    library.markPlayed(game)
    try {
      await launch(uri)
    } catch (e) {
      launching = null
      sound.error()
      showToast(`No se pudo abrir ${platform.emulatorName}. Revisa que esté instalado en la consola.`)
    }
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
    />
  {:else}
    <Library
      systemId={screen.systemId}
      onBack={() => (screen = { name: 'home' })}
      onSwitch={openLibrary}
      onLaunch={startGame}
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
