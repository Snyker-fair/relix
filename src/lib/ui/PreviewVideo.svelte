<script>
  /**
   * Video de vista previa del juego enfocado. Empieza a cargar recién cuando
   * te quedas un momento en el juego (moverse rápido por la grilla no pide
   * videos), aparece encima de la captura cuando ya se está viendo y se
   * repite. Sin sonido salvo que lo actives en Opciones › Preferencias.
   * Se detiene con el protector de pantalla o al abrir un juego.
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

  // El sonido se puede cambiar sin volver a cargar el video
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
