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
   * Screens. The ones that open "on top" remember where from, to go back with B.
   * @typedef {{ name: 'home' }
   *   | { name: 'library', systemId: string }
   *   | { name: 'search', from: any }
   *   | { name: 'options', from: any, section?: string, row?: string }
   *   | { name: 'coverPicker', back: any, gameId?: string }
   *   | { name: 'guide', systemId: string, back: any }
   *   | { name: 'welcome', step: number, row?: string, back: any, auto?: boolean }} Screen
   *   welcome.auto: it opened by itself the first time (not from Options)
   */
  /** @type {Screen} */
  let screen = $state({ name: 'home' })
  /** The game menu (Y), on top of the current screen */
  /** @type {{ game: any, sortOptions?: import('./lib/core/sorting.js').SortOrder[], filterChannel?: string } | null} */
  let menu = $state(null)
  /** The channel with the focus on the home screen (a console id, 'favorites' or 'options'). null = the first one */
  /** @type {string|null} */
  let focusedId = $state(null)
  let boot = $state(true)

  /** @type {{ game: any, uri: string, emulatorName: string } | null} */
  let launching = $state(null)
  let toast = $state('')
  /** @type {ReturnType<typeof setTimeout>} */
  let toastTimer

  // In the browser: keyboard and controller with the Gamepad API.
  // On the Xbox: the C# shell reads the controller and it arrives as an 'input' event.
  startInput({ keyboard: mode === 'browser', gamepad: mode === 'browser' })
  // Diagnostic log: errors from the shell and the interface, from the start
  diagnostics.start()

  onShellEvent((e) => {
    if (e.event === 'input' && e.action) dispatch(/** @type {any} */ (e.action))
    // You're back in Relix: when the emulator closes (resumed) or another way, like the Xbox button (visible)
    else if (e.event === 'resumed' || e.event === 'visible') {
      markActivity() // time spent playing doesn't count toward the screensaver
      backInRelix({ fromEmulator: true })
    }
  })

  /**
   * A session that ended with Relix closed (the Xbox closed it while you played):
   * it's closed when Relix opens, and reported once the library is ready.
   */
  let finishedWhileClosed = library.endSession()

  library.load().finally(notifyReady)

  // Once the library is in: the collections from the USB drive, your data (if the drive
  // just showed up, with Retry), the system checkup (which also asks which
  // emulators there are), the notice for the pending session and, the first
  // time, the welcome tour
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

  // Your data arrived later from the USB drive and you had already done the tour there
  $effect(() => {
    if (screen.name === 'welcome' && screen.auto && screen.step === 0 && settings.onboarded) {
      untrack(() => (screen = { name: 'home' }))
    }
  })

  /**
   * When Relix opens, if the checkup found something to fix, it's reported once
   * (not during the welcome tour, which already shows it).
   */
  let warnedSystem = false
  function warnSystem() {
    const { errors } = systemStatus.summary
    if (warnedSystem || errors === 0 || screen.name === 'welcome') return
    warnedSystem = true
    // If another notice is on screen (the playtime, e.g.), this one goes after it
    setTimeout(
      () =>
        showToast(t('Relix encontró {found}: ≡ › Revisión', { found: plural(errors, 'cosa por arreglar', 'cosas por arreglar') }), 6000),
      toast ? 3600 : 0,
    )
  }

  /** There's a new version of Relix: it's reported once per version (after the other notices) */
  function notifyUpdate() {
    if (screen.name === 'welcome') return
    const version = updates.takeNotice()
    if (!version) return
    setTimeout(
      () => showToast(t('Relix {version} ya está disponible: ≡ › Revisión', { version }), 6000),
      toast ? 6500 : 0,
    )
  }

  // If the USB drive doesn't let your data be saved, it's reported once (and each different error is logged)
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

  // Demo in the browser: when the language changes, the test descriptions change too
  let demoLanguage = i18n.current
  $effect(() => {
    const language = i18n.current
    if (mode !== 'browser' || language === demoLanguage) return
    demoLanguage = language
    untrack(() => library.status === 'ready' && library.reloadDemoGamelists())
  })

  // No USB drive (or no roms folder): what the loading screen said is logged
  $effect(() => {
    if (library.status === 'error') untrack(() => diagnostics.log('usb', library.error))
  })

  /** "Relix 1.0.0 · Xbox · E:\roms · 57 games on 12 consoles · light theme · Spanish" */
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
   * Closes the session in progress (if there was one) and counts the time played. If you
   * came back from the emulator after a few seconds, the game didn't open: it says what
   * to check (the emulator doesn't tell Relix anything).
   * @param {{ fromEmulator?: boolean }} [how]  false = you closed the "Opening…" notice with B
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

  /** "Okami: 45 min played · 12 h in total" @param {{ id: string, seconds: number }} finished */
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

  // Preview videos stop while a game opens
  $effect(() => {
    activity.launching = launching !== null
  })

  // Screensaver: after the chosen minutes without touching the controller.
  // It doesn't show up in the welcome tour or while a game opens
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
   * Opens a channel. "Collections" opens the first collection; on the home screen,
   * the focus stays on the Collections channel.
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
   * @param {string} [filterChannel]  the library channel (for Y › Filter)
   */
  function openMenu(game, sortOptions, filterChannel) {
    menu = { game, sortOptions, filterChannel }
  }

  /** The guide to get a console working @param {string} systemId */
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
    // That game's, its console's or the recommended one (see emulators.svelte.js)
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
    // The session starts counting and is on the USB drive before the Xbox switches to the emulator
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
    <!-- Coming back, the focus stays on the guide's console (even if you switched with LB/RB).
         In Checkup, if you didn't switch, on the same check ("bios:psx") -->
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
        const to = back // {@const} follows `screen`: it's kept before changing it
        settings.markOnboarded()
        screen = to
        // If something was left to fix (or you skipped the tour), it says so once
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
    /* top center: briefly covers the top bar, never the content */
    top: 44px;
    left: 50%;
    translate: -50% 0;
    /* between the logo and the clock: even long notices fit in two lines
       (max-content: without it, anchored to the center it wouldn't go past 960 px) */
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
