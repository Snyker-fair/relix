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
  import { sound } from '../lib/ui/sound.js'

  /** @type {{ onBack: () => void, onToast: (message: string) => void }} */
  let { onBack, onToast } = $props()

  // Una fila por consola y, al final, "Escanear todo"
  const ROWS = [...PLATFORMS.map((p) => p.id), 'all']

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
      else if (action === 'a') scanRow()
      else if (action === 'b' || action === 'start') (sound.back(), onBack())
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>
  <Clock />
</header>

<section class="intro">
  <span class="intro-icon"><ChannelIcon id="options" color="#23304A" size={84} /></span>
  <h1>Opciones</h1>
  <h2>Biblioteca</h2>
  <p>
    Relix guarda la lista de juegos de cada consola para abrir al instante. Escanea una consola
    cuando agregues o quites juegos de su carpeta.
  </p>
  <ul class="chips">
    <li>{plural(totalGames, 'juego', 'juegos')}</li>
    <li>{library.romRoot}</li>
  </ul>
</section>

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

<HintBar
  hints={[
    { button: 'a', label: 'Escanear' },
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
