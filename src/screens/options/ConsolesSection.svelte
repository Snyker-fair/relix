<script>
  // Options › Consoles: which emulator each console opens with (A changes it),
  // its guide (Y) and their order (X lifts one, ↑↓ move it, A saves, B cancels)
  import { untrack } from 'svelte'
  import { flip } from 'svelte/animate'
  import { moveConsole } from '../../lib/core/consoleOrder.js'
  import { getPlatform, launcherDetail } from '../../lib/core/platforms.js'
  import { t } from '../../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../../lib/ui/ChannelIcon.svelte'
  import { emulators } from '../../lib/ui/emulators.svelte.js'
  import { plural } from '../../lib/ui/format.js'
  import { library } from '../../lib/ui/library.svelte.js'
  import PadButton from '../../lib/ui/PadButton.svelte'
  import { settings } from '../../lib/ui/settings.svelte.js'
  import { shelf } from '../../lib/ui/shelf.svelte.js'
  import { sound } from '../../lib/ui/sound.js'

  /** @typedef {import('./section.js').Hint} Hint @typedef {import('./section.js').Action} Action */
  /** @typedef {import('../../lib/core/platforms.js').Platform} Platform */

  /**
   * @type {{
   *   index: number,
   *   onMove: (i: number) => void,
   *   onToast: (message: string) => void,
   *   onGuide: (systemId: string, from: { section: string, row: string }) => void,
   * }}
   */
  let { index = $bindable(), onMove, onToast, onGuide } = $props()

  /**
   * Moving a console (X): which one and the order while it moves.
   * It's saved with A; B leaves it as it was.
   */
  let moving = $state(/** @type {{ id: string, ids: string[] } | null} */ (null))
  const ROWS = $derived(moving ? moving.ids : shelf.consoles.map((p) => p.id))

  // On entering it asks again what's installed
  $effect(() => {
    untrack(() => emulators.check())
  })

  export function rows() {
    return ROWS
  }

  /** @param {Hint[]} common */
  export function hints(common) {
    if (moving) {
      return [
        { button: /** @type {const} */ ('up'), also: /** @type {const} */ ('down'), label: t('Mover') },
        { button: /** @type {const} */ ('a'), label: t('Listo') },
        { button: /** @type {const} */ ('b'), label: t('Cancelar') },
      ]
    }
    return [
      { button: /** @type {const} */ ('a'), label: t('Cambiar') },
      { button: /** @type {const} */ ('x'), label: t('Ordenar') },
      { button: /** @type {const} */ ('y'), label: t('Guía') },
      ...common,
    ]
  }

  /** @param {Action} action */
  export function handle(action) {
    if (moving) {
      if (action === 'up') moveRow(-1)
      else if (action === 'down') moveRow(1)
      else if (action === 'a' || action === 'x') stopMoving(true)
      else if (action === 'b') stopMoving(false)
      // nothing else while one moves
      return true
    }
    if (action === 'x') startMoving()
    else if (action === 'y') (sound.select(), onGuide(ROWS[index], { section: 'consoles', row: ROWS[index] }))
    else return false
    return true
  }

  /** A moves to the next emulator */
  export function activate() {
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

  /** X: the focused console starts moving */
  function startMoving() {
    moving = { id: ROWS[index], ids: [...ROWS] }
    sound.select()
  }

  /** @param {-1 | 1} delta */
  function moveRow(delta) {
    if (!moving) return
    const ids = moveConsole(moving.ids, moving.id, delta)
    if (ids === moving.ids) return sound.error()
    moving = { ...moving, ids }
    index = ids.indexOf(moving.id)
    sound.move()
  }

  /** A saves the new order (home screen, library tabs and here); B leaves it as it was @param {boolean} keep */
  function stopMoving(keep) {
    if (!moving) return
    const { id, ids } = moving
    if (keep) settings.setConsoleOrder(ids)
    moving = null
    index = ROWS.indexOf(id)
    if (keep) sound.favorite()
    else sound.back()
  }
</script>

{#each ROWS as id, i (id)}
  {@const platform = /** @type {Platform} */ (getPlatform(id))}
  {@const focused = i === index}
  {@const emulator = emulators.forPlatform(platform)}
  {@const installed = emulator ? emulators.isInstalled(emulator) : null}
  {@const count = library.gamesFor(id).length}
  <button
    class="row focus-ring"
    class:focused
    class:moving={moving?.id === id}
    style:--tint={platform.color}
    onmouseenter={() => !moving && onMove(i)}
    onclick={() => (moving ? stopMoving(true) : i === index ? activate() : onMove(i))}
    animate:flip={{ duration: 180 }}
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
      {#if moving?.id === id}
        <PadButton name="up" size={30} /><PadButton name="down" size={30} /> {t('Mover')}
      {:else if focused && platform.emulators.length > 1}
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
