<script>
  import { PLATFORMS } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import { plural, scanSummary, timeAgo } from '../lib/ui/format.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { settings } from '../lib/ui/settings.svelte.js'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import { sound } from '../lib/ui/sound.js'

  /** @type {{ onBack: () => void, onToast: (message: string) => void }} */
  let { onBack, onToast } = $props()

  // Secciones: se cambian con LB/RB, igual que las consolas en la biblioteca
  const SECTIONS = [
    { id: 'library', name: 'Biblioteca' },
    { id: 'preferences', name: 'Preferencias' },
  ]
  // Biblioteca: una fila por consola y, al final, "Escanear todo"
  const LIBRARY_ROWS = [...PLATFORMS.map((p) => p.id), 'all']
  const PREFERENCE_ROWS = ['empty', 'sounds']

  let section = $state('library')
  const ROWS = $derived(section === 'library' ? LIBRARY_ROWS : PREFERENCE_ROWS)
  let index = $state(0)
  /** true mientras corre "Escanear todo" (las filas muestran cuál va) */
  let scanningAll = $state(false)
  /** Para refrescar los "hace X min" mientras la pantalla está abierta */
  let now = $state(Date.now())

  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 30_000)
    return () => clearInterval(t)
  })

  const busy = $derived(library.scanning.length > 0)
  const totalGames = $derived(PLATFORMS.reduce((n, p) => n + library.gamesFor(p.id).length, 0))

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
    if (busy || scanningAll) return
    const id = ROWS[index]
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

  function toggleRow() {
    const id = ROWS[index]
    if (id === 'empty') settings.toggleEmptyConsoles()
    else if (id === 'sounds') settings.toggleSounds()
    sound.select() // con los sonidos recién apagados, este ya no suena
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
      else if (action === 'a') section === 'library' ? scanRow() : toggleRow()
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
  {:else}
    <h2>Preferencias</h2>
    <p>Qué se ve en el inicio y cómo suena Relix. Los cambios se guardan solos.</p>
  {/if}
</section>

{#if section === 'library'}
<section class="rows" aria-label="Escanear consolas">
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
          <ChannelIcon id={id} color={platform.ink} size={52} />
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
      {:else}
        <span class="badge refresh">
          <ChannelIcon id="refresh" color="#FFFFFF" size={52} />
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
{:else}
<section class="rows" aria-label="Preferencias">
  {#each ROWS as id, i (id)}
    {@const focused = i === index}
    {@const on = id === 'empty' ? settings.showEmptyConsoles : settings.sounds}
    <button
      class="row focus-ring"
      class:focused
      style:--tint="#8FA3BF"
      onmouseenter={() => move(i)}
      onclick={() => (i === index ? toggleRow() : move(i))}
    >
      <span class="badge neutral">
        <ChannelIcon id={id === 'empty' ? 'eye' : 'sound'} color="#23304A" size={52} />
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
        {:else}
          <strong>Sonidos de la interfaz</strong>
          <span>El tic al moverte y el pop al elegir</span>
        {/if}
      </span>
      <span class="state">
        {#if focused}<PadButton name="a" size={30} />{/if}
        <span class="value" class:on>
          {id === 'empty' ? (on ? 'Visibles' : 'Ocultas') : on ? 'Activados' : 'Desactivados'}
        </span>
      </span>
    </button>
  {/each}
</section>
{/if}

<HintBar
  hints={[
    { button: 'a', label: section === 'library' ? 'Escanear' : 'Cambiar' },
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

  /* ── Filas ───────────────────────────── */
  .rows {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 170px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 24px;
    height: 112px;
    padding: 0 30px 0 18px;
    border-radius: 34px;
    background: var(--cloud);
    text-align: left;
  }
  /* las filas son anchas: el foco salta menos que una portada */
  .row.focus-ring.focused {
    transform: translateX(10px) scale(1.02);
  }
  .row.all {
    margin-top: 10px;
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
