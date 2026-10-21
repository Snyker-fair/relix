using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Windows.Data.Json;
using Windows.Storage;
using Windows.System;
using Windows.System.Profile;

namespace RelixShell
{
    /// <summary>
    /// The system checkup (Options › Checkup and the first run): what Relix
    /// can check about the USB drive and the console. Here it's only measured; the
    /// interface decides what each thing means and how to fix it (src/lib/core/systemCheck.js).
    /// </summary>
    internal static class SystemCheck
    {
        /// <summary>The cover server: if it answers, there's internet to download them.</summary>
        private const string ThumbnailsServer = "https://thumbnails.libretro.com/";

        /// <summary>A cap on files per folder (the BIOS folders have a few).</summary>
        private const int MaxFilesPerFolder = 300;

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };

        /// <summary>
        /// { drive, writable, space: { free, total } | null, romFolders: [...],
        ///   folders: { "RetroArch\\system": ["scph5501.bin"] | null }, internet,
        ///   memory: { xbox, expectedLimit, limit, usage } | null }
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
            result.SetNamedValue("memory", Memory());
            return result;
        }

        /// <summary>
        /// { xbox, expectedLimit, limit, usage } in bytes, or null if the console doesn't say.
        /// On the Xbox an app gets about 1 GB and a game about 5 GB, by its type in Dev Home
        /// (View details › App type), and the limit starts low and grows: ExpectedAppMemoryUsageLimit
        /// is the one it will reach, and that tells the interface which type Relix is.
        /// </summary>
        public static IJsonValue Memory()
        {
            try
            {
                var memory = new JsonObject();
                memory.SetNamedValue("xbox", JsonValue.CreateBooleanValue(
                    AnalyticsInfo.VersionInfo.DeviceFamily == "Windows.Xbox"));
                memory.SetNamedValue("expectedLimit", JsonValue.CreateNumberValue(MemoryManager.ExpectedAppMemoryUsageLimit));
                memory.SetNamedValue("limit", JsonValue.CreateNumberValue(MemoryManager.AppMemoryUsageLimit));
                memory.SetNamedValue("usage", JsonValue.CreateNumberValue(MemoryManager.AppMemoryUsage));
                return memory;
            }
            catch (Exception)
            {
                // no memory data: the interface doesn't show that row
                return JsonValue.CreateNullValue();
            }
        }

        /// <summary>Writes and deletes a test file in E:\relix.</summary>
        private static async Task<bool> CanWriteAsync(LibraryPaths paths)
        {
            try
            {
                StorageFolder relix = await CoverService.CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), "relix");
                StorageFile probe = await relix.CreateFileAsync(".write-test", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(probe, "relix");
                await probe.DeleteAsync(StorageDeleteOption.PermanentDelete);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>{ free, total } in bytes, or null if the console doesn't report it.</summary>
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
                // no space data: the interface doesn't show that row
            }
            return JsonValue.CreateNullValue();
        }

        /// <summary>The folders inside roms (to point out the ones Relix doesn't use).</summary>
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
        /// The files of each folder asked for, relative to the USB drive ("RetroArch\\system").
        /// null if the folder doesn't exist.
        /// </summary>
        private static async Task<IJsonValue> ListFoldersAsync(LibraryPaths paths, JsonArray folders)
        {
            var result = new JsonObject();
            foreach (IJsonValue value in folders)
            {
                string relative = value.GetString();
                if (relative.Contains("..") || Path.IsPathRooted(relative))
                {
                    continue; // only folders inside the USB drive
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

        /// <summary>Does the cover server answer?</summary>
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
