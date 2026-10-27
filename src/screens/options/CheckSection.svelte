<script>
  // Options › Checkup: what needs fixing first, then the warnings and what's fine;
  // A opens a check's guide. At the end: check again, the log and the welcome tour.
  import { untrack } from 'svelte'
  import { t } from '../../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../../lib/ui/ChannelIcon.svelte'
  import { diagnostics } from '../../lib/ui/diagnostics.svelte.js'
  import { plural, timeAgo } from '../../lib/ui/format.js'
  import { library } from '../../lib/ui/library.svelte.js'
  import PadButton from '../../lib/ui/PadButton.svelte'
  import { sound } from '../../lib/ui/sound.js'
  import { systemStatus } from '../../lib/ui/systemStatus.svelte.js'
  import { ticking } from './ticking.svelte.js'

  /** @typedef {import('./section.js').Hint} Hint */
  /** @typedef {import('../../lib/core/systemCheck.js').CheckState} CheckState */

  /**
   * @type {{
   *   index: number,
   *   onMove: (i: number) => void,
   *   onToast: (message: string) => void,
   *   onGuide: (systemId: string, from: { section: string, row: string }) => void,
   *   onWelcome: () => void,
   *   onLog: () => void,
   * }}
   */
  let { index = $bindable(), onMove, onToast, onGuide, onWelcome, onLog } = $props()

  /** @type {Record<CheckState, number>} a new version first */
  const STATE_ORDER = { update: -1, error: 0, warn: 1, info: 2, ok: 3 }
  /** @type {Record<CheckState, string>} */
  const MARKS = { ok: '✓', warn: '!', error: '✗', info: 'i', update: '↑' }
  /** @type {Record<CheckState, string>} */
  const STATE_TINTS = { ok: '#3FAE49', warn: '#F2B705', error: 'var(--pop)', info: '#8FA3BF', update: 'var(--btn-x)' }

  const sortedChecks = $derived([...systemStatus.checks].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]))
  const checkById = $derived(new Map(sortedChecks.map((c) => [c.id, c])))
  const ROWS = $derived([...sortedChecks.map((c) => c.id), 'recheck', 'log', 'welcome'])
  const logDrive = $derived(library.romRoot.replace(/roms[\\/]*$/i, '') || 'E:\\')
  const clock = ticking()

  // On entering it checks again, unless it was just done (e.g. coming back from a guide)
  $effect(() => {
    untrack(() => {
      if (Date.now() - systemStatus.checkedAt > 20_000) systemStatus.run().then(() => clock.refresh())
    })
  })

  // The rows change when checking again (they appear, get fixed): the focus
  // follows the row it had and not its position
  let focusedId = ''
  $effect.pre(() => {
    const rows = ROWS
    untrack(() => {
      if (!focusedId) return
      const i = rows.indexOf(focusedId)
      if (i >= 0 && i !== index) index = i
      else if (i < 0 && index >= rows.length) index = rows.length - 1
    })
  })
  $effect(() => {
    focusedId = ROWS[index] ?? ''
  })

  export function rows() {
    return ROWS
  }

  /** @param {Hint[]} common */
  export function hints(common) {
    const id = ROWS[index]
    const a =
      id === 'recheck' ? t('Revisar') : id === 'welcome' || id === 'log' ? t('Ver') : checkById.get(id)?.action ? t('Ver guía') : ''
    return [...(a ? [{ button: /** @type {const} */ ('a'), label: a }] : []), ...common]
  }

  /** A opens the check's guide, checks again, the log or the tour */
  export async function activate() {
    const id = ROWS[index]
    if (id === 'welcome') {
      sound.select()
      onWelcome()
      return
    }
    if (id === 'log') {
      sound.select()
      onLog()
      return
    }
    if (id === 'recheck') {
      if (systemStatus.running) return
      sound.select()
      await systemStatus.run({ forceUpdate: true })
      clock.refresh()
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
    onGuide(check.action.systemId, { section: 'check', row: id })
  }
</script>

{#each ROWS as id, i (id)}
  {@const check = checkById.get(id)}
  {@const focused = i === index}
  <button
    class="row focus-ring"
    class:focused
    class:all={id === 'recheck'}
    style:--tint={check ? STATE_TINTS[check.state] : 'var(--pop)'}
    onmouseenter={() => onMove(i)}
    onclick={() => (i === index ? activate() : onMove(i))}
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
              ? t('Última revisión {when}', { when: timeAgo(systemStatus.checkedAt, clock.now) })
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
          <code>{logDrive}relix\log.txt</code> ·
          {diagnostics.lastAt
            ? t('última entrada {when}', { when: timeAgo(diagnostics.lastAt, clock.now) })
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
