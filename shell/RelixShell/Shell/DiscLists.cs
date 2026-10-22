using System;
using System.IO;
using System.Threading.Tasks;
using Windows.Storage;

namespace RelixShell
{
    /// <summary>
    /// The disc lists Relix makes for games on several discs copied without an .m3u
    /// (src/lib/core/discs.js), in its own folder, so the games folder isn't touched:
    ///
    ///   E:\relix\discs\psx\Final Fantasy VII (USA) (Disc 1).m3u
    ///
    /// Each line is a disc's full path. The emulator opens the list and changes
    /// discs from its menu. It's written again every time the game opens, so it
    /// follows the discs that are there.
    /// </summary>
    internal static class DiscLists
    {
        private const string Folder = "relix";
        private const string ListsFolder = "discs";

        /// <summary>Writes the list and returns its full path, the one the emulator opens.</summary>
        public static async Task<string> WriteAsync(LibraryPaths paths, string system, string name, string text)
        {
            if (!IsSafeName(system) || !IsSafeName(name) || !OnlyGames(paths, text))
            {
                throw new UserFacingException("error", Text.Pick("La lista de discos no es válida.", "The disc list isn't valid."));
            }

            try
            {
                StorageFolder folder = await CoverService.CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), Folder, ListsFolder, system);
                StorageFile file = await folder.CreateFileAsync(name + ".m3u", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(file, text);
                return file.Path;
            }
            catch (Exception)
            {
                throw new UserFacingException(
                    "usb-readonly",
                    Text.Pick(
                        "No pude guardar la lista de discos en el USB. Conecta el disco al PC y vuelve a aplicarle los permisos con la herramienta de DevStore.",
                        "I couldn't save the disc list to the USB drive. Plug the drive into the PC and apply the permissions again with the DevStore tool."));
            }
        }

        /// <summary>A file or folder name, not a path ("psx", "Game (USA) (Disc 1)").</summary>
        private static bool IsSafeName(string name)
        {
            return !string.IsNullOrWhiteSpace(name)
                && name != "." && name != ".."
                && name.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
        }

        /// <summary>Every line is a file inside the roms folder.</summary>
        private static bool OnlyGames(LibraryPaths paths, string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }
            string root = paths.RomRoot.TrimEnd('\\') + "\\";
            foreach (string line in text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (!line.StartsWith(root, StringComparison.OrdinalIgnoreCase) || line.Contains("..\\"))
                {
                    return false;
                }
            }
            return true;
        }
    }
}
