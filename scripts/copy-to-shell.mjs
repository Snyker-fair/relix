// Copia la interfaz compilada (dist/) a la carpeta ui/ del proyecto RelixShell.
//
// Uso (desde la carpeta relix):
//   npm run build:shell                                   busca ../RelixShell/RelixShell
//   npm run build:shell -- "C:\Proyectos\RelixShell\RelixShell"
//
// La carpeta de destino es la que tiene el archivo Package.appxmanifest.

import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const target = resolve(process.argv[2] ?? process.env.RELIX_SHELL ?? '../RelixShell/RelixShell')

if (!existsSync(resolve(target, 'Package.appxmanifest'))) {
  console.error(`\nNo encontré Package.appxmanifest en:\n  ${target}\n`)
  console.error('Pasa la carpeta del proyecto RelixShell, la que tiene Package.appxmanifest:')
  console.error('  npm run build:shell -- "C:\\ruta\\a\\RelixShell\\RelixShell"\n')
  process.exit(1)
}
if (!existsSync('dist/index.html')) {
  console.error('\nNo existe dist/index.html. Corre primero: npm run build\n')
  process.exit(1)
}

const ui = resolve(target, 'ui')
rmSync(ui, { recursive: true, force: true })
cpSync('dist', ui, { recursive: true })
console.log(`\nInterfaz copiada a:\n  ${ui}\n\nAhora presiona F5 en Visual Studio.\n`)
