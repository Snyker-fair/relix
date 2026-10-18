using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// Saves a console's ES-DE gamelist.xml (Y › Find info…). The interface merges the
    /// new information into the text (src/lib/core/gameInfo.js › mergeGameInfo); here
    /// it's only written, safely:
    ///
    ///   - through a temporary file, so the gamelist is never left half-written;
    ///   - the first time Relix changes a gamelist, the original stays next to it as
    ///     gamelist.xml.relix-backup (it's never replaced afterwards);
    ///   - if ES-DE\gamelists\&lt;system&gt; doesn't exist yet, it's created.
    /// </summary>
    internal static class GamelistWriter
    {
        public const string BackupName = "gamelist.xml.relix-backup";

        /// <summary>An ES-DE system name: letters and digits only (it becomes a folder name).</summary>
        private static readonly Regex SystemId = new Regex("^[a-z0-9]+$");

        public static async Task WriteAsync(LibraryPaths paths, string system, string text)
        {
            if (system == null || !SystemId.IsMatch(system))
            {
                throw new UserFacingException("gamelist-invalid", Text.Pick("Esa consola no existe.", "That console doesn't exist."));
            }
            if (string.IsNullOrWhiteSpace(text) || text.IndexOf("</gameList>", StringComparison.Ordinal) < 0)
            {
                throw new UserFacingException("gamelist-invalid", Text.Pick(
                    "La lista de juegos para ES-DE no es válida: no la guardé.",
                    "The game list for ES-DE isn't valid: I didn't save it."));
            }

            StorageFolder drive = await LibraryReader.TryGetFolderAsync(paths.DriveRoot);
            if (drive == null)
            {
                throw new UserFacingException("usb-missing", Text.Pick(
                    "No encuentro el USB. Conéctalo y vuelve a intentarlo.",
                    "I can't find the USB drive. Plug it in and try again."));
            }
            StorageFolder folder = await CoverService.CreateFoldersAsync(drive, Path.GetFileName(paths.EsdeRoot), "gamelists", system);

            if (await folder.TryGetItemAsync("gamelist.xml") is StorageFile current
                && await folder.TryGetItemAsync(BackupName) == null)
            {
                await current.CopyAsync(folder, BackupName, NameCollisionOption.FailIfExists);
            }

            StorageFile temp = await folder.CreateFileAsync("gamelist.xml.tmp", CreationCollisionOption.ReplaceExisting);
            await FileIO.WriteTextAsync(temp, text);
            await temp.RenameAsync("gamelist.xml", NameCollisionOption.ReplaceExisting);
        }
    }
}
