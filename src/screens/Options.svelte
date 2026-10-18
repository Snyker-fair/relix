<script>
  import { untrack } from 'svelte'
  import { mode } from '../lib/core/bridge.js'
  import { REGION_NAMES } from '../lib/core/coverMatch.js'
  import { BUILD_DATE, VERSION } from '../lib/core/version.js'
  import About from './About.svelte'
  import { getPlatform, launcherDetail, PLATFORMS } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import { covers } from '../lib/ui/covers.svelte.js'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { coverSummary, formatDate, formatHour, plural, scanSummary, timeAgo } from '../lib/ui/format.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { settings } from '../lib/ui/settings.svelte.js'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import { sound } from '../lib/ui/sound.js'
  import { systemStatus } from '../lib/ui/systemStatus.svelte.js'
  import { updates } from '../lib/ui/updates.svelte.js'
  import { diagnostics } from '../lib/ui/diagnostics.svelte.js'
  import LogViewer from './LogViewer.svelte'
  import { NIGHT, THEME_NAMES } from '../lib/core/theme.js'
  import { theme } from '../lib/ui/theme.svelte.js'
  import { LANGUAGE_NAMES } from '../lib/core/language.js'
  import { i18n, t, tn } from '../lib/i18n/i18n.svelte.js'

  /**
   * @type {{
   *   onBack: () => void,
   *   onToast: (message: string) => void,
   *   onPickCovers: () => void,
   *   onGuide: (systemId: string, from: { section: string, row: string }) => void,
   *   onWelcome: () => void,
   *   initialSection?: string,
   *   initialRow?: string,
   * }}
   *   initialRow: fila con el foco al abrir (p. ej. la consola de la guía de la que vuelves).
   *   En Revisión basta la consola: "psx" enfoca su primer chequeo ("emu:psx").
   */
  let { onBack, onToast, onPickCovers, onGuide, onWelcome, initialSection = 'library', initialRow } = $props()

  // Secciones: se cambian con LB/RB, igual que las consolas en la biblioteca
  const SECTIONS = $derived([
    { id: 'library', name: t('Biblioteca') },
    { id: 'consoles', name: t('Consolas') },
    { id: 'check', name: t('Revisión') },
    { id: 'covers', name: t('Portadas') },
    { id: 'preferences', name: t('Preferencias') },
    { id: 'about', name: t('Acerca de') },
  ])
  // Biblioteca: una fila por consola, "Escanear todo" y los juegos ocultos
  const LIBRARY_ROWS = [...PLATFORMS.map((p) => p.id), 'all', 'hidden']
  const PREFERENCE_ROWS = ['language', 'theme', 'empty', 'sounds', 'region', 'video', 'screensaver']
  // Consolas: con qué emulador se abre cada una
  const CONSOLE_ROWS = PLATFORMS.map((p) => p.id)
  /** Cuántas apps de emulador distintas tiene la Xbox (RetroArch cuenta una vez) */
  const installedApps = $derived(
    new Set(
      PLATFORMS.flatMap((p) => p.emulators)
        .filter((e) => emulators.isInstalled(e) === true)
        .map((e) => e.launcher.protocol),
    ).size,
  )

  // Portadas: las consolas con juegos, "Buscar en todas" y "Elegir a mano"
  const coverPlatforms = $derived.by(() => {
    const withGames = PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0)
    return withGames.length > 0 ? withGames : PLATFORMS
  })
  const COVER_ROWS = $derived([...coverPlatforms.map((p) => p.id), 'all', 'choose'])

  // Revisión: primero lo que hay que arreglar, después los avisos y lo que está bien
  const STATE_ORDER = { update: -1, error: 0, warn: 1, info: 2, ok: 3 }
  const sortedChecks = $derived(
    [...systemStatus.checks].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]),
  )
  const checkById = $derived(new Map(sortedChecks.map((c) => [c.id, c])))
  const CHECK_ROWS = $derived([...sortedChecks.map((c) => c.id), 'recheck', 'log', 'welcome'])
  /** El visor del registro de diagnóstico, encima de Revisión */
  let showLog = $state(false)
  const logDrive = $derived(library.romRoot.replace(/roms[\\/]*$/i, '') || 'E:\\')
  const MARKS = { ok: '✓', warn: '!', error: '✗', info: 'i', update: '↑' }
  const STATE_TINTS = { ok: '#3FAE49', warn: '#F2B705', error: 'var(--pop)', info: '#8FA3BF', update: 'var(--btn-x)' }

  // Solo importa al abrir (p. ej. volver a Portadas desde "Elegir a mano")
  // svelte-ignore state_referenced_locally
  let section = $state(initialSection)
  const ROWS = $derived(
    section === 'library'
      ? LIBRARY_ROWS
      : section === 'consoles'
        ? CONSOLE_ROWS
        : section === 'check'
          ? CHECK_ROWS
          : section === 'covers'
            ? COVER_ROWS
            : section === 'preferences'
              ? PREFERENCE_ROWS
              : [], // Acerca de: solo para leer
  )

  // Lista que se desliza: el desplazamiento justo para que la fila enfocada
  // quede entera a la vista, con margen para su aro
  let rowsScroll = $state(0)
  /** @type {HTMLElement | undefined} */
  let rowsEl = $state()
  $effect(() => {
    const el = /** @type {HTMLElement | undefined} */ (rowsEl?.children[index])
    const view = rowsEl?.parentElement?.clientHeight ?? 0
    if (!rowsEl || !el || !view) return
    const MARGIN = 28
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    const max = Math.max(0, rowsEl.scrollHeight - view)
    untrack(() => {
      let next = rowsScroll
      if (top - next < MARGIN) next = top - MARGIN
      else if (bottom - next > view - MARGIN) next = bottom - view + MARGIN
      rowsScroll = Math.max(0, Math.min(next, max))
    })
  })

  // Al entrar a Consolas se vuelve a preguntar qué hay instalado
  $effect(() => {
    if (section === 'consoles') untrack(() => emulators.check())
  })
  // Al entrar a Revisión se revisa de nuevo, salvo que se haya hecho recién
  // (p. ej. al volver de una guía)
  $effect(() => {
    if (section !== 'check') return
    untrack(() => {
      if (Date.now() - systemStatus.checkedAt > 20_000) systemStatus.run().then(() => (now = Date.now()))
    })
  })
  /** "2026-10-16" -> "16 oct 2026" ("Oct 16, 2026" en inglés) */
  const buildDate = $derived(
    BUILD_DATE ? formatDate(new Date(`${BUILD_DATE}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '',
  )
  /** La fila de initialRow: exacta o, en Revisión, el primer chequeo de esa consola */
  function initialIndex() {
    if (!initialRow) return 0
    const exact = ROWS.indexOf(initialRow)
    if (exact >= 0) return exact
    return Math.max(0, ROWS.findIndex((id) => id.endsWith(`:${initialRow}`)))
  }
  let index = $state(initialIndex())

  // En Revisión las filas cambian al revisar de nuevo (aparecen, se arreglan):
  // el foco sigue a la fila que tenía y no a su posición
  let focusedKey = ''
  $effect.pre(() => {
    const rows = ROWS
    untrack(() => {
      if (section !== 'check' || !focusedKey.startsWith('check/')) return
      const i = rows.indexOf(focusedKey.slice(6))
      if (i >= 0 && i !== index) index = i
      else if (i < 0 && index >= rows.length) index = rows.length - 1
    })
  })
  $effect(() => {
    focusedKey = `${section}/${ROWS[index] ?? ''}`
  })
  /** true mientras corre "Escanear todo" (las filas muestran cuál va) */
  let scanningAll = $state(false)
  /** true mientras corre "Buscar en todas" */
  const searchingAll = $derived(covers.all !== null)
  /** Para refrescar los "hace X min" mientras la pantalla está abierta */
  let now = $state(Date.now())

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000)
    return () => clearInterval(timer)
  })

  const busy = $derived(library.scanning.length > 0)
  const totalGames = $derived(PLATFORMS.reduce((n, p) => n + library.gamesFor(p.id).length, 0))
  const coverBusy = $derived(covers.busy !== null || searchingAll)
  const coverTotals = $derived(
    PLATFORMS.reduce(
      (sum, p) => {
        const count = library.coverCount(p.id)
        return { withCover: sum.withCover + count.withCover, total: sum.total + count.total }
      },
      { withCover: 0, total: 0 },
    ),
  )
  const hintA = $derived(
    section === 'library'
      ? ROWS[index] === 'hidden'
        ? t('Mostrar')
        : t('Escanear')
      : section === 'preferences' || section === 'consoles'
        ? t('Cambiar')
        : section === 'check'
          ? ROWS[index] === 'recheck'
            ? t('Revisar')
            : ROWS[index] === 'welcome' || ROWS[index] === 'log'
              ? t('Ver')
              : checkById.get(ROWS[index])?.action
                ? t('Ver guía')
                : ''
          : ROWS[index] === 'choose'
            ? t('Elegir')
            : t('Buscar'),
  )

  /** @param {string} id */
  function rowMeta(id) {
    const scan = library.scans[id]
    const count = plural(library.gamesFor(id).length, 'juego', 'juegos')
    return { count, where: library.romFolderPath(id), when: scan ? timeAgo(scan.scannedAt, now) : t('sin escanear') }
  }

  /** @param {string} id */
  async function scanOne(id) {
    const platform = PLATFORMS.find((p) => p.id === id)
    const [change] = await library.rescan([id])
    now = Date.now()
    return scanSummary(platform?.shortName ?? id, change)
  }

  async function scanRow() {
    const id = ROWS[index]
    if (id === 'hidden') return unhideRow()
    if (busy || scanningAll) return
    sound.select()
    try {
      if (id !== 'all') {
        onToast(await scanOne(id))
      } else {
        // Una consola tras otra, para que se vea el avance fila por fila
        let added = 0
        let removed = 0
        scanningAll = true
        try {
          for (const p of PLATFORMS) {
            const [change] = await library.rescan([p.id])
            added += change.added
            removed += change.removed
          }
        } finally {
          scanningAll = false
        }
        now = Date.now()
        onToast(
          added + removed === 0
            ? t('Listo: sin cambios ({games} en {consoles} consolas)', {
                games: plural(totalGames, 'juego', 'juegos'),
                consoles: PLATFORMS.length,
              })
            : scanSummary(t('Listo'), { added, removed, total: totalGames }),
        )
      }
      sound.favorite()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudo escanear. Revisa que el USB esté conectado.'))
    }
  }

  function unhideRow() {
    const count = library.hiddenCount()
    if (count === 0) {
      sound.error()
      onToast(t('No hay juegos ocultos. Se ocultan desde el menú del juego (Y).'))
      return
    }
    library.unhideAll()
    sound.favorite()
    onToast(tn(count, 'Listo: {n} juego vuelve a la biblioteca', 'Listo: {n} juegos vuelven a la biblioteca'))
  }

  async function coverRow() {
    const id = ROWS[index]
    if (id === 'choose') {
      if (covers.pending.length === 0) {
        sound.error()
        onToast(t('No hay portadas por elegir. Primero busca en una consola.'))
        return
      }
      sound.select()
      onPickCovers()
      return
    }
    if (coverBusy) return
    sound.select()
    try {
      if (id !== 'all') {
        onToast(coverSummary(getPlatform(id)?.shortName ?? id, await covers.find(id)))
      } else {
        // Una consola tras otra, solo las que tienen juegos sin portada
        onToast(coverSummary(t('Listo'), await covers.findAll()))
      }
      now = Date.now()
      sound.favorite()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudieron buscar las portadas.'))
    }
  }

  /** Consolas: A pasa al emulador siguiente */
  function consoleRow() {
    const platform = getPlatform(ROWS[index])
    if (!platform) return
    if (platform.emulators.length === 0) {
      sound.error()
      onToast(
        platform.noEmulatorNote
          ? t(platform.noEmulatorNote)
          : t('{console} todavía no tiene un emulador para abrir juegos.', { console: platform.name }),
      )
      return
    }
    if (platform.emulators.length === 1) {
      sound.error()
      onToast(t('Por ahora {console} se abre solo con {emulator}.', { console: platform.name, emulator: platform.emulators[0].name }))
      return
    }
    const next = emulators.cyclePlatform(platform)
    sound.select()
    if (next?.note) onToast(`${next.name}: ${t(next.note)}.`)
  }

  /** Revisión: A abre la guía del chequeo, revisa de nuevo o abre el recorrido */
  async function checkRow() {
    const id = ROWS[index]
    if (id === 'welcome') {
      sound.select()
      onWelcome()
      return
    }
    if (id === 'log') {
      sound.select()
      showLog = true
      return
    }
    if (id === 'recheck') {
      if (systemStatus.running) return
      sound.select()
      await systemStatus.run({ forceUpdate: true })
      now = Date.now()
      const { errors, warnings } = systemStatus.summary
      const found = [
        errors > 0 ? plural(errors, 'cosa por arreglar', 'cosas por arreglar') : '',
        warnings > 0 ? plural(warnings, 'aviso', 'avisos') : '',
      ].filter(Boolean)
      onToast(
        found.length === 0
          ? t('Listo: todo en orden')
          : t('Listo: {found}', { found: found.length === 2 ? t('{a} y {b}', { a: found[0], b: found[1] }) : found[0] }),
      )
      return
    }
    const check = checkById.get(id)
    if (!check?.action) return sound.error()
    sound.select()
    onGuide(check.action.systemId, { section, row: id })
  }

  function toggleRow() {
    const id = ROWS[index]
    if (id === 'empty') settings.toggleEmptyConsoles()
    else if (id === 'sounds') settings.toggleSounds()
    else if (id === 'region') settings.cycleCoverRegion()
    else if (id === 'video') settings.toggleVideoSound()
    else if (id === 'screensaver') settings.cycleScreensaver()
    else if (id === 'theme') settings.cycleTheme()
    else if (id === 'language') settings.cycleLanguage()
    sound.select() // con los sonidos recién apagados, este ya no suena
  }

  /** "45 de 52 con portada" y qué tan llena está la consola (0 a 1) */
  function coverMeta(/** @type {string} */ id) {
    const { withCover, total } = library.coverCount(id)
    return {
      text: t('{n} de {total} con portada', { n: withCover, total }),
      full: total > 0 && withCover === total,
      ratio: total > 0 ? withCover / total : 0,
    }
  }

  /** @param {number} delta */
  function switchSection(delta) {
    const next = SECTIONS.findIndex((s) => s.id === section) + delta
    if (next < 0 || next >= SECTIONS.length) return
    section = SECTIONS[next].id
    index = 0
    sound.move()
  }

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= ROWS.length || next === index) return
    index = next
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (action === 'up') move(index - 1)
      else if (action === 'down') move(index + 1)
      else if (action === 'lb') switchSection(-1)
      else if (action === 'rb') switchSection(1)
      else if (action === 'y' && section === 'consoles') (sound.select(), onGuide(ROWS[index], { section, row: ROWS[index] }))
      else if (action === 'a' && section !== 'about')
        section === 'library'
          ? scanRow()
          : section === 'consoles'
            ? consoleRow()
            : section === 'check'
              ? checkRow()
              : section === 'covers'
                ? coverRow()
                : toggleRow()
      else if (action === 'b' || action === 'start') (sound.back(), onBack())
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <nav class="tabs" aria-label={t('Secciones')}>
    <button class="bumper" onclick={() => dispatch('lb')} aria-label={t('Sección anterior')}>
      <PadButton name="lb" size={30} />
    </button>
    {#each SECTIONS as s (s.id)}
      <button
        class="tab"
        class:active={s.id === section}
        onclick={() => s.id !== section && ((section = s.id), (index = 0), sound.move())}
      >
        {s.name}
      </button>
    {/each}
    <button class="bumper" onclick={() => dispatch('rb')} aria-label={t('Sección siguiente')}>
      <PadButton name="rb" size={30} />
    </button>
  </nav>

  <Clock />
</header>

<section class="intro">
  <span class="intro-icon"><ChannelIcon id="options" color="currentColor" size={84} /></span>
  <h1>{t('Opciones')}</h1>
  {#if section === 'library'}
    <h2>{t('Biblioteca')}</h2>
    <p>
      {t(
        'Relix guarda la lista de juegos de cada consola para abrir al instante. Escanea una consola cuando agregues o quites juegos de su carpeta.',
      )}
    </p>
    <ul class="chips">
      <li>{plural(totalGames, 'juego', 'juegos')}</li>
      <li>{library.romRoot}</li>
    </ul>
  {:else if section === 'consoles'}
    <h2>{t('Consolas')}</h2>
    <p>
      {t('Con qué emulador se abre cada consola. Para un juego puntual, en la biblioteca usa')}
      <strong>{t('Y › Abrir con…')}</strong>
    </p>
    <ul class="chips">
      <li>{plural(PLATFORMS.length, 'consola', 'consolas')}</li>
      {#if emulators.installed}
        <li>{plural(installedApps, 'emulador instalado', 'emuladores instalados')}</li>
      {/if}
    </ul>
  {:else if section === 'check'}
    {@const { errors, warnings } = systemStatus.summary}
    <h2>{t('Revisión')}</h2>
    <p>
      {t('Relix revisa tu USB, los emuladores y las BIOS. Si algo falta,')} <PadButton name="a" size={26} />
      {t('abre la guía que explica cómo dejarlo listo.')}
    </p>
    <ul class="chips">
      {#if systemStatus.running && !systemStatus.checkedAt}
        <li>{t('Revisando…')}</li>
      {:else if errors + warnings === 0}
        <li class="ok">{t('Todo en orden')}</li>
      {:else}
        {#if errors > 0}<li class="error">{plural(errors, 'cosa por arreglar', 'cosas por arreglar')}</li>{/if}
        {#if warnings > 0}<li class="warn">{plural(warnings, 'aviso', 'avisos')}</li>{/if}
      {/if}
    </ul>
    <p class="note">
      {t(
        'Relix solo ve el USB: si pusiste una BIOS dentro del emulador con el Device Portal, aquí sale como aviso aunque funcione.',
      )}
    </p>
  {:else if section === 'covers'}
    <h2>{t('Portadas')}</h2>
    <p>
      {t(
        'Relix las busca en libretro, las mismas de RetroArch, y las guarda en el USB junto a las de ES-DE. Si no está seguro de cuál es, te deja elegir. También baja una captura de cada juego para el fondo de su ficha.',
      )}
    </p>
    <ul class="chips">
      <li>{t('{n} de {total} con portada', { n: coverTotals.withCover, total: coverTotals.total })}</li>
      <li>{t('Región: {region}', { region: t(REGION_NAMES[settings.coverRegion]) })}</li>
    </ul>
  {:else if section === 'about'}
    <h2>{t('Acerca de')}</h2>
    <p>
      {t('Tus reliquias, listas para jugar: un lanzador para tus emuladores en la Xbox que lee tu USB como lo deja ES-DE.')}
    </p>
    <ul class="chips">
      <li>{t('Versión {version}', { version: VERSION })}</li>
      {#if updates.available && updates.latest}
        <li class="new">{t('Hay una versión nueva: {version}', { version: updates.latest.version })}</li>
      {/if}
      <!-- Con versión nueva, su aviso ocupa el lugar de la fecha (si no, los créditos no caben) -->
      {#if buildDate && !updates.available}<li>{t('Compilada el {date}', { date: buildDate })}</li>{/if}
      <li>{mode === 'xbox' ? t('Xbox · Modo Desarrollador') : t('Demo en el navegador')}</li>
    </ul>
    <div class="credits">
      <strong>© 2026 snyker-fair</strong>
      <!-- Aviso que pide la GPL en un programa interactivo: autor, licencia, sin garantía y dónde leerla -->
      <p class="legal">
        {t('Licencia GPL-3.0 o posterior, sin garantía: compártelo y modifícalo bajo sus términos (ver LICENSE).')}
      </p>
      <p>{t('Portadas de libretro · formato de ES-DE · letras SIL OFL')}</p>
    </div>
  {:else}
    <h2>{t('Preferencias')}</h2>
    <p>
      {t(
        'El idioma, el tema claro u oscuro, qué se ve en el inicio, cómo suena Relix, qué portadas prefieres y cuándo aparece el protector de pantalla. Los cambios se guardan solos.',
      )}
    </p>
  {/if}
</section>

{#if section === 'about'}
<About />
{:else}
<!-- Con doce consolas las filas no caben: la lista se desliza para mostrar la enfocada -->
<div class="rows-window">
{#if section === 'library'}
<section class="rows compact" aria-label={t('Escanear consolas')} bind:this={rowsEl} style:transform="translateY({-rowsScroll}px)">
  {#each ROWS as id, i (id)}
    {@const platform = PLATFORMS.find((p) => p.id === id)}
    {@const focused = i === index}
    {@const scanning = library.scanning.includes(id)}
    <button
      class="row focus-ring"
      class:focused
      class:all={id === 'all'}
      style:--tint={platform?.color ?? 'var(--pop)'}
      onmouseenter={() => move(i)}
      onclick={() => (i === index ? scanRow() : move(i))}
    >
      {#if platform}
        {@const meta = rowMeta(id)}
        <span class="badge" style:background={platform.color}>
          <ChannelIcon id={id} color={platform.ink} size={46} />
        </span>
        <span class="text">
          <strong>{platform.name}</strong>
          <span>{t('{games} en', { games: meta.count })} <code>{meta.where}</code></span>
        </span>
        <span class="state">
          {#if scanning}
            <span class="spinner" aria-hidden="true"></span> {t('Escaneando…')}
          {:else if focused && !busy}
            <PadButton name="a" size={30} /> {t('Escanear')}
          {:else}
            {meta.when}
          {/if}
        </span>
      {:else if id === 'hidden'}
        {@const hiddenCount = library.hiddenCount()}
        <span class="badge neutral">
          <ChannelIcon id="hide" color="currentColor" size={46} />
        </span>
        <span class="text">
          <strong>{t('Juegos ocultos')}</strong>
          <span>
            {hiddenCount > 0
              ? tn(hiddenCount, '{n} juego oculto con Y › Ocultar juego', '{n} juegos ocultos con Y › Ocultar juego')
              : t('Ninguno. Se ocultan desde el menú del juego (Y)')}
          </span>
        </span>
        <span class="state">
          {#if focused && hiddenCount > 0}
            <PadButton name="a" size={30} /> {t('Mostrar de nuevo')}
          {:else if hiddenCount > 0}
            <span class="value on">{hiddenCount}</span>
          {/if}
        </span>
      {:else}
        <span class="badge refresh">
          <ChannelIcon id="refresh" color="#FFFFFF" size={46} />
        </span>
        <span class="text">
          <strong>{t('Escanear todo')}</strong>
          <span>{t('Las {n} consolas, una tras otra', { n: PLATFORMS.length })}</span>
        </span>
        <span class="state">
          {#if scanningAll}
            <span class="spinner" aria-hidden="true"></span> {t('Escaneando…')}
          {:else if focused && !busy}
            <PadButton name="a" size={30} /> {t('Escanear')}
          {/if}
        </span>
      {/if}
    </button>
  {/each}
</section>
{:else if section === 'consoles'}
<section class="rows compact" aria-label={t('Emulador de cada consola')} bind:this={rowsEl} style:transform="translateY({-rowsScroll}px)">
  {#each ROWS as id, i (id)}
    {@const platform = /** @type {import('../lib/core/platforms.js').Platform} */ (getPlatform(id))}
    {@const focused = i === index}
    {@const emulator = emulators.forPlatform(platform)}
    {@const installed = emulator ? emulators.isInstalled(emulator) : null}
    {@const count = library.gamesFor(id).length}
    <button
      class="row focus-ring"
      class:focused
      style:--tint={platform.color}
      onmouseenter={() => move(i)}
      onclick={() => (i === index ? consoleRow() : move(i))}
    >
      <span class="badge" style:background={platform.color}>
        <ChannelIcon {id} color={platform.ink} size={46} />
      </span>
      <span class="text">
        <strong>{platform.name}<small>{plural(count, 'juego', 'juegos')}</small></strong>
        {#if emulator}
          <span>{emulator.name} · <code>{launcherDetail(emulator.launcher)}</code></span>
        {:else}
          <span>{t('Sin emulador: Cemu aún no se abre desde otra app')}</span>
        {/if}
      </span>
      <span class="state">
        {#if focused && platform.emulators.length > 1}
          <PadButton name="a" size={30} /> {t('Cambiar')}
          <span class="value"
            >{t('{n} de {total}', {
              n: platform.emulators.findIndex((e) => e.id === emulator?.id) + 1,
              total: platform.emulators.length,
            })}</span
          >
        {:else if installed === true}
          <span class="value ok">{t('Instalado')}</span>
        {:else if installed === false}
          <span class="value missing">{t('No instalado')}</span>
        {:else if !emulator}
          <span class="value">—</span>
        {/if}
      </span>
    </button>
  {/each}
</section>
{:else if section === 'check'}
<section class="rows review" aria-label={t('Revisión del sistema')} bind:this={rowsEl} style:transform="translateY({-rowsScroll}px)">
  {#each ROWS as id, i (id)}
    {@const check = checkById.get(id)}
    {@const focused = i === index}
    <button
      class="row focus-ring"
      class:focused
      class:all={id === 'recheck'}
      style:--tint={check ? STATE_TINTS[check.state] : 'var(--pop)'}
      onmouseenter={() => move(i)}
      onclick={() => (i === index ? checkRow() : move(i))}
    >
      {#if check}
        <span class="badge mark {check.state}" aria-hidden="true">{MARKS[check.state]}</span>
        <span class="text">
          <strong>{check.title}</strong>
          <span class="explain">{check.detail}</span>
        </span>
        <span class="state">
          {#if focused && check.action}<PadButton name="a" size={30} /> {t('Guía')}{/if}
        </span>
      {:else if id === 'recheck'}
        <span class="badge refresh">
          <ChannelIcon id="refresh" color="#FFFFFF" size={46} />
        </span>
        <span class="text">
          <strong>{t('Revisar de nuevo')}</strong>
          <span>
            {systemStatus.running
              ? t('Revisando el USB, los emuladores y la conexión…')
              : systemStatus.checkedAt
                ? t('Última revisión {when}', { when: timeAgo(systemStatus.checkedAt, now) })
                : t('Todavía no se revisa')}
          </span>
        </span>
        <span class="state">
          {#if systemStatus.running}
            <span class="spinner" aria-hidden="true"></span> {t('Revisando…')}
          {:else if focused}
            <PadButton name="a" size={30} /> {t('Revisar')}
          {/if}
        </span>
      {:else if id === 'log'}
        <span class="badge neutral">
          <ChannelIcon id="log" color="currentColor" size={46} />
        </span>
        <span class="text">
          <strong>{t('Registro de diagnóstico')}</strong>
          <span>
            <code>{logDrive}relix\registro.txt</code> ·
            {diagnostics.lastAt
              ? t('última entrada {when}', { when: timeAgo(diagnostics.lastAt, now) })
              : t('cada juego que abres y cada error')}
          </span>
        </span>
        <span class="state">
          {#if focused}<PadButton name="a" size={30} /> {t('Ver')}{/if}
        </span>
      {:else}
        <span class="badge neutral">
          <ChannelIcon id="flag" color="currentColor" size={46} />
        </span>
        <span class="text">
          <strong>{t('Recorrido de bienvenida')}</strong>
          <span>{t('Los primeros pasos de Relix, otra vez')}</span>
        </span>
        <span class="state">
          {#if focused}<PadButton name="a" size={30} /> {t('Ver')}{/if}
        </span>
      {/if}
    </button>
  {/each}
</section>
{:else if section === 'covers'}
<section class="rows compact" aria-label={t('Portadas')} bind:this={rowsEl} style:transform="translateY({-rowsScroll}px)">
  {#each ROWS as id, i (id)}
    {@const platform = PLATFORMS.find((p) => p.id === id)}
    {@const focused = i === index}
    <button
      class="row focus-ring"
      class:focused
      class:all={id === 'all'}
      style:--tint={platform?.color ?? (id === 'choose' ? 'var(--glint)' : 'var(--pop)')}
      onmouseenter={() => move(i)}
      onclick={() => (i === index ? coverRow() : move(i))}
    >
      {#if platform}
        {@const meta = coverMeta(id)}
        <span class="badge" style:background={platform.color}>
          <ChannelIcon id={id} color={platform.ink} size={46} />
        </span>
        <span class="text">
          <strong>{platform.name}</strong>
          <span class="count">
            {meta.text}
            <i class="meter" aria-hidden="true">
              <i style:width="{meta.ratio * 100}%" style:background={platform.color}></i>
            </i>
          </span>
        </span>
        <span class="state">
          {#if covers.busy === id}
            <span class="spinner" aria-hidden="true"></span>
            {covers.progress?.phase === 'download'
              ? t('Bajando {n} de {total}', { n: covers.progress.done, total: covers.progress.total })
              : covers.progress?.phase === 'shots'
                ? t('Capturas {n} de {total}', { n: covers.progress.done, total: covers.progress.total })
                : t('Buscando…')}
          {:else if focused && !coverBusy}
            <PadButton name="a" size={30} /> {t('Buscar')}
          {:else if meta.full}
            <span class="value on">{t('Completa')}</span>
          {:else if covers.results[id]}
            {timeAgo(covers.results[id].at, now)}
          {:else}
            {t('sin buscar')}
          {/if}
        </span>
      {:else if id === 'all'}
        <span class="badge refresh">
          <ChannelIcon id="download" color="#FFFFFF" size={46} />
        </span>
        <span class="text">
          <strong>{t('Buscar en todas')}</strong>
          <span>{t('Solo las consolas a las que les faltan portadas')}</span>
        </span>
        <span class="state">
          {#if searchingAll}
            <span class="spinner" aria-hidden="true"></span>
            {covers.all && covers.all.total > 1
              ? t('Consola {n} de {total}', { n: Math.min(covers.all.done + 1, covers.all.total), total: covers.all.total })
              : t('Buscando…')}
          {:else if focused && !coverBusy}
            <PadButton name="a" size={30} /> {t('Buscar')}
          {/if}
        </span>
      {:else}
        <span class="badge pick">
          <ChannelIcon id="pick" color="currentColor" size={46} />
        </span>
        <span class="text">
          <strong>{t('Elegir a mano')}</strong>
          <span>
            {covers.pending.length > 0
              ? tn(covers.pending.length, '{n} juego espera que elijas su portada', '{n} juegos esperan que elijas su portada')
              : t('Nada pendiente: aquí llegan los juegos con nombres dudosos')}
          </span>
        </span>
        <span class="state">
          {#if focused}
            <PadButton name="a" size={30} /> {t('Elegir')}
          {:else if covers.pending.length > 0}
            <span class="value on">{covers.pending.length}</span>
          {/if}
        </span>
      {/if}
    </button>
  {/each}
</section>
{:else}
<section class="rows" aria-label={t('Preferencias')} bind:this={rowsEl} style:transform="translateY({-rowsScroll}px)">
  {#each ROWS as id, i (id)}
    {@const focused = i === index}
    {@const on =
      id === 'empty'
        ? settings.showEmptyConsoles
        : id === 'sounds'
          ? settings.sounds
          : id === 'video'
            ? settings.videoSound
            : id === 'screensaver'
              ? settings.screensaverMinutes > 0
              : id === 'theme'
                ? settings.theme !== 'light'
                : id === 'language'
                  ? false
                  : true}
    <button
      class="row focus-ring"
      class:focused
      style:--tint="#8FA3BF"
      onmouseenter={() => move(i)}
      onclick={() => (i === index ? toggleRow() : move(i))}
    >
      <span class="badge neutral">
        <ChannelIcon
          id={id === 'language' ? 'language' : id === 'theme' ? 'theme' : id === 'empty' ? 'eye' : id === 'sounds' ? 'sound' : id === 'video' ? 'video' : id === 'screensaver' ? 'moon' : 'globe'}
          color="currentColor"
          size={52}
        />
      </span>
      <span class="text">
        {#if id === 'language'}
          <!-- En los dos idiomas a la vez, así lo encuentra quien no lee el que se ve -->
          <strong>{t('Idioma · Language')}</strong>
          <span>
            {settings.language === 'auto'
              ? t('Automático usa el de la Xbox · ahora {language}', { language: LANGUAGE_NAMES[i18n.current] })
              : t('Automático, español o inglés')}
          </span>
        {:else if id === 'theme'}
          <strong>{t('Tema')}</strong>
          <span>
            {settings.theme === 'auto'
              ? t('Oscuro de {from} a {to} · ahora {now}', {
                  from: formatHour(NIGHT.from),
                  to: formatHour(NIGHT.to),
                  now: theme.current === 'dark' ? t('oscuro') : t('claro'),
                })
              : t('Claro, oscuro o automático según la hora')}
          </span>
        {:else if id === 'empty'}
          <strong>{t('Consolas sin juegos')}</strong>
          <span>
            {on
              ? t('Se muestran en el inicio aunque estén vacías')
              : shelf.hiddenCount > 0
                ? t('Ocultas en el inicio (ahora {channels})', {
                    channels: plural(shelf.hiddenCount, 'canal oculto', 'canales ocultos'),
                  })
                : t('Ocultas en el inicio')}
          </span>
        {:else if id === 'sounds'}
          <strong>{t('Sonidos de la interfaz')}</strong>
          <span>{t('El tic al moverte y el pop al elegir')}</span>
        {:else if id === 'video'}
          <strong>{t('Sonido de los videos')}</strong>
          <span>{t('La vista previa en la ficha del juego (si escrapeaste videos con ES-DE)')}</span>
        {:else if id === 'screensaver'}
          <strong>{t('Protector de pantalla')}</strong>
          <span>{t('Tus juegos, uno tras otro, cuando dejas el control quieto')}</span>
        {:else}
          <strong>{t('Región de las portadas')}</strong>
          <span>{t('Para los juegos cuyo archivo no dice la región')}</span>
        {/if}
      </span>
      <span class="state">
        {#if focused}<PadButton name="a" size={30} />{/if}
        <span class="value" class:on>
          {#if id === 'language'}
            {settings.language === 'auto' ? t('Automático') : LANGUAGE_NAMES[settings.language]}
          {:else if id === 'theme'}
            {t(THEME_NAMES[settings.theme])}
          {:else if id === 'empty'}
            {on ? t('Visibles') : t('Ocultas')}
          {:else if id === 'sounds'}
            {on ? t('Activados') : t('Desactivados')}
          {:else if id === 'video'}
            {on ? t('Con sonido') : t('Sin sonido')}
          {:else if id === 'screensaver'}
            {settings.screensaverMinutes > 0 ? t('A los {n} min', { n: settings.screensaverMinutes }) : t('Nunca')}
          {:else}
            {t(REGION_NAMES[settings.coverRegion])}
          {/if}
        </span>
      </span>
    </button>
  {/each}
</section>
{/if}
</div>
{/if}

<HintBar
  hints={section === 'about'
    ? [
        { button: 'lb', also: 'rb', label: t('Secciones') },
        { button: 'b', label: t('Volver') },
      ]
    : [
        ...(hintA ? [{ button: /** @type {const} */ ('a'), label: hintA }] : []),
        ...(section === 'consoles' ? [{ button: /** @type {const} */ ('y'), label: t('Guía') }] : []),
        { button: 'lb', also: 'rb', label: t('Secciones') },
        { button: 'b', label: t('Volver') },
      ]}
/>

{#if showLog}
  <LogViewer onClose={() => (showLog = false)} />
{/if}

<style>
  .top {
    position: absolute;
    top: 56px;
    left: 112px;
    right: 112px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tabs {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 999px;
    background: rgb(var(--glass) / 0.65);
  }
  .bumper {
    padding: 0 8px;
  }
  .tab {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
    padding: 8px 24px 6px;
    border-radius: 999px;
    color: var(--ink-soft);
    transition:
      background 160ms ease,
      color 160ms ease;
  }
  .tab.active {
    background: var(--ink);
    color: var(--cloud);
  }
  .back {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 22px 8px 10px;
    border-radius: 999px;
    background: var(--cloud);
  }

  /* ── Columna izquierda ───────────────── */
  .intro {
    position: absolute;
    left: 112px;
    top: 170px;
    width: 600px;
    height: 790px;
    padding: 44px;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -40px rgb(var(--shadow) / 0.5);
  }
  .intro-icon {
    display: grid;
    place-items: center;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: var(--sky);
  }
  h1 {
    margin: 30px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 72px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  h2 {
    margin: 28px 0 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 36px;
    line-height: 1.1;
  }
  .intro p {
    margin: 12px 0 0;
    font-size: 25px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    list-style: none;
    margin: 26px 0 0;
    padding: 0;
  }
  .chips li {
    padding: 6px 18px 8px;
    border-radius: 999px;
    background: var(--sky);
    font-weight: 700;
    font-size: 22px;
  }
  .chips li.ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .chips li.error {
    background: var(--pop);
    color: var(--on-color);
  }
  .chips li.warn {
    background: var(--sun);
  }
  .chips li.new {
    background: var(--btn-x);
    color: #ffffff;
  }
  .intro p :global(.pad) {
    vertical-align: -4px;
    margin: 0 2px;
  }
  /* nota al pie del panel de Revisión */
  .intro p.note {
    margin-top: 26px;
    padding-top: 18px;
    border-top: 3px dashed var(--sky);
    font-size: 20px;
    line-height: 1.4;
  }
  /* créditos, al pie del panel de Acerca de */
  .credits {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 3px dashed var(--sky);
  }
  .credits strong {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 24px;
  }
  .intro .credits p {
    margin: 4px 0 0;
    font-size: 19px;
    line-height: 1.4;
  }
  .intro .credits p.legal {
    color: var(--ink);
  }

  /* ── Filas ───────────────────────────── */
  /* El aro del foco (11 px) deja al menos 16 px libres hasta la fila vecina */
  /* La ventana de las filas va de 142 a 970 px; la primera fila queda en 170
     como el panel de la izquierda. Las filas tienen aire alrededor para el aro
     del foco y se deslizan cuando no caben; arriba y abajo se desvanecen, así
     una fila a medio salir no se ve como un borde cortado. */
  .rows-window {
    position: absolute;
    left: 760px;
    right: 108px;
    top: 142px;
    bottom: 110px;
    overflow: hidden;
    mask-image: linear-gradient(transparent, #000 12px, #000 calc(100% - 12px), transparent);
  }
  .rows {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 30px;
    padding: 28px 16px;
    transition: transform 260ms var(--spring);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 24px;
    height: 108px;
    padding: 0 30px 0 18px;
    border-radius: 34px;
    background: var(--cloud);
    text-align: left;
  }
  /* las filas son anchas: no se mueven ni crecen (se saldrían del borde), solo el aro */
  .row.focus-ring.focused {
    transform: none;
  }
  .row.all {
    margin-top: 10px;
  }
  /* Biblioteca y Portadas tienen siete filas: un poco más bajas para que quepan */
  .rows.compact {
    gap: 30px;
  }
  .rows.compact .row {
    height: 82px;
  }
  .rows.compact .badge {
    width: 68px;
    height: 68px;
    border-radius: 22px;
  }
  .rows.compact .badge.refresh {
    border-radius: 50%;
  }
  .badge.pick {
    background: var(--sun);
  }
  /* Revisión: el detalle puede ocupar dos líneas, así que la fila crece */
  .rows.review {
    gap: 30px;
  }
  .rows.review .row {
    height: auto;
    min-height: 96px;
    padding: 14px 30px 14px 18px;
  }
  .rows.review .badge {
    width: 68px;
    height: 68px;
    border-radius: 22px;
  }
  .rows.review .badge.refresh {
    border-radius: 50%;
  }
  .rows.review .text strong {
    font-size: 29px;
  }
  .rows.review .text .explain {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.35;
    font-size: 21px;
  }
  .badge.mark {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 40px;
    line-height: 1;
    padding-top: 4px;
  }
  .badge.mark.ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .badge.mark.warn {
    background: var(--sun);
    color: var(--ink);
  }
  .badge.mark.error {
    background: var(--pop);
    color: var(--on-color);
  }
  .badge.mark.update {
    background: var(--btn-x);
    color: #ffffff;
  }
  .badge.mark.info {
    background: var(--sky);
    color: var(--ink-soft);
    font-family: Georgia, serif;
    font-style: italic;
  }
  .text .count {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .meter {
    display: block;
    flex: none;
    width: 120px;
    height: 10px;
    border-radius: 999px;
    background: var(--sky);
    overflow: hidden;
  }
  .meter i {
    display: block;
    height: 100%;
    border-radius: 999px;
  }
  .badge {
    display: grid;
    place-items: center;
    flex: none;
    width: 80px;
    height: 80px;
    border-radius: 26px;
  }
  .badge.neutral {
    background: var(--sky);
  }
  .value {
    padding: 6px 18px 8px;
    border-radius: 999px;
    background: var(--sky);
    color: var(--ink-soft);
  }
  .value.on {
    background: var(--pop);
    color: var(--on-color);
  }
  .value.missing {
    background: var(--pop-soft);
    color: var(--ink);
  }
  .value.ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  /* "PlayStation  12 juegos" en la fila de Consolas */
  .text strong small {
    margin-left: 12px;
    font-family: var(--font-body);
    font-size: 20px;
    font-weight: 700;
    color: var(--ink-soft);
  }
  .badge.refresh {
    background: var(--pop);
    border-radius: 50%;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .text strong {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 32px;
    line-height: 1.1;
  }
  .text span {
    font-size: 22px;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .text code {
    font-family: var(--font-body);
    font-weight: 700;
    color: var(--ink);
  }
  .state {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
    font-weight: 700;
    font-size: 24px;
    color: var(--ink-soft);
  }
  .row.focused .state {
    color: var(--ink);
  }
  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 5px solid var(--pop-soft);
    border-top-color: var(--pop);
    animation: spin 700ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
