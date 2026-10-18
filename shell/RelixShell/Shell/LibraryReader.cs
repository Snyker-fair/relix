using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Where the library is on the USB drive. Relix expects this structure at
    /// the root of the drive:
    ///
    ///   E:\roms\psx\...                              games (they get scanned)
    ///   E:\ES-DE\gamelists\psx\gamelist.xml          ES-DE's data (optional)
    ///   E:\ES-DE\downloaded_media\psx\covers\...     ES-DE's covers (optional)
    /// </summary>
    internal sealed class LibraryPaths
    {
        public LibraryPaths(string driveRoot, string driveName)
        {
            DriveRoot = driveRoot;
            DriveName = driveName ?? "";
            RomRoot = Path.Combine(driveRoot, "roms");
            EsdeRoot = Path.Combine(driveRoot, "ES-DE");
            MediaRoot = Path.Combine(EsdeRoot, "downloaded_media");
        }

        public string DriveRoot { get; }

        /// <summary>The drive's name, e.g. "RELIX (E:)". It's used to notice if you switched USB drives.</summary>
        public string DriveName { get; }
        public string RomRoot { get; }
        public string EsdeRoot { get; }
        public string MediaRoot { get; }
    }

    /// <summary>What was found in roms\&lt;console&gt;\.</summary>
    internal sealed class RomFolder
    {
        public RomFolder(string folder, List<string> files)
        {
            Folder = folder;
            Files = files;
        }

        /// <summary>The folder's real name (e.g. "ps1" even though the console is psx).</summary>
        public string Folder { get; }

        /// <summary>Relative paths with "/", e.g. "Final Fantasy VII/FF7.m3u".</summary>
        public List<string> Files { get; }
    }

    internal static class LibraryReader
    {
        /// <summary>How many subfolders deep it looks (Wii U uses Game\code\game.rpx).</summary>
        private const int MaxDepth = 3;

        /// <summary>A safety cap per console.</summary>
        private const int MaxFiles = 5000;

        /// <summary>
        /// Folders that never have games and can have thousands of files
        /// (e.g. the content folder of Wii U games).
        /// </summary>
        private static readonly HashSet<string> SkipFolders =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "content", "meta", "save", "saves", "states", "screenshots", "media", "images",
            };

        /// <summary>Looks for the first drive with the roms or ES-DE folder at its root.</summary>
        public static async Task<LibraryPaths> FindAsync()
        {
            // 1) The drives the console reports as removable (needs removableStorage)
            try
            {
                foreach (StorageFolder drive in await KnownFolders.RemovableDevices.GetFoldersAsync())
                {
                    if (await drive.TryGetItemAsync("roms") is StorageFolder
                        || await drive.TryGetItemAsync("ES-DE") is StorageFolder)
                    {
                        return new LibraryPaths(drive.Path, drive.DisplayName);
                    }
                }
            }
            catch (Exception)
            {
                // No access to the list of drives: we try by letter.
            }

            // 2) Drive letters USB drives usually get on Xbox
            foreach (char letter in "EFGHIJ")
            {
                string root = letter + ":\\";
                if (await TryGetFolderAsync(Path.Combine(root, "roms")) != null
                    || await TryGetFolderAsync(Path.Combine(root, "ES-DE")) != null)
                {
                    StorageFolder drive = await TryGetFolderAsync(root);
                    return new LibraryPaths(root, drive?.DisplayName);
                }
            }

            return null;
        }

        /// <summary>
        /// Lists the files in a console's folder inside roms.
        /// It tries the names in order (psx, ps1, playstation...) and uses the first one that exists.
        /// It returns null if the console has no folder.
        /// </summary>
        public static async Task<RomFolder> ScanRomsAsync(LibraryPaths paths, IEnumerable<string> folderNames)
        {
            foreach (string name in folderNames)
            {
                StorageFolder folder = await TryGetFolderAsync(Path.Combine(paths.RomRoot, name));
                if (folder == null)
                {
                    continue;
                }

                var files = new List<string>();
                await CollectFilesAsync(folder, "", 0, files);
                return new RomFolder(folder.Name, files);
            }
            return null;
        }

        /// <summary>Lists the files in a folder and its subfolders (relative paths with "/").</summary>
        internal static async Task CollectFilesAsync(StorageFolder folder, string prefix, int depth, List<string> files)
        {
            IReadOnlyList<IStorageItem> items;
            try
            {
                items = await folder.GetItemsAsync();
            }
            catch (Exception)
            {
                return; // a folder without permission: it's skipped
            }

            foreach (IStorageItem item in items)
            {
                if (files.Count >= MaxFiles)
                {
                    return;
                }
                if (item.Name.StartsWith(".", StringComparison.Ordinal))
                {
                    continue; // hidden ones: .gitkeep, .DS_Store...
                }

                StorageFolder subfolder = item as StorageFolder;
                if (subfolder == null)
                {
                    files.Add(prefix + item.Name);
                }
                else if (depth < MaxDepth && !SkipFolders.Contains(item.Name))
                {
                    await CollectFilesAsync(subfolder, prefix + item.Name + "/", depth + 1, files);
                }
            }
        }

        public static async Task<StorageFolder> TryGetFolderAsync(string path)
        {
            try
            {
                return await StorageFolder.GetFolderFromPathAsync(path);
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>A system's gamelist.xml, or null if that system has none.</summary>
        public static async Task<string> ReadGamelistAsync(LibraryPaths paths, string systemId)
        {
            string path = Path.Combine(paths.EsdeRoot, "gamelists", systemId, "gamelist.xml");
            StorageFile file = await TryGetFileAsync(path);
            return file == null ? null : await FileIO.ReadTextAsync(file);
        }

        public static async Task<bool> FileExistsAsync(string path)
        {
            return await TryGetFileAsync(path) != null;
        }

        public static async Task<StorageFile> TryGetFileAsync(string path)
        {
            try
            {
                return await StorageFile.GetFileFromPathAsync(path);
            }
            catch (Exception)
            {
                return null;
            }
        }
    }

    /// <summary>An error with a message meant to be shown in the interface.</summary>
    internal sealed class UserFacingException : Exception
    {
        public UserFacingException(string code, string message) : base(message)
        {
            Code = code;
        }

        /// <summary>A code so the interface can pick the message (e.g. emulator-missing).</summary>
        public string Code { get; }
    }
}
