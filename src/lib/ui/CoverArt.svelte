<script module>
  /** The standard shape of covers in grids and lists (the PS2, GameCube and Wii U one) */
  export const TILE_ASPECT = 0.71
</script>

<script>
  /**
   * A game's cover. If there's an image it's used; otherwise a temporary cover
   * is drawn with the console's color, varying the tone and decorations by the
   * name (each game looks different).
   *
   * Two shapes:
   *   - standard (the default): all the same, so grids and lists look
   *     even; the image fills the frame and what's left over is cropped
   *   - real: the whole box with its console's shape (PS1 square, PSP
   *     tall), for the detail panel
   *
   *   width           the width; the height comes from the shape
   *   width + height  the maximum space: the whole cover fits in that space
   *   real            use the box's real shape
   *   thumb           use the thumbnail (grids and lists) instead of the original
   */
  import ChannelIcon from './ChannelIcon.svelte'

  /**
   * @type {{
   *   game: any, platform: any, width?: number, height?: number,
   *   showTitle?: boolean, thumb?: boolean, real?: boolean,
   * }}
   */
  let { game, platform, width = 184, height, showTitle = true, thumb = false, real = false } = $props()

  /** The image that didn't load; if the URL changes, it tries again */
  let failedSrc = $state('')
  /** The image already showing (while it loads, the color cover stays underneath) */
  let loadedSrc = $state('')
  const src = $derived((thumb ? (game.thumb ?? game.cover) : game.cover) ?? '')
  const showImage = $derived(src !== '' && src !== failedSrc)

  const aspect = $derived(real ? (platform.coverAspect ?? TILE_ASPECT) : TILE_ASPECT)
  const size = $derived.by(() => {
    if (height !== undefined && width / height > aspect) {
      return { w: Math.round(height * aspect), h: height }
    }
    return { w: width, h: Math.round(width / aspect) }
  })

  /** A simple, stable hash of the name */
  function hash(/** @type {string} */ str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  const seed = $derived(hash(game.name))
  // Mixes the console's color with white or ink depending on the hash
  const shade = $derived((seed % 5) * 9 - 18) // -18..+18
  const bg = $derived(
    shade >= 0
      ? `color-mix(in oklab, ${platform.color}, white ${shade}%)`
      : `color-mix(in oklab, ${platform.color}, ${platform.ink} ${-shade}%)`,
  )
  const blobX = $derived(20 + (seed % 60))
  const blobY = $derived(10 + ((seed >> 6) % 40))
  const blobSize = $derived(55 + ((seed >> 12) % 35))
  const titleSize = $derived(Math.max(14, Math.round(size.w / (game.name.length > 22 ? 9.5 : 7.5))))
</script>

<div
  class="cover"
  style:width="{size.w}px"
  style:height="{size.h}px"
  style:--bg={bg}
  style:--ink={platform.ink}
>
  {#if !showImage || loadedSrc !== src}
    <div
      class="blob"
      style:left="{blobX}%"
      style:top="{blobY}%"
      style:width="{blobSize}%"
    ></div>
    <div class="icon"><ChannelIcon id={platform.id} color={platform.ink} size={size.w * 0.22} /></div>
    {#if showTitle}
      <p class="title" style:font-size="{titleSize}px">{game.name}</p>
    {/if}
  {/if}
  {#if showImage}
    <img
      {src}
      alt={game.name}
      decoding="async"
      class:loaded={loadedSrc === src}
      onload={() => (loadedSrc = src)}
      onerror={() => (failedSrc = src)}
    />
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
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity 180ms ease;
  }
  img.loaded {
    opacity: 1;
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
