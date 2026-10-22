<script>
  import { untrack } from 'svelte'
  import { launch, mode, notifyReady, onShellEvent, ShellError } from './lib/core/bridge.js'
  import { buildLaunchUri } from './lib/core/launchUri.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { placeFor, returnTo } from './lib/core/place.js'
  import { pickSurprise } from './lib/core/surprise.js'
  import { isMultiplayer } from './lib/core/together.js'
  import { QUICK_EXIT_SECONDS, quickExitMessage } from './lib/core/quickExit.js'
  import { shortDuration } from './lib/core/diagnostics.js'
  import { VERSION } from './lib/core/version.js'
  import { diagnostics } from './lib/ui/diagnostics.svelte.js'
  import { theme } from './lib/ui/theme.svelte.js'
  import { COLLECTIONS, COLLECTION_PREFIX, isCollectionId } from './lib/ui/channels.js'
  import { collections } from './lib/ui/collections.svelte.js'
  import { controllers } from './lib/ui/controllers.svelte.js'
  import { emulators } from './lib/ui/emulators.svelte.js'
  import { activity } from './lib/ui/activity.svelte.js'
  import { dispatch, idleFor, markActivity, startInput } from './lib/ui/input.js'
  import { library } from './lib/ui/library.svelte.js'
  import { memory } from './lib/ui/memory.svelte.js'
  import { settings } from './lib/ui/settings.svelte.js'
  import { shelf } from './lib/ui/shelf.svelte.js'
  import { sound } from './lib/ui/sound.js'
  import { systemStatus } from './lib/ui/systemStatus.svelte.js'
  import { userData } from './lib/ui/userData.svelte.js'
  import { updates } from './lib/ui/updates.svelte.js'
  import { formatPlaytime, plural } from './lib/ui/format.js'
  import { i18n, t } from './lib/i18n/i18n.svelte.js'
  import Stage from './lib/ui/Stage.svelte'
  import CoverPicker from './screens/CoverPicker.svelte'
  import RenamePicker from './screens/RenamePicker.svelte'
  import InfoPicker from './screens/InfoPicker.svelte'
  import GameMenu from './screens/GameMenu.svelte'
  import GameSheet from './screens/GameSheet.svelte'
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
   *   | { name: 'library', systemId: string, gameId?: string }
   *   | { name: 'search', from: any }
   *   | { name: 'options', from: any, section?: string, row?: string }
   *   | { name: 'coverPicker', back: any, gameId?: string }
   *   | { name: 'renamer', back: any, gameId?: string }
   *   | { name: 'info', back: any, gameId?: string }
   *   | { name: 'sheet', back: any, gameId: string, surprise?: { pool: string[], shown: string[] } }
   *   | { name: 'guide', systemId: string, back: any }
   *   | { name: 'welcome', step: number, row?: string, back: any, auto?: boolean }} Screen
   *   welcome.auto: it opened by itself the first time (not from Options)
   *   sheet.surprise: opened by "Surprise me": the games it picks from and the ones it already showed
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
  if (mode === 'browser') controllers.watchBrowser()
  // Diagnostic log: errors from the shell and the interface, from the start
  diagnostics.start()

  onShellEvent((e) => {
    if (e.event === 'input' && e.action) dispatch(/** @type {any} */ (e.action))
    // How many controllers there are (with two or more, games to play together)
    else if (e.event === 'controllers') controllers.set(Number(e.action))
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
      collectionsRead = collections.load()
      userData.resync()
      library.loadMedia()
      systemStatus.run().then(startNotices)
      memory.start(screenLabel)
      if (finishedWhileClosed) {
        diagnostics.log(
          'back',
          t('{game} tras {time} (Relix estaba cerrado)', {
            game: gameLabel(finishedWhileClosed.id),
            time: shortDuration(finishedWhileClosed.elapsed),
          }),
        )
        announcePlaytime(finishedWhileClosed)
        const finished = finishedWhileClosed
        // A collection's games are known once the collections are read
        if (isCollectionId(String(/** @type {any} */ (finished.from)?.channel ?? ''))) collectionsRead.then(() => goBackTo(finished))
        else goBackTo(finished)
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
   * When Relix opens, after the checkup, one notice after another (not during the
   * welcome tour, which already shows the checkup): what's left to fix, once per
   * session; that Relix is of the Game type, the first time it's seen; what's new
   * in this version, once; and a new version, once per version.
   */
  let warnedSystem = false
  function startNotices() {
    if (screen.name === 'welcome') return
    /** @type {string[]} */
    const notices = []
    const { errors } = systemStatus.summary
    if (!warnedSystem && errors > 0) {
      warnedSystem = true
      notices.push(t('Relix encontró {found}: ≡ › Revisión', { found: plural(errors, 'cosa por arreglar', 'cosas por arreglar') }))
    }
    if (systemStatus.takeAppTypeNotice()) {
      notices.push(t('Relix está como Game: cámbialo a App para volver al instante (≡ › Revisión)'))
    }
    for (const line of updates.takeNews(library.all.length > 0) ?? []) notices.push(t(line, { version: VERSION }))
    const version = updates.takeNotice()
    if (version) notices.push(t('Relix {version} ya está disponible: ≡ › Revisión', { version }))
    // If another notice is on screen (the playtime, e.g.), these go after it
    const first = toast ? 3600 : 0
    notices.forEach((message, i) => setTimeout(() => showToast(message, 6000), first + i * 6500))
  }

  // A second controller turned on: the home screen has games to play together (once each time)
  let wasTogether = false
  $effect(() => {
    const together = controllers.together
    const count = controllers.count
    untrack(() => {
      if (together && !wasTogether && library.status === 'ready' && screen.name !== 'welcome' && library.all.some(isMultiplayer)) {
        setTimeout(
          () => showToast(t('{n} controles conectados: en el inicio tienes juegos para jugar juntos', { n: count }), 5000),
          toast ? 3600 : 0,
        )
      }
      wasTogether = together
    })
  })

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

  /** What's on screen, in a few words, for the memory log ("biblioteca de PS2") */
  function screenLabel() {
    if (activity.quiet) return t('protector de pantalla')
    if (screen.name === 'library') {
      const id = screen.systemId
      const channel = isCollectionId(id)
        ? id.slice(COLLECTION_PREFIX.length)
        : id === 'favorites'
          ? t('Favoritos')
          : (getPlatform(id)?.shortName ?? id)
      return t('biblioteca de {channel}', { channel })
    }
    const labels = {
      home: t('inicio'),
      search: t('búsqueda'),
      options: t('opciones'),
      coverPicker: t('portadas'),
      renamer: t('renombrar'),
      info: t('información de juegos'),
      sheet: t('ficha del juego'),
      guide: t('guía'),
      welcome: t('bienvenida'),
    }
    return labels[/** @type {keyof typeof labels} */ (screen.name)] ?? screen.name
  }

  /** @type {Promise<void>} */
  let collectionsRead = Promise.resolve()

  /**
   * The Xbox closed Relix while you played: back where you were when the game opened,
   * the same library with that game focused (see core/place.js). Only if you haven't
   * moved from the home screen yet.
   * @param {{ id: string, from: unknown }} finished
   */
  function goBackTo({ id, from }) {
    const place = returnTo(from, library.byId.get(id), (channel) => shelf.gamesFor(channel).some((g) => g.id === id))
    if (!place || screen.name !== 'home') return
    boot = false
    if (place.view === 'library') {
      focusedId = isCollectionId(place.channel) ? COLLECTIONS.id : place.channel
      screen = { name: 'library', systemId: place.channel, gameId: place.gameId }
    } else if (place.channel) {
      focusedId = place.channel
    }
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
  function renameFile(game) {
    screen = { name: 'renamer', back: screen, gameId: game.id }
  }

  /** @param {any} game */
  function findInfo(game) {
    screen = { name: 'info', back: screen, gameId: game.id }
  }

  /**
   * The game's full sheet. Coming back from it, the library has that game focused.
   * @param {any} game
   */
  function openSheet(game) {
    menu = null
    const back = screen.name === 'library' ? { ...screen, gameId: game.id } : screen
    screen = { name: 'sheet', back, gameId: game.id }
  }

  /**
   * "Surprise me" (core/surprise.js): a random game that can be played, in its sheet.
   * From the home screen, among every console; from a library, among the games it shows.
   * @param {any[]} games
   * @param {string} [focusedGameId]  the game focused in the library: coming back, it's still there
   */
  function surprise(games, focusedGameId) {
    const playable = games.filter((g) => emulators.forGame(g))
    // With two or more controllers, among the games for several players (if there are any)
    const together = controllers.together ? playable.filter(isMultiplayer) : []
    const pool = (together.length > 0 ? together : playable.length > 0 ? playable : games).map((g) => g.id)
    const back = screen.name === 'library' && focusedGameId ? { ...screen, gameId: focusedGameId } : screen
    showSurprise(pool, [], back)
  }

  /** The sheet's "Another": the next one, without repeating until all were shown */
  function anotherSurprise() {
    if (screen.name !== 'sheet' || !screen.surprise) return
    showSurprise(screen.surprise.pool, screen.surprise.shown, screen.back)
  }

  /** @param {string[]} pool @param {string[]} shown @param {any} back */
  function showSurprise(pool, shown, back) {
    const games = pool.map((id) => library.byId.get(id)).filter((g) => g !== undefined)
    const game = pickSurprise(games, { playtime: library.playtime, lastPlayed: library.lastPlayed, shown })
    if (!game) {
      sound.error()
      showToast(t('Todavía no hay juegos para elegir.'))
      return
    }
    // Once every game was shown, the round starts over
    const round = shown.length >= games.length ? [] : shown
    screen = { name: 'sheet', back, gameId: game.id, surprise: { pool, shown: [...round, game.id] } }
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
    // The session starts counting and is on the USB drive before the Xbox switches to the
    // emulator, with where you were: if the Xbox closes Relix, it opens there again
    library.startSession(game, placeFor(screen, focusedId))
    diagnostics.log('launch', t('{game} con {emulator} · {uri}', { game: gameLabel(game.id), emulator: emulator.name, uri }))
    await memory.beforeGame(gameLabel(game.id))
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
      onSurprise={() => surprise(library.all)}
    />
  {:else if screen.name === 'library'}
    <Library
      systemId={screen.systemId}
      focusGameId={screen.gameId}
      onBack={() => (screen = { name: 'home' })}
      onSwitch={openLibrary}
      onLaunch={startGame}
      onOptions={openOptions}
      onMenu={openMenu}
      onSearch={openSearch}
      onGuide={openGuide}
      onSheet={openSheet}
      onSurprise={surprise}
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
      onRenameFiles={() => (screen = { name: 'renamer', back: { ...options, section: 'library', row: 'rename' } })}
      onGameInfo={() => (screen = { name: 'info', back: { ...options, section: 'library', row: 'info' } })}
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
        if (to.name === 'home') startNotices()
      }}
      onToast={showToast}
    />
  {:else if screen.name === 'renamer'}
    {@const back = screen.back}
    <RenamePicker gameId={screen.gameId} onBack={() => (screen = back)} onToast={showToast} />
  {:else if screen.name === 'info'}
    {@const back = screen.back}
    <InfoPicker gameId={screen.gameId} onBack={() => (screen = back)} onToast={showToast} />
  {:else if screen.name === 'sheet'}
    {@const back = screen.back}
    <!-- each surprise is a new sheet: it comes in with its animation and the description from the top -->
    {#key screen.gameId}
      <GameSheet
        gameId={screen.gameId}
        onBack={() => (screen = back)}
        onLaunch={startGame}
        onMenu={(game) => openMenu(game)}
        onAnother={screen.surprise ? anotherSurprise : undefined}
      />
    {/key}
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
      onRename={renameFile}
      onFindInfo={findInfo}
      onSheet={screen.name === 'sheet' ? undefined : openSheet}
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
