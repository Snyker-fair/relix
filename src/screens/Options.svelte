<script>
  import { mode } from '../lib/core/bridge.js'
  import { REGION_NAMES } from '../lib/core/coverMatch.js'
  import { BUILD_DATE, VERSION } from '../lib/core/version.js'
  import About from './About.svelte'
  import { getPlatform, PLATFORMS } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import { covers } from '../lib/ui/covers.svelte.js'
  import { coverSummary, plural, scanSummary, timeAgo } from '../lib/ui/format.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { settings } from '../lib/ui/settings.svelte.js'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import { sound } from '../lib/ui/sound.js'

  /**
   * @type {{
   *   onBack: () => void,
   *   onToast: (message: string) => void,
   *   onPickCovers: () => void,
   *   initialSection?: string,
   * }}
   */
  let { onBack, onToast, onPickCovers, initialSection = 'library' } = $props()

  // Secciones: se cambian con LB/RB, igual que las consolas en la biblioteca
  const SECTIONS = [
    { id: 'library', name: 'Biblioteca' },
    { id: 'covers', name: 'Portadas' },
    { id: 'preferences', name: 'Preferencias' },
    { id: 'about', name: 'Acerca de' },
  ]
  // Biblioteca: una fila por consola, "Escanear todo" y los juegos ocultos
  const LIBRARY_ROWS = [...PLATFORMS.map((p) => p.id), 'all', 'hidden']
  const PREFERENCE_ROWS = ['empty', 'sounds', 'region']

  // Portadas: las consolas con juegos, "Buscar en todas" y "Elegir a mano"
  const coverPlatforms = $derived.by(() => {
    const withGames = PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0)
    return withGames.length > 0 ? withGames : PLATFORMS
  })
  const COVER_ROWS = $derived([...coverPlatforms.map((p) => p.id), 'all', 'choose'])

  // Solo importa al abrir (p. ej. volver a Portadas desde "Elegir a mano")
  // svelte-ignore state_referenced_locally
  let section = $state(initialSection)
  const ROWS = $derived(
    section === 'library'
      ? LIBRARY_ROWS
      : section === 'covers'
        ? COVER_ROWS
        : section === 'preferences'
          ? PREFERENCE_ROWS
          : [], // Acerca de: solo para leer
  )
  /** "2026-10-16" -> "16 oct 2026" */
  const buildDate = BUILD_DATE
    ? new Date(`${BUILD_DATE}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  let index = $state(0)
  /** true mientras corre "Escanear todo" (las filas muestran cuál va) */
  let scanningAll = $state(false)
  /** true mientras corre "Buscar en todas" */
  let searchingAll = $state(false)
  /** Para refrescar los "hace X min" mientras la pantalla está abierta */
  let now = $state(Date.now())

  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 30_000)
    return () => clearInterval(t)
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
        ? 'Mostrar'
        : 'Escanear'
      : section === 'preferences'
        ? 'Cambiar'
        : ROWS[index] === 'choose'
          ? 'Elegir'
          : 'Buscar',
  )

  /** @param {string} id */
  function rowMeta(id) {
    const scan = library.scans[id]
    const count = plural(library.gamesFor(id).length, 'juego', 'juegos')
    return { count, where: library.romFolderPath(id), when: scan ? timeAgo(scan.scannedAt, now) : 'sin escanear' }
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
            ? `Listo: sin cambios (${plural(totalGames, 'juego', 'juegos')} en ${PLATFORMS.length} consolas)`
            : scanSummary('Listo', { added, removed, total: totalGames }),
        )
      }
      sound.favorite()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : 'No se pudo escanear. Revisa que el USB esté conectado.')
    }
  }

  function unhideRow() {
    const count = library.hiddenCount()
    if (count === 0) {
      sound.error()
      onToast('No hay juegos ocultos. Se ocultan desde el menú del juego (Y).')
      return
    }
    library.unhideAll()
    sound.favorite()
    onToast(`Listo: ${plural(count, 'juego vuelve', 'juegos vuelven')} a la biblioteca`)
  }

  async function coverRow() {
    const id = ROWS[index]
    if (id === 'choose') {
      if (covers.pending.length === 0) {
        sound.error()
        onToast('No hay portadas por elegir. Primero busca en una consola.')
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
        const total = { saved: 0, failed: 0, toChoose: 0, notFound: 0 }
        searchingAll = true
        try {
          for (const p of coverPlatforms) {
            const count = library.coverCount(p.id)
            if (count.withCover === count.total) continue
            const result = await covers.find(p.id)
            total.saved += result.saved
            total.failed += result.failed
            total.toChoose += result.toChoose
            total.notFound += result.notFound
          }
        } finally {
          searchingAll = false
        }
        onToast(coverSummary('Listo', total))
      }
      now = Date.now()
      sound.favorite()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : 'No se pudieron buscar las portadas.')
    }
  }

  function toggleRow() {
    const id = ROWS[index]
    if (id === 'empty') settings.toggleEmptyConsoles()
    else if (id === 'sounds') settings.toggleSounds()
    else if (id === 'region') settings.cycleCoverRegion()
    sound.select() // con los sonidos recién apagados, este ya no suena
  }

  /** "45 de 52 con portada" y qué tan llena está la consola (0 a 1) */
  function coverMeta(/** @type {string} */ id) {
    const { withCover, total } = library.coverCount(id)
    return {
      text: `${withCover} de ${total} con portada`,
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
      else if (action === 'a' && section !== 'about')
        section === 'library' ? scanRow() : section === 'covers' ? coverRow() : toggleRow()
      else if (action === 'b' || action === 'start') (sound.back(), onBack())
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <nav class="tabs" aria-label="Secciones">
    <button class="bumper" onclick={() => dispatch('lb')} aria-label="Sección anterior">
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
    <button class="bumper" onclick={() => dispatch('rb')} aria-label="Sección siguiente">
      <PadButton name="rb" size={30} />
    </button>
  </nav>

  <Clock />
</header>

<section class="intro">
  <span class="intro-icon"><ChannelIcon id="options" color="#23304A" size={84} /></span>
  <h1>Opciones</h1>
  {#if section === 'library'}
    <h2>Biblioteca</h2>
    <p>
      Relix guarda la lista de juegos de cada consola para abrir al instante. Escanea una consola
      cuando agregues o quites juegos de su carpeta.
    </p>
    <ul class="chips">
      <li>{plural(totalGames, 'juego', 'juegos')}</li>
      <li>{library.romRoot}</li>
    </ul>
  {:else if section === 'covers'}
    <h2>Portadas</h2>
    <p>
      Relix las busca en libretro, las mismas de RetroArch, y las guarda en el USB junto a las de
      ES-DE. Si no está seguro de cuál es, te deja elegir.
    </p>
    <ul class="chips">
      <li>{coverTotals.withCover} de {coverTotals.total} con portada</li>
      <li>Región: {REGION_NAMES[settings.coverRegion]}</li>
    </ul>
  {:else if section === 'about'}
    <h2>Acerca de</h2>
    <p>
      Tus reliquias, listas para jugar. Un lanzador hecho a la medida para tus emuladores en la
      Xbox, que lee tu USB tal como lo deja ES-DE.
    </p>
    <ul class="chips">
      <li>Versión {VERSION}</li>
      {#if buildDate}<li>Compilada el {buildDate}</li>{/if}
      <li>{mode === 'xbox' ? 'Xbox · Modo Desarrollador' : 'Demo en el navegador'}</li>
    </ul>
    <div class="credits">
      <strong>Creado por snyker-fair</strong>
      <p>
        Portadas de libretro-thumbnails · formato de ES-DE · letras Baloo 2 y Nunito (SIL OFL) ·
        hecho con Svelte, C# y WebView2
      </p>
    </div>
  {:else}
    <h2>Preferencias</h2>
    <p>Qué se ve en el inicio, cómo suena Relix y qué portadas prefieres. Los cambios se guardan solos.</p>
  {/if}
</section>

{#if section === 'library'}
<section class="rows compact" aria-label="Escanear consolas">
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
          <span>{meta.count} en <code>{meta.where}</code></span>
        </span>
        <span class="state">
          {#if scanning}
            <span class="spinner" aria-hidden="true"></span> Escaneando…
          {:else if focused && !busy}
            <PadButton name="a" size={30} /> Escanear
          {:else}
            {meta.when}
          {/if}
        </span>
      {:else if id === 'hidden'}
        {@const hiddenCount = library.hiddenCount()}
        <span class="badge neutral">
          <ChannelIcon id="hide" color="#23304A" size={46} />
        </span>
        <span class="text">
          <strong>Juegos ocultos</strong>
          <span>
            {hiddenCount > 0
              ? `${plural(hiddenCount, 'juego oculto', 'juegos ocultos')} con Y › Ocultar juego`
              : 'Ninguno. Se ocultan desde el menú del juego (Y)'}
          </span>
        </span>
        <span class="state">
          {#if focused && hiddenCount > 0}
            <PadButton name="a" size={30} /> Mostrar de nuevo
          {:else if hiddenCount > 0}
            <span class="value on">{hiddenCount}</span>
          {/if}
        </span>
      {:else}
        <span class="badge refresh">
          <ChannelIcon id="refresh" color="#FFFFFF" size={46} />
        </span>
        <span class="text">
          <strong>Escanear todo</strong>
          <span>Las {PLATFORMS.length} consolas, una tras otra</span>
        </span>
        <span class="state">
          {#if scanningAll}
            <span class="spinner" aria-hidden="true"></span> Escaneando…
          {:else if focused && !busy}
            <PadButton name="a" size={30} /> Escanear
          {/if}
        </span>
      {/if}
    </button>
  {/each}
</section>
{:else if section === 'covers'}
<section class="rows compact" aria-label="Portadas">
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
              ? `Bajando ${covers.progress.done} de ${covers.progress.total}`
              : 'Buscando…'}
          {:else if focused && !coverBusy}
            <PadButton name="a" size={30} /> Buscar
          {:else if meta.full}
            <span class="value on">Completa</span>
          {:else if covers.results[id]}
            {timeAgo(covers.results[id].at, now)}
          {:else}
            sin buscar
          {/if}
        </span>
      {:else if id === 'all'}
        <span class="badge refresh">
          <ChannelIcon id="download" color="#FFFFFF" size={46} />
        </span>
        <span class="text">
          <strong>Buscar en todas</strong>
          <span>Solo las consolas a las que les faltan portadas</span>
        </span>
        <span class="state">
          {#if searchingAll}
            <span class="spinner" aria-hidden="true"></span> Buscando…
          {:else if focused && !coverBusy}
            <PadButton name="a" size={30} /> Buscar
          {/if}
        </span>
      {:else}
        <span class="badge pick">
          <ChannelIcon id="pick" color="#23304A" size={46} />
        </span>
        <span class="text">
          <strong>Elegir a mano</strong>
          <span>
            {covers.pending.length > 0
              ? `${plural(covers.pending.length, 'juego espera', 'juegos esperan')} que elijas su portada`
              : 'Nada pendiente: aquí llegan los juegos con nombres dudosos'}
          </span>
        </span>
        <span class="state">
          {#if focused}
            <PadButton name="a" size={30} /> Elegir
          {:else if covers.pending.length > 0}
            <span class="value on">{covers.pending.length}</span>
          {/if}
        </span>
      {/if}
    </button>
  {/each}
</section>
{:else if section === 'about'}
<About />
{:else}
<section class="rows" aria-label="Preferencias">
  {#each ROWS as id, i (id)}
    {@const focused = i === index}
    {@const on = id === 'empty' ? settings.showEmptyConsoles : id === 'sounds' ? settings.sounds : true}
    <button
      class="row focus-ring"
      class:focused
      style:--tint="#8FA3BF"
      onmouseenter={() => move(i)}
      onclick={() => (i === index ? toggleRow() : move(i))}
    >
      <span class="badge neutral">
        <ChannelIcon id={id === 'empty' ? 'eye' : id === 'sounds' ? 'sound' : 'globe'} color="#23304A" size={52} />
      </span>
      <span class="text">
        {#if id === 'empty'}
          <strong>Consolas sin juegos</strong>
          <span>
            {on
              ? 'Se muestran en el inicio aunque estén vacías'
              : shelf.hiddenCount > 0
                ? `Ocultas en el inicio (ahora ${plural(shelf.hiddenCount, 'canal oculto', 'canales ocultos')})`
                : 'Ocultas en el inicio'}
          </span>
        {:else if id === 'sounds'}
          <strong>Sonidos de la interfaz</strong>
          <span>El tic al moverte y el pop al elegir</span>
        {:else}
          <strong>Región de las portadas</strong>
          <span>Para los juegos cuyo archivo no dice la región</span>
        {/if}
      </span>
      <span class="state">
        {#if focused}<PadButton name="a" size={30} />{/if}
        <span class="value" class:on>
          {#if id === 'empty'}
            {on ? 'Visibles' : 'Ocultas'}
          {:else if id === 'sounds'}
            {on ? 'Activados' : 'Desactivados'}
          {:else}
            {REGION_NAMES[settings.coverRegion]}
          {/if}
        </span>
      </span>
    </button>
  {/each}
</section>
{/if}

<HintBar
  hints={section === 'about'
    ? [
        { button: 'lb', also: 'rb', label: 'Secciones' },
        { button: 'b', label: 'Volver' },
      ]
    : [
        { button: 'a', label: hintA },
        { button: 'b', label: 'Volver' },
      ]}
/>

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
    background: rgb(255 255 255 / 0.65);
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
    box-shadow: 0 30px 60px -40px rgb(35 48 74 / 0.5);
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

  /* ── Filas ───────────────────────────── */
  /* El aro del foco (11 px) deja al menos 16 px libres hasta la fila vecina */
  .rows {
    position: absolute;
    left: 776px;
    right: 124px;
    top: 170px;
    display: flex;
    flex-direction: column;
    gap: 30px;
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
    color: var(--cloud);
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
