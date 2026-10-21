<script>
  /**
   * Options › About: which emulators the console has, how much you've played,
   * a summary of the library and where Relix keeps things on the USB drive.
   * It's read-only: there's nothing to focus.
   */
  import { getPlatform, PLATFORMS } from '../lib/core/platforms.js'
  import { weeklyTotals } from '../lib/core/playDays.js'
  import { mostPlayed, totalSeconds } from '../lib/core/userData.js'
  import { collections } from '../lib/ui/collections.svelte.js'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { formatPlaytime, plural, timeAgo } from '../lib/ui/format.js'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import { library } from '../lib/ui/library.svelte.js'
  import { userData } from '../lib/ui/userData.svelte.js'
  import WeekBars from '../lib/ui/WeekBars.svelte'

  /** "E:\roms" -> "E:" */
  const drive = $derived(library.romRoot.replace(/[\\/]+roms[\\/]*$/i, '') || 'E:')

  // The names of files and folders on the USB drive are the same in any language
  const paths = $derived([
    { label: t('Juegos'), path: `${library.romRoot}\\${t('<consola>')}` },
    { label: t('Portadas'), path: `${drive}\\ES-DE\\downloaded_media` },
    { label: t('Colecciones'), path: `${drive}\\ES-DE\\collections` },
    { label: t('Tus datos'), path: `${drive}\\relix\\data.json` },
    { label: t('Respaldos'), path: `${drive}\\relix\\backups ${t('(7 días)')}` },
    { label: t('Registro'), path: `${drive}\\relix\\log.txt` },
    { label: t('Caché'), path: `${drive}\\relix\\cache ${t('(se puede borrar)')}` },
  ])

  /** Only the games still on the USB drive count */
  const inLibrary = (/** @type {string} */ id) => library.byId.has(id)
  const total = $derived(totalSeconds(library.playtime, inLibrary))
  const plays = $derived(
    Object.entries(library.playtime).reduce((n, [id, s]) => n + (inLibrary(id) ? s.plays : 0), 0),
  )
  const top = $derived(
    mostPlayed(library.playtime, inLibrary, 5).map((entry) => {
      const game = /** @type {import('../lib/ui/library.svelte.js').LibraryGame} */ (library.byId.get(entry.id))
      return { ...entry, game, platform: getPlatform(game.system) }
    }),
  )
  // The last 8 weeks; they're counted since 1.3.0
  const weeks = $derived(weeklyTotals(library.playDays, { now: Date.now(), weeks: 8, keep: inLibrary }))
  const thisWeek = $derived(weeks.at(-1)?.seconds ?? 0)
  const hasWeeks = $derived(weeks.some((w) => w.seconds > 0))

  const stats = $derived.by(() => {
    const covers = PLATFORMS.reduce((n, p) => n + library.coverCount(p.id).withCover, 0)
    const consoles = PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0).length
    return [
      { value: library.all.length, label: library.all.length === 1 ? t('juego') : t('juegos') },
      { value: consoles, label: consoles === 1 ? t('consola') : t('consolas') },
      { value: covers, label: t('con portada') },
      { value: library.favorites.length, label: library.favorites.length === 1 ? t('favorito') : t('favoritos') },
      { value: collections.visible.length, label: collections.visible.length === 1 ? t('colección') : t('colecciones') },
      { value: library.hiddenCount(), label: library.hiddenCount() === 1 ? t('oculto') : t('ocultos') },
    ]
  })

  /** How the backup on the USB drive is doing */
  const saveState = $derived.by(() => {
    if (userData.status === 'error') return { tone: 'bad', text: t('No se pudo guardar') }
    if (userData.status === 'off') return { tone: 'muted', text: t('Solo en la app') }
    if (userData.status === 'pending') return { tone: 'muted', text: t('Guardando…') }
    return {
      tone: 'ok',
      text: userData.savedAt ? t('Guardado {when}', { when: timeAgo(userData.savedAt) }) : t('Al día'),
    }
  })

  /**
   * Each emulator app once (RetroArch covers many consoles), with what
   * the Xbox says it has installed.
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

<section class="about" aria-label={t('Acerca de Relix')}>
  <div class="column">
    <article class="card">
      <h3>{t('Emuladores en la consola')}</h3>
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
          ? t('{installed} de {total}.', {
              installed: plural(apps.filter((a) => a.installed).length, 'instalado', 'instalados'),
              total: apps.length,
            })
          : t('Relix lo revisa al abrir en la Xbox.')}
        {t('Cuál usa cada consola se elige en')} <strong>{t('Opciones › Consolas')}</strong>.
      </p>
    </article>

    <article class="card">
      <div class="head">
        <h3>{t('Tiempo de juego')}</h3>
        {#if total > 0}
          <p class="total">
            <strong>{formatPlaytime(total)}</strong>
            <span>{t('en {sessions}', { sessions: plural(plays, 'partida', 'partidas') })}</span>
          </p>
        {/if}
      </div>
      {#if total > 0}
        {#if hasWeeks}
          <div class="chart">
            <WeekBars
              {weeks}
              height={64}
              values={false}
              nowLabel={t('esta semana: {time}', { time: thisWeek > 0 ? formatPlaytime(thisWeek) : '0 min' })}
              label={t('Tiempo jugado por semana')}
            />
          </div>
        {:else}
          <p class="since">{t('Las semanas se cuentan desde la 1.3.0.')}</p>
        {/if}
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
          {t('Aún no hay partidas contadas. El tiempo se suma solo cuando vuelves de un juego.')}
        </p>
      {/if}
    </article>
  </div>

  <div class="column">
    <article class="card">
      <h3>{t('Tu biblioteca')}</h3>
      <ul class="stats">
        {#each stats as s (s.label)}
          <li><strong>{s.value}</strong><span>{s.label}</span></li>
        {/each}
      </ul>
    </article>

    <article class="card">
      <div class="head">
        <h3>{t('En tu USB')}</h3>
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
  /* everything fits between the header and the hint bar (170 to 960 px) */
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

  /* ── Emulators on the console ─── */
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
    background: var(--ok-bg);
    color: var(--ok-ink);
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

  /* ── Playtime ─────────────────── */
  /* the total, beside the title: so the chart and the five fit above the hint bar */
  .total {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0;
    white-space: nowrap;
  }
  .total strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 32px;
    line-height: 1;
  }
  .total span {
    font-weight: 700;
    font-size: 19px;
    color: var(--ink-soft);
  }
  .chart {
    margin: 4px 0 12px;
  }
  .since {
    margin: -4px 0 14px;
    font-size: 19px;
    color: var(--ink-soft);
  }
  /* five rows: compact, so everything fits above the hint bar */
  .top {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .top li {
    display: grid;
    grid-template-columns: 30px 1fr auto;
    align-items: center;
    gap: 12px;
  }
  .rank {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 10px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 18px;
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

  /* ── Your library ─────────────── */
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

  /* ── On your USB drive ────────── */
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
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .state.muted {
    background: var(--sky);
    color: var(--ink-soft);
  }
  .state.bad {
    background: var(--pop);
    color: var(--on-color);
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
