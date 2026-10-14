<script>
  /**
   * Barra inferior con lo que hace cada botón en esta pantalla.
   * Las pistas también se pueden clickear (útil al probar en el PC).
   */
  import { dispatch } from './input.js'
  import PadButton from './PadButton.svelte'

  /** @type {{ hints: Array<{ button: import('./input.js').Action, label: string }> }} */
  let { hints } = $props()
</script>

<nav class="hints">
  {#each hints as hint (hint.button)}
    <button class="hint" onclick={() => dispatch(hint.button)}>
      <PadButton name={hint.button} />
      <span>{hint.label}</span>
    </button>
  {/each}
</nav>

<style>
  .hints {
    position: absolute;
    right: 112px;
    bottom: 48px;
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
