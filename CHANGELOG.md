# Changelog

Each version's section becomes the notes of its GitHub release.

## [Unreleased]

- **"New" games:** the games a scan brings to a console get a *New* tag on their
  cover until you play them or for 14 days, and the home screen counts them
  ("10 games · 2 new"). The first scan of a console doesn't mark anything.
- **Games on several discs, ready to change discs:** copy Final Fantasy VII as
  three `.chd` files and that's it. Relix shows it once, says "3 discs", and when
  you open it makes the list of its discs (an `.m3u`) in `E:\relix\discs`,
  without touching your games folder, named like disc 1 so your saves stay the
  same. The launch screen says where to change discs (in RetroArch, its menu ›
  *Disc Control*). For PS1 and Dreamcast; a game that already has its `.m3u`
  opens with it, as before.
- **Scanning is the only step:** after scanning a console (*≡ › Library*), Relix
  also finds the covers and screenshots its games are missing and the
  descriptions Wikipedia is sure about, without asking. The row says what it's
  doing, and a notice says what came and what's left to pick by hand. Without
  internet, your games are in and the rest waits for the next scan.
- **Your consoles in your order:** in *≡ › Consoles*, **X** on a console lets you
  move it with ↑ ↓ (**A** saves, **B** leaves it as it was). The home screen, the
  library's tabs and Options follow that order; Favorites and Collections stay
  first. It's saved on the USB drive with the rest of your settings.
- **Remove from Continue playing:** on the home screen, **Y** on a game of the
  row has *Remove from Continue playing*. Its time and the *Recent* order stay,
  and if you play it again it comes back.
- **Big consoles stay light:** the grid only draws the rows you see and a couple
  more, so a console with 1,000 games opens using the same memory as one with 20
  (in the browser, 380 MB less with 1,000). And when the Xbox says Relix is near
  its memory limit, the web view lets go of the images it keeps; the diagnostic
  log says how much it was using before and after.
- **No more number of players:** many games' data gets it wrong (fighting games
  often say 1 player), so Relix no longer shows it in the library panel or the
  sheet, *Y › Filter* drops *2 or more players* (genres stay) and *Find info…*
  no longer writes it to `gamelist.xml`. What ES-DE already saved there stays.

## [1.3.0] - 2026-10-22

- **Game sheet:** click the right stick on a game (or *Y › Game sheet*) for its
  full page: the cover, the whole description (scroll it with ↑ ↓), every detail
  ES-DE or Wikipedia left (developer, publisher, players, rating, file, emulator)
  and the time you've played it, with its last 8 weeks. No video plays there, to
  keep Relix light. The library's button bar shows the stick, and after updating
  Relix says it once (along with the left stick for *Surprise me*).
- **Surprise me:** can't choose what to play? The die at the end of the home
  screen's channels picks a game for you, almost always one you never opened or
  barely played, and shows its sheet. **A** plays it, the left stick picks
  another one (no repeats until it has shown them all) and **B** goes back.
  Inside a console or collection, clicking the left stick picks among its games.
- **Playtime by week:** Relix now keeps the minutes played per day (in
  `data.json`, the last 26 weeks). *≡ › About* shows your last 8 weeks and your
  top 5. The weeks count from this version on.
- **The home screen takes each console's color** at the top left as you move
  through the channels.
- **A count on the Checkup tab** in Options, the same as on the home screen's
  Options tile: what's left to fix.
- **Videos are always muted:** the *Video sound* option is gone. Relix has about
  1 GB of memory as an App, so it now logs how much it uses (when it opens, before
  each game and on each new peak, saying whether a video was playing) to decide
  with data whether the videos stay.
- **A lighter button bar in each console:** it no longer shows LT / RT. They
  still jump from letter to letter, and after updating Relix mentions it once.
- **Fix:** in the library panel, a long description (like Wikipedia's) with time
  played could push "Opens with…" out of the card. The description now takes the
  lines that fit.
- **Fix:** with a background image, a long name (*Castlevania: Symphony of the
  Night*) climbed over the image and was hard to read. It now always starts below
  it.
- **Fix:** opening the game menu (**Y**) from *Continue playing* on the home
  screen moved the whole screen to the left, and it stayed that way after closing
  the menu. The menu now sits against the right edge and the screen stays put.

## [1.2.0] - 2026-10-21

- **Back where you were:** the Xbox closes Relix while you play (it does that to
  apps of the Game type), so coming back used to mean starting from the home
  screen. Now Relix remembers the library and the game you opened, and when it
  opens again after a game it takes you there, with that game focused and the
  time you played. Opened from the home screen, it goes back to the same channel.
- **Relix as App:** the README used to say to set Relix as Game in Dev Home, but
  the Xbox closes a Game while another one plays. As an App it only pauses it, so
  quitting a game takes you straight back. Relix can't change its own type, so
  *≡ › Checkup* now says which one it has and, if it's Game, Relix says so once
  when it opens, with the steps to switch it (Dev Home › View details). The
  emulators stay as Game.

## [1.1.0] - 2026-10-18

- **Game info from Wikipedia:** *Y › Find info…* on a game, or *≡ › Library ›
  Game info* for every game ES-DE didn't scrape. Relix finds each game among its
  console's games on Wikidata and adds its description (from Wikipedia, in Spanish
  or English, with its CC BY-SA credit), year, genre, developer, publisher and
  players to ES-DE's `gamelist.xml`. The sure matches are saved by themselves and
  you pick the rest. Nothing already there is replaced, the original gamelist is
  kept as `gamelist.xml.relix-backup`, and no account or key is needed.
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
