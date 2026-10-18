<script>
  /**
   * A QR code to open an address on the phone (the TV has no browser
   * at hand). Dark ink on white and a white margin: that way cameras
   * read it well even with a bright TV.
   */
  import { encode } from 'uqr'
  import { t } from '../i18n/i18n.svelte.js'

  /** @type {{ text: string, size?: number }} */
  let { text, size = 180 } = $props()

  const qr = $derived(encode(text, { ecc: 'M', border: 2 }))
  // A single path with every dark module: lighter than hundreds of <rect>
  const path = $derived(
    qr.data.map((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : '')).join('')).join(''),
  )
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {qr.size} {qr.size}"
  shape-rendering="crispEdges"
  role="img"
  aria-label={t('Código QR: {text}', { text })}
>
  <rect width={qr.size} height={qr.size} fill="#FFFFFF" />
  <path d={path} fill="#23304A" />
</svg>
