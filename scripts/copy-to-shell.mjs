// Copies the built interface (dist/) to the ui/ folder of the RelixShell project.
//
// Usage (from the relix folder):
//   npm run build:shell                         to this repository's project (shell/RelixShell)
//   npm run build:shell -- "D:\other\RelixShell"  to another project
//
// The target folder is the one with the Package.appxmanifest file.

import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

// By default, this repository's Visual Studio project (shell/RelixShell)
const target = resolve(process.argv[2] ?? process.env.RELIX_SHELL ?? 'shell/RelixShell')

if (!existsSync(resolve(target, 'Package.appxmanifest'))) {
  console.error(`\nPackage.appxmanifest wasn't found in:\n  ${target}\n`)
  console.error('Pass the RelixShell project folder, the one with Package.appxmanifest:')
  console.error('  npm run build:shell -- "C:\\path\\to\\RelixShell"\n')
  process.exit(1)
}
if (!existsSync('dist/index.html')) {
  console.error('\ndist/index.html doesn\'t exist. Run this first: npm run build\n')
  process.exit(1)
}

const ui = resolve(target, 'ui')
rmSync(ui, { recursive: true, force: true })
cpSync('dist', ui, { recursive: true })
console.log(`\nInterface copied to:\n  ${ui}\n\nNow press F5 in Visual Studio.\n`)
