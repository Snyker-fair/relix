<script>
  /**
   * Ícono de cada canal: formas simples del hardware (disco, portátil,
   * cubo, tablet...), dibujadas a mano. No usamos logos de las marcas.
   */
  let { id, color = 'currentColor', size = 96 } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 96 96"
  fill="none"
  stroke={color}
  stroke-width="6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if id === 'psx'}
    <!-- disco -->
    <circle cx="48" cy="48" r="34" />
    <circle cx="48" cy="48" r="9" fill={color} />
    <path d="M30 34a22 22 0 0 1 14-10" opacity="0.55" />
  {:else if id === 'psp'}
    <!-- portátil horizontal -->
    <rect x="8" y="30" width="80" height="38" rx="19" />
    <rect x="30" y="38" width="36" height="22" rx="4" fill={color} />
    <circle cx="20" cy="49" r="3" fill={color} />
    <circle cx="76" cy="49" r="3" fill={color} />
  {:else if id === 'ps2'}
    <!-- consola de pie, en capas -->
    <rect x="28" y="12" width="40" height="72" rx="8" />
    <path d="M28 40h40M28 56h40" />
    <circle cx="48" cy="26" r="3" fill={color} />
  {:else if id === 'gc'}
    <!-- cubo -->
    <path d="M48 12 82 30v36L48 84 14 66V30Z" />
    <path d="M14 30 48 48l34-18M48 48v36" />
  {:else if id === 'wiiu'}
    <!-- tablet con botones -->
    <rect x="6" y="22" width="84" height="52" rx="18" />
    <rect x="28" y="32" width="40" height="32" rx="5" fill={color} />
    <circle cx="17" cy="38" r="3" fill={color} />
    <circle cx="79" cy="56" r="3" fill={color} />
  {:else if id === 'favorites'}
    <!-- corazón -->
    <path
      d="M48 80S14 60 14 36a17 17 0 0 1 34-4 17 17 0 0 1 34 4c0 24-34 44-34 44Z"
      fill={color}
    />
  {/if}
</svg>
