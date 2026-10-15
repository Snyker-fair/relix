using System;
using System.IO;
using System.Threading.Tasks;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Dónde está la biblioteca en el USB. Relix espera esta estructura en la
    /// raíz del disco:
    ///
    ///   E:\roms\psx\...                              juegos
    ///   E:\ES-DE\gamelists\psx\gamelist.xml          datos de ES-DE
    ///   E:\ES-DE\downloaded_media\psx\covers\...     portadas de ES-DE
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

    internal static class LibraryReader
    {
        /// <summary>Busca el primer disco que tenga la carpeta ES-DE en la raíz.</summary>
        public static async Task<LibraryPaths> FindAsync()
        {
            // 1) Los discos que la consola reporta como extraíbles (requiere removableStorage)
            try
            {
                foreach (StorageFolder drive in await KnownFolders.RemovableDevices.GetFoldersAsync())
                {
                    if (await drive.TryGetItemAsync("ES-DE") is StorageFolder)
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
                try
                {
                    await StorageFolder.GetFolderFromPathAsync(Path.Combine(root, "ES-DE"));
                    return new LibraryPaths(root);
                }
                catch (Exception)
                {
                    // Esa letra no existe o no tiene ES-DE.
                }
            }

            return null;
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
