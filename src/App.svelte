<script>
  import { untrack } from 'svelte'
  import { launch, mode, notifyReady, onShellEvent, ShellError } from './lib/core/bridge.js'
  import { buildLaunchUri } from './lib/core/launchUri.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { QUICK_EXIT_SECONDS, quickExitMessage } from './lib/core/quickExit.js'
  import { shortDuration } from './lib/core/diagnostics.js'
  import { VERSION } from './lib/core/version.js'
  import { diagnostics } from './lib/ui/diagnostics.svelte.js'
  import { theme } from './lib/ui/theme.svelte.js'
  import { COLLECTIONS, COLLECTION_PREFIX, isCollectionId } from './lib/ui/channels.js'
  import { collections } from './lib/ui/collections.svelte.js'
  import { emulators } from './lib/ui/emulators.svelte.js'
  import { activity } from './lib/ui/activity.svelte.js'
  import { dispatch, idleFor, markActivity, startInput } from './lib/ui/input.js'
  import { library } from './lib/ui/library.svelte.js'
  import { settings } from './lib/ui/settings.svelte.js'
  import { sound } from './lib/ui/sound.js'
  import { systemStatus } from './lib/ui/systemStatus.svelte.js'
  import { userData } from './lib/ui/userData.svelte.js'
  import { updates } from './lib/ui/updates.svelte.js'
  import { formatPlaytime, plural } from './lib/ui/format.js'
  import { i18n, t } from './lib/i18n/i18n.svelte.js'
  import Stage from './lib/ui/Stage.svelte'
  import CoverPicker from './screens/CoverPicker.svelte'
  import GameMenu from './screens/GameMenu.svelte'
  import Guide from './screens/Guide.svelte'
  import Home from './screens/Home.svelte'
  import LaunchOverlay from './screens/LaunchOverlay.svelte'
  import Library from './screens/Library.svelte'
  import Options from './screens/Options.svelte'
  import Screensaver from './screens/Screensaver.svelte'
  import Search from './screens/Search.svelte'
  import Status from './screens/Status.svelte'
  import Welcome from './screens/Welcome.svelte'

  /**
   * Pantallas. Las que se abren "encima" recuerdan desde dónde, para volver con B.
   * @typedef {{ name: 'home' }
   *   | { name: 'library', systemId: string }
   *   | { name: 'search', from: any }
   *   | { name: 'options', from: any, section?: string, row?: string }
   *   | { name: 'coverPicker', back: any, gameId?: string }
   *   | { name: 'guide', systemId: string, back: any }
   *   | { name: 'welcome', step: number, row?: string, back: any, auto?: boolean }} Screen
   *   welcome.auto: se abrió solo la primera vez (no desde Opciones)
   */
  /** @type {Screen} */
  let screen = $state({ name: 'home' })
  /** Menú del juego (Y), encima de la pantalla actual */
  /** @type {{ game: any, sortOptions?: import('./lib/core/sorting.js').SortOrder[], filterChannel?: string } | null} */
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
  // Registro de diagnóstico: errores del shell y de la interfaz, desde ya
  diagnostics.start()

  onShellEvent((e) => {
    if (e.event === 'input' && e.action) dispatch(/** @type {any} */ (e.action))
    // Volviste a Relix: al cerrar el emulador (resumed) o por otro camino, como el botón Xbox (visible)
    else if (e.event === 'resumed' || e.event === 'visible') {
      markActivity() // el tiempo jugando no cuenta para el protector de pantalla
      backInRelix({ fromEmulator: true })
    }
  })

  /**
   * Partida que terminó con Relix cerrado (la Xbox lo cerró mientras jugabas):
   * se cierra al abrir y se avisa cuando la biblioteca esté lista.
   */
  let finishedWhileClosed = library.endSession()

  library.load().finally(notifyReady)

  // Al tener la biblioteca: colecciones del USB, tus datos (si el USB apareció
  // recién, con Reintentar), la revisión del sistema (que también pregunta qué
  // emuladores hay), el aviso de la partida que quedó pendiente y, la primera
  // vez, el recorrido de bienvenida
  let loggedStart = false
  $effect(() => {
    if (library.status !== 'ready') return
    untrack(() => {
      if (!loggedStart) {
        loggedStart = true
        diagnostics.log('start', startSummary())
      }
      collections.load()
      userData.resync()
      library.loadMedia()
      systemStatus.run().then(() => {
        warnSystem()
        notifyUpdate()
      })
      if (finishedWhileClosed) {
        diagnostics.log(
          'back',
          t('{game} tras {time} (Relix estaba cerrado)', {
            game: gameLabel(finishedWhileClosed.id),
            time: shortDuration(finishedWhileClosed.elapsed),
          }),
        )
        announcePlaytime(finishedWhileClosed)
        finishedWhileClosed = null
      }
      if (userData.recoveredFrom) showToast(t('Tus datos se recuperaron de {file}', { file: `relix\\${userData.recoveredFrom}` }))
      if (!settings.onboarded && screen.name === 'home') {
        screen = { name: 'welcome', step: 0, back: { name: 'home' }, auto: true }
      }
    })
  })

  // Tus datos llegaron después desde el USB y ahí ya habías hecho el recorrido
  $effect(() => {
    if (screen.name === 'welcome' && screen.auto && screen.step === 0 && settings.onboarded) {
      untrack(() => (screen = { name: 'home' }))
    }
  })

  /**
   * Al abrir, si la revisión encontró algo por arreglar, se avisa una vez
   * (no durante el recorrido de bienvenida, que ya lo muestra).
   */
  let warnedSystem = false
  function warnSystem() {
    const { errors } = systemStatus.summary
    if (warnedSystem || errors === 0 || screen.name === 'welcome') return
    warnedSystem = true
    // Si hay otro aviso en pantalla (el tiempo jugado, p. ej.), va después
    setTimeout(
      () =>
        showToast(t('Relix encontró {found}: ≡ › Revisión', { found: plural(errors, 'cosa por arreglar', 'cosas por arreglar') }), 6000),
      toast ? 3600 : 0,
    )
  }

  /** Hay una versión nueva de Relix: se avisa una vez por versión (después de otros avisos) */
  function notifyUpdate() {
    if (screen.name === 'welcome') return
    const version = updates.takeNotice()
    if (!version) return
    setTimeout(
      () => showToast(t('Relix {version} ya está disponible: ≡ › Revisión', { version }), 6000),
      toast ? 6500 : 0,
    )
  }

  // Si el USB no deja guardar tus datos, se avisa una vez (y se anota cada error distinto)
  let warnedSave = false
  $effect(() => {
    if (userData.status !== 'error') return
    const error = userData.error
    untrack(() => {
      diagnostics.log('data', error)
      if (!warnedSave) {
        warnedSave = true
        showToast(error)
      }
    })
  })

  // Demo en el navegador: al cambiar de idioma, las descripciones de prueba también
  let demoLanguage = i18n.current
  $effect(() => {
    const language = i18n.current
    if (mode !== 'browser' || language === demoLanguage) return
    demoLanguage = language
    untrack(() => library.status === 'ready' && library.reloadDemoGamelists())
  })

  // Sin USB (o sin la carpeta roms): se anota lo que dijo la pantalla de carga
  $effect(() => {
    if (library.status === 'error') untrack(() => diagnostics.log('usb', library.error))
  })

  /** "Relix 0.9.0 · Xbox · E:\roms · 57 juegos en 12 consolas · tema claro · español" */
  function startSummary() {
    const consoles = new Set(library.all.map((g) => g.system)).size
    return [
      `Relix ${VERSION}`,
      mode === 'xbox' ? 'Xbox' : t('navegador'),
      library.romRoot,
      t('{games} en {consoles}', {
        games: plural(library.all.length, 'juego', 'juegos'),
        consoles: plural(consoles, 'consola', 'consolas'),
      }),
      theme.current === 'dark' ? t('tema oscuro') : t('tema claro'),
      t('español'),
    ].join(' · ')
  }

  /** "Ōkami (PS2)" @param {string} id */
  function gameLabel(id) {
    const game = library.byId.get(id)
    if (!game) return id
    return `${game.name} (${getPlatform(game.system)?.shortName ?? game.system})`
  }

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
        ? t('{game}: {time} jugados · {total} en total', {
            game: game.name,
            time: formatPlaytime(seconds),
            total: formatPlaytime(total),
          })
        : t('{game}: {time} jugados', { game: game.name, time: formatPlaytime(seconds) }),
    )
  }

  $effect(() => {
    const timer = setTimeout(() => (boot = false), 1400)
    return () => clearTimeout(timer)
  })

  // Los videos de vista previa se detienen mientras se abre un juego
  $effect(() => {
    activity.launching = launching !== null
  })

  // Protector de pantalla: tras los minutos elegidos sin tocar el control.
  // No aparece en el recorrido de bienvenida ni mientras se abre un juego
  $effect(() => {
    const minutes = settings.screensaverMinutes
    if (!minutes || library.status !== 'ready') return
    const timer = setInterval(() => {
      if (activity.screensaver || launching || screen.name === 'welcome' || document.hidden) return
      if (idleFor() >= minutes * 60_000) activity.screensaver = true
    }, 5000)
    return () => clearInterval(timer)
  })

  function closeScreensaver() {
    activity.screensaver = false
    markActivity()
  }

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
   * @param {string} [filterChannel]  canal de la biblioteca (para Y › Filtrar)
   */
  function openMenu(game, sortOptions, filterChannel) {
    menu = { game, sortOptions, filterChannel }
  }

  /** Guía para dejar andando una consola @param {string} systemId */
  function openGuide(systemId) {
    screen = { name: 'guide', systemId, back: screen }
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
      showToast(
        platform?.noEmulatorNote
          ? t(platform.noEmulatorNote)
          : t('Esta consola todavía no tiene un emulador para abrir juegos.'),
      )
      return
    }
    let uri
    try {
      uri = buildLaunchUri(emulator.launcher, library.romPath(game))
    } catch (e) {
      sound.error()
      const message = e instanceof Error ? e.message : String(e)
      diagnostics.log(
        'error',
        t('No se pudo armar la URI de {game} con {emulator}: {message}', { game: gameLabel(game.id), emulator: emulator.name, message }),
      )
      showToast(message)
      return
    }
    sound.select()
    launching = { game, uri, emulatorName: emulator.name }
    // La partida empieza a contar y queda en el USB antes de que la Xbox pase al emulador
    library.startSession(game)
    diagnostics.log('launch', t('{game} con {emulator} · {uri}', { game: gameLabel(game.id), emulator: emulator.name, uri }))
    diagnostics.flush()
    await userData.flush()
    try {
      await launch(uri, library.romPath(game))
      library.markPlayed(game)
    } catch (e) {
      launching = null
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
      showToast(launchErrorMessage(e, emulator.name, platform.emulators.length > 1))
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
      onGuide={openGuide}
    />
  {:else if screen.name === 'search'}
    {@const from = screen.from}
    <Search onBack={() => (screen = from)} onLaunch={startGame} onMenu={(game) => openMenu(game)} />
  {:else if screen.name === 'options'}
    {@const from = screen.from}
    {@const options = screen}
    <Options
      initialSection={screen.section}
      initialRow={screen.row}
      onBack={() => (screen = from)}
      onToast={showToast}
      onPickCovers={() => (screen = { name: 'coverPicker', back: { ...options, section: 'covers' } })}
      onGuide={(systemId, from) => (screen = { name: 'guide', systemId, back: { ...options, ...from } })}
      onWelcome={() => (screen = { name: 'welcome', step: 0, back: { ...options, section: 'check', row: 'welcome' } })}
    />
  {:else if screen.name === 'guide'}
    {@const back = screen.back}
    <!-- Al volver, el foco queda en la consola de la guía (aunque cambiaras con LB/RB).
         En Revisión, si no cambiaste, en el mismo chequeo ("bios:psx") -->
    <Guide
      systemId={screen.systemId}
      onBack={(systemId) =>
        (screen =
          back.name === 'options' || back.name === 'welcome'
            ? { ...back, row: back.row?.endsWith(`:${systemId}`) ? back.row : systemId }
            : back)}
    />
  {:else if screen.name === 'welcome'}
    {@const welcome = screen}
    {@const back = screen.back}
    <Welcome
      initialStep={screen.step}
      initialRow={screen.row}
      onGuide={(systemId, from) => (screen = { name: 'guide', systemId, back: { ...welcome, ...from } })}
      onDone={() => {
        const to = back // {@const} sigue a `screen`: se guarda antes de cambiarla
        settings.markOnboarded()
        screen = to
        // Si quedó algo por arreglar (o saltaste el recorrido), se avisa una vez
        if (to.name === 'home') {
          warnSystem()
          notifyUpdate()
        }
      }}
      onToast={showToast}
    />
  {:else}
    {@const back = screen.back}
    <CoverPicker gameId={screen.gameId} onBack={() => (screen = back)} onToast={showToast} />
  {/if}

  {#if menu}
    <GameMenu
      game={menu.game}
      sortOptions={menu.sortOptions}
      filterChannel={menu.filterChannel}
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

  {#if activity.screensaver}
    <Screensaver
      onClose={closeScreensaver}
      onPlay={(game) => {
        closeScreensaver()
        menu = null
        startGame(game)
      }}
    />
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
    color: var(--cloud);
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
