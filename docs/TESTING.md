# What to test on the TV

Checklists to go through Relix on the Xbox after building it
([`BUILDING.md`](BUILDING.md)). Start with the quick test; the others follow the
roadmap step in which each feature arrived.

The labels are the ones Relix shows in English (**≡ → Preferences → Language**).

## Quick test (first, about 15 minutes)

If this works, the rest almost surely does too. If something fails here, it's
worth fixing before going on.

Since 0.7.0, the **welcome tour** shows up once when Relix opens: go through it
(five screens) or skip it with **≡**; then continue with the list.

1. [ ] Relix opens and shows your games. The first time, it scans the new consoles
       (you'll see the progress on the loading screen).
2. [ ] **≡ → RB to About → On your USB drive** says "Saved …", and on the PC
       `E:\relix\data.json` exists.
3. [ ] **≡ → Consoles**: the emulators you have say **Installed**.
4. [ ] Open a PS1 game and a PS2 or PSP one, play for **more than 1 minute** and
       quit from the emulator's menu: you're back in Relix with the "N min played"
       notice.
5. [ ] Open another game and come back with the **Xbox button** → Relix: it adds up
       too.
6. [ ] A European PS1 game with `scph5502.bin` where the PS1 guide says
       (**≡ → Consoles → PlayStation → Y**): does it open? If not, does "closed right
       away" show up?
7. [ ] **≡ → RB to Covers → A** on a console: it downloads covers and they show in
       the grid.
8. [ ] **≡ → RB to Checkup**: take a photo of the list (go down with ↓ to the end).
       It shows at once which emulators, BIOS files and permissions your Xbox
       detects.

**To report a problem:** open an *issue* with a photo of the screen, what you did
right before and the version (**≡ → About**). If Visual Studio stops with an error,
copy the message from the **Output** window.

## Step 2 · Covers
- [ ] **≡ → RB to Covers**: each console says "N of M with a cover".
- [ ] **A** on a console: "Searching…", "Downloading X of Y" and the summary.
- [ ] The grid shows the covers (the first time they take a moment: the thumbnails
      are being made).
- [ ] **Pick by hand**: A saves a candidate, X keeps the color one.
- [ ] On the PC: covers in `E:\ES-DE\downloaded_media\<console>\covers\` and the
      cache in `E:\relix\cache\`.

## Step 3 · Finding games
- [ ] In a console, **RT / LT** jump by letter and the big letter shows up.
- [ ] **Y** opens the game menu: favorite, collections, change cover, hide, sort.
- [ ] **Y → Collections → New collection…**: type a name with the keyboard and
      **≡** to finish.
- [ ] **Collections** shows up on the home screen; inside, LB/RB switches
      collection.
- [ ] On the PC: `E:\ES-DE\collections\custom-<Name>.cfg`.
- [ ] **View ⧉** opens search from home or the library; → moves to the results.
- [ ] **Y → Sort library**: A–Z → Recent (→ Year, if your games have a year from
      ES-DE).
- [ ] **Y → Hide game**, then **≡ → Library → Hidden games** to bring it back.

## App image
- [ ] On Relix's card on the Xbox (the **Resume** one), the tile shows the gem and
      the name.

## Visual tweaks (between steps 3 and 4)
- [ ] On the home screen, the focused channel no longer touches its neighbors as
      you move.
- [ ] In search, the field (white, with a magnifier) stays apart from the keyboard.
- [ ] In the grids, the pink ring of the focused game doesn't touch the row above
      or the covers beside it.

## About
- [ ] **≡ → RB to About** shows the version (1.1.0), the build date and
      "Xbox · Developer Mode".
- [ ] **On your USB drive** shows your real drive letter.
- [ ] At the foot of the left panel it says **© 2026 snyker-fair**.

## Step 4 · Your data and playtime
- [ ] When the new version opens, your favorites and hidden games are still there,
      and on the PC `E:\relix\data.json` has them.
- [ ] Play for **more than 1 minute** and quit from the emulator's menu: at the top,
      "<Game>: N min played" shows up.
- [ ] Play again and come back with the **Xbox button** → Relix: it adds up too.
- [ ] The game panel shows the clock: time · sessions · how long ago. In
      **Continue playing** it says "Played …".
- [ ] **Y → Sort library**: **Most played** shows up (only on consoles where you've
      played).
- [ ] **About**: the **Playtime** card with the total and your top 3; **On your USB
      drive** says "Saved …".
- [ ] A game that doesn't open (for example, a European PS1 game without
      `scph5502.bin`): when you come back, Relix says it "closed right away" and
      which BIOS to check.
- [ ] The next day, on the PC: `E:\relix\backups\data-YYYY-MM-DD.json`.
- [ ] Hard test (optional): uninstall Relix from Dev Home, deploy again with **F5**
      and open it: favorites and playtime are still there (they come from the USB
      drive).

## Step 5 · More consoles and choosing an emulator
- [ ] Create on the USB drive the folders of the consoles you want (`E:\roms\snes`,
      `n64`, `gba`, `n3ds`, `megadrive`, `dreamcast`, `xbox360`) with a few games.
      Relix scans them by itself only the first time it opens; after that,
      **≡ → Library** to scan again.
- [ ] On the home screen, the channels slide as you move; in the library, so do the
      tabs (LB/RB).
- [ ] **≡ → RB → Consoles**: each console shows its emulator and **Installed** /
      **Not installed**. A moves to the next emulator.
- [ ] **≡ → About**: the **Emulators on the console** card ticks ✓ the ones you
      have.
- [ ] On a game, **Y → Open with…** → pick another emulator: the panel says "this
      game only".
- [ ] Xbox 360 games in a folder (`Halo 3 (USA)\default.xex`) show up with the
      folder's name.

## Console guides
- [ ] **≡ → Consoles → Y** opens the guide of the focused console; LB/RB move to
      another one and B goes back to the same row.
- [ ] At the top left it says whether the emulator is installed and how many games
      it found.
- [ ] The QR code opens with the phone's camera (it leads to DevStore › Emulators).
- [ ] On a console without games (with **Consoles without games: Shown** in
      Preferences), **Y** opens its guide.

## Step 6 · Checkup and first use
- [ ] The first time 0.7.0 opens, **Getting started** shows up: Hi, Your USB drive,
      Emulators, Covers and Buttons. **A** moves on, **B** goes back, **≡** skips.
- [ ] **Your USB drive** says whether Relix can save, how much space is left and
      which folders in `E:\roms` it doesn't use (for example `nes`).
- [ ] **Emulators**: your consoles with games, each with **Installed** / **Not
      installed** and the BIOS. **↑** picks one, **A** opens its guide and **B**
      goes back to the same step.
- [ ] **Covers → Search now**: you can move on to **Buttons** while it keeps
      searching.
- [ ] When it ends (or you skip it), close and open Relix: the tour does **not**
      come back.
- [ ] If something needs fixing, "Relix found N things to fix" shows up when it
      opens, and the **Options** icon on the home screen has a pink number.
- [ ] **≡ → RB to Checkup**: first what's missing (pink ✗), then the warnings
      (yellow !), the information (i) and what's fine (green ✓).
- [ ] With a European PS1 game: if `scph5502.bin` is in `E:\RetroArch\system`, it
      says **PS1 BIOS in place**; if not, **missing scph5502.bin**, and **A** opens
      the PS1 guide. Coming back with **B**, the focus stays on the same row.
- [ ] If you use DuckStation and put the BIOS inside the emulator, it says "I can't
      see it on the USB drive" as information, not as an error.
- [ ] (0.7.1) The PS2 BIOS in `E:\XBSX2\BIOS` with any extension (not only `.bin`):
      it says **PS2 BIOS in place** with your file's name. If it's a `.zip`, it
      warns that it has to be extracted.
- [ ] **Check again** measures again (it takes a few seconds without internet).
- [ ] **Welcome tour** shows it again; at the end you're back in Checkup.

## Step 7 · Live game panel, screensaver and filters
- [ ] Prepare backgrounds, logos and videos with ES-DE on the PC (README ›
      **Backgrounds, logos and videos with ES-DE**). It can be tested without that
      too: **≡ → Covers → A** now also downloads a screenshot for games without a
      background ("N background screenshots").
- [ ] In a console, the game panel shows the fan art (or the screenshot) at the top
      with the logo over it; the cover is small, next to the name. Behind it, the
      game's color, blurred.
- [ ] Stay about 2 seconds on a game with a video: it starts muted, loops and the
      logo fades. Moving to another game stops it. **The most important thing to
      check on the Xbox: that the video loops without cutting.**
- [ ] Videos always play muted (since 1.3.0 there's no *Video sound* option).
- [ ] **≡ → Preferences → Screensaver**: set it to 3 minutes and let go of the
      controller. Your games show up one after another; **A** plays the one on
      screen and any other button goes back to where you were.
- [ ] **Y → Filter** (if your gamelists have genre or players): pick a genre; the
      grid shows only those and the filter shows up at the top. **Y → Filter → All
      games** removes it.
- [ ] If a video doesn't show, write down its name and extension (`.mp4`, `.webm`…)
      when reporting it: it may be a format the Xbox doesn't play.

## Dark theme (0.8.1)
- [ ] **≡ → Preferences → Theme** (the first row): **A** goes from Light to Dark and
      to Automatic. The change shows right away, on every screen.
- [ ] With **Dark**, go through home, a console, the **Y** menu, search, Options and
      a guide: no text becomes invisible and no white panel "dazzles". If you see
      one, a photo is enough.
- [ ] Close Relix with the theme on **Dark** and open it again: it starts in night
      blue, without the light blue flash (from the second time, once the shell
      remembers it).
- [ ] **Automatic** says "Dark from 8 PM to 7 AM · now …" and switches by itself at
      that time.

## Language (0.9.0)
- [ ] **≡ → Preferences → Language · Idioma** (the first row): with the Xbox in
      Spanish it says "Automatic … now Español". **A** goes to Español, English and
      back to Automatic; the change shows right away, the time and date too.
- [ ] With **Español**, go through home, a console, the **Y** menu, search, Options,
      a guide and Checkup: no English text is left (except the paths and the file
      names on the USB drive, which are the same in both languages).
- [ ] With **Español**, open a game whose emulator you don't have: the notice is in
      Spanish (it comes from the shell).
- [ ] **≡ → Checkup → Welcome tour**: on the greeting, **Y** switches language.
- [ ] Close and open Relix: it stays in the language you chose.

## Diagnostic log (0.8.2)
- [ ] Open a game, play a while and come back. Open another one and come back right
      away (or one you know doesn't open).
- [ ] **≡ → Checkup → Diagnostic log → A**: the newest at the top. It should say
      **RETURNED** or **NO START** for each case, and each **LAUNCH** has the full
      URI. **↑ ↓** scroll; **LT / RT**, a page at a time; **B** goes back.
- [ ] On the PC, `E:\relix\log.txt` exists with the same lines.
- [ ] With an emulator that isn't installed, the attempt shows as **ERROR** with
      `[emulator-missing]`.

## Released version and the new-version notice (1.0.0)
- [ ] Install the `.msix` from the release as the README says (**Install**). Open
      it: your favorites, collections and playtime are still there (they come from
      the USB drive).
- [ ] Dev Home shows a single Relix, of the **App** type (since 1.2.0; before, the
      README said Game).
- [ ] **≡ → Checkup** with internet: there's no new-version row (you're on the
      latest).
- [ ] When the next version comes out: when Relix opens, "Relix X.Y.Z is out:
      ≡ › Checkup" shows up once, Checkup shows it at the top with **↑**, and in
      **About** the chip says "New version available: X.Y.Z". Without waiting a day:
      **Checkup › Check again**.

## File names on the USB drive in English (1.1.0)
Before installing 1.1.0, on the PC, write down what `E:\relix\` has: with 1.0.0 it's
`datos.json`, `datos.anterior.json`, `respaldos\`, `registro.txt` and
`cache\miniaturas\`.

- [ ] Install 1.1.0 over 1.0.0 and open it: your favorites, collections, hidden
      games and playtime are all still there.
- [ ] On the PC, `E:\relix\` now has `data.json`, `data.previous.json`, `backups\`
      (with `data-YYYY-MM-DD.json` files), `log.txt` and `cache\thumbnails\`. The
      Spanish names are gone; nothing is duplicated or lost.
- [ ] The covers in the grid show up right away, without the "first time" pause:
      the thumbnails were kept.
- [ ] **≡ → Checkup → Diagnostic log**: the lines from before 1.1.0 are still
      there.
- [ ] **About** › **On your USB drive** shows `data.json`, `backups` and `log.txt`.

## Renaming files (1.1.0)
Before starting, on the PC, copy to the USB drive a game with a made-up name (for
example `E:\roms\ps2\kh2.iso`, a copy of a game you have) and, if you play it with
RetroArch, one of its saves in `E:\RetroArch\saves` with the same name
(`kh2.srm`). **≡ → Library** to scan the console.

- [ ] On that game, **Y → Rename file…**: the standard names show up with their
      cover; the file's current name is on the left and, under it, the new one as
      you move.
- [ ] **A** on a name: the window says what moves with it (images, its entry in
      `gamelist.xml`, RetroArch saves, collections). **B** cancels and nothing
      changes.
- [ ] **A** again: "Renamed: …". On the PC the file has the new name; so do its
      ES-DE images in `E:\ES-DE\downloaded_media\ps2\*\` and its save
      (`… .srm`), and `gamelist.xml` points to the new name.
- [ ] Back in Relix: the game keeps its cover, its playtime, whether it's a
      favorite and its collections. In ES-DE (on the PC) it still has its data.
- [ ] Open it with RetroArch: the save is there.
- [ ] **Y** on the screen opens the keyboard with the name: it has `( ) [ ]`, the
      **Ab** key for capitals and **LT** erases a word. A name with `:` or one
      that's already taken says why it can't be used.
- [ ] A PS1 game in several discs without an `.m3u` (`ff7 (Disc 1).chd`,
      `ff7 (Disc 2).chd`): renaming disc 1 renames every disc, each with its
      number.
- [ ] An Xbox 360 game in a folder: the folder is renamed and the game still
      opens.
- [ ] **≡ → Library → File names**: it checks the consoles and lists the files
      without their standard name. **X** keeps a game as it is (it leaves the
      list), **RB** moves to the next one.

## Game info from Wikipedia (1.1.0)
Before starting, on the PC, copy `E:\ES-DE\gamelists\` somewhere safe, and copy to
the USB drive a game ES-DE hasn't scraped (it has no description in Relix).
**≡ → Library** to scan its console. The console needs internet.

- [ ] On that game, **Y**: the menu has **Find info…** (a game with everything
      doesn't show it).
- [ ] **Find info…**: the left shows what it's missing; the right, the results
      from Wikipedia with **Match** on the sure one, and its year, genre, players
      and description. Moving through the results changes the description.
- [ ] **A**: "Info saved: …". The game's panel now shows the description, with
      "Source: Wikipedia, …" at the end, and **Y › Sort library › Year** places it.
- [ ] On the PC, `gamelist.xml` has the new entry (or the missing fields in the
      existing one) and `gamelist.xml.relix-backup` is the original. Open ES-DE:
      it shows the description too.
- [ ] A scraped game with a description keeps its own text: Relix only fills what
      was empty.
- [ ] **≡ → Library → Game info**: it says how many games have no description;
      **A** goes through the consoles, saves the sure ones by itself and then
      shows the ones to pick. **X** leaves a game without info (it leaves the list).
- [ ] With the language in English, the descriptions come from the English
      Wikipedia.
- [ ] Without internet: it says it couldn't reach Wikipedia, and nothing changes.

## Back where you were (1.2.0)
- [ ] In a console's library, move to a game that isn't the first one and open it.
      Play a couple of minutes and quit **from the emulator's menu**.
- [ ] If Relix comes back by itself: it's on the same library and game, as before.
- [ ] With an emulator that doesn't come back by itself (XBSX2, PPSSPP, Dolphin,
      Xenia…): open Relix from Home. It opens on that library, with that game
      focused, and says "<Game>: N min played". **B** goes to the home screen with
      that console's channel focused.
- [ ] **≡ → Checkup → Diagnostic log**: after a game, a new **START** line means
      the Xbox had closed Relix; the line before it says "(Relix was closed)".
- [ ] A game opened from a collection or Favorites comes back to that collection
      or Favorites.
- [ ] A game opened from the home screen (*Continue playing*) comes back to the
      home screen, on the same channel.

## Relix as App (1.2.0)
- [ ] With Relix as **Game** (Dev Home › View details): when it opens, "Relix is set
      as Game: switch it to App…" shows up once, and **≡ → Checkup** has the
      warning "Relix is set as Game" with the steps. Close and open Relix: the
      notice doesn't show again (the warning in Checkup stays).
- [ ] Switch it to **App** and open Relix: Checkup says "Relix is set as App" and
      "Memory: up to" about 1 GB. If it says Game, or a number far from 1 GB, write
      down what it says.
- [ ] As App, open a game with XBSX2, quit from the emulator's menu and open Relix
      from Home: it's where you left it, without the loading screen.
- [ ] As App, with every console scanned and covers on, browse a few libraries for
      a while: Relix doesn't close by itself.

## Game sheet, weeks and memory (1.3.0)
- [ ] After installing 1.3.0, when Relix opens: "New in 1.3.0: inside a
      console, click the right stick for a game's sheet and the left one…" and then "Tip: inside a
      console, LT and RT jump from letter to letter" show up once (not again on the
      next start). In a console, the button bar shows **R Game sheet** and no
      longer LT / RT (they still jump by letter).
- [ ] Home: at the end of the channels, before Options, the pink die
      **Surprise me** with three face-down cards. **A** opens a random game's
      sheet with the **Surprise me** pill at the top; **L Another** (the left
      stick) shows a different one each time; **B** goes back to the die.
- [ ] On the home screen, the left stick does nothing: *Surprise me* is the die.
- [ ] Inside a console, the left stick picks among that console's games (inside a
      collection, among the collection's). **B** goes back with the same game
      focused as before. Mostly games you haven't played come up.
- [ ] In a console, click the right stick on a game: its sheet opens with the
      cover, the data, the whole description (**↑ ↓** scroll it when it's long) and
      the time played. **B** (or the stick again) goes back with the same game
      focused.
- [ ] **Y → Game sheet** opens it too (also from *Continue playing* and the
      search). Inside the sheet, the menu doesn't offer *Game sheet*. **A** plays
      and **X** sets or removes the favorite.
- [ ] Play a game for more than a minute and come back: its sheet shows this
      week's bar and "This week: N min". **≡ → About → Playtime** shows the 8 weeks
      and the top 5, and it all fits above the hint bar.
- [ ] Home: moving through the channels, the top left takes each one's color,
      softly, in both themes.
- [ ] With something to fix (an emulator missing, e.g.), **≡** shows the red
      number on the **Checkup** tab, the same as the Options tile on the home screen.
- [ ] **≡ → Preferences** no longer has *Video sound*.
- [ ] **≡ → Checkup → Diagnostic log**: **MEMORY** lines when Relix opens ("Relix
      opened: N MB of 1.0 GB"), before each game ("Opening <game>: …") and on each
      new peak ("Peak: … · <screen> · with a video"). Browse a console with ES-DE
      videos for a while, and one without: write down both peaks. That decides
      whether the videos stay.
- [ ] A game with a long description (from Wikipedia) and time played: in the
      library panel, "Opens with …" stays inside the card.
- [ ] Home, on the first channel: go down to *Continue playing* and press **Y**.
      The menu comes in against the right edge, and when you close it the home
      screen is where it was. The same in a console, on a game at the far right.

If something fails, the **If something fails** table in
[`shell/README.md`](../shell/README.md) has the most common causes.
