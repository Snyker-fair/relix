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
  {:else if id === 'options'}
    <!-- engranaje -->
    {#each [0, 45, 90, 135, 180, 225, 270, 315] as angle (angle)}
      <path d="M48 26V15" transform="rotate({angle} 48 48)" stroke-width="15" stroke-linecap="butt" />
    {/each}
    <circle cx="48" cy="48" r="23" fill={color} stroke="none" />
    <circle cx="48" cy="48" r="9" fill="#FFFFFF" stroke="none" />
  {:else if id === 'eye'}
    <!-- ojo: qué se ve en el inicio -->
    <path d="M10 48s14-22 38-22 38 22 38 22-14 22-38 22S10 48 10 48Z" />
    <circle cx="48" cy="48" r="9" fill={color} />
  {:else if id === 'sound'}
    <!-- parlante -->
    <path d="M16 38h14l18-14v48L30 58H16Z" fill={color} />
    <path d="M60 38a14 14 0 0 1 0 20M68 28a28 28 0 0 1 0 40" />
  {:else if id === 'refresh'}
    <!-- flecha circular -->
    <path d="M74 52a26 26 0 1 1-8-22" />
    <path d="M70 14v18H52" />
  {:else if id === 'cover'}
    <!-- caja con un paisaje: portada -->
    <rect x="20" y="10" width="56" height="76" rx="9" />
    <path d="M30 70 43 53l9 10 8-7 8 14" />
    <circle cx="58" cy="31" r="6" fill={color} />
  {:else if id === 'download'}
    <!-- flecha hacia la bandeja: bajar -->
    <path d="M48 14v42M31 40l17 17 17-17" />
    <path d="M18 62v10a9 9 0 0 0 9 9h42a9 9 0 0 0 9-9V62" />
  {:else if id === 'pick'}
    <!-- caja con visto bueno: elegir a mano -->
    <rect x="20" y="10" width="56" height="76" rx="9" />
    <path d="M34 49l10 10 19-21" />
  {:else if id === 'collections' || id.startsWith('collection:')}
    <!-- cajas apiladas: colecciones -->
    <rect x="30" y="14" width="44" height="58" rx="8" opacity="0.55" />
    <rect x="20" y="24" width="44" height="58" rx="8" fill={color} />
  {:else if id === 'search'}
    <!-- lupa -->
    <circle cx="42" cy="42" r="24" />
    <path d="M60 60l20 20" stroke-width="9" />
  {:else if id === 'play'}
    <!-- triángulo: jugar -->
    <path d="M32 20v56l46-28Z" fill={color} />
  {:else if id === 'hide'}
    <!-- ojo tachado: ocultar -->
    <path d="M10 48s14-22 38-22 38 22 38 22-14 22-38 22S10 48 10 48Z" />
    <circle cx="48" cy="48" r="9" fill={color} />
    <path d="M18 80 78 16" stroke-width="7" />
  {:else if id === 'sort'}
    <!-- flechas arriba y abajo: ordenar -->
    <path d="M32 78V18M16 34l16-16 16 16" />
    <path d="M64 18v60M48 62l16 16 16-16" />
  {:else if id === 'plus'}
    <path d="M48 18v60M18 48h60" stroke-width="9" />
  {:else if id === 'globe'}
    <!-- globo: región -->
    <circle cx="48" cy="48" r="34" />
    <path d="M14 48h68M48 14c-13 10-13 58 0 68M48 14c13 10 13 58 0 68" />
  {/if}
</svg>
