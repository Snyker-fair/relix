# Changelog

Each version's section becomes the notes of its GitHub release.

## [1.1.0] - 2026-10-18

- **Rename files to their standard name:** *Y › Rename file…* on a game, or
  *≡ › Library › File names* to go through every file whose name isn't the
  standard one (the Redump / No-Intro names libretro uses), each with its cover
  so you can tell the right version. You can also type the name. Everything tied
  to the old name moves with it: its other discs, its ES-DE images and
  `gamelist.xml` entry, Relix's thumbnails, the RetroArch saves on the USB drive,
  your collections, playtime and favorites. Nothing is overwritten.
- **English file names on the USB drive:** your data is now in `relix\data.json`,
  with `data.previous.json` and daily backups in `relix\backups\`; the diagnostic
  log is `relix\log.txt` and the thumbnails are in `relix\cache\thumbnails\`. The
  first time 1.1.0 opens a drive used with 1.0.0, it renames `datos.json`,
  `respaldos\`, `registro.txt` and `cache\miniaturas\` by itself, without
  overwriting or deleting anything: your favorites, collections and playtime
  stay, and the thumbnails don't have to be made again.
- **For contributors:** the code comments, tests, guides (`docs/BUILDING.md`,
  `docs/TESTING.md`) and tools are in English, and commits follow Conventional
  Commits. Relix itself still speaks Spanish and English.

## [1.0.0] - 2026-10-18

The first public release of Relix: a launcher for emulators on Xbox Series X|S
in Developer Mode. *La primera versión pública de Relix.*

- **Library:** a channel per console (PS1, PS2, PSP, SNES, N64, GBA, GameCube,
  Wii U, 3DS, Mega Drive, Dreamcast, Xbox 360), Favorites, Collections in ES-DE's
  format, *Continue playing* and hidden games. Scans `E:\roms` once and opens
  instantly afterwards.
- **Covers** from libretro-thumbnails without accounts, with *Pick by hand* when
  a name is ambiguous; ES-DE's covers, fan art, logos and videos when present.
- **Emulators:** a recommended one per console, another per console or per game
  (*Open with…*), and detection of which ones are installed.
- **Find games:** search across consoles, jump by letter, sort (A–Z, recent,
  most played, year) and filter by genre or players.
- **Playtime** per game, and a clear message when a game closes right after
  launching (which BIOS or core to check).
- **Checkup and guides:** USB drive, space, emulators and BIOS files, each problem
  with a step-by-step guide; a welcome tour on first run.
- **Your data on the USB drive** (`relix\datos.json`) with the previous copy and
  daily backups; a diagnostic log in `relix\registro.txt`.
- **English and Spanish**, light and dark themes, a screensaver, and a notice
  when a new version is out.
