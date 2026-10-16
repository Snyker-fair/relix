<script>
  /**
   * Opciones › Acerca de: qué emuladores tiene la consola, cuánto has jugado,
   * un resumen de la biblioteca y dónde guarda Relix las cosas en el USB.
   * Es solo para leer: no hay nada que enfocar.
   */
  import { getPlatform, PLATFORMS } from '../lib/core/platforms.js'
  import { mostPlayed, totalSeconds } from '../lib/core/userData.js'
  import { collections } from '../lib/ui/collections.svelte.js'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { formatPlaytime, plural, timeAgo } from '../lib/ui/format.js'
  import { library } from '../lib/ui/library.svelte.js'
  import { userData } from '../lib/ui/userData.svelte.js'

  /** "E:\roms" -> "E:" */
  const drive = $derived(library.romRoot.replace(/[\\/]+roms[\\/]*$/i, '') || 'E:')

  const paths = $derived([
    { label: 'Juegos', path: `${library.romRoot}\\<consola>` },
    { label: 'Portadas', path: `${drive}\\ES-DE\\downloaded_media` },
    { label: 'Colecciones', path: `${drive}\\ES-DE\\collections` },
    { label: 'Tus datos', path: `${drive}\\relix\\datos.json` },
    { label: 'Respaldos', path: `${drive}\\relix\\respaldos (7 días)` },
    { label: 'Caché', path: `${drive}\\relix\\cache (se puede borrar)` },
  ])

  /** Solo cuentan los juegos que siguen en el USB */
  const inLibrary = (/** @type {string} */ id) => library.byId.has(id)
  const total = $derived(totalSeconds(library.playtime, inLibrary))
  const plays = $derived(
    Object.entries(library.playtime).reduce((n, [id, s]) => n + (inLibrary(id) ? s.plays : 0), 0),
  )
  const top = $derived(
    mostPlayed(library.playtime, inLibrary).map((entry) => {
      const game = /** @type {import('../lib/ui/library.svelte.js').LibraryGame} */ (library.byId.get(entry.id))
      return { ...entry, game, platform: getPlatform(game.system) }
    }),
  )

  const stats = $derived.by(() => {
    const covers = PLATFORMS.reduce((n, p) => n + library.coverCount(p.id).withCover, 0)
    const consoles = PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0).length
    return [
      { value: library.all.length, label: library.all.length === 1 ? 'juego' : 'juegos' },
      { value: consoles, label: consoles === 1 ? 'consola' : 'consolas' },
      { value: covers, label: 'con portada' },
      { value: library.favorites.length, label: library.favorites.length === 1 ? 'favorito' : 'favoritos' },
      { value: collections.visible.length, label: collections.visible.length === 1 ? 'colección' : 'colecciones' },
      { value: library.hiddenCount(), label: library.hiddenCount() === 1 ? 'oculto' : 'ocultos' },
    ]
  })

  /** Cómo va el respaldo en el USB */
  const saveState = $derived.by(() => {
    if (userData.status === 'error') return { tone: 'bad', text: 'No se pudo guardar' }
    if (userData.status === 'off') return { tone: 'muted', text: 'Solo en la app' }
    if (userData.status === 'pending') return { tone: 'muted', text: 'Guardando…' }
    return { tone: 'ok', text: userData.savedAt ? `Guardado ${timeAgo(userData.savedAt)}` : 'Al día' }
  })

  /**
   * Cada app de emulador una vez (RetroArch cubre muchas consolas), con lo
   * que la Xbox dice que tiene instalado.
   */
  const apps = $derived.by(() => {
    /** @type {Map<string, { protocol: string, name: string, installed: boolean | null }>} */
    const byProtocol = new Map()
    for (const p of PLATFORMS) {
      for (const e of p.emulators) {
        const { protocol } = e.launcher
        if (byProtocol.has(protocol)) continue
        const name = protocol === 'retroarch' ? 'RetroArch' : e.name
        byProtocol.set(protocol, { protocol, name, installed: emulators.isInstalled(e) })
      }
    }
    return [...byProtocol.values()]
  })
</script>

<section class="about" aria-label="Acerca de Relix">
  <div class="column">
    <article class="card">
      <h3>Emuladores en la consola</h3>
      <ul class="apps">
        {#each apps as app (app.protocol)}
          <li class:on={app.installed === true} class:off={app.installed === false}>
            <span class="mark" aria-hidden="true">{app.installed === true ? '✓' : app.installed === false ? '–' : '?'}</span>
            {app.name}
          </li>
        {/each}
      </ul>
      <p class="hint">
        {emulators.installed
          ? `${plural(apps.filter((a) => a.installed).length, 'instalado', 'instalados')} de ${apps.length}.`
          : 'Relix lo revisa al abrir en la Xbox.'}
        Cuál usa cada consola se elige en <strong>Opciones › Consolas</strong>.
      </p>
    </article>

    <article class="card">
      <h3>Tiempo de juego</h3>
      {#if total > 0}
        <p class="total">
          <strong>{formatPlaytime(total)}</strong>
          <span>en {plural(plays, 'partida', 'partidas')}</span>
        </p>
        <ol class="top">
          {#each top as entry, i (entry.id)}
            <li>
              <span class="rank" style:background={entry.platform.color} style:color={entry.platform.ink}>{i + 1}</span>
              <span class="name">{entry.game.name}</span>
              <span class="time">{formatPlaytime(entry.seconds)}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="empty">
          Aún no hay partidas contadas. El tiempo se suma solo cuando vuelves de un juego.
        </p>
      {/if}
    </article>
  </div>

  <div class="column">
    <article class="card">
      <h3>Tu biblioteca</h3>
      <ul class="stats">
        {#each stats as s (s.label)}
          <li><strong>{s.value}</strong><span>{s.label}</span></li>
        {/each}
      </ul>
    </article>

    <article class="card">
      <div class="head">
        <h3>En tu USB</h3>
        <span class="state {saveState.tone}">{saveState.text}</span>
      </div>
      <ul class="paths">
        {#each paths as item (item.label)}
          <li>
            <span class="label">{item.label}</span>
            <code>{item.path}</code>
          </li>
        {/each}
      </ul>
    </article>
  </div>
</section>

<style>
  .about {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 170px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  /* todo cabe entre el encabezado y la barra de pistas (170 a 960 px) */
  .column {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
  .card {
    padding: 22px 28px 26px;
    border-radius: 34px;
    background: var(--cloud);
  }
  h3 {
    margin: 0 0 14px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
  }
  ul,
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  code {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 18px;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Emuladores en la consola ─── */
  .apps {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .apps li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 16px 7px 8px;
    border-radius: 999px;
    background: var(--sky);
    font-weight: 700;
    font-size: 19px;
    color: var(--ink-soft);
  }
  .apps li.on {
    background: #d9f2dc;
    color: #1d5a27;
  }
  .apps li.off {
    opacity: 0.6;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--cloud);
    font-size: 16px;
    font-weight: 800;
  }
  .hint {
    margin: 14px 0 0;
    font-size: 19px;
    line-height: 1.4;
    color: var(--ink-soft);
  }
  .hint strong {
    color: var(--ink);
  }

  /* ── Tiempo de juego ──────────── */
  .total {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 0 0 14px;
  }
  .total strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 40px;
    line-height: 1;
  }
  .total span {
    font-weight: 700;
    font-size: 20px;
    color: var(--ink-soft);
  }
  .top {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .top li {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    align-items: center;
    gap: 14px;
  }
  .rank {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 21px;
    padding-top: 2px;
  }
  .name {
    font-weight: 700;
    font-size: 21px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .time {
    font-weight: 700;
    font-size: 19px;
    color: var(--ink-soft);
  }
  .empty {
    margin: 0;
    font-size: 20px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  /* ── Tu biblioteca ────────────── */
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .stats li {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 6px;
    border-radius: 18px;
    background: var(--sky);
  }
  .stats strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 32px;
    line-height: 1.1;
  }
  .stats span {
    font-weight: 700;
    font-size: 18px;
    color: var(--ink-soft);
  }

  /* ── En tu USB ────────────────── */
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .state {
    padding: 4px 14px 6px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 18px;
    white-space: nowrap;
  }
  .state.ok {
    background: #d9f2dc;
    color: #1d5a27;
  }
  .state.muted {
    background: var(--sky);
    color: var(--ink-soft);
  }
  .state.bad {
    background: var(--pop);
    color: var(--cloud);
  }
  .paths {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .paths li {
    display: grid;
    grid-template-columns: 124px 1fr;
    align-items: baseline;
    gap: 12px;
    padding: 6px 14px;
    border-radius: 14px;
    background: var(--sky);
    min-width: 0;
  }
  .paths .label {
    font-weight: 700;
    font-size: 18px;
    color: var(--ink-soft);
  }
  .paths code {
    font-size: 19px;
    color: var(--ink);
  }
</style>
