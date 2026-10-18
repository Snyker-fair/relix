<script>
  /**
   * The bottom bar with what each button does on this screen.
   * The hints can be clicked too (useful when testing on the PC).
   */
  import { untrack } from 'svelte'
  import { hintStack } from './hintStack.svelte.js'
  import { dispatch } from './input.js'
  import PadButton from './PadButton.svelte'

  /**
   * also: a second button for the same hint (e.g. LT and RT)
   * surface: its own background, for when the bar sits over a dimmed screen
   * @type {{
   *   hints: Array<{ button: import('./input.js').Action, also?: import('./input.js').Action, label: string }>,
   *   surface?: boolean,
   * }}
   */
  let { hints, surface = false } = $props()

  // If a window opens on top (menu, keyboard), its bar covers this one
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
  /* over a window with a dimmed background: a light pill so it can be read */
  .hints.surface {
    right: 92px;
    bottom: 46px;
    padding: 14px 20px;
    border-radius: 999px;
    background: rgb(var(--glass) / 0.94);
    box-shadow: 0 16px 34px -20px rgb(var(--shadow) / 0.6);
  }
  .hints {
    position: absolute;
    right: 112px;
    bottom: 60px; /* inside the TV's safe area (5 %) */
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
