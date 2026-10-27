<script>
  // Options › Library: a row per console to scan it, "Scan everything", the file
  // names, the games' information and the hidden games
  import { afterScanText } from '../../lib/core/afterScan.js'
  import { PLATFORMS } from '../../lib/core/platforms.js'
  import { t, tn } from '../../lib/i18n/i18n.svelte.js'
  import { afterScan } from '../../lib/ui/afterScan.svelte.js'
  import ChannelIcon from '../../lib/ui/ChannelIcon.svelte'
  import { covers } from '../../lib/ui/covers.svelte.js'
  import { plural, scanSummary, timeAgo } from '../../lib/ui/format.js'
  import { gameInfo } from '../../lib/ui/gameInfo.svelte.js'
  import { library } from '../../lib/ui/library.svelte.js'
  import PadButton from '../../lib/ui/PadButton.svelte'
  import { renamer } from '../../lib/ui/renamer.svelte.js'
  import { shelf } from '../../lib/ui/shelf.svelte.js'
  import { sound } from '../../lib/ui/sound.js'
  import { ticking } from './ticking.svelte.js'

  /** @typedef {import('./section.js').Hint} Hint */

  /**
   * @type {{
   *   index: number,
   *   onMove: (i: number) => void,
   *   onToast: (message: string) => void,
   *   onRenameFiles: () => void,
   *   onGameInfo: () => void,
   * }}
   */
  let { index, onMove, onToast, onRenameFiles, onGameInfo } = $props()

  const ROWS = $derived([...shelf.consoles.map((p) => p.id), 'all', 'rename', 'info', 'hidden'])
  const clock = ticking()
  /** true while "Scan everything" runs (the rows show which one it's on) */
  let scanningAll = $state(false)
  const busy = $derived(library.scanning.length > 0)
  const totalGames = $derived(PLATFORMS.reduce((n, p) => n + library.gamesFor(p.id).length, 0))

  export function rows() {
    return ROWS
  }

  /** @param {Hint[]} common */
  export function hints(common) {
    const id = ROWS[index]
    const a = id === 'hidden' ? t('Mostrar') : id === 'rename' ? t('Revisar') : id === 'info' ? t('Buscar') : t('Escanear')
    return [{ button: /** @type {const} */ ('a'), label: a }, ...common]
  }

  /** @param {string} id */
  function rowMeta(id) {
    const scan = library.scans[id]
    const count = plural(library.gamesFor(id).length, 'juego', 'juegos')
    return { count, where: library.romFolderPath(id), when: scan ? timeAgo(scan.scannedAt, clock.now) : t('sin escanear') }
  }

  /** @param {string} id */
  async function scanOne(id) {
    const platform = PLATFORMS.find((p) => p.id === id)
    const [change] = await library.rescan([id])
    clock.refresh()
    return scanSummary(platform?.shortName ?? id, change)
  }

  /**
   * After scanning, the covers and descriptions its games are missing, without
   * asking (ui/afterScan.svelte.js): copying the games and scanning is all there is.
   * @param {string[]} ids
   */
  function completeAfterScan(ids) {
    afterScan.complete(ids).then((result) => {
      const text = result && afterScanText(result)
      if (text) onToast(text)
    })
  }

  export async function activate() {
    const id = ROWS[index]
    if (id === 'hidden') return unhide()
    if (id === 'rename') return (sound.select(), onRenameFiles())
    if (id === 'info') return (sound.select(), onGameInfo())
    if (busy || scanningAll || afterScan.working) return
    sound.select()
    try {
      if (id !== 'all') {
        onToast(await scanOne(id))
      } else {
        // One console after another, so the progress shows row by row
        let added = 0
        let removed = 0
        scanningAll = true
        try {
          for (const p of shelf.consoles) {
            const [change] = await library.rescan([p.id])
            added += change.added
            removed += change.removed
          }
        } finally {
          scanningAll = false
        }
        clock.refresh()
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
      completeAfterScan(id === 'all' ? shelf.consoles.map((p) => p.id) : [id])
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudo escanear. Revisa que el USB esté conectado.'))
    }
  }

  function unhide() {
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
</script>

{#each ROWS as id, i (id)}
  {@const platform = PLATFORMS.find((p) => p.id === id)}
  {@const focused = i === index}
  {@const scanning = library.scanning.includes(id)}
  <button
    class="row focus-ring"
    class:focused
    class:all={id === 'all'}
    style:--tint={platform?.color ?? 'var(--pop)'}
    onmouseenter={() => onMove(i)}
    onclick={() => (i === index ? activate() : onMove(i))}
  >
    {#if platform}
      {@const meta = rowMeta(id)}
      <span class="badge" style:background={platform.color}>
        <ChannelIcon {id} color={platform.ink} size={46} />
      </span>
      <span class="text">
        <strong>{platform.name}</strong>
        <span>{t('{games} en', { games: meta.count })} <code>{meta.where}</code></span>
      </span>
      <span class="state">
        {#if scanning}
          <span class="spinner" aria-hidden="true"></span> {t('Escaneando…')}
        {:else if covers.busy === id}
          <span class="spinner" aria-hidden="true"></span> {t('Buscando portadas…')}
        {:else if gameInfo.finding?.console === platform.shortName}
          <span class="spinner" aria-hidden="true"></span> {t('Buscando información…')}
        {:else if focused && !busy && !afterScan.working}
          <PadButton name="a" size={30} /> {t('Escanear')}
        {:else}
          {meta.when}
        {/if}
      </span>
    {:else if id === 'rename'}
      {@const toRename = renamer.pending.length}
      <span class="badge neutral">
        <ChannelIcon id="rename" color="currentColor" size={46} />
      </span>
      <span class="text">
        <strong>{t('Nombres de archivo')}</strong>
        <span>
          {renamer.review === null
            ? t('Busca los archivos que no tienen su nombre estándar y los renombra')
            : toRename > 0
              ? tn(toRename, '{n} archivo sin su nombre estándar', '{n} archivos sin su nombre estándar')
              : t('Todos tienen su nombre estándar')}
        </span>
      </span>
      <span class="state">
        {#if focused}
          <PadButton name="a" size={30} /> {t('Revisar')}
        {:else if toRename > 0}
          <span class="value on">{toRename}</span>
        {/if}
      </span>
    {:else if id === 'info'}
      {@const withoutInfo = gameInfo.withoutDescription}
      <span class="badge neutral">
        <ChannelIcon id="info" color="currentColor" size={46} />
      </span>
      <span class="text">
        <strong>{t('Información de los juegos')}</strong>
        <span>
          {gameInfo.finding
            ? t('Buscando en Wikipedia: {console}…', { console: gameInfo.finding.console })
            : withoutInfo > 0
              ? tn(withoutInfo, '{n} juego sin descripción · desde Wikipedia', '{n} juegos sin descripción · desde Wikipedia')
              : t('Todos tienen su descripción')}
        </span>
      </span>
      <span class="state">
        {#if gameInfo.finding}
          <span class="spinner" aria-hidden="true"></span>
        {:else if focused}
          <PadButton name="a" size={30} /> {t('Buscar')}
        {:else if withoutInfo > 0}
          <span class="value on">{withoutInfo}</span>
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
        {:else if afterScan.working}
          <span class="spinner" aria-hidden="true"></span> {t('Portadas e información…')}
        {:else if focused && !busy}
          <PadButton name="a" size={30} /> {t('Escanear')}
        {/if}
      </span>
    {/if}
  </button>
{/each}
