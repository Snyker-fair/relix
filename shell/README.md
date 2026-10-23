# RelixShell

The shell is the C# part that runs on the Xbox: a UWP app with a full-screen
WebView2. It has four jobs:

1. **Show the interface** (the one in `src/`, built into `ui/`) and talk to it
   through messages.
2. **Read the controller** natively and pass each button to the interface.
3. **Read and write the USB drive:** it scans `roms\<console>\`, reads ES-DE's
   files, and saves covers, thumbnails, collections, your data and the log.
4. **Open the emulators** and come back to Relix when you close them.

To build it and try it on the Xbox, and to release a version, follow
[`docs/BUILDING.md`](../docs/BUILDING.md).

```
RelixShell/
  RelixShell.slnx         the solution: open it in Visual Studio 2022
  RelixShell.csproj       the project (WinUI 2 brings WebView2; ui\** goes in the package)
  Package.appxmanifest    identity, the relix: protocol, permissions (USB and internet)
  App.xaml(.cs)           startup, no mouse mode, coming back from the emulator (relix:)
  MainPage.xaml(.cs)      the WebView2 and the messages with the interface
  Shell/                  the real work (see the table)
  Assets/                 app icons (made by brand/build-assets.py)
  Properties/             AssemblyInfo and .NET Native directives
  ui/                     the built interface: `npm run build:shell` copies it (Git ignores it)
```

| File in `Shell/` | What it does |
|---|---|
| `GamepadInput.cs` | Reads the controller and sends it to the interface |
| `LocalServer.cs` | Serves the interface, images and thumbnails from `https://relix.example` |
| `LibraryReader.cs` | Finds the USB drive and walks the `roms` folder |
| `CoverService.cs` | Downloads covers and screenshots from libretro, makes the thumbnails, lists what's in `downloaded_media` |
| `CollectionStore.cs` | Reads and saves collections in `ES-DE\collections` |
| `UserDataStore.cs` | Saves your data in `relix\data.json`, with the previous copy and daily backups |
| `LegacyFileNames.cs` | Renames the Spanish file names of drives used with Relix 1.0.0 |
| `SystemCheck.cs` | Checks permissions, space, folders, BIOS files and internet (Options › Checkup) |
| `DiagnosticLog.cs` | Writes and reads the diagnostic log (`relix\log.txt`) |
| `Text.cs` | The language of the shell's messages: the same as the interface's |

### Why the controller is read in C#

WebView2 on Xbox has a known problem: it grabs the focus and the B button, and
its content uses a "mouse mode" cursor. That's why the focus stays on the XAML
page and never goes to the WebView2. The controller is read with
`Windows.Gaming.Input` and each button reaches the interface as a message.

### What can't change in the manifest

- The protocol **has to be called `relix`**: it's the one emulators use to send
  you back to the app (`launchOnExit=relix:`).
- **Removable storage** (`removableStorage`) for the USB drive and **Internet
  (client)** for covers and the new-version notice.
- The publisher (`CN=snyker-fair`) has to match the certificate GitHub signs the
  releases with.

---

## A test USB drive

1. Use a drive formatted as **NTFS**.
2. Copy the **contents** of `shell\test-usb\` to the root of the drive. It should
   end up as:
   ```
   E:\ES-DE\gamelists\ps2\gamelist.xml   (and the other consoles)
   E:\roms\ps2\                          (empty for now)
   ```
3. With the drive plugged into the PC, run the **Xbox USB Permissions Tool** from
   [DevStore](https://xbdev.store/). It lets the Xbox apps read and write the
   drive. The emulators need it too.
4. Plug the drive into the Xbox.

Relix lists what it finds in `roms\<console>\`. With the test folder, whose
`roms` is empty, you'll see each console with the notice that it has no games
and which folder to put them in. Copy a real game into that folder and it shows
up when you scan.

Multi-disc games: use an `.m3u` (Relix shows only that one) or leave the discs
with `(Disc 1)`, `(Disc 2)` in the name (Relix shows only disc 1). Each console's
folders and formats are in its guide, inside Relix.

`E:\relix\cache` can be deleted whenever you want: Relix makes it again. If you
replace covers from the PC, delete it so the thumbnails are made again.

## What you should see when it opens

1. The light blue loading screen (or night blue, with the dark theme) with the
   logo.
2. The gem appearing with its sparkle, and the row of consoles.
3. The controller moving between consoles, **without a cursor**.
4. A opens the library. B goes back home. B doesn't close the app.

When you open a game and close the emulator, the console goes back to Relix by
itself.

---

## If something fails

| What you see | What to check |
|---|---|
| Visual Studio doesn't open `RelixShell.slnx` | You need Visual Studio 2022 17.14 or later |
| An error that the 10.0.26100 SDK or the UWP platform is missing | Install the **Universal Windows Platform development** workload in the Visual Studio Installer |
| A build error with `XamlControlsResources` or `WebView2` | The NuGet packages weren't restored: right-click the solution → **Restore NuGet Packages** |
| An empty light blue screen | `npm run build:shell` is missing: the `ui` folder didn't make it into the package |
| Options › Checkup says "Couldn't fully check the USB drive" | The shell didn't answer within 15 seconds: almost always a new interface with an old shell. Deploy again with F5 |
| "I couldn't save your data to the USB drive" | The drive can't be written to: apply the permissions again with the USB Permissions Tool. Meanwhile your data stays in the app and moves to the drive when it can |
| "I couldn't find a roms folder on any USB drive" | The `roms` folder has to be at the root of the drive. Run the USB Permissions Tool |
| A game doesn't show up | Check that its format is in the console's guide and that it's at most 3 folders deep |
| No sound | Check that `MainPage.xaml.cs` has the line `--autoplay-policy=no-user-gesture-required` |
| "… isn't installed on the console" | That emulator isn't installed, or its protocol is a different one |
| "I couldn't connect to the cover server" | The Xbox has no internet |
| A wrong cover | Game menu (Y) › **Change cover** |
| `datos.json` or `registro.txt` are still on the drive | Relix 1.1.0 renames them only if the drive can be written to and the English name doesn't exist yet. Apply the permissions again; if `data.json` already exists, the old file can be deleted |
| Two Relix apps in Dev Home | One is from before 1.0.0 (another publisher): uninstall the old one |

### See the interface's console from the PC

It only works in **Debug** builds, which turn on remote debugging:

1. In Edge, open `https://<Xbox-IP>:11443` and accept the security warning.
2. Download `https://<Xbox-IP>:11443/config/rootcertificate` and install it in
   **Current User → Trusted Root Certification Authorities**.
3. Restart Edge and open `edge://inspect`.
4. Under **Connect to a remote Windows device**, type `https://<Xbox-IP>:11443`.
5. With Relix open on the Xbox, click **inspect** under the WebView2 called
   **Edge**.

There you see the JavaScript errors and the messages between the interface and
the shell.
