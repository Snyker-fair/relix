# Contributing to Relix

Thanks for wanting to help. Relix is small and made with care for one kind of
person: someone with an Xbox in Developer Mode, a USB drive and a controller in
their hand. These notes say what guides it, so a change fits on the first try.

¿Prefieres español? Los problemas e ideas se pueden escribir en español: hay
plantillas en los dos idiomas.

## Report a problem or share an idea

- **From the Xbox:** *Options › Checkup › Report a problem* shows a QR code.
  Scan it with your phone and GitHub's form opens already filled in with your
  version, what Checkup found and the last lines of the log. You see it all
  before sending it.
- **From the PC:** [open an issue](https://github.com/Snyker-fair/relix/issues/new/choose)
  with the *Something isn't working* or *Idea* template (or their Spanish
  versions). The log is in `E:\relix\log.txt`; check it before pasting it, since
  it has your game names and USB drive paths.

## What guides Relix

1. **Outside Relix, the only tasks are installing the emulators and copying the
   games to their folder on the USB drive.** Nobody should have to move, rename
   or edit files to get something from Relix. If a feature needs a file somewhere,
   Relix writes it (like the disc lists in `E:\relix\discs`). Renaming games is
   the one exception, and it happens inside Relix.
2. **Never link to BIOS or game downloads.** The guides say which file goes
   where, never where to get it.
3. **The controller is enough.** Every screen works with the controller alone,
   says what each button does in its bottom bar, and B always goes back.
4. **Your data lives on the USB drive.** Playtime, favorites, collections and
   settings go to `E:\relix\data.json`, written safely with backups, because a
   Developer Mode app gets reinstalled often.
5. **Light on the Xbox.** As an App, Relix gets about 1 GB while you browse and
   128 MB while a game runs. Draw only what's on screen, and measure memory when a
   change adds images or lists (*Options › Checkup › Diagnostic log*).
6. **Compatible with ES-DE.** Relix reads ES-DE's gamelists and media and writes
   where ES-DE expects them, so one USB drive works on the PC and on the Xbox.
7. **Say what's wrong and how to fix it**, in words a player understands, not
   just that something failed.

## Working on the code

How to build it, try it on the Xbox and release a version is in
[`docs/BUILDING.md`](docs/BUILDING.md); what to check on the TV, in
[`docs/TESTING.md`](docs/TESTING.md).

- **Branches.** `main` holds the next version; while a version is tested on the
  Xbox, the one after it is built on `next`. Send pull requests to `main`.
- **Before a pull request**, all of these pass (GitHub runs them too):
  ```
  npm run check           # types
  npm test                # logic and translations
  node scripts/i18n.mjs   # no text without English, nothing left over in en.js
  npm run e2e             # the interface in Chromium (once: npx playwright install chromium)
  ```
- **Texts** are written in Spanish inside `t()` and translated in
  `src/lib/i18n/en.js` (see *Translations* in the README).
- **Logic goes in `src/lib/core/`, with tests**; screens only show it.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/),
  in English (types and scopes in [`docs/BUILDING.md`](docs/BUILDING.md#commits)).
- **What a person would notice** goes in [`CHANGELOG.md`](CHANGELOG.md), in the
  section of the version in progress (`## [1.5.0] - unreleased`).

By contributing, you agree that your work is shared under the project's license,
[GPL-3.0-or-later](LICENSE).
