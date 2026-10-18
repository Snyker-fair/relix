using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using Windows.Data.Json;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Your Relix data on the USB drive (favorites, hidden games, playtime,
    /// chosen covers, preferences), so it travels with your games:
    ///
    ///   E:\relix\data.json                          the latest
    ///   E:\relix\data.previous.json                 the version before it
    ///   E:\relix\backups\data-YYYY-MM-DD.json       one per day, the last 7
    ///
    /// The interface builds and reads the content (src/lib/core/userData.js);
    /// here the files are only read and written, never leaving one half-written.
    /// Drives used with Relix 1.0.0 have Spanish names: LegacyFileNames renames
    /// them, and until it can, they are still read.
    /// </summary>
    internal static class UserDataStore
    {
        public const string BackupFolder = "backups";
        public const string BackupPrefix = "data-";
        private const string Folder = "relix";
        private const string FileName = "data.json";
        private const string PreviousName = "data.previous.json";
        private const string TempName = "data.tmp";
        private const int BackupDays = 7;

        /// <summary>
        /// The newest copy that can be read: data.json; if it's damaged,
        /// data.previous.json; otherwise the newest backup. Null if there's nothing.
        /// </summary>
        public static async Task<UserDataFile> LoadAsync(LibraryPaths paths)
        {
            await LegacyFileNames.MigrateAsync(paths);
            StorageFolder relix = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.DriveRoot, Folder));
            if (relix == null)
            {
                return null;
            }

            string[] names = { FileName, PreviousName, LegacyFileNames.DataFile, LegacyFileNames.PreviousDataFile };
            foreach (string name in names)
            {
                string text = await TryReadAsync(relix, name);
                if (IsRelixData(text))
                {
                    return new UserDataFile(text, name);
                }
            }

            string[][] backupFolders =
            {
                new[] { BackupFolder, BackupPrefix },
                new[] { LegacyFileNames.BackupFolder, LegacyFileNames.BackupPrefix },
            };
            foreach (string[] backup in backupFolders)
            {
                if (await relix.TryGetItemAsync(backup[0]) is StorageFolder backups)
                {
                    foreach (StorageFile file in await BackupsNewestFirstAsync(backups, backup[1]))
                    {
                        string text = await TryReadAsync(backups, file.Name);
                        if (IsRelixData(text))
                        {
                            return new UserDataFile(text, backup[0] + "\\" + file.Name);
                        }
                    }
                }
            }
            return null;
        }

        /// <summary>
        /// Saves data.json. The new content is written to a separate file first and
        /// only replaces the old one at the very end: if the power goes out halfway,
        /// data.json stays as it was.
        /// </summary>
        public static async Task SaveAsync(LibraryPaths paths, string text)
        {
            if (!IsRelixData(text))
            {
                throw new UserFacingException("error", Text.Pick("Los datos para guardar no son válidos.", "The data to save isn't valid."));
            }

            await LegacyFileNames.MigrateAsync(paths);
            try
            {
                StorageFolder relix = await CoverService.CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), Folder);

                StorageFile temp = await relix.CreateFileAsync(TempName, CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(temp, text);

                // What was there becomes the previous version and, if it's the first save of the day, a backup
                if (await relix.TryGetItemAsync(FileName) is StorageFile current)
                {
                    await current.CopyAsync(relix, PreviousName, NameCollisionOption.ReplaceExisting);
                    await BackupTodayAsync(relix, current);
                }

                await temp.RenameAsync(FileName, NameCollisionOption.ReplaceExisting);
            }
            catch (Exception)
            {
                throw new UserFacingException(
                    "usb-readonly",
                    Text.Pick(
                        "No pude guardar tus datos en el USB. Conecta el disco al PC y vuelve a aplicarle los permisos con la herramienta de DevStore.",
                        "I couldn't save your data to the USB drive. Plug the drive into the PC and apply the permissions again with the DevStore tool."));
            }
        }

        /// <summary>One backup per day (the data as it was when the day started), and only the last 7.</summary>
        private static async Task BackupTodayAsync(StorageFolder relix, StorageFile current)
        {
            StorageFolder backups = await relix.CreateFolderAsync(BackupFolder, CreationCollisionOption.OpenIfExists);
            string today = BackupPrefix + DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + ".json";
            if (await backups.TryGetItemAsync(today) == null)
            {
                await current.CopyAsync(backups, today, NameCollisionOption.ReplaceExisting);
            }

            List<StorageFile> all = await BackupsNewestFirstAsync(backups, BackupPrefix);
            for (int i = BackupDays; i < all.Count; i++)
            {
                await all[i].DeleteAsync();
            }
        }

        private static async Task<List<StorageFile>> BackupsNewestFirstAsync(StorageFolder backups, string prefix)
        {
            var files = new List<StorageFile>();
            foreach (StorageFile file in await backups.GetFilesAsync())
            {
                if (file.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                    && file.Name.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
                {
                    files.Add(file);
                }
            }
            // The name carries the date as YYYY-MM-DD: sorting the text sorts by date
            files.Sort((a, b) => string.CompareOrdinal(b.Name, a.Name));
            return files;
        }

        private static async Task<string> TryReadAsync(StorageFolder folder, string name)
        {
            try
            {
                if (await folder.TryGetItemAsync(name) is StorageFile file)
                {
                    return await FileIO.ReadTextAsync(file);
                }
            }
            catch (Exception)
            {
                // Unreadable: the next copy is tried
            }
            return null;
        }

        /// <summary>Relix JSON: an object with "app": "relix".</summary>
        private static bool IsRelixData(string text)
        {
            JsonObject data;
            IJsonValue app;
            return !string.IsNullOrEmpty(text)
                && JsonObject.TryParse(text, out data)
                && data.TryGetValue("app", out app)
                && app.ValueType == JsonValueType.String
                && app.GetString() == "relix";
        }
    }

    /// <summary>A data file that was read and where it came from (data.json, the previous one or a backup).</summary>
    internal sealed class UserDataFile
    {
        public UserDataFile(string text, string source)
        {
            Text = text;
            Source = source;
        }

        public string Text { get; }
        public string Source { get; }
    }
}
