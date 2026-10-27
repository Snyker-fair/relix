<script>
  import { untrack } from 'svelte'
  import { mode, notifyReady, onShellEvent } from './lib/core/bridge.js'
  import { getPlatform } from './lib/core/platforms.js'
  import { placeFor, returnTo } from './lib/core/place.js'
  import { pickSurprise } from './lib/core/surprise.js'
  import { shortDuration } from './lib/core/diagnostics.js'
  import { diagnostics } from './lib/ui/diagnostics.svelte.js'
  import { COLLECTIONS, COLLECTION_PREFIX, isCollectionId } from './lib/ui/channels.js'
  import { collections } from './lib/ui/collections.svelte.js'
  import { emulators } from './lib/ui/emulators.svelte.js'
  import { activity } from './lib/ui/activity.svelte.js'
  import { dispatch, idleFor, markActivity, startInput } from './lib/ui/input.js'
  import { announcePlaytime, gameLabel, launcher } from './lib/ui/launcher.svelte.js'
  import { library } from './lib/ui/library.svelte.js'
  import { memory } from './lib/ui/memory.svelte.js'
  import { settings } from './lib/ui/settings.svelte.js'
  import { shelf } from './lib/ui/shelf.svelte.js'
  import { sound } from './lib/ui/sound.js'
  import { showStartNotices, startSummary } from './lib/ui/startup.js'
  import { systemStatus } from './lib/ui/systemStatus.svelte.js'
  import { toasts } from './lib/ui/toasts.svelte.js'
  import { userData } from './lib/ui/userData.svelte.js'
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
  /** @type {{ game: any, sortOptions?: import('./lib/core/sorting.js').SortOrder[], filterChannel?: string, fromRecent?: boolean } | null} */
  let menu = $state(null)
  /** The channel with the focus on the home screen (a console id, 'favorites' or 'options'). null = the first one */
  /** @type {string|null} */
  let focusedId = $state(null)
  let boot = $state(true)

  // In the browser: keyboard and controller with the Gamepad API.
  // On the Xbox: the C# shell reads the controller and it arrives as an 'input' event.
  startInput({ keyboard: mode === 'browser', gamepad: mode === 'browser' })
  // Diagnostic log: errors from the shell and the interface, from the start
  diagnostics.start()

  onShellEvent((e) => {
    if (e.event === 'input' && e.action) dispatch(/** @type {any} */ (e.action))
    // Near the memory limit: the shell asked WebView2 to let go of what it keeps
    else if (e.event === 'memoryLevel' && e.action === 'high') memory.nearLimit()
    // You're back in Relix: when the emulator closes (resumed) or another way, like the Xbox button (visible)
    else if (e.event === 'resumed' || e.event === 'visible') {
      markActivity() // time spent playing doesn't count toward the screensaver
      launcher.back({ fromEmulator: true })
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
      if (userData.recoveredFrom) toasts.show(t('Tus datos se recuperaron de {file}', { file: `relix\\${userData.recoveredFrom}` }))
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

  /** The notices when Relix opens (lib/ui/startup.js): not during the welcome tour, which already shows the checkup */
  function startNotices() {
    if (screen.name !== 'welcome') showStartNotices()
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
        toasts.show(error)
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

  $effect(() => {
    const timer = setTimeout(() => (boot = false), 1400)
    return () => clearTimeout(timer)
  })

  // Screensaver: after the chosen minutes without touching the controller.
  // It doesn't show up in the welcome tour or while a game opens
  $effect(() => {
    const minutes = settings.screensaverMinutes
    if (!minutes || library.status !== 'ready') return
    const timer = setInterval(() => {
      if (activity.screensaver || launcher.launching || screen.name === 'welcome' || document.hidden) return
      if (idleFor() >= minutes * 60_000) activity.screensaver = true
    }, 5000)
    return () => clearInterval(timer)
  })

  function closeScreensaver() {
    activity.screensaver = false
    markActivity()
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
   * @param {boolean} [fromRecent]  from "Continue playing" on the home screen (Y › Remove from Continue playing)
   */
  function openMenu(game, sortOptions, filterChannel, fromRecent = false) {
    menu = { game, sortOptions, filterChannel, fromRecent }
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
    const pool = (playable.length > 0 ? playable : games).map((g) => g.id)
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
      toasts.show(t('Todavía no hay juegos para elegir.'))
      return
    }
    // Once every game was shown, the round starts over
    const round = shown.length >= games.length ? [] : shown
    screen = { name: 'sheet', back, gameId: game.id, surprise: { pool, shown: [...round, game.id] } }
  }

  /**
   * Opens a game (lib/ui/launcher.svelte.js), remembering where you are: if the
   * Xbox closes Relix while you play, it opens there again
   * @param {any} game
   */
  function startGame(game) {
    launcher.start(game, placeFor(screen, focusedId))
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
      onMenu={(game) => openMenu(game, undefined, undefined, true)}
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
      onToast={toasts.show}
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
      onToast={toasts.show}
    />
  {:else if screen.name === 'renamer'}
    {@const back = screen.back}
    <RenamePicker gameId={screen.gameId} onBack={() => (screen = back)} onToast={toasts.show} />
  {:else if screen.name === 'info'}
    {@const back = screen.back}
    <InfoPicker gameId={screen.gameId} onBack={() => (screen = back)} onToast={toasts.show} />
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
    <CoverPicker gameId={screen.gameId} onBack={() => (screen = back)} onToast={toasts.show} />
  {/if}

  {#if menu}
    <GameMenu
      game={menu.game}
      sortOptions={menu.sortOptions}
      filterChannel={menu.filterChannel}
      fromRecent={menu.fromRecent}
      onClose={() => (menu = null)}
      onLaunch={startGame}
      onChangeCover={changeCover}
      onRename={renameFile}
      onFindInfo={findInfo}
      onSheet={screen.name === 'sheet' ? undefined : openSheet}
      onToast={toasts.show}
    />
  {/if}

  {#if launcher.launching}
    {@const launching = launcher.launching}
    <LaunchOverlay
      game={launching.game}
      uri={launching.uri}
      emulatorName={launching.emulatorName}
      note={launching.note}
      onClose={() => launcher.back()}
    />
  {/if}

  {#if toasts.message}
    <div class="toast" role="status">{toasts.message}</div>
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
