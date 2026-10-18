<script>
  /**
   * A window to type a short text with the on-screen keyboard
   * (e.g. the name of a new collection). ≡ or "Done" confirm; B cancels.
   *
   * file: for a file name (Y › Rename file…): a wider field that wraps, the
   * keyboard with parentheses and brackets, and LT to erase a word.
   * check: what's wrong with the text as you type it (null if nothing):
   * it shows under the field and "Done" waits until it's fixed.
   */
  import { untrack } from 'svelte'
  import HintBar from './HintBar.svelte'
  import { pushHandler } from './input.js'
  import Keyboard from './Keyboard.svelte'
  import { sound } from './sound.js'
  import { t } from '../i18n/i18n.svelte.js'

  /**
   * @type {{
   *   title: string,
   *   placeholder?: string,
   *   initial?: string,
   *   file?: boolean,
   *   maxLength?: number,
   *   check?: (value: string) => string | null,
   *   onSubmit: (value: string) => void,
   *   onCancel: () => void,
   * }}
   */
  let { title, placeholder = '', initial = '', file = false, maxLength, check, onSubmit, onCancel } = $props()

  let value = $state(untrack(() => initial))
  const problem = $derived(value.trim() && check ? check(value) : null)
  /** @type {Keyboard | undefined} */
  let keyboard = $state()

  function submit() {
    if (!value.trim() || problem) return sound.error()
    onSubmit(value.trim())
  }

  $effect(() =>
    pushHandler((action) => {
      if (action === 'b') (sound.back(), onCancel())
      else if (action === 'start') submit()
      else keyboard?.handle(action)
    }),
  )
</script>

<div class="backdrop">
  <section class="prompt" class:file aria-label={title}>
    <h2>{title}</h2>
    <p class="field" class:empty={!value}>
      {#if value}{value}<span class="caret" aria-hidden="true"></span>
      {:else}<span class="caret" aria-hidden="true"></span>{placeholder}{/if}
    </p>
    {#if check || file}
      <p class="problem" role="status">{problem ?? ''}</p>
    {/if}
    <Keyboard
      bind:this={keyboard}
      bind:value
      onSubmit={submit}
      layout={file ? 'file' : 'text'}
      maxLength={maxLength ?? (file ? 120 : 40)}
    />
  </section>

  <HintBar
    surface
    hints={[
      { button: 'a', label: t('Escribir') },
      { button: 'x', label: t('Borrar') },
      ...(file ? [{ button: /** @type {const} */ ('lt'), label: t('Borrar palabra') }] : []),
      { button: 'y', label: t('Espacio') },
      { button: 'start', label: t('Listo') },
      { button: 'b', label: t('Cancelar') },
    ]}
  />
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(var(--shadow) / 0.45);
    z-index: 12;
    animation: fade 160ms ease both;
  }
  .prompt {
    width: 700px;
    max-height: 960px;
    padding: 44px 48px 48px;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 40px 80px -40px rgb(var(--shadow) / 0.7);
    animation: pop 260ms var(--spring) both;
  }
  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 44px;
  }
  .field {
    display: flex;
    align-items: center;
    height: 76px;
    margin: 24px 0 38px;
    padding: 0 24px;
    border-radius: 24px;
    border: 4px solid var(--sky-deep);
    background: var(--cloud);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 34px;
  }
  .field.empty {
    color: var(--ink-soft);
  }
  /* a file name: long, so it wraps instead of being cut */
  .file {
    width: 1040px;
    padding-top: 38px;
    padding-bottom: 40px;
    margin-bottom: 70px; /* a little above the middle: the bar of buttons fits below */
  }
  .file .field {
    display: block;
    height: auto;
    min-height: 76px;
    margin-bottom: 0;
    padding: 14px 24px;
    font-size: 30px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .file .caret {
    display: inline-block;
    height: 32px;
    vertical-align: -5px;
  }
  .problem {
    min-height: 30px;
    margin: 10px 4px 22px;
    font-weight: 700;
    font-size: 22px;
    color: var(--pop);
  }
  .file h2 {
    font-size: 40px;
  }
  .caret {
    width: 4px;
    height: 38px;
    margin-left: 4px;
    border-radius: 2px;
    background: var(--pop);
    animation: blink 1s steps(2, start) infinite;
  }
  .field.empty .caret {
    margin: 0 8px 0 0;
  }
  @keyframes blink {
    to {
      visibility: hidden;
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.92);
    }
  }
</style>
