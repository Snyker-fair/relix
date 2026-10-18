<script>
  /**
   * The diagnostic log on the TV (Options › Checkup › Log): the last
   * entries of E:\relix\log.txt, the newest on top. It's there to
   * take a photo when something fails, without taking the USB drive to the PC.
   *
   *   ↑ ↓  scroll    LT / RT  a page at a time    B  back
   */
  import { untrack } from 'svelte'
  import { readLog } from '../lib/core/bridge.js'
  import { parseLogLine } from '../lib/core/diagnostics.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import { diagnostics } from '../lib/ui/diagnostics.svelte.js'
  import { formatDate, plural } from '../lib/ui/format.js'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import { sound } from '../lib/ui/sound.js'

  /** @type {{ onClose: () => void }} */
  let { onClose } = $props()

  const SHOWN = 150
  const PAGE = 8
  const drive = library.romRoot.replace(/roms[\\/]*$/i, '') || 'E:\\'

  /** @type {'loading'|'ready'|'error'} */
  let status = $state('loading')
  /** @type {Array<{ time: string, kind: string, text: string }>} */
  let entries = $state([])
  let index = $state(0)

  // What's pending is sent before reading, so the list includes the latest
  $effect(() => {
    untrack(() => {
      diagnostics.flush()
      setTimeout(async () => {
        try {
          const lines = await readLog(SHOWN)
          entries = lines.map(parseLogLine).reverse()
          status = 'ready'
        } catch {
          status = 'error'
        }
      }, 400)
    })
  })

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  /** "06:40" today; "16 oct 23:10" another day @param {string} time */
  function when(time) {
    if (!time) return ''
    const [day, clock] = time.split(' ')
    if (day === todayKey) return clock.slice(0, 5)
    const date = new Date(`${day}T12:00:00`)
    return `${formatDate(date, { day: 'numeric', month: 'short' })} ${clock.slice(0, 5)}`
  }

  /**
   * Each kind's color: what failed in pink, what needs a look in yellow.
   * In both languages: the log can have lines written in each.
   */
  const TONES = {
    ERROR: 'bad',
    'NO ABRIÓ': 'bad',
    'NO START': 'bad',
    DATOS: 'warn',
    DATA: 'warn',
    USB: 'warn',
    PORTADAS: 'warn',
    COVERS: 'warn',
    RENOMBRAR: 'warn',
    RENAME: 'warn',
    LANZAR: 'go',
    LAUNCH: 'go',
    'VOLVIÓ': 'ok',
    RETURNED: 'ok',
    INICIO: 'start',
    START: 'start',
  }

  // A list that slides: the focused entry always in view
  let scroll = $state(0)
  /** @type {HTMLElement | undefined} */
  let list = $state()
  $effect(() => {
    const el = /** @type {HTMLElement | undefined} */ (list?.children[index])
    const view = list?.parentElement?.clientHeight ?? 0
    if (!list || !el || !view) return
    const MARGIN = 12
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    const max = Math.max(0, list.scrollHeight - view)
    untrack(() => {
      let next = scroll
      if (top - next < MARGIN) next = top - MARGIN
      else if (bottom - next > view - MARGIN) next = bottom - view + MARGIN
      scroll = Math.max(0, Math.min(next, max))
    })
  })

  /** @param {number} next */
  function move(next) {
    const clamped = Math.max(0, Math.min(next, entries.length - 1))
    if (clamped === index) return
    index = clamped
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (action === 'up') move(index - 1)
      else if (action === 'down') move(index + 1)
      else if (action === 'lt') move(index - PAGE)
      else if (action === 'rt') move(index + PAGE)
      else if (action === 'b' || action === 'start') (sound.back(), onClose())
    }),
  )
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<section class="panel" aria-label={t('Registro de diagnóstico')}>
  <header>
    <span class="badge"><ChannelIcon id="log" color="currentColor" size={52} /></span>
    <div class="title">
      <h2>{t('Registro de diagnóstico')}</h2>
      <p>
        {t('En el PC:')} <code>{drive}relix\log.txt</code>
        {#if status === 'ready' && entries.length > 0}· {t('las últimas {entries}', { entries: plural(entries.length, 'entrada', 'entradas') })}{/if}
      </p>
    </div>
  </header>

  {#if status === 'loading'}
    <p class="empty"><span class="spinner" aria-hidden="true"></span> {t('Leyendo el registro…')}</p>
  {:else if status === 'error'}
    <p class="empty">
      {t('No se pudo leer el registro. Si actualizaste solo la interfaz, actualiza también el proyecto C# (falta')}
      <code>DiagnosticLog.cs</code>).
    </p>
  {:else if entries.length === 0}
    <p class="empty">
      {t(
        'Todavía no hay nada anotado. Relix anota cada juego que abres, cómo volvió y los errores, para revisarlos aquí o en el PC.',
      )}
    </p>
  {:else}
    <div class="window">
      <ol class="entries" bind:this={list} style:transform="translateY({-scroll}px)">
        {#each entries as entry, i (i)}
          <li class:focused={i === index}>
            <span class="when">{when(entry.time)}</span>
            {#if entry.kind}<span class="kind {TONES[entry.kind] ?? 'plain'}">{entry.kind}</span>{/if}
            <span class="text">{entry.text}</span>
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</section>

<div class="hints-layer">
  <HintBar
    surface
    hints={[
      ...(entries.length > PAGE ? [{ button: /** @type {const} */ ('lt'), also: /** @type {const} */ ('rt'), label: t('Página') }] : []),
      { button: 'b', label: t('Volver') },
    ]}
  />
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(var(--shadow) / 0.45);
    z-index: 10;
    animation: fade 180ms ease both;
  }
  .panel {
    position: absolute;
    left: 112px;
    right: 112px;
    top: 80px;
    bottom: 140px;
    display: flex;
    flex-direction: column;
    padding: 36px 44px 28px;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 40px 80px -40px rgb(var(--shadow) / 0.7);
    z-index: 11;
    animation: rise 260ms var(--spring) both;
  }
  header {
    display: flex;
    align-items: center;
    gap: 24px;
    padding-bottom: 22px;
    border-bottom: 3px dashed var(--sky);
  }
  .badge {
    display: grid;
    place-items: center;
    flex: none;
    width: 84px;
    height: 84px;
    border-radius: 26px;
    background: var(--sky);
  }
  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 40px;
    line-height: 1.1;
  }
  .title p {
    margin: 4px 0 0;
    font-size: 22px;
    color: var(--ink-soft);
  }
  code {
    font-family: var(--font-body);
    font-weight: 700;
    color: var(--ink);
  }
  .empty {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 40px 0 0;
    max-width: 1100px;
    font-size: 26px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .window {
    position: relative;
    flex: 1;
    margin-top: 14px;
    overflow: hidden;
    mask-image: linear-gradient(transparent, #000 10px, #000 calc(100% - 10px), transparent);
  }
  .entries {
    list-style: none;
    margin: 0;
    padding: 8px 0;
    transition: transform 220ms var(--spring);
  }
  .entries li {
    display: grid;
    grid-template-columns: 170px 150px 1fr;
    align-items: start;
    gap: 18px;
    padding: 12px 18px;
    border-radius: 20px;
  }
  .entries li.focused {
    background: var(--sky);
    box-shadow: inset 0 0 0 3px var(--pop);
  }
  .when {
    padding-top: 3px;
    font-weight: 700;
    font-size: 21px;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  .kind {
    justify-self: start;
    padding: 3px 14px 5px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 17px;
    letter-spacing: 0.02em;
    white-space: nowrap;
    background: var(--sky);
    color: var(--ink-soft);
  }
  .entries li.focused .kind.plain {
    background: var(--cloud);
  }
  .kind.bad {
    background: var(--pop);
    color: var(--on-color);
  }
  .kind.warn {
    background: var(--sun);
    color: var(--ink);
  }
  .kind.go {
    background: var(--btn-x);
    color: var(--on-color);
  }
  .kind.ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .kind.start {
    background: var(--ink);
    color: var(--cloud);
  }
  .text {
    font-size: 22px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .entries li.focused .text {
    -webkit-line-clamp: 6;
    line-clamp: 6;
  }
  .hints-layer {
    position: absolute;
    inset: 0;
    z-index: 11;
    pointer-events: none;
  }
  .hints-layer :global(.hints) {
    pointer-events: auto;
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
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
  }
</style>
