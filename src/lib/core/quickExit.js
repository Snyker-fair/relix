/**
 * Cuando vuelves a Relix pocos segundos después de lanzar un juego, casi
 * siempre es porque el emulador no pudo abrirlo: falta la BIOS, falta algo
 * del emulador o el archivo está dañado. El emulador no le avisa nada a
 * Relix (se cierra y la Xbox vuelve sola), así que Relix lo deduce por el
 * tiempo y te dice qué revisar.
 */
import { regionsOf } from './coverMatch.js'

/** Volver antes de esto cuenta como "se cerró al abrir" */
export const QUICK_EXIT_SECONDS = 15

/** BIOS de PS1 que busca SwanStation en la carpeta system de RetroArch */
const PS1_BIOS = {
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
 * @param {{ id: string, emulatorName: string }} platform
 */
export function quickExitMessage(game, platform) {
  const intro = `${game.name} se cerró enseguida.`
  if (platform.id === 'psx') {
    const region = ps1BiosRegion(game.path.split('/').pop() ?? '')
    const bios = region
      ? `${PS1_BIOS[region].file} (BIOS de PS1 ${PS1_BIOS[region].label})`
      : 'la BIOS de PS1 (scph5500, scph5501 o scph5502.bin)'
    return `${intro} Revisa que ${bios} esté en la carpeta system de RetroArch, o que el archivo no esté dañado.`
  }
  if (platform.id === 'ps2') {
    return `${intro} Revisa que XBSX2 tenga una BIOS de PS2 configurada, o que el archivo no esté dañado.`
  }
  return `${intro} Revisa que ${platform.emulatorName} esté instalado y al día, o que el archivo no esté dañado.`
}
