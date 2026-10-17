using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Colecciones personalizadas en el formato de ES-DE, en el USB:
    ///
    ///   E:\ES-DE\collections\custom-&lt;Nombre&gt;.cfg
    ///
    /// Una línea por juego (%ROMPATH%/psx/Juego.chd). La interfaz arma y
    /// entiende el contenido (ver src/lib/core/collections.js); aquí solo se
    /// leen y escriben los archivos.
    /// </summary>
    internal static class CollectionStore
    {
        private const string Prefix = "custom-";
        private const string Extension = ".cfg";

        /// <summary>Todas las colecciones: nombre de archivo y contenido.</summary>
        public static async Task<List<KeyValuePair<string, string>>> ListAsync(LibraryPaths paths)
        {
            var collections = new List<KeyValuePair<string, string>>();
            StorageFolder folder = await LibraryReader.TryGetFolderAsync(Path.Combine(paths.EsdeRoot, "collections"));
            if (folder == null)
            {
                return collections;
            }

            foreach (StorageFile file in await folder.GetFilesAsync())
            {
                if (IsCollectionFile(file.Name))
                {
                    collections.Add(new KeyValuePair<string, string>(file.Name, await FileIO.ReadTextAsync(file)));
                }
            }
            return collections;
        }

        /// <summary>Guarda una colección. Si el contenido queda vacío, se borra el archivo.</summary>
        public static async Task SaveAsync(LibraryPaths paths, string fileName, string text)
        {
            if (!IsCollectionFile(fileName))
            {
                throw new UserFacingException("error", Text.Pick("Nombre de colección no válido: ", "Invalid collection name: ") + fileName);
            }

            try
            {
                StorageFolder folder = await CoverService.CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), "ES-DE", "collections");

                if (string.IsNullOrWhiteSpace(text))
                {
                    if (await folder.TryGetItemAsync(fileName) is StorageFile old)
                    {
                        await old.DeleteAsync();
                    }
                    return;
                }

                StorageFile file = await folder.CreateFileAsync(fileName, CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(file, text);
            }
            catch (Exception)
            {
                throw new UserFacingException(
                    "usb-readonly",
                    Text.Pick(
                        "No pude guardar la colección en el USB. Conecta el disco al PC y vuelve a aplicarle los permisos con la herramienta de DevStore.",
                        "I couldn't save the collection to the USB drive. Plug the drive into the PC and apply the permissions again with the DevStore tool."));
            }
        }

        /// <summary>"custom-Nombre.cfg", sin carpetas ni caracteres raros.</summary>
        private static bool IsCollectionFile(string name)
        {
            return name.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)
                && name.EndsWith(Extension, StringComparison.OrdinalIgnoreCase)
                && name.Length > Prefix.Length + Extension.Length
                && name.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
        }
    }
}
