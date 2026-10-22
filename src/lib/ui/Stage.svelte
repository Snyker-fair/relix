<script>
  /**
   * A fixed 1920×1080 stage scaled to fill the screen.
   * It's designed once in "TV pixels" and looks the same on the Xbox,
   * on a monitor or on a phone.
   */
  let { children } = $props()

  let scale = $state(1)

  function fit() {
    scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  }

  /**
   * The stage never scrolls. With overflow: clip the browser can't scroll it;
   * this is for a browser that doesn't know clip and still does (to show a
   * focused button, say): it goes back to its place.
   * @param {Event} event
   */
  function stay(event) {
    const el = /** @type {HTMLElement} */ (event.currentTarget)
    if (el.scrollLeft !== 0 || el.scrollTop !== 0) el.scrollTo(0, 0)
  }

  $effect(() => {
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  })
</script>

<div class="viewport" onscroll={stay}>
  <div class="stage" onscroll={stay} style:transform="translate(-50%, -50%) scale({scale})">
    {@render children()}
  </div>
</div>

<style>
  .viewport {
    position: fixed;
    inset: 0;
    overflow: hidden;
    overflow: clip;
    background: var(--sky);
  }
  .stage {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1920px;
    height: 1080px;
    transform-origin: center;
    /* clip, not hidden: hidden still lets the browser scroll it, and something
       coming in from off screen (the game menu, as it slides in) moved the
       whole screen to reach it */
    overflow: hidden;
    overflow: clip;
    /* A dot pattern like sketchbook paper */
    background-color: var(--sky);
    background-image:
      radial-gradient(circle at 12% -10%, var(--glow), transparent 42%),
      radial-gradient(circle, var(--sky-deep) 2.5px, transparent 3px);
    background-size:
      100% 100%,
      36px 36px;
  }
</style>
