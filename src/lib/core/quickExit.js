/**
 * When you come back to Relix a few seconds after launching a game, it's
 * almost always because the emulator couldn't open it: the BIOS is missing,
 * something from the emulator is missing or the file is damaged. The emulator
 * doesn't tell Relix anything (it closes and the Xbox goes back by itself), so
 * Relix works it out from the time and tells you what to check.
 */
import { t } from '../i18n/i18n.svelte.js'
import { regionsOf } from './coverMatch.js'

/** Coming back before this counts as "closed on opening" */
export const QUICK_EXIT_SECONDS = 15

/** The PS1 BIOS files SwanStation looks for in RetroArch's system folder */
export const PS1_BIOS = {
  japan: { file: 'scph5500.bin', label: 'japonesa' },
  usa: { file: 'scph5501.bin', label: 'de EE. UU.' },
  europe: { file: 'scph5502.bin', label: 'europea' },
}

/** File name tags that tell the BIOS region (NTSC-J, NTSC-U or PAL) */
const BIOS_REGION_OF = /** @type {Record<string, 'japan'|'usa'|'europe'>} */ ({
  Japan: 'japan', Asia: 'japan', Korea: 'japan', China: 'japan', Taiwan: 'japan', 'Hong Kong': 'japan',
  USA: 'usa', Canada: 'usa', 'Latin America': 'usa', Mexico: 'usa', Brazil: 'usa', Argentina: 'usa',
  Europe: 'europe', Spain: 'europe', France: 'europe', Germany: 'europe', Italy: 'europe', UK: 'europe',
  Australia: 'europe', Netherlands: 'europe', Scandinavia: 'europe', Portugal: 'europe', Sweden: 'europe',
  Russia: 'europe',
})

/**
 * Which PS1 BIOS a game needs according to its name: "(Europe)" -> europe.
 * null if the name doesn't say ("(World)" or without tags).
 * @param {string} fileName
 */
export function ps1BiosRegion(fileName) {
  for (const region of regionsOf(fileName)) {
    if (BIOS_REGION_OF[region]) return BIOS_REGION_OF[region]
  }
  return null
}

/**
 * The notice when a game closed on opening.
 * @param {{ name: string, path: string }} game
 * @param {{ id: string, emulators: unknown[] }} platform
 * @param {import('./platforms.js').Emulator} emulator  the one it was opened with
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
  // With another option at hand, switching emulators is usually the quickest fix
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
