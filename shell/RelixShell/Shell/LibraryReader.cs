using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Dónde está la biblioteca en el USB. Relix espera esta estructura en la
    /// raíz del disco:
    ///
    ///   E:\roms\psx\...                              juegos (se escanean)
    ///   E:\ES-DE\gamelists\psx\gamelist.xml          datos de ES-DE (opcional)
    ///   E:\ES-DE\downloaded_media\psx\covers\...     portadas de ES-DE (opcional)
    /// </summary>
    internal sealed class LibraryPaths
    {
        public LibraryPaths(string driveRoot)
        {
            DriveRoot = driveRoot;
            RomRoot = Path.Combine(driveRoot, "roms");
            EsdeRoot = Path.Combine(driveRoot, "ES-DE");
            MediaRoot = Path.Combine(EsdeRoot, "downloaded_media");
        }

        public string DriveRoot { get; }
        public string RomRoot { get; }
        public string EsdeRoot { get; }
        public string MediaRoot { get; }
    }

    /// <summary>Lo que se encontró en roms\&lt;consola&gt;\.</summary>
    internal sealed class RomFolder
    {
        public RomFolder(string folder, List<string> files)
        {
            Folder = folder;
            Files = files;
        }

        /// <summary>Nombre real de la carpeta (p. ej. "ps1" aunque la consola sea psx).</summary>
        public string Folder { get; }

        /// <summary>Rutas relativas con "/", p. ej. "Final Fantasy VII/FF7.m3u".</summary>
        public List<string> Files { get; }
    }

    internal static class LibraryReader
    {
        /// <summary>Hasta cuántas subcarpetas se mira (Wii U usa Juego\code\juego.rpx).</summary>
        private const int MaxDepth = 3;

        /// <summary>Tope de seguridad por consola.</summary>
        private const int MaxFiles = 5000;

        /// <summary>
        /// Carpetas que nunca tienen juegos y pueden tener miles de archivos
        /// (p. ej. content de los juegos de Wii U).
        /// </summary>
        private static readonly HashSet<string> SkipFolders =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "content", "meta", "save", "saves", "states", "screenshots", "media", "images",
            };

        /// <summary>Busca el primer disco que tenga la carpeta roms o ES-DE en la raíz.</summary>
        public static async Task<LibraryPaths> FindAsync()
        {
            // 1) Los discos que la consola reporta como extraíbles (requiere removableStorage)
            try
            {
                foreach (StorageFolder drive in await KnownFolders.RemovableDevices.GetFoldersAsync())
                {
                    if (await drive.TryGetItemAsync("roms") is StorageFolder
                        || await drive.TryGetItemAsync("ES-DE") is StorageFolder)
                    {
                        return new LibraryPaths(drive.Path);
                    }
                }
            }
            catch (Exception)
            {
                // Sin acceso a la lista de discos: probamos por letra.
            }

            // 2) Letras de unidad habituales para USB en Xbox
            foreach (char letter in "EFGHIJ")
            {
                string root = letter + ":\\";
                if (await TryGetFolderAsync(Path.Combine(root, "roms")) != null
                    || await TryGetFolderAsync(Path.Combine(root, "ES-DE")) != null)
                {
                    return new LibraryPaths(root);
                }
            }

            return null;
        }

        /// <summary>
        /// Lista los archivos de la carpeta de una consola dentro de roms.
        /// Prueba los nombres en orden (psx, ps1, playstation...) y usa el primero que exista.
        /// Devuelve null si la consola no tiene carpeta.
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

        private static async Task CollectFilesAsync(StorageFolder folder, string prefix, int depth, List<string> files)
        {
            IReadOnlyList<IStorageItem> items;
            try
            {
                items = await folder.GetItemsAsync();
            }
            catch (Exception)
            {
                return; // carpeta sin permiso: se salta
            }

            foreach (IStorageItem item in items)
            {
                if (files.Count >= MaxFiles)
                {
                    return;
                }
                if (item.Name.StartsWith(".", StringComparison.Ordinal))
                {
                    continue; // ocultos: .gitkeep, .DS_Store...
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

        /// <summary>El gamelist.xml de un sistema, o null si ese sistema no tiene.</summary>
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

    /// <summary>Error con un mensaje pensado para mostrarse en la interfaz.</summary>
    internal sealed class UserFacingException : Exception
    {
        public UserFacingException(string code, string message) : base(message)
        {
            Code = code;
        }

        /// <summary>Código para que la interfaz elija el mensaje (p. ej. emulator-missing).</summary>
        public string Code { get; }
    }
}
