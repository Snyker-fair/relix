<script>
  /**
   * The preview video of the focused game. It only starts loading once you
   * stay on the game for a moment (moving fast through the grid doesn't ask
   * for videos), shows up over the screenshot once it's playing, and
   * loops, always muted (it's a preview: the sound is the game's).
   * It stops with the screensaver or when a game opens.
   */
  import { activity, brokenMedia } from './activity.svelte.js'
  import { memory } from './memory.svelte.js'

  /** @type {{ src: string, delay?: number, onplaying?: () => void }} */
  let { src, delay = 1500, onplaying } = $props()

  let waited = $state(false)
  let playing = $state(false)
  const shown = $derived(waited && !activity.quiet && !brokenMedia.has(src))

  $effect(() => {
    src
    waited = false
    playing = false
    const timer = setTimeout(() => (waited = true), delay)
    return () => clearTimeout(timer)
  })

  // While it plays, the memory log knows (see memory.svelte.js)
  $effect(() => {
    if (!playing || !shown) return
    memory.videoStarted()
    return () => memory.videoStopped()
  })
</script>

{#if shown}
  <video
    class:playing
    {src}
    muted
    autoplay
    loop
    playsinline
    preload="auto"
    aria-hidden="true"
    onplaying={() => ((playing = true), onplaying?.())}
    onerror={() => brokenMedia.add(src)}
  ></video>
{/if}

<style>
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 400ms ease;
    background: transparent;
  }
  video.playing {
    opacity: 1;
  }
</style>
