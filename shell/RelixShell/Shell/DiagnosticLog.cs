using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Windows.Storage;
using Windows.Storage.FileProperties;

namespace RelixShell
{
    /// <summary>
    /// Diagnostic log on the USB drive: E:\relix\log.txt, plain text to read on
    /// the PC. One line per event (launches, errors, checkup…); the interface
    /// builds them (src/lib/core/diagnostics.js) and here they are only saved.
    ///
    /// Past MaxBytes, the file becomes log.previous.txt and a new one starts:
    /// it never grows without limit.
    /// </summary>
    internal static class DiagnosticLog
    {
        private const string Folder = "relix";
        private const string FileName = "log.txt";
        private const string PreviousName = "log.previous.txt";
        private const ulong MaxBytes = 256 * 1024;
        private const int MaxLineLength = 600;

        /// <summary>One write at a time: events arrive together when a game launches.</summary>
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(1, 1);

        /// <summary>Adds lines at the end. If the USB drive can't be written to, it does nothing.</summary>
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

            await LegacyFileNames.MigrateAsync(paths);
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
                // The log must never break anything: without permissions, it simply isn't written
            }
            finally
            {
                Gate.Release();
            }
        }

        /// <summary>The last lines of the log (to see them on the TV), oldest to newest.</summary>
        public static async Task<List<string>> ReadLastAsync(LibraryPaths paths, int count)
        {
            var result = new List<string>();
            if (paths == null)
            {
                return result;
            }
            await LegacyFileNames.MigrateAsync(paths);
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
                // No log to read: the interface shows an empty list
            }
            finally
            {
                Gate.Release();
            }
            return result;
        }
    }
}
