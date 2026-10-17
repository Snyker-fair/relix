/**
 * Estado de la revisión del sistema (Opciones › Revisión y el primer uso).
 * El shell mide; core/systemCheck.js arma los chequeos con lo que Relix ya
 * sabe (juegos, emuladores instalados, respaldo de tus datos).
 */
import { systemCheck } from '../core/bridge.js'
import { PLATFORMS } from '../core/platforms.js'
import { buildChecks, CHECK_FOLDERS, summarize } from '../core/systemCheck.js'
import { emulators } from './emulators.svelte.js'
import { library } from './library.svelte.js'
import { userData } from './userData.svelte.js'

class SystemStatus {
  /** Lo último que midió el shell (null: todavía no, o el shell es anterior) */
  /** @type {import('../core/systemCheck.js').ShellCheck | null} */
  shell = $state(null)
  running = $state(false)
  /** El shell no respondió la última vez (o es anterior al paso 6) */
  failed = $state(false)
  /** Cuándo terminó la última revisión (ms) */
  checkedAt = $state(0)

  /** Cada consola con sus juegos y su emulador */
  consoles = $derived(
    PLATFORMS.map((platform) => {
      const emulator = emulators.forPlatform(platform)
      return {
        platform,
        games: library.gamesFor(platform.id),
        emulator,
        installed: emulator ? emulators.isInstalled(emulator) : null,
      }
    }),
  )

  checks = $derived(
    buildChecks({
      shell: this.shell,
      romRoot: library.romRoot,
      consoles: this.consoles,
      knownFolders: PLATFORMS.flatMap((p) => p.folders),
      dataStatus: userData.status,
      shellFailed: this.failed,
    }),
  )

  summary = $derived(summarize(this.checks))

  /** Vuelve a medir todo (también qué emuladores hay instalados) */
  async run() {
    if (this.running) return
    this.running = true
    try {
      const [shell] = await Promise.all([systemCheck(CHECK_FOLDERS), emulators.check()])
      this.shell = shell
      this.failed = false
    } catch {
      // Sin respuesta del shell: quedan los chequeos que no lo necesitan, y uno que lo dice
      this.shell = null
      this.failed = true
    } finally {
      this.running = false
      this.checkedAt = Date.now()
    }
  }
}

export const systemStatus = new SystemStatus()
