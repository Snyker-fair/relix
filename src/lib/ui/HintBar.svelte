<script>
  /**
   * Barra inferior con lo que hace cada botón en esta pantalla.
   * Las pistas también se pueden clickear (útil al probar en el PC).
   */
  import { untrack } from 'svelte'
  import { hintStack } from './hintStack.svelte.js'
  import { dispatch } from './input.js'
  import PadButton from './PadButton.svelte'

  /**
   * also: un segundo botón para la misma pista (p. ej. LT y RT)
   * surface: fondo propio, para cuando la barra queda sobre una pantalla oscurecida
   * @type {{
   *   hints: Array<{ button: import('./input.js').Action, also?: import('./input.js').Action, label: string }>,
   *   surface?: boolean,
   * }}
   */
  let { hints, surface = false } = $props()

  // Si se abre una ventana encima (menú, teclado), su barra tapa a esta
  const id = Symbol('hints')
  $effect(() => untrack(() => hintStack.push(id)))
  const visible = $derived(hintStack.isTop(id))
</script>

<nav class="hints" class:covered={!visible} class:surface aria-hidden={!visible}>
  {#each hints as hint (hint.button)}
    <button class="hint" onclick={() => dispatch(hint.button)}>
      <PadButton name={hint.button} />
      {#if hint.also}<PadButton name={hint.also} />{/if}
      <span>{hint.label}</span>
    </button>
  {/each}
</nav>

<style>
  .covered {
    visibility: hidden;
  }
  /* sobre una ventana con fondo oscurecido: píldora clara para que se lea */
  .hints.surface {
    right: 92px;
    bottom: 46px;
    padding: 14px 20px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.94);
    box-shadow: 0 16px 34px -20px rgb(35 48 74 / 0.6);
  }
  .hints {
    position: absolute;
    right: 112px;
    bottom: 60px; /* dentro del área segura de la TV (5 %) */
    display: flex;
    gap: 36px;
  }
  .hint {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 700;
    font-size: 26px;
    color: var(--ink-soft);
  }
  .hint:hover span {
    color: var(--ink);
  }
</style>
