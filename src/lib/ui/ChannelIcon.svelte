<script>
  /**
   * Each channel's icon: simple shapes of the hardware (disc, handheld,
   * cube, tablet...), drawn by hand. We don't use the brands' logos.
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
    <!-- disc -->
    <circle cx="48" cy="48" r="34" />
    <circle cx="48" cy="48" r="9" fill={color} />
    <path d="M30 34a22 22 0 0 1 14-10" opacity="0.55" />
  {:else if id === 'psp'}
    <!-- horizontal handheld -->
    <rect x="8" y="30" width="80" height="38" rx="19" />
    <rect x="30" y="38" width="36" height="22" rx="4" fill={color} />
    <circle cx="20" cy="49" r="3" fill={color} />
    <circle cx="76" cy="49" r="3" fill={color} />
  {:else if id === 'ps2'}
    <!-- standing console, in layers -->
    <rect x="28" y="12" width="40" height="72" rx="8" />
    <path d="M28 40h40M28 56h40" />
    <circle cx="48" cy="26" r="3" fill={color} />
  {:else if id === 'gc'}
    <!-- cube -->
    <path d="M48 12 82 30v36L48 84 14 66V30Z" />
    <path d="M14 30 48 48l34-18M48 48v36" />
  {:else if id === 'wiiu'}
    <!-- tablet with buttons -->
    <rect x="6" y="22" width="84" height="52" rx="18" />
    <rect x="28" y="32" width="40" height="32" rx="5" fill={color} />
    <circle cx="17" cy="38" r="3" fill={color} />
    <circle cx="79" cy="56" r="3" fill={color} />
  {:else if id === 'snes'}
    <!-- dog-bone controller: d-pad and four buttons in a diamond -->
    <rect x="6" y="30" width="84" height="38" rx="19" />
    <path d="M26 40v18M17 49h18" stroke-width="7" stroke-linecap="butt" />
    <circle cx="70" cy="40" r="4" fill={color} stroke="none" />
    <circle cx="79" cy="49" r="4" fill={color} stroke="none" />
    <circle cx="70" cy="58" r="4" fill={color} stroke="none" />
    <circle cx="61" cy="49" r="4" fill={color} stroke="none" />
  {:else if id === 'n64'}
    <!-- three-pronged controller: a wide body, three handles and the stick in the middle -->
    <rect x="6" y="20" width="84" height="28" rx="14" />
    <path d="M20 50 24 70M48 50v26M76 50 72 70" stroke-width="12" />
    <circle cx="48" cy="34" r="5" fill={color} stroke="none" />
  {:else if id === 'gba'}
    <!-- wide handheld: screen in the middle, d-pad and two buttons -->
    <path d="M18 26h60a14 14 0 0 1 14 14v16a14 14 0 0 1-14 14H18A14 14 0 0 1 4 56V40a14 14 0 0 1 14-14Z" />
    <rect x="31" y="35" width="34" height="26" rx="4" />
    <path d="M17 42v12M11 48h12" stroke-width="5" stroke-linecap="butt" />
    <circle cx="77" cy="44" r="3.5" fill={color} stroke="none" />
    <circle cx="83" cy="52" r="3.5" fill={color} stroke="none" />
  {:else if id === 'n3ds'}
    <!-- clamshell handheld: two screens -->
    <rect x="18" y="8" width="60" height="38" rx="7" />
    <rect x="28" y="16" width="40" height="22" rx="3" fill={color} stroke="none" />
    <rect x="18" y="50" width="60" height="38" rx="7" />
    <rect x="34" y="57" width="28" height="20" rx="3" />
  {:else if id === 'megadrive'}
    <!-- low console with the round disc on top and the cartridge slot -->
    <rect x="6" y="30" width="84" height="40" rx="10" />
    <circle cx="32" cy="50" r="12" />
    <path d="M56 44h24M56 56h12" />
  {:else if id === 'dreamcast'}
    <!-- square console with the round lid and the four ports -->
    <rect x="12" y="12" width="72" height="72" rx="16" />
    <circle cx="48" cy="42" r="18" />
    {#each [27, 41, 55, 69] as x (x)}
      <circle cx={x} cy="72" r="3" fill={color} stroke="none" />
    {/each}
  {:else if id === 'xbox360'}
    <!-- standing console with curved sides and the round button -->
    <path d="M30 8h36q-8 40 0 80H30q8-40 0-80Z" />
    <circle cx="48" cy="26" r="7" />
  {:else if id === 'swap'}
    <!-- two arrows: switch emulator -->
    <path d="M18 34h54M58 20l14 14-14 14" />
    <path d="M78 62H24M38 48 24 62l14 14" />
  {:else if id === 'favorites'}
    <!-- heart -->
    <path
      d="M48 80S14 60 14 36a17 17 0 0 1 34-4 17 17 0 0 1 34 4c0 24-34 44-34 44Z"
      fill={color}
    />
  {:else if id === 'options'}
    <!-- gear -->
    {#each [0, 45, 90, 135, 180, 225, 270, 315] as angle (angle)}
      <path d="M48 26V15" transform="rotate({angle} 48 48)" stroke-width="15" stroke-linecap="butt" />
    {/each}
    <circle cx="48" cy="48" r="23" fill={color} stroke="none" />
    <circle cx="48" cy="48" r="9" stroke="none" style="fill: var(--cloud)" />
  {:else if id === 'eye'}
    <!-- eye: what shows on the home screen -->
    <path d="M10 48s14-22 38-22 38 22 38 22-14 22-38 22S10 48 10 48Z" />
    <circle cx="48" cy="48" r="9" fill={color} />
  {:else if id === 'sound'}
    <!-- speaker -->
    <path d="M16 38h14l18-14v48L30 58H16Z" fill={color} />
    <path d="M60 38a14 14 0 0 1 0 20M68 28a28 28 0 0 1 0 40" />
  {:else if id === 'refresh'}
    <!-- circular arrow -->
    <path d="M74 52a26 26 0 1 1-8-22" />
    <path d="M70 14v18H52" />
  {:else if id === 'cover'}
    <!-- box with a landscape: cover -->
    <rect x="20" y="10" width="56" height="76" rx="9" />
    <path d="M30 70 43 53l9 10 8-7 8 14" />
    <circle cx="58" cy="31" r="6" fill={color} />
  {:else if id === 'download'}
    <!-- arrow into the tray: download -->
    <path d="M48 14v42M31 40l17 17 17-17" />
    <path d="M18 62v10a9 9 0 0 0 9 9h42a9 9 0 0 0 9-9V62" />
  {:else if id === 'pick'}
    <!-- box with a check mark: pick by hand -->
    <rect x="20" y="10" width="56" height="76" rx="9" />
    <path d="M34 49l10 10 19-21" />
  {:else if id === 'rename'}
    <!-- pencil over a line: rename the file -->
    <path d="M60 14l20 20-40 40H20V54Z" />
    <path d="M50 24l20 20" />
    <path d="M50 82h30" opacity="0.55" />
  {:else if id === 'collections' || id.startsWith('collection:')}
    <!-- stacked boxes: collections -->
    <rect x="30" y="14" width="44" height="58" rx="8" opacity="0.55" />
    <rect x="20" y="24" width="44" height="58" rx="8" fill={color} />
  {:else if id === 'search'}
    <!-- magnifier -->
    <circle cx="42" cy="42" r="24" />
    <path d="M60 60l20 20" stroke-width="9" />
  {:else if id === 'time'}
    <!-- clock: time played -->
    <circle cx="48" cy="48" r="34" />
    <path d="M48 28v20l14 10" stroke-width="7" />
  {:else if id === 'play'}
    <!-- triangle: play -->
    <path d="M32 20v56l46-28Z" fill={color} />
  {:else if id === 'hide'}
    <!-- crossed-out eye: hide -->
    <path d="M10 48s14-22 38-22 38 22 38 22-14 22-38 22S10 48 10 48Z" />
    <circle cx="48" cy="48" r="9" fill={color} />
    <path d="M18 80 78 16" stroke-width="7" />
  {:else if id === 'sort'}
    <!-- up and down arrows: sort -->
    <path d="M32 78V18M16 34l16-16 16 16" />
    <path d="M64 18v60M48 62l16 16 16-16" />
  {:else if id === 'plus'}
    <path d="M48 18v60M18 48h60" stroke-width="9" />
  {:else if id === 'globe'}
    <!-- globe: region -->
    <circle cx="48" cy="48" r="34" />
    <path d="M14 48h68M48 14c-13 10-13 58 0 68M48 14c13 10 13 58 0 68" />
  {:else if id === 'check'}
    <!-- clipboard with a check mark: checkup -->
    <rect x="20" y="16" width="56" height="70" rx="10" />
    <rect x="34" y="9" width="28" height="15" rx="6" fill={color} />
    <path d="M34 54l10 10 19-21" stroke-width="7" />
  {:else if id === 'flag'}
    <!-- pennant: getting started -->
    <path d="M26 86V12" />
    <path d="M26 16h44l-9 15 9 15H26Z" fill={color} />
  {:else if id === 'usb'}
    <!-- USB stick -->
    <rect x="28" y="36" width="40" height="50" rx="10" fill={color} />
    <path d="M37 36V12h22v24" />
    <path d="M43 20v6M53 20v6" stroke-width="5" />
  {:else if id === 'filter'}
    <!-- funnel: filter -->
    <path d="M16 20h64L56 50v24l-16 8V50Z" fill={color} />
  {:else if id === 'log'}
    <!-- page with lines: log -->
    <rect x="22" y="12" width="52" height="72" rx="10" />
    <path d="M34 34h28M34 48h28M34 62h16" />
  {:else if id === 'language'}
    <!-- speech bubble with an A: language -->
    <path d="M24 14h48a12 12 0 0 1 12 12v32a12 12 0 0 1-12 12H44L28 82V70h-4a12 12 0 0 1-12-12V26a12 12 0 0 1 12-12Z" />
    <path d="M36 58l12-30 12 30M41 47h14" />
  {:else if id === 'theme'}
    <!-- half-filled circle: light or dark theme -->
    <circle cx="48" cy="48" r="32" />
    <path d="M48 16a32 32 0 0 1 0 64Z" fill={color} />
  {:else if id === 'moon'}
    <!-- moon: screensaver -->
    <path d="M62 14a34 34 0 1 0 20 46A28 28 0 0 1 62 14Z" fill={color} />
  {:else if id === 'video'}
    <!-- screen with a triangle: video -->
    <rect x="12" y="22" width="72" height="52" rx="10" />
    <path d="M42 36v24l20-12Z" fill={color} />
  {:else if id === 'gamepad'}
    <!-- controller -->
    <path d="M30 28h36c11 0 17 8 19 20l3 17c1 9-9 13-15 6l-8-9H31l-8 9c-6 7-16 3-15-6l3-17c2-12 8-20 19-20Z" />
    <path d="M31 40v14M24 47h14" />
    <circle cx="64" cy="43" r="3.5" fill={color} />
    <circle cx="71" cy="51" r="3.5" fill={color} />
  {/if}
</svg>
