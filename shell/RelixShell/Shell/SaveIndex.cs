using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Windows.Data.Json;
using Windows.Storage;
using Windows.Storage.FileProperties;
using Windows.Storage.Search;

namespace RelixShell
{
    /// <summary>
    /// RetroArch's saves on the USB drive, for the game sheet ("Saved 3 days ago"):
    ///
    ///   E:\RetroArch\saves\Game.srm             the game's own save (its memory card)
    ///   E:\RetroArch\states\Game.state1         RetroArch's quick saves
    ///   E:\RetroArch\states\Game.state1.png     the picture of that moment
    ///
    /// and the same one folder down (RetroArch can sort them by core or by content
    /// folder). They're only there if RetroArch was told to keep them on the USB drive
    /// (Settings › Directory; the guides explain it). Relix only lists them: it never
    /// changes or deletes a save.
    /// </summary>
    internal static class SaveIndex
    {
        private static readonly string[] Folders = { "saves", "states" };

        /// <summary>Enough for any library; past this, the rest isn't listed.</summary>
        private const int MaxFiles = 5000;

        /// <summary>
        /// { found, base, files: [{ path: "states/SwanStation/Game.state1", size, modified }] }
        /// found: at least one of the two folders exists; base: where the pictures are asked
        /// for (base + "/" + path); modified in ms since 1970.
        /// </summary>
        public static async Task<JsonObject> ListAsync(LibraryPaths paths)
        {
            var files = new JsonArray();
            bool found = false;
            foreach (string name in Folders)
            {
                StorageFolder folder = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.DriveRoot, "RetroArch", name));
                if (folder == null)
                {
                    continue;
                }
                found = true;
                await AddFilesAsync(folder, name, files);
                foreach (StorageFolder inner in await folder.GetFoldersAsync())
                {
                    await AddFilesAsync(inner, name + "/" + inner.Name, files);
                }
            }

            var result = new JsonObject();
            result.SetNamedValue("found", JsonValue.CreateBooleanValue(found));
            result.SetNamedValue("base", JsonValue.CreateStringValue(MainPage.Origin + "/saves"));
            result.SetNamedValue("files", files);
            return result;
        }

        /// <summary>
        /// A save's picture (states\Game.state1.png), for the interface's /saves/ address.
        /// Only PNG files inside those two folders.
        /// </summary>
        public static async Task<StorageFile> FindImageAsync(LibraryPaths paths, string relative)
        {
            string[] parts = relative.Split('/');
            if (paths == null || parts.Length < 2 || Array.IndexOf(Folders, parts[0]) < 0
                || Array.IndexOf(parts, "..") >= 0
                || !relative.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }
            return await LibraryReader.TryGetFileAsync(Path.Combine(paths.DriveRoot, "RetroArch", relative.Replace('/', '\\')));
        }

        private static async Task AddFilesAsync(StorageFolder folder, string relative, JsonArray files)
        {
            if (files.Count >= MaxFiles)
            {
                return;
            }
            foreach (StorageFile file in await FilesWithPropertiesAsync(folder, (uint)(MaxFiles - files.Count)))
            {
                BasicProperties props = await file.GetBasicPropertiesAsync();
                var entry = new JsonObject();
                entry.SetNamedValue("path", JsonValue.CreateStringValue(relative + "/" + file.Name));
                entry.SetNamedValue("size", JsonValue.CreateNumberValue(props.Size));
                entry.SetNamedValue("modified", JsonValue.CreateNumberValue(props.DateModified.ToUnixTimeMilliseconds()));
                files.Add(entry);
            }
        }

        /// <summary>
        /// The folder's files with their size and date already read: asking file by file
        /// is slow on a USB drive. If the query isn't available, the plain list.
        /// </summary>
        private static async Task<IReadOnlyList<StorageFile>> FilesWithPropertiesAsync(StorageFolder folder, uint max)
        {
            try
            {
                var options = new QueryOptions(CommonFileQuery.DefaultQuery, new[] { "*" }) { FolderDepth = FolderDepth.Shallow };
                options.SetPropertyPrefetch(PropertyPrefetchOptions.BasicProperties, null);
                return await folder.CreateFileQueryWithOptions(options).GetFilesAsync(0, max);
            }
            catch (Exception)
            {
                IReadOnlyList<StorageFile> all = await folder.GetFilesAsync();
                var some = new List<StorageFile>();
                for (int i = 0; i < all.Count && i < max; i++)
                {
                    some.Add(all[i]);
                }
                return some;
            }
        }
    }
}
