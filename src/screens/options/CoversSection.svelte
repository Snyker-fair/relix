<script>
  // Options › Covers: a row per console with games to look for the ones missing,
  // "Search all" and "Pick by hand" (the games whose cover Relix wasn't sure of)
  import { getPlatform, PLATFORMS } from '../../lib/core/platforms.js'
  import { t, tn } from '../../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../../lib/ui/ChannelIcon.svelte'
  import { covers } from '../../lib/ui/covers.svelte.js'
  import { coverSummary, timeAgo } from '../../lib/ui/format.js'
  import { library } from '../../lib/ui/library.svelte.js'
  import PadButton from '../../lib/ui/PadButton.svelte'
  import { shelf } from '../../lib/ui/shelf.svelte.js'
  import { sound } from '../../lib/ui/sound.js'
  import { ticking } from './ticking.svelte.js'

  /** @typedef {import('./section.js').Hint} Hint */

  /**
   * @type {{
   *   index: number,
   *   onMove: (i: number) => void,
   *   onToast: (message: string) => void,
   *   onPickCovers: () => void,
   * }}
   */
  let { index, onMove, onToast, onPickCovers } = $props()

  // The consoles with games (all of them if none has any yet)
  const coverPlatforms = $derived.by(() => {
    const withGames = shelf.consoles.filter((p) => library.gamesFor(p.id).length > 0)
    return withGames.length > 0 ? withGames : shelf.consoles
  })
  const ROWS = $derived([...coverPlatforms.map((p) => p.id), 'all', 'choose'])
  /** true while "Search all" runs */
  const searchingAll = $derived(covers.all !== null)
  const coverBusy = $derived(covers.busy !== null || searchingAll)
  const clock = ticking()

  export function rows() {
    return ROWS
  }

  /** @param {Hint[]} common */
  export function hints(common) {
    return [{ button: /** @type {const} */ ('a'), label: ROWS[index] === 'choose' ? t('Elegir') : t('Buscar') }, ...common]
  }

  export async function activate() {
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
        // One console after another, only the ones with games without a cover
        onToast(coverSummary(t('Listo'), await covers.findAll()))
      }
      clock.refresh()
      sound.favorite()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudieron buscar las portadas.'))
    }
  }

  /** "45 of 52 with a cover" and how full the console is (0 to 1) @param {string} id */
  function coverMeta(id) {
    const { withCover, total } = library.coverCount(id)
    return {
      text: t('{n} de {total} con portada', { n: withCover, total }),
      full: total > 0 && withCover === total,
      ratio: total > 0 ? withCover / total : 0,
    }
  }
</script>

{#each ROWS as id, i (id)}
  {@const platform = PLATFORMS.find((p) => p.id === id)}
  {@const focused = i === index}
  <button
    class="row focus-ring"
    class:focused
    class:all={id === 'all'}
    style:--tint={platform?.color ?? (id === 'choose' ? 'var(--glint)' : 'var(--pop)')}
    onmouseenter={() => onMove(i)}
    onclick={() => (i === index ? activate() : onMove(i))}
  >
    {#if platform}
      {@const meta = coverMeta(id)}
      <span class="badge" style:background={platform.color}>
        <ChannelIcon {id} color={platform.ink} size={46} />
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
          {timeAgo(covers.results[id].at, clock.now)}
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
