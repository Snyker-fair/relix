using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Windows.Data.Json;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Renames a game on the USB drive (Y › Rename file…). The interface plans it
    /// (src/lib/core/rename.js); here every name is checked first, and then moved:
    ///
    ///   roms\&lt;folder&gt;\...                     the game: its file, its other discs or its folder
    ///   ES-DE\downloaded_media\&lt;system&gt;\*\     its images and videos, in every type folder
    ///   relix\cache\thumbnails\&lt;system&gt;\      its thumbnails
    ///   ES-DE\gamelists\&lt;system&gt;\gamelist.xml its &lt;path&gt; entries
    ///   RetroArch\saves, RetroArch\states       RetroArch's saves and states (and the ones next to the game)
    ///
    /// Nothing is overwritten. If the game itself can't be renamed, nothing changes
    /// (a disc that fails puts the others back); the rest is done as far as it can be,
    /// and the answer says how much moved.
    /// </summary>
    internal static class RomRenamer
    {
        /// <summary>Saves RetroArch can keep next to the game ("Write saves to content directory").</summary>
        private static readonly Regex SaveSuffix = new Regex(
            @"^\.(srm|sav|rtc|eep|sra|fla|mpk|mcd|mcr|ldci|state(\d+|\.auto)?)(\.png)?$", RegexOptions.IgnoreCase);

        private static readonly Regex PathElement = new Regex("<path>([^<]*)</path>");

        private sealed class Rename
        {
            public string From;
            public string To;
            public bool Folder;
        }

        /// <summary>
        /// { system, folder, files: [{ from, to }], media: [{ from, to, folder }],
        ///   gamelist: [{ from, to, folder }], saves: [{ from, to }] }
        /// Answer: { files, media, thumbnails, gamelist, saves, savesFolder, failed, errors }.
        /// errors: "step: message" for each step that failed (the interface logs them).
        /// With dryRun nothing changes: the counts say what would move.
        /// </summary>
        public static async Task<JsonObject> RunAsync(LibraryPaths paths, CoverService covers, JsonObject payload, bool dryRun)
        {
            string system = payload.GetNamedString("system");
            string folder = payload.GetNamedString("folder");
            List<Rename> files = Read(payload, "files");
            List<Rename> media = Read(payload, "media");
            List<Rename> gamelist = Read(payload, "gamelist");
            List<Rename> saves = Read(payload, "saves");
            if (files.Count == 0)
            {
                throw new UserFacingException("rename-missing", Text.Pick("No hay nada que renombrar.", "There's nothing to rename."));
            }

            // 1) The game: every name is checked before anything moves
            string romFolder = Path.Combine(paths.RomRoot, folder);
            var items = new List<IStorageItem>();
            foreach (Rename r in files)
            {
                IStorageItem item = await TryGetItemAsync(Path.Combine(romFolder, ToWindows(r.From)));
                if (item == null)
                {
                    throw new UserFacingException("rename-missing", Text.Pick(
                        "No encontré " + r.From + " en el USB. Vuelve a escanear la consola.",
                        "I couldn't find " + r.From + " on the USB drive. Scan the console again."));
                }
                if (!SameName(r.From, r.To) && await TryGetItemAsync(Path.Combine(romFolder, ToWindows(r.To))) != null)
                {
                    throw new UserFacingException("rename-exists", Text.Pick(
                        "Ya hay un archivo llamado " + LastPart(r.To) + ".",
                        "There's already a file called " + LastPart(r.To) + "."));
                }
                items.Add(item);
            }

            var result = new JsonObject();
            int failed = 0;
            var errors = new JsonArray();
            result.SetNamedValue("errors", errors);
            List<StorageFolder> saveFolders = await SaveFoldersAsync(paths);
            result.SetNamedValue("savesFolder", JsonValue.CreateBooleanValue(saveFolders.Count > 0));

            if (dryRun)
            {
                result.SetNamedValue("files", JsonValue.CreateNumberValue(files.Count));
                result.SetNamedValue("media", JsonValue.CreateNumberValue(await RenameMediaAsync(paths, system, media, dryRun: true)));
                result.SetNamedValue("thumbnails", JsonValue.CreateNumberValue(0));
                result.SetNamedValue("gamelist", JsonValue.CreateNumberValue(await RenameInGamelistAsync(paths, system, gamelist, dryRun: true)));
                result.SetNamedValue("saves", JsonValue.CreateNumberValue(await RenameSavesAsync(saveFolders, romFolder, files, saves, dryRun: true)));
                result.SetNamedValue("failed", JsonValue.CreateNumberValue(0));
                return result;
            }

            var done = new List<int>();
            try
            {
                for (int i = 0; i < files.Count; i++)
                {
                    await RenameItemAsync(items[i], LastPart(files[i].To));
                    done.Add(i);
                }
            }
            catch (Exception)
            {
                // The game stays as it was: the discs that already moved go back
                foreach (int i in done)
                {
                    try
                    {
                        await RenameItemAsync(items[i], LastPart(files[i].From));
                    }
                    catch (Exception)
                    {
                        // Nothing else to try: the scan will show it with whatever name it has
                    }
                }
                throw new UserFacingException("rename-failed", Text.Pick(
                    "No pude renombrar el juego en el USB. Conecta el disco al PC y vuelve a aplicarle los permisos con la herramienta de DevStore.",
                    "I couldn't rename the game on the USB drive. Plug the drive into the PC and apply the permissions again with the DevStore tool."));
            }
            result.SetNamedValue("files", JsonValue.CreateNumberValue(files.Count));

            // 2) What goes with it: as far as it can
            var counts = new Dictionary<string, Func<Task<int>>>
            {
                { "media", () => RenameMediaAsync(paths, system, media, dryRun: false) },
                { "thumbnails", () => RenameThumbnailsAsync(paths, covers, system, media) },
                { "gamelist", () => RenameInGamelistAsync(paths, system, gamelist, dryRun: false) },
                { "saves", () => RenameSavesAsync(saveFolders, romFolder, files, saves, dryRun: false) },
            };
            foreach (KeyValuePair<string, Func<Task<int>>> step in counts)
            {
                int count = 0;
                try
                {
                    count = await step.Value();
                }
                catch (Exception e)
                {
                    failed++;
                    errors.Add(JsonValue.CreateStringValue(step.Key + ": " + e.Message));
                }
                result.SetNamedValue(step.Key, JsonValue.CreateNumberValue(count));
            }
            result.SetNamedValue("failed", JsonValue.CreateNumberValue(failed));
            return result;
        }

        // ── Images, videos and thumbnails ───────────────────────────────────

        /// <summary>The game's images and videos in every type folder of downloaded_media\&lt;system&gt;.</summary>
        private static async Task<int> RenameMediaAsync(LibraryPaths paths, string system, List<Rename> media, bool dryRun)
        {
            StorageFolder root = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.MediaRoot, system));
            if (root == null || media.Count == 0)
            {
                return 0;
            }
            int count = 0;
            foreach (StorageFolder type in await root.GetFoldersAsync())
            {
                count += await RenameKeysAsync(type, media, dryRun);
            }
            return count;
        }

        private static async Task<int> RenameThumbnailsAsync(LibraryPaths paths, CoverService covers, string system, List<Rename> media)
        {
            StorageFolder thumbs = await covers.ThumbnailFolderAsync(paths, system);
            return thumbs == null ? 0 : await RenameKeysAsync(thumbs, media, dryRun: false);
        }

        /// <summary>
        /// Inside one folder: a key "Sub/Old" renames every "Sub\Old.*" (any extension);
        /// a folder key renames that folder.
        /// </summary>
        private static async Task<int> RenameKeysAsync(StorageFolder root, List<Rename> keys, bool dryRun)
        {
            int count = 0;
            foreach (Rename key in keys)
            {
                if (ParentOf(key.From) != ParentOf(key.To))
                {
                    continue;
                }
                if (key.Folder)
                {
                    if (await TryGetItemAsync(Path.Combine(root.Path, ToWindows(key.From))) is StorageFolder found
                        && (SameName(key.From, key.To) || await TryGetItemAsync(Path.Combine(root.Path, ToWindows(key.To))) == null))
                    {
                        if (!dryRun) await RenameItemAsync(found, LastPart(key.To));
                        count++;
                    }
                    continue;
                }

                StorageFolder parent = ParentOf(key.From) == ""
                    ? root
                    : await LibraryReader.TryGetFolderAsync(Path.Combine(root.Path, ToWindows(ParentOf(key.From))));
                if (parent == null)
                {
                    continue;
                }
                string fromStem = LastPart(key.From);
                string toStem = LastPart(key.To);
                foreach (StorageFile file in await parent.GetFilesAsync())
                {
                    if (!string.Equals(Path.GetFileNameWithoutExtension(file.Name), fromStem, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    string target = toStem + Path.GetExtension(file.Name);
                    if (!SameName(file.Name, target) && await parent.TryGetItemAsync(target) != null)
                    {
                        continue;
                    }
                    if (!dryRun) await RenameItemAsync(file, target);
                    count++;
                }
            }
            return count;
        }

        // ── ES-DE's gamelist ────────────────────────────────────────────────

        /// <summary>
        /// The &lt;path&gt; entries of ES-DE\gamelists\&lt;system&gt;\gamelist.xml, changed in the text
        /// itself (the rest of the file stays exactly as it was) and saved through a
        /// temporary file, so it's never left half-written.
        /// </summary>
        private static async Task<int> RenameInGamelistAsync(LibraryPaths paths, string system, List<Rename> renames, bool dryRun)
        {
            StorageFolder folder = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.EsdeRoot, "gamelists", system));
            if (folder == null || renames.Count == 0 || !(await folder.TryGetItemAsync("gamelist.xml") is StorageFile file))
            {
                return 0;
            }

            string text = await FileIO.ReadTextAsync(file);
            int count = 0;
            string updated = PathElement.Replace(text, match =>
            {
                string raw = WebUtility.HtmlDecode(match.Groups[1].Value);
                string relative = raw.Replace('\\', '/');
                bool dotted = relative.StartsWith("./", StringComparison.Ordinal);
                if (dotted) relative = relative.Substring(2);

                foreach (Rename r in renames)
                {
                    bool same = string.Equals(relative, r.From, StringComparison.OrdinalIgnoreCase);
                    bool inside = r.Folder && relative.StartsWith(r.From + "/", StringComparison.OrdinalIgnoreCase);
                    if (same || inside)
                    {
                        count++;
                        string renamed = r.To + relative.Substring(r.From.Length);
                        return "<path>" + (dotted ? "./" : "") + EscapeXml(renamed) + "</path>";
                    }
                }
                return match.Value;
            });

            if (dryRun || count == 0)
            {
                return count;
            }
            StorageFile temp = await folder.CreateFileAsync("gamelist.xml.tmp", CreationCollisionOption.ReplaceExisting);
            await FileIO.WriteTextAsync(temp, updated);
            await temp.RenameAsync("gamelist.xml", NameCollisionOption.ReplaceExisting);
            return count;
        }

        private static string EscapeXml(string text)
        {
            return text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
        }

        // ── RetroArch's saves ───────────────────────────────────────────────

        /// <summary>E:\RetroArch\saves and states, and the folders inside them (one per core).</summary>
        private static async Task<List<StorageFolder>> SaveFoldersAsync(LibraryPaths paths)
        {
            var folders = new List<StorageFolder>();
            foreach (string name in new[] { "saves", "states" })
            {
                StorageFolder folder = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.DriveRoot, "RetroArch", name));
                if (folder == null)
                {
                    continue;
                }
                folders.Add(folder);
                folders.AddRange(await folder.GetFoldersAsync());
            }
            return folders;
        }

        /// <summary>
        /// RetroArch names saves after the game's file: "Old.srm", "Old.state1"...
        /// In its saves folders any of them moves; next to the game, only the known
        /// kinds of save (a .bin there is a track of the .cue, not a save).
        /// </summary>
        private static async Task<int> RenameSavesAsync(
            List<StorageFolder> saveFolders, string romFolder, List<Rename> files, List<Rename> saves, bool dryRun)
        {
            int count = 0;
            foreach (Rename save in saves)
            {
                foreach (StorageFolder folder in saveFolders)
                {
                    count += await RenameSavesInAsync(folder, save, anySuffix: true, dryRun: dryRun);
                }
            }

            // Next to the game (its own folder in roms)
            for (int i = 0; i < files.Count && i < saves.Count; i++)
            {
                StorageFolder folder = ParentOf(files[i].From) == ""
                    ? await LibraryReader.TryGetFolderAsync(romFolder)
                    : await LibraryReader.TryGetFolderAsync(Path.Combine(romFolder, ToWindows(ParentOf(files[i].From))));
                if (folder != null)
                {
                    count += await RenameSavesInAsync(folder, saves[i], anySuffix: false, dryRun: dryRun);
                }
            }
            return count;
        }

        private static async Task<int> RenameSavesInAsync(StorageFolder folder, Rename save, bool anySuffix, bool dryRun)
        {
            int count = 0;
            foreach (StorageFile file in await folder.GetFilesAsync())
            {
                if (!file.Name.StartsWith(save.From + ".", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                string suffix = file.Name.Substring(save.From.Length);
                if (!anySuffix && !SaveSuffix.IsMatch(suffix))
                {
                    continue;
                }
                string target = save.To + suffix;
                if (!SameName(file.Name, target) && await folder.TryGetItemAsync(target) != null)
                {
                    continue;
                }
                if (!dryRun) await RenameItemAsync(file, target);
                count++;
            }
            return count;
        }

        // ── Helpers ─────────────────────────────────────────────────────────

        private static List<Rename> Read(JsonObject payload, string name)
        {
            var list = new List<Rename>();
            foreach (IJsonValue value in payload.GetNamedArray(name, new JsonArray()))
            {
                if (value.ValueType != JsonValueType.Object)
                {
                    continue;
                }
                JsonObject item = value.GetObject();
                string from = item.GetNamedString("from", "").Replace('\\', '/').Trim('/');
                string to = item.GetNamedString("to", "").Replace('\\', '/').Trim('/');
                if (from.Length == 0 || to.Length == 0 || IsUnsafe(from) || IsUnsafe(to))
                {
                    continue;
                }
                list.Add(new Rename { From = from, To = to, Folder = item.GetNamedBoolean("folder", false) });
            }
            return list;
        }

        /// <summary>A path that tries to leave its folder ("..") or names a drive is never used.</summary>
        private static bool IsUnsafe(string path)
        {
            foreach (string part in path.Split('/'))
            {
                if (part == ".." || part == "." || part.Length == 0 || part.Contains(":"))
                {
                    return true;
                }
            }
            return false;
        }

        /// <summary>
        /// Renames a file or folder. A case-only change ("okami" -> "Okami") goes
        /// through a temporary name: Windows sees both names as the same one.
        /// </summary>
        private static async Task RenameItemAsync(IStorageItem item, string newName)
        {
            if (item.Name == newName)
            {
                return;
            }
            if (string.Equals(item.Name, newName, StringComparison.OrdinalIgnoreCase))
            {
                await item.RenameAsync(newName + ".relix-tmp", NameCollisionOption.FailIfExists);
            }
            await item.RenameAsync(newName, NameCollisionOption.FailIfExists);
        }

        private static async Task<IStorageItem> TryGetItemAsync(string path)
        {
            StorageFolder parent = await LibraryReader.TryGetFolderAsync(Path.GetDirectoryName(path));
            return parent == null ? null : await parent.TryGetItemAsync(Path.GetFileName(path));
        }

        private static bool SameName(string a, string b)
        {
            return string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
        }

        private static string ToWindows(string path)
        {
            return path.Replace('/', '\\');
        }

        private static string LastPart(string path)
        {
            int slash = path.LastIndexOf('/');
            return slash >= 0 ? path.Substring(slash + 1) : path;
        }

        private static string ParentOf(string path)
        {
            int slash = path.LastIndexOf('/');
            return slash >= 0 ? path.Substring(0, slash) : "";
        }
    }
}
