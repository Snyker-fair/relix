<script>
  /**
   * Ventana para escribir un texto corto con el teclado en pantalla
   * (p. ej. el nombre de una colección nueva). ≡ o "Listo" confirman; B cancela.
   */
  import HintBar from './HintBar.svelte'
  import { pushHandler } from './input.js'
  import Keyboard from './Keyboard.svelte'
  import { sound } from './sound.js'
  import { t } from '../i18n/i18n.svelte.js'

  /**
   * @type {{
   *   title: string,
   *   placeholder?: string,
   *   onSubmit: (value: string) => void,
   *   onCancel: () => void,
   * }}
   */
  let { title, placeholder = '', onSubmit, onCancel } = $props()

  let value = $state('')
  /** @type {Keyboard | undefined} */
  let keyboard = $state()

  function submit() {
    if (!value.trim()) return sound.error()
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
  <section class="prompt" aria-label={title}>
    <h2>{title}</h2>
    <p class="field" class:empty={!value}>
      {value || placeholder}<span class="caret" aria-hidden="true"></span>
    </p>
    <Keyboard bind:this={keyboard} bind:value onSubmit={submit} />
  </section>

  <HintBar
    surface
    hints={[
      { button: 'a', label: t('Escribir') },
      { button: 'x', label: t('Borrar') },
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
  .caret {
    width: 4px;
    height: 38px;
    margin-left: 4px;
    border-radius: 2px;
    background: var(--pop);
    animation: blink 1s steps(2, start) infinite;
  }
  .field.empty .caret {
    order: -1;
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
