<script>
  /**
   * Portada de un juego. Si ES-DE trajo imagen, se usa esa.
   * Si no, se dibuja una portada provisoria con el color de la consola,
   * variando tono y adornos según el nombre (cada juego se ve distinto).
   */
  import ChannelIcon from './ChannelIcon.svelte'

  /** @type {{ game: any, platform: any, width?: number, showTitle?: boolean }} */
  let { game, platform, width = 184, showTitle = true } = $props()

  let failed = $state(false)

  /** Hash simple y estable del nombre */
  function hash(str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  const seed = $derived(hash(game.name))
  // Mezcla el color de la consola con blanco o tinta según el hash
  const shade = $derived((seed % 5) * 9 - 18) // -18..+18
  const bg = $derived(
    shade >= 0
      ? `color-mix(in oklab, ${platform.color}, white ${shade}%)`
      : `color-mix(in oklab, ${platform.color}, ${platform.ink} ${-shade}%)`,
  )
  const blobX = $derived(20 + (seed % 60))
  const blobY = $derived(10 + ((seed >> 6) % 40))
  const blobSize = $derived(55 + ((seed >> 12) % 35))
  const height = $derived(Math.round(width * 1.4))
  const titleSize = $derived(Math.max(14, Math.round(width / (game.name.length > 22 ? 9.5 : 7.5))))
</script>

<div
  class="cover"
  style:width="{width}px"
  style:height="{height}px"
  style:--bg={bg}
  style:--ink={platform.ink}
>
  {#if game.cover && !failed}
    <img src={game.cover} alt={game.name} onerror={() => (failed = true)} />
  {:else}
    <div
      class="blob"
      style:left="{blobX}%"
      style:top="{blobY}%"
      style:width="{blobSize}%"
    ></div>
    <div class="icon"><ChannelIcon id={platform.id} color={platform.ink} size={width * 0.22} /></div>
    {#if showTitle}
      <p class="title" style:font-size="{titleSize}px">{game.name}</p>
    {/if}
  {/if}
</div>

<style>
  .cover {
    position: relative;
    flex: none;
    overflow: hidden;
    border-radius: 22px;
    background: var(--bg);
    color: var(--ink);
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .blob {
    position: absolute;
    aspect-ratio: 1;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.28);
    transform: translate(-50%, -50%);
  }
  .icon {
    position: absolute;
    top: 9%;
    left: 10%;
    opacity: 0.55;
  }
  .title {
    position: absolute;
    left: 10%;
    right: 10%;
    bottom: 8%;
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
</style>
