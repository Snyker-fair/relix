using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Windows.Data.Json;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Revisión del sistema (Opciones › Revisión y el primer uso): lo que Relix
    /// puede comprobar del USB y de la consola. Aquí solo se mide; la interfaz
    /// decide qué significa cada cosa y cómo arreglarla (src/lib/core/systemCheck.js).
    /// </summary>
    internal static class SystemCheck
    {
        /// <summary>El servidor de portadas: si responde, hay internet para bajarlas.</summary>
        private const string ThumbnailsServer = "https://thumbnails.libretro.com/";

        /// <summary>Tope de archivos por carpeta (las de BIOS tienen unos pocos).</summary>
        private const int MaxFilesPerFolder = 300;

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };

        /// <summary>
        /// { drive, writable, space: { free, total } | null, romFolders: [...],
        ///   folders: { "RetroArch\\system": ["scph5501.bin"] | null }, internet }
        /// </summary>
        public static async Task<JsonObject> RunAsync(LibraryPaths paths, JsonArray folders)
        {
            var result = new JsonObject();
            result.SetNamedValue("drive", JsonValue.CreateStringValue(paths.DriveRoot));
            result.SetNamedValue("writable", JsonValue.CreateBooleanValue(await CanWriteAsync(paths)));
            result.SetNamedValue("space", await SpaceAsync(paths));
            result.SetNamedValue("romFolders", await RomFoldersAsync(paths));
            result.SetNamedValue("folders", await ListFoldersAsync(paths, folders));
            result.SetNamedValue("internet", JsonValue.CreateBooleanValue(await InternetAsync()));
            return result;
        }

        /// <summary>Escribe y borra un archivo de prueba en E:\relix.</summary>
        private static async Task<bool> CanWriteAsync(LibraryPaths paths)
        {
            try
            {
                StorageFolder relix = await CoverService.CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), "relix");
                StorageFile probe = await relix.CreateFileAsync(".prueba-escritura", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(probe, "relix");
                await probe.DeleteAsync(StorageDeleteOption.PermanentDelete);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>{ free, total } en bytes, o null si la consola no lo informa.</summary>
        private static async Task<IJsonValue> SpaceAsync(LibraryPaths paths)
        {
            try
            {
                StorageFolder root = await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot);
                IDictionary<string, object> props = await root.Properties.RetrievePropertiesAsync(
                    new[] { "System.FreeSpace", "System.Capacity" });
                object free;
                object total;
                if (props.TryGetValue("System.FreeSpace", out free) && free != null
                    && props.TryGetValue("System.Capacity", out total) && total != null)
                {
                    var space = new JsonObject();
                    space.SetNamedValue("free", JsonValue.CreateNumberValue(Convert.ToDouble(free)));
                    space.SetNamedValue("total", JsonValue.CreateNumberValue(Convert.ToDouble(total)));
                    return space;
                }
            }
            catch (Exception)
            {
                // sin datos de espacio: la interfaz no muestra esa fila
            }
            return JsonValue.CreateNullValue();
        }

        /// <summary>Las carpetas dentro de roms (para avisar de las que Relix no usa).</summary>
        private static async Task<IJsonValue> RomFoldersAsync(LibraryPaths paths)
        {
            var names = new JsonArray();
            StorageFolder roms = await LibraryReader.TryGetFolderAsync(paths.RomRoot);
            if (roms != null)
            {
                foreach (StorageFolder folder in await roms.GetFoldersAsync())
                {
                    names.Add(JsonValue.CreateStringValue(folder.Name));
                }
            }
            return names;
        }

        /// <summary>
        /// Los archivos de cada carpeta pedida, relativa al USB ("RetroArch\\system").
        /// null si la carpeta no existe.
        /// </summary>
        private static async Task<IJsonValue> ListFoldersAsync(LibraryPaths paths, JsonArray folders)
        {
            var result = new JsonObject();
            foreach (IJsonValue value in folders)
            {
                string relative = value.GetString();
                if (relative.Contains("..") || Path.IsPathRooted(relative))
                {
                    continue; // solo carpetas dentro del USB
                }

                StorageFolder folder = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.DriveRoot, relative));
                if (folder == null)
                {
                    result.SetNamedValue(relative, JsonValue.CreateNullValue());
                    continue;
                }

                var files = new JsonArray();
                foreach (StorageFile file in await folder.GetFilesAsync())
                {
                    if (files.Count >= MaxFilesPerFolder)
                    {
                        break;
                    }
                    files.Add(JsonValue.CreateStringValue(file.Name));
                }
                result.SetNamedValue(relative, files);
            }
            return result;
        }

        /// <summary>¿Responde el servidor de portadas?</summary>
        private static async Task<bool> InternetAsync()
        {
            try
            {
                using (var request = new HttpRequestMessage(HttpMethod.Head, ThumbnailsServer))
                using (HttpResponseMessage response = await Http.SendAsync(request))
                {
                    return (int)response.StatusCode < 500;
                }
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
