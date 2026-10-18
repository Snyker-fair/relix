<script>
  /**
   * An on-screen keyboard to type with the controller, Nintendo style.
   * The screen that uses it passes it the buttons with `handle(action)`:
   *
   *   arrows  move    A  type the key    X  delete    Y  space
   *
   * `handle` returns false if the action isn't its business (for example, leaving
   * through the right edge toward the search results).
   */
  import { sound } from './sound.js'
  import { t } from '../i18n/i18n.svelte.js'

  /**
   * @type {{
   *   value?: string,
   *   onSubmit?: (value: string) => void,
   *   maxLength?: number,
   *   active?: boolean,
   * }}
   */
  let { value = $bindable(''), onSubmit, maxLength = 40, active = true } = $props()

  const COLUMNS = 7
  const LETTERS = ['ABCDEFG', 'HIJKLMN', 'ÑOPQRST', 'UVWXYZ-', '1234567', "890&':."]

  /** @typedef {{ id: string, label: string, span: number, kind: 'char'|'space'|'del'|'ok' }} Key */

  /** @type {Key[][]} */
  const rows = $derived([
    ...LETTERS.map((r) => [...r].map((ch) => /** @type {Key} */ ({ id: ch, label: ch, span: 1, kind: 'char' }))),
    onSubmit
      ? [
          { id: 'space', label: t('Espacio'), span: 3, kind: 'space' },
          { id: 'del', label: t('Borrar'), span: 2, kind: 'del' },
          { id: 'ok', label: t('Listo'), span: 2, kind: 'ok' },
        ]
      : [
          { id: 'space', label: t('Espacio'), span: 4, kind: 'space' },
          { id: 'del', label: t('Borrar'), span: 3, kind: 'del' },
        ],
  ])

  let row = $state(0)
  /** A column from 0 to 6; the wide keys take several */
  let col = $state(0)

  /** The key that covers a column and where it starts */
  function keyAt(/** @type {number} */ r, /** @type {number} */ c) {
    let start = 0
    for (const key of rows[r]) {
      if (c < start + key.span) return { key, start }
      start += key.span
    }
    const last = rows[r].at(-1)
    return { key: /** @type {Key} */ (last), start: COLUMNS - (last?.span ?? 1) }
  }

  const focused = $derived(keyAt(row, col))

  /** @param {Key} key */
  function press(key) {
    if (key.kind === 'del') {
      if (value.length === 0) return sound.error()
      value = value.slice(0, -1)
    } else if (key.kind === 'ok') {
      if (!value.trim()) return sound.error()
      onSubmit?.(value.trim())
      return
    } else if (key.kind === 'space') {
      if (value.length === 0 || value.endsWith(' ') || value.length >= maxLength) return sound.error()
      value += ' '
    } else {
      if (value.length >= maxLength) return sound.error()
      // Uppercase at the start of each word: "with friends" -> "With Friends" looks right in titles
      const startOfWord = value.length === 0 || value.endsWith(' ')
      value += startOfWord ? key.label : key.label.toLowerCase()
    }
    sound.select()
  }

  /**
   * @param {import('./input.js').Action} action
   * @returns {boolean} false if the action isn't the keyboard's business
   */
  export function handle(action) {
    const { key, start } = focused
    if (action === 'left') {
      if (start === 0) return false
      col = keyAt(row, start - 1).start
    } else if (action === 'right') {
      if (start + key.span >= COLUMNS) return false
      col = start + key.span
    } else if (action === 'up') {
      if (row === 0) return false
      row--
    } else if (action === 'down') {
      if (row === rows.length - 1) return false
      row++
    } else if (action === 'a') {
      press(key)
      return true
    } else if (action === 'x') {
      press({ id: 'del', label: '', span: 1, kind: 'del' })
      return true
    } else if (action === 'y') {
      press({ id: 'space', label: '', span: 1, kind: 'space' })
      return true
    } else {
      return false
    }
    sound.move()
    return true
  }

  /** Back to the keyboard from the results: to the row's last column */
  export function enterFromRight() {
    col = COLUMNS - 1
  }
</script>

<div class="keyboard" class:active role="group" aria-label={t('Teclado')}>
  {#each rows as keys, r (r)}
    <div class="row">
      {#each keys as key (key.id)}
        <button
          class="key"
          class:wide={key.span > 1}
          class:ok={key.kind === 'ok'}
          class:focused={active && focused.key.id === key.id}
          style:grid-column="span {key.span}"
          onclick={() => press(key)}
        >
          {key.label}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .keyboard {
    display: grid;
    gap: 12px;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(7, 64px);
    gap: 12px;
    justify-content: center;
  }
  .key {
    height: 60px;
    border-radius: 18px;
    background: var(--sky);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 28px;
    color: var(--ink);
    padding-top: 3px;
    transition:
      transform 140ms var(--spring),
      background 140ms ease,
      color 140ms ease;
  }
  .key.wide {
    font-size: 22px;
  }
  .key.ok {
    background: var(--ink);
    color: var(--cloud);
  }
  /* the focused key changes color and rises a little, without growing:
     that way it never steps on its neighbors, not even the wide ones */
  .key.focused {
    background: var(--pop);
    color: var(--on-color);
    transform: translateY(-3px);
    box-shadow: 0 8px 18px -8px var(--pop);
  }
  .keyboard:not(.active) {
    opacity: 0.7;
  }
</style>
