<script>
  /**
   * The preview video of the focused game. It only starts loading once you
   * stay on the game for a moment (moving fast through the grid doesn't ask
   * for videos), shows up over the screenshot once it's playing, and
   * loops. Muted unless you turn the sound on in Options › Preferences.
   * It stops with the screensaver or when a game opens.
   */
  import { activity, brokenMedia } from './activity.svelte.js'

  /** @type {{ src: string, delay?: number, sound?: boolean, onplaying?: () => void }} */
  let { src, delay = 1500, sound = false, onplaying } = $props()

  let waited = $state(false)
  let playing = $state(false)
  /** @type {HTMLVideoElement | undefined} */
  let video = $state()

  $effect(() => {
    src
    waited = false
    playing = false
    const timer = setTimeout(() => (waited = true), delay)
    return () => clearTimeout(timer)
  })

  // The sound can change without loading the video again
  $effect(() => {
    if (!video) return
    video.muted = !sound
    video.volume = 0.6
  })
</script>

{#if waited && !activity.quiet && !brokenMedia.has(src)}
  <video
    bind:this={video}
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
