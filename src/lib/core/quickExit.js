/**
 * Cuando vuelves a Relix pocos segundos después de lanzar un juego, casi
 * siempre es porque el emulador no pudo abrirlo: falta la BIOS, falta algo
 * del emulador o el archivo está dañado. El emulador no le avisa nada a
 * Relix (se cierra y la Xbox vuelve sola), así que Relix lo deduce por el
 * tiempo y te dice qué revisar.
 */
import { t } from '../i18n/i18n.svelte.js'
import { regionsOf } from './coverMatch.js'

/** Volver antes de esto cuenta como "se cerró al abrir" */
export const QUICK_EXIT_SECONDS = 15

/** BIOS de PS1 que busca SwanStation en la carpeta system de RetroArch */
export const PS1_BIOS = {
  japan: { file: 'scph5500.bin', label: 'japonesa' },
  usa: { file: 'scph5501.bin', label: 'de EE. UU.' },
  europe: { file: 'scph5502.bin', label: 'europea' },
}

/** Etiquetas del nombre del archivo que dicen la región de la BIOS (NTSC-J, NTSC-U o PAL) */
const BIOS_REGION_OF = /** @type {Record<string, 'japan'|'usa'|'europe'>} */ ({
  Japan: 'japan', Asia: 'japan', Korea: 'japan', China: 'japan', Taiwan: 'japan', 'Hong Kong': 'japan',
  USA: 'usa', Canada: 'usa', 'Latin America': 'usa', Mexico: 'usa', Brazil: 'usa', Argentina: 'usa',
  Europe: 'europe', Spain: 'europe', France: 'europe', Germany: 'europe', Italy: 'europe', UK: 'europe',
  Australia: 'europe', Netherlands: 'europe', Scandinavia: 'europe', Portugal: 'europe', Sweden: 'europe',
  Russia: 'europe',
})

/**
 * Qué BIOS de PS1 necesita un juego según su nombre: "(Europe)" -> europe.
 * null si el nombre no lo dice ("(World)" o sin etiquetas).
 * @param {string} fileName
 */
export function ps1BiosRegion(fileName) {
  for (const region of regionsOf(fileName)) {
    if (BIOS_REGION_OF[region]) return BIOS_REGION_OF[region]
  }
  return null
}

/**
 * El aviso cuando un juego se cerró al abrir.
 * @param {{ name: string, path: string }} game
 * @param {{ id: string, emulators: unknown[] }} platform
 * @param {import('./platforms.js').Emulator} emulator  con el que se intentó abrir
 */
export function quickExitMessage(game, platform, emulator) {
  const { launcher } = emulator
  if (platform.id === 'psx') {
    const region = ps1BiosRegion(game.path.split('/').pop() ?? '')
    const bios = region
      ? t('{file} (BIOS de PS1 {label})', { file: PS1_BIOS[region].file, label: t(PS1_BIOS[region].label) })
      : t('la BIOS de PS1 (scph5500, scph5501 o scph5502.bin)')
    const where =
      launcher.kind === 'retroarch'
        ? t('la carpeta system de RetroArch')
        : t('la carpeta bios de {emulator}', { emulator: emulator.name })
    return t('{game} se cerró enseguida. Revisa que {bios} esté en {where}, o que el archivo no esté dañado.', {
      game: game.name,
      bios,
      where,
    })
  }
  if (platform.id === 'ps2') {
    return t(
      '{game} se cerró enseguida. Revisa que {emulator} tenga una BIOS de PS2 configurada, o que el archivo no esté dañado.',
      { game: game.name, emulator: emulator.name },
    )
  }
  // Con otra opción a mano, cambiar de emulador suele ser la solución más rápida
  const tryOther = platform.emulators.length > 1 ? ` ${t('También puedes probar otro con Y › Abrir con…')}` : ''
  if (launcher.kind === 'retroarch') {
    return (
      t('{game} se cerró enseguida. Revisa que tu RetroArch traiga el núcleo {core}, o que el archivo no esté dañado.', {
        game: game.name,
        core: launcher.core,
      }) + tryOther
    )
  }
  return (
    t('{game} se cerró enseguida. Revisa que {emulator} esté instalado y al día, o que el archivo no esté dañado.', {
      game: game.name,
      emulator: emulator.name,
    }) + tryOther
  )
}
