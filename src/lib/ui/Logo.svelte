<script>
  /**
   * The Relix logo: the gem with its X-shaped sparkle, and the name in
   * lowercase. The dot on the "i" is a small gem, so the name and the
   * symbol read as one piece.
   */
  import mark from '../../../brand/relix-mark.svg?raw'

  /** @type {{ size?: number, wordmark?: boolean, boot?: boolean }} */
  let { size = 60, wordmark = true, boot = false } = $props()
</script>

<span class="logo" class:boot style:--size="{size}px">
  <span class="mark" aria-hidden={wordmark}>{@html mark}</span>
  {#if wordmark}
    <span class="word" aria-label="Relix"
      ><span aria-hidden="true">rel<span class="i">ı<span class="tittle"></span></span>x</span></span
    >
  {/if}
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--size) * 0.18);
    line-height: 1;
  }
  .mark {
    display: block;
    width: calc(var(--size) * 1.15);
    height: calc(var(--size) * 1.15);
    flex: none;
  }
  .mark :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .word {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: calc(var(--size) * 0.92);
    letter-spacing: -0.035em;
    color: var(--ink);
    /* Baloo 2 has room on top; this centers it optically with the gem */
    padding-top: calc(var(--size) * 0.1);
  }
  .i {
    position: relative;
  }
  /* The dot on the i: a small pink gem */
  .tittle {
    position: absolute;
    left: 50%;
    top: 0.38em;
    width: 0.17em;
    height: 0.17em;
    border-radius: 0.04em;
    background: var(--pop);
    transform: translateX(-50%) rotate(45deg);
  }

  /* ── The startup moment: the gem appears and the sparkle twinkles ── */
  .boot .mark :global(.gem),
  .boot .mark :global(.glint),
  .boot .tittle {
    transform-box: fill-box;
    transform-origin: center;
  }
  .boot .mark :global(.gem) {
    animation: gem-in 620ms var(--spring) both;
  }
  .boot .mark :global(.glint) {
    animation: glint 760ms var(--spring) 420ms both;
  }
  .boot .tittle {
    animation: tittle-in 420ms var(--spring) 700ms both;
  }

  @keyframes gem-in {
    from {
      transform: scale(0) rotate(-12deg);
    }
  }
  @keyframes glint {
    0% {
      transform: scale(0) rotate(-90deg);
    }
    60% {
      transform: scale(1.35) rotate(10deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }
  @keyframes tittle-in {
    from {
      transform: translateX(-50%) rotate(45deg) scale(0);
    }
  }
</style>
