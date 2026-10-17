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
    /// Tus datos de Relix en el USB (favoritos, ocultos, tiempo de juego,
    /// portadas elegidas, preferencias), para que viajen con tus juegos:
    ///
    ///   E:\relix\datos.json                          lo último
    ///   E:\relix\datos.anterior.json                 la versión anterior
    ///   E:\relix\respaldos\datos-AAAA-MM-DD.json     uno por día, los últimos 7
    ///
    /// La interfaz arma y entiende el contenido (src/lib/core/userData.js);
    /// aquí solo se leen y escriben los archivos, sin dejar nunca uno a medias.
    /// </summary>
    internal static class UserDataStore
    {
        private const string Folder = "relix";
        private const string FileName = "datos.json";
        private const string PreviousName = "datos.anterior.json";
        private const string TempName = "datos.tmp";
        private const string BackupFolder = "respaldos";
        private const string BackupPrefix = "datos-";
        private const int BackupDays = 7;

        /// <summary>
        /// Lo más reciente que se pueda leer: datos.json; si está dañado,
        /// datos.anterior.json; si no, el respaldo más nuevo. Null si no hay nada.
        /// </summary>
        public static async Task<UserDataFile> LoadAsync(LibraryPaths paths)
        {
            StorageFolder relix = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.DriveRoot, Folder));
            if (relix == null)
            {
                return null;
            }

            foreach (string name in new[] { FileName, PreviousName })
            {
                string text = await TryReadAsync(relix, name);
                if (IsRelixData(text))
                {
                    return new UserDataFile(text, name);
                }
            }

            if (await relix.TryGetItemAsync(BackupFolder) is StorageFolder backups)
            {
                foreach (StorageFile file in await BackupsNewestFirstAsync(backups))
                {
                    string text = await TryReadAsync(backups, file.Name);
                    if (IsRelixData(text))
                    {
                        return new UserDataFile(text, BackupFolder + "\\" + file.Name);
                    }
                }
            }
            return null;
        }

        /// <summary>
        /// Guarda datos.json. Lo nuevo se escribe primero en un archivo aparte y
        /// recién al final reemplaza al anterior: si se corta la luz a mitad,
        /// datos.json queda como estaba.
        /// </summary>
        public static async Task SaveAsync(LibraryPaths paths, string text)
        {
            if (!IsRelixData(text))
            {
                throw new UserFacingException("error", Text.Pick("Los datos para guardar no son válidos.", "The data to save isn't valid."));
            }

            try
            {
                StorageFolder relix = await CoverService.CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), Folder);

                StorageFile temp = await relix.CreateFileAsync(TempName, CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(temp, text);

                // Lo que había queda como versión anterior y, si es lo primero del día, de respaldo
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

        /// <summary>Un respaldo por día (el estado con que empezó ese día) y solo los últimos 7.</summary>
        private static async Task BackupTodayAsync(StorageFolder relix, StorageFile current)
        {
            StorageFolder backups = await relix.CreateFolderAsync(BackupFolder, CreationCollisionOption.OpenIfExists);
            string today = BackupPrefix + DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + ".json";
            if (await backups.TryGetItemAsync(today) == null)
            {
                await current.CopyAsync(backups, today, NameCollisionOption.ReplaceExisting);
            }

            List<StorageFile> all = await BackupsNewestFirstAsync(backups);
            for (int i = BackupDays; i < all.Count; i++)
            {
                await all[i].DeleteAsync();
            }
        }

        private static async Task<List<StorageFile>> BackupsNewestFirstAsync(StorageFolder backups)
        {
            var files = new List<StorageFile>();
            foreach (StorageFile file in await backups.GetFilesAsync())
            {
                if (file.Name.StartsWith(BackupPrefix, StringComparison.OrdinalIgnoreCase)
                    && file.Name.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
                {
                    files.Add(file);
                }
            }
            // El nombre lleva la fecha AAAA-MM-DD: ordenar el texto es ordenar por fecha
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
                // ilegible: se prueba con la copia siguiente
            }
            return null;
        }

        /// <summary>JSON de Relix: un objeto con "app": "relix".</summary>
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

    /// <summary>Un archivo de datos leído y de dónde salió (datos.json, la anterior o un respaldo).</summary>
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
