using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Up to 1.0.0, Relix gave its files on the USB drive Spanish names. The first
    /// time a newer Relix opens a drive, it renames them to the English ones:
    ///
    ///   relix\datos.json                    -> relix\data.json
    ///   relix\datos.anterior.json           -> relix\data.previous.json
    ///   relix\respaldos\datos-YYYY-MM-DD.json -> relix\backups\data-YYYY-MM-DD.json
    ///   relix\registro.txt                  -> relix\log.txt
    ///   relix\registro.anterior.txt         -> relix\log.previous.txt
    ///   relix\cache\miniaturas              -> relix\cache\thumbnails
    ///
    /// Nothing is overwritten or deleted: if a file already exists under its new
    /// name, the old one stays where it is. If the drive is read-only, everything
    /// keeps its old name and UserDataStore still reads it.
    /// </summary>
    internal static class LegacyFileNames
    {
        public const string DataFile = "datos.json";
        public const string PreviousDataFile = "datos.anterior.json";
        public const string BackupFolder = "respaldos";
        public const string BackupPrefix = "datos-";

        private static readonly string[][] Renames =
        {
            new[] { DataFile, "data.json" },
            new[] { PreviousDataFile, "data.previous.json" },
            new[] { "registro.txt", "log.txt" },
            new[] { "registro.anterior.txt", "log.previous.txt" },
        };

        /// <summary>One migration at a time, and once per drive while the app runs.</summary>
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(1, 1);
        private static readonly HashSet<string> Done = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        public static async Task MigrateAsync(LibraryPaths paths)
        {
            if (paths == null)
            {
                return;
            }

            await Gate.WaitAsync();
            try
            {
                if (!Done.Add(paths.DriveRoot))
                {
                    return;
                }

                StorageFolder relix = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.DriveRoot, "relix"));
                if (relix == null)
                {
                    return;
                }

                foreach (string[] rename in Renames)
                {
                    await TryAsync(() => RenameFileAsync(relix, rename[0], rename[1]));
                }
                await TryAsync(() => MoveBackupsAsync(relix));
                await TryAsync(() => RenameThumbnailsAsync(relix));
            }
            finally
            {
                Gate.Release();
            }
        }

        private static async Task RenameFileAsync(StorageFolder folder, string from, string to)
        {
            if (await folder.TryGetItemAsync(from) is StorageFile file && await folder.TryGetItemAsync(to) == null)
            {
                await file.RenameAsync(to, NameCollisionOption.FailIfExists);
            }
        }

        /// <summary>respaldos\datos-2026-10-17.json -> backups\data-2026-10-17.json; the empty folder goes away.</summary>
        private static async Task MoveBackupsAsync(StorageFolder relix)
        {
            if (!(await relix.TryGetItemAsync(BackupFolder) is StorageFolder old))
            {
                return;
            }

            StorageFolder backups = await relix.CreateFolderAsync(UserDataStore.BackupFolder, CreationCollisionOption.OpenIfExists);
            foreach (StorageFile file in await old.GetFilesAsync())
            {
                string name = file.Name.StartsWith(BackupPrefix, StringComparison.OrdinalIgnoreCase)
                    ? UserDataStore.BackupPrefix + file.Name.Substring(BackupPrefix.Length)
                    : file.Name;
                if (await backups.TryGetItemAsync(name) == null)
                {
                    await file.MoveAsync(backups, name, NameCollisionOption.FailIfExists);
                }
            }

            if ((await old.GetItemsAsync()).Count == 0)
            {
                await old.DeleteAsync(StorageDeleteOption.PermanentDelete);
            }
        }

        /// <summary>Renaming the folder keeps the thumbnails, so the console doesn't have to make them again.</summary>
        private static async Task RenameThumbnailsAsync(StorageFolder relix)
        {
            if (await relix.TryGetItemAsync("cache") is StorageFolder cache
                && await cache.TryGetItemAsync("miniaturas") is StorageFolder old
                && await cache.TryGetItemAsync(CoverService.ThumbnailFolder) == null)
            {
                await old.RenameAsync(CoverService.ThumbnailFolder, NameCollisionOption.FailIfExists);
            }
        }

        /// <summary>A step that fails (a file in use, a read-only drive) doesn't stop the others.</summary>
        private static async Task TryAsync(Func<Task> step)
        {
            try
            {
                await step();
            }
            catch (Exception)
            {
                // The file keeps its old name: nothing is lost, and the next start tries again
            }
        }
    }
}
