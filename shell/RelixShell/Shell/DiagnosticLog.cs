using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Windows.Storage;
using Windows.Storage.FileProperties;

namespace RelixShell
{
    /// <summary>
    /// Registro de diagnóstico en el USB: E:\relix\registro.txt, texto simple que
    /// se lee en el PC. Una línea por evento (lanzamientos, errores, revisión…);
    /// las arma la interfaz (src/lib/core/diagnostics.js) y aquí solo se guardan.
    ///
    /// Cuando pasa de MaxBytes, el archivo pasa a ser registro.anterior.txt y se
    /// empieza uno nuevo: nunca crece sin límite.
    /// </summary>
    internal static class DiagnosticLog
    {
        private const string Folder = "relix";
        private const string FileName = "registro.txt";
        private const string PreviousName = "registro.anterior.txt";
        private const ulong MaxBytes = 256 * 1024;
        private const int MaxLineLength = 600;

        /// <summary>Una escritura a la vez: los eventos llegan juntos al lanzar un juego.</summary>
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(1, 1);

        /// <summary>Agrega líneas al final. Si el USB no deja escribir, no hace nada.</summary>
        public static async Task AppendAsync(LibraryPaths paths, IEnumerable<string> lines)
        {
            var clean = new List<string>();
            foreach (string line in lines)
            {
                string one = (line ?? "").Replace("\r", " ").Replace("\n", " ");
                clean.Add(one.Length > MaxLineLength ? one.Substring(0, MaxLineLength) + "…" : one);
            }
            if (clean.Count == 0 || paths == null)
            {
                return;
            }

            await Gate.WaitAsync();
            try
            {
                StorageFolder relix = await CoverService.CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), Folder);
                StorageFile file = await relix.CreateFileAsync(FileName, CreationCollisionOption.OpenIfExists);

                BasicProperties props = await file.GetBasicPropertiesAsync();
                if (props.Size > MaxBytes)
                {
                    await file.RenameAsync(PreviousName, NameCollisionOption.ReplaceExisting);
                    file = await relix.CreateFileAsync(FileName, CreationCollisionOption.OpenIfExists);
                }

                await FileIO.AppendLinesAsync(file, clean);
            }
            catch (Exception)
            {
                // El registro nunca debe romper nada: sin permisos, simplemente no se anota
            }
            finally
            {
                Gate.Release();
            }
        }

        /// <summary>Las últimas líneas del registro (para verlas en la TV), de la más vieja a la más nueva.</summary>
        public static async Task<List<string>> ReadLastAsync(LibraryPaths paths, int count)
        {
            var result = new List<string>();
            if (paths == null)
            {
                return result;
            }
            await Gate.WaitAsync();
            try
            {
                StorageFolder relix = await LibraryReader.TryGetFolderAsync(System.IO.Path.Combine(paths.DriveRoot, Folder));
                if (relix == null)
                {
                    return result;
                }
                IStorageItem item = await relix.TryGetItemAsync(FileName);
                if (!(item is StorageFile))
                {
                    return result;
                }
                IList<string> lines = await FileIO.ReadLinesAsync((StorageFile)item);
                int start = Math.Max(0, lines.Count - count);
                for (int i = start; i < lines.Count; i++)
                {
                    if (lines[i].Length > 0)
                    {
                        result.Add(lines[i]);
                    }
                }
            }
            catch (Exception)
            {
                // Sin registro que leer: la interfaz muestra la lista vacía
            }
            finally
            {
                Gate.Release();
            }
            return result;
        }
    }
}
