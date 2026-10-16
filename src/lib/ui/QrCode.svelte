<script>
  /**
   * Código QR para abrir una dirección en el celular (la TV no tiene navegador
   * a mano). Tinta oscura sobre blanco y un margen blanco: así lo leen bien
   * las cámaras aunque la TV brille.
   */
  import { encode } from 'uqr'

  /** @type {{ text: string, size?: number }} */
  let { text, size = 180 } = $props()

  const qr = $derived(encode(text, { ecc: 'M', border: 2 }))
  // Un solo trazo con todos los módulos oscuros: más liviano que cientos de <rect>
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
  aria-label="Código QR: {text}"
>
  <rect width={qr.size} height={qr.size} fill="#FFFFFF" />
  <path d={path} fill="#23304A" />
</svg>
