using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Windows.Foundation;
using Windows.Graphics.Imaging;
using Windows.Storage;
using Windows.Storage.Streams;

namespace RelixShell
{
    /// <summary>Una portada para bajar: dónde guardarla y cómo se llama en libretro.</summary>
    internal sealed class CoverRequest
    {
        public CoverRequest(string key, string remote)
        {
            Key = key;
            Remote = remote;
        }

        /// <summary>Ruta del juego sin extensión, p. ej. "Okami (USA)" o "FF7 (USA)/FF7 (USA)".</summary>
        public string Key { get; }

        /// <summary>Nombre en libretro sin ".png", p. ej. "Ookami (USA)".</summary>
        public string Remote { get; }
    }

    /// <summary>Resultado de una descarga: lo que se guardó y lo que falló.</summary>
    internal sealed class CoverDownloadResult
    {
        public List<string> Saved { get; } = new List<string>();
        public List<KeyValuePair<string, string>> Failed { get; } = new List<KeyValuePair<string, string>>();
    }

    /// <summary>
    /// Portadas e imágenes de libretro-thumbnails (las mismas de RetroArch):
    ///
    ///   - la lista de nombres de cada consola, guardada un mes en E:\relix\cache\libretro\
    ///   - la descarga al USB, en la carpeta de ES-DE:
    ///       E:\ES-DE\downloaded_media\&lt;consola&gt;\covers\&lt;juego&gt;.png        (Named_Boxarts)
    ///       E:\ES-DE\downloaded_media\&lt;consola&gt;\screenshots\&lt;juego&gt;.png   (Named_Snaps)
    ///       E:\ES-DE\downloaded_media\&lt;consola&gt;\titlescreens\&lt;juego&gt;.png  (Named_Titles)
    ///   - las miniaturas JPG para la grilla, en E:\relix\cache\miniaturas\
    ///     (o en la memoria interna de la app si el USB no deja escribir)
    ///   - la lista de lo que ES-DE (o Relix) dejó en cada carpeta de downloaded_media
    /// </summary>
    internal sealed class CoverService
    {
        private const string Server = "https://thumbnails.libretro.com/";

        /// <summary>Qué se puede bajar de libretro: carpeta de ES-DE -> carpeta de libretro.</summary>
        private static readonly Dictionary<string, string> LibretroFolders =
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                { "covers", "Named_Boxarts" },
                { "screenshots", "Named_Snaps" },
                { "titlescreens", "Named_Titles" },
            };

        /// <summary>Carpetas de downloaded_media que la interfaz puede pedir listar.</summary>
        private static readonly string[] MediaTypes =
            { "covers", "screenshots", "titlescreens", "fanart", "marquees", "videos" };

        private static readonly string[] VideoExtensions = { ".mp4", ".webm", ".m4v" };

        /// <summary>Cada cuánto se vuelve a bajar la lista de nombres de una consola.</summary>
        private static readonly TimeSpan IndexMaxAge = TimeSpan.FromDays(30);

        /// <summary>Ancho de las miniaturas: el doble de una portada en la grilla (184 px).</summary>
        private const uint ThumbWidth = 368;

        /// <summary>Thumbnails folder inside E:\relix\cache (until 1.0.0, "miniaturas").</summary>
        internal const string ThumbnailFolder = "thumbnails";

        /// <summary>Descargas a la vez: el servidor es comunitario, no hay que apurarlo.</summary>
        private const int ParallelDownloads = 2;

        private static readonly string[] ImageExtensions = { ".png", ".jpg", ".jpeg", ".webp" };

        private static readonly HttpClient Http = CreateClient();

        private readonly SemaphoreSlim thumbGate = new SemaphoreSlim(2);
        private readonly Dictionary<string, Task<StorageFile>> thumbsInProgress =
            new Dictionary<string, Task<StorageFile>>(StringComparer.OrdinalIgnoreCase);

        private StorageFolder cacheRoot;
        private string cacheRootDrive;

        private static HttpClient CreateClient()
        {
            var client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Relix/0.3");
            return client;
        }

        // ── Lista de portadas de una consola ────────────────────────────────

        /// <summary>
        /// Nombres de las portadas de una consola en libretro, sin ".png".
        /// Usa la copia guardada si tiene menos de un mes; si no hay internet,
        /// usa la copia aunque sea más vieja.
        /// </summary>
        public async Task<List<string>> GetIndexAsync(LibraryPaths paths, string libretroSystem)
        {
            StorageFolder lists = await (await GetCacheRootAsync(paths))
                .CreateFolderAsync("libretro", CreationCollisionOption.OpenIfExists);
            string fileName = libretroSystem + ".txt";

            StorageFile cached = await lists.TryGetItemAsync(fileName) as StorageFile;
            if (cached != null)
            {
                var properties = await cached.GetBasicPropertiesAsync();
                if (DateTimeOffset.Now - properties.DateModified < IndexMaxAge)
                {
                    return SplitLines(await FileIO.ReadTextAsync(cached));
                }
            }

            try
            {
                string url = Server + Uri.EscapeDataString(libretroSystem) + "/Named_Boxarts/";
                List<string> names = ParseIndex(await Http.GetStringAsync(url));
                if (names.Count == 0)
                {
                    throw new InvalidOperationException(Text.Pick("La lista llegó vacía.", "The list came back empty."));
                }

                try
                {
                    StorageFile file = await lists.CreateFileAsync(fileName, CreationCollisionOption.ReplaceExisting);
                    await FileIO.WriteTextAsync(file, string.Join("\n", names));
                }
                catch (Exception)
                {
                    // Sin poder guardar la copia: se usa igual, se bajará de nuevo la próxima vez.
                }
                return names;
            }
            catch (Exception) when (cached != null)
            {
                return SplitLines(await FileIO.ReadTextAsync(cached));
            }
            catch (Exception)
            {
                throw new UserFacingException(
                    "no-internet",
                    Text.Pick(
                        "No pude conectarme al servidor de portadas (thumbnails.libretro.com). Revisa la conexión a internet de la Xbox.",
                        "I couldn't connect to the cover server (thumbnails.libretro.com). Check the Xbox's internet connection."));
            }
        }

        /// <summary>
        /// Lee la página de índice del servidor. Cada portada es un enlace:
        /// &lt;a href="Ookami%20(USA).png"&gt;
        /// </summary>
        private static List<string> ParseIndex(string html)
        {
            var names = new List<string>();
            foreach (Match match in Regex.Matches(html, "href=\"([^\"/?]+)\\.png\"", RegexOptions.IgnoreCase))
            {
                names.Add(Uri.UnescapeDataString(match.Groups[1].Value.Replace("&amp;", "&")));
            }
            return names;
        }

        private static List<string> SplitLines(string text)
        {
            var lines = new List<string>();
            foreach (string line in text.Split('\n'))
            {
                string name = line.Trim('\r');
                if (name.Length > 0)
                {
                    lines.Add(name);
                }
            }
            return lines;
        }

        // ── Descarga ────────────────────────────────────────────────────────

        /// <summary>
        /// Baja las imágenes pedidas y las guarda en la carpeta de ES-DE del USB.
        /// kind: "covers" (portadas), "screenshots" (capturas) o "titlescreens".
        /// Avisa el avance con onProgress(listas, total).
        /// </summary>
        public async Task<CoverDownloadResult> DownloadAsync(
            LibraryPaths paths, string systemId, string libretroSystem, string kind,
            IList<CoverRequest> items, Action<int, int> onProgress)
        {
            if (!LibretroFolders.ContainsKey(kind))
            {
                throw new UserFacingException("bad-kind", Text.Pick(
                    "Relix no sabe bajar imágenes de tipo \"" + kind + "\".",
                    "Relix doesn't know how to download images of type \"" + kind + "\"."));
            }

            StorageFolder covers;
            try
            {
                covers = await CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot),
                    "ES-DE", "downloaded_media", systemId, kind);
            }
            catch (Exception)
            {
                throw new UserFacingException(
                    "usb-readonly",
                    Text.Pick(
                        "No pude guardar en el USB. Conecta el disco al PC y vuelve a aplicarle los permisos con la herramienta de DevStore.",
                        "I couldn't save to the USB drive. Plug the drive into the PC and apply the permissions again with the DevStore tool."));
            }

            // Sin Task.Run: todo sigue en el hilo de la interfaz, así onProgress
            // puede mandar mensajes al WebView2 sin cambiar de hilo.
            var result = new CoverDownloadResult();
            var gate = new SemaphoreSlim(ParallelDownloads);
            var progress = new int[1];
            var tasks = new List<Task>();
            foreach (CoverRequest item in items)
            {
                tasks.Add(DownloadWithGateAsync(paths, covers, systemId, libretroSystem, kind, item, gate, result,
                    () => onProgress(++progress[0], items.Count)));
            }

            await Task.WhenAll(tasks);
            return result;
        }

        private async Task DownloadWithGateAsync(
            LibraryPaths paths, StorageFolder covers, string systemId, string libretroSystem, string kind,
            CoverRequest item, SemaphoreSlim gate, CoverDownloadResult result, Action onDone)
        {
            await gate.WaitAsync();
            try
            {
                await DownloadOneAsync(paths, covers, systemId, libretroSystem, kind, item);
                result.Saved.Add(item.Key);
            }
            catch (Exception ex)
            {
                result.Failed.Add(new KeyValuePair<string, string>(item.Key, DescribeError(ex)));
            }
            finally
            {
                gate.Release();
                onDone();
            }
        }

        private async Task DownloadOneAsync(
            LibraryPaths paths, StorageFolder covers, string systemId, string libretroSystem, string kind, CoverRequest item)
        {
            string url = Server + Uri.EscapeDataString(libretroSystem) + "/" + LibretroFolders[kind] + "/"
                + Uri.EscapeDataString(item.Remote + ".png");
            byte[] bytes = await Http.GetByteArrayAsync(url);
            if (!IsImage(bytes))
            {
                throw new InvalidOperationException(Text.Pick("El servidor no devolvió una imagen.", "The server didn't return an image."));
            }

            // La clave puede traer carpetas: "Final Fantasy VII (USA)/Final Fantasy VII (USA)"
            string[] parts = item.Key.Split('/');
            StorageFolder folder = await CreateFoldersAsync(covers, SubArray(parts, 0, parts.Length - 1));
            string stem = parts[parts.Length - 1];

            // Una sola imagen por juego: se quitan las de otro formato (p. ej. un .jpg de ES-DE)
            foreach (string extension in ImageExtensions)
            {
                if (extension != ".png" && await folder.TryGetItemAsync(stem + extension) is StorageFile old)
                {
                    await old.DeleteAsync();
                }
            }

            StorageFile file = await folder.CreateFileAsync(stem + ".png", CreationCollisionOption.ReplaceExisting);
            await FileIO.WriteBytesAsync(file, bytes);

            if (kind == "covers")
            {
                await DeleteThumbnailAsync(paths, systemId, item.Key);
            }
        }

        private static bool IsImage(byte[] bytes)
        {
            bool png = bytes.Length > 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
            bool jpeg = bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8;
            return png || jpeg;
        }

        private static string DescribeError(Exception ex)
        {
            if (ex is HttpRequestException)
            {
                return Text.Pick("No se pudo descargar.", "Couldn't download.");
            }
            if (ex is TaskCanceledException)
            {
                return Text.Pick("El servidor tardó demasiado.", "The server took too long.");
            }
            return ex.Message;
        }

        // ── Portadas que ya están en el USB ─────────────────────────────────

        /// <summary>
        /// Las portadas de una consola, con su extensión, relativas a covers:
        /// ["Okami (USA).png", "FF7 (USA)/FF7 (USA).jpg"]
        /// </summary>
        public static Task<List<string>> ListCoversAsync(LibraryPaths paths, string systemId)
        {
            return ListMediaAsync(paths, systemId, "covers");
        }

        /// <summary>¿Es una carpeta de downloaded_media que la interfaz puede pedir?</summary>
        public static bool IsMediaType(string type)
        {
            return Array.IndexOf(MediaTypes, type) >= 0;
        }

        /// <summary>
        /// Los archivos de una carpeta de downloaded_media (covers, screenshots,
        /// fanart, marquees, videos…), con su extensión y relativos a ella:
        /// ["Okami (USA).png", "FF7 (USA)/FF7 (USA).mp4"]
        /// </summary>
        public static async Task<List<string>> ListMediaAsync(LibraryPaths paths, string systemId, string type)
        {
            var found = new List<string>();
            if (!IsMediaType(type))
            {
                return found;
            }
            StorageFolder folder = await LibraryReader.TryGetFolderAsync(
                Path.Combine(paths.MediaRoot, systemId, type));
            if (folder == null)
            {
                return found;
            }

            string[] extensions = type == "videos" ? VideoExtensions : ImageExtensions;
            var files = new List<string>();
            await LibraryReader.CollectFilesAsync(folder, "", 0, files);
            foreach (string file in files)
            {
                if (Array.IndexOf(extensions, Path.GetExtension(file).ToLowerInvariant()) >= 0)
                {
                    found.Add(file);
                }
            }
            return found;
        }

        // ── Miniaturas ──────────────────────────────────────────────────────

        /// <summary>
        /// Miniatura JPG de una portada. Se crea la primera vez que se pide y
        /// queda guardada. Si no se puede crear, devuelve la portada original.
        /// </summary>
        /// <param name="relativeFile">Relativa a covers, con extensión: "Okami (USA).png"</param>
        public async Task<StorageFile> GetThumbnailAsync(LibraryPaths paths, string systemId, string relativeFile)
        {
            StorageFile original = await LibraryReader.TryGetFileAsync(
                Path.Combine(paths.MediaRoot, systemId, "covers", relativeFile.Replace('/', '\\')));
            if (original == null)
            {
                return null;
            }

            string key = systemId + "/" + WithoutExtension(relativeFile);
            Task<StorageFile> work;
            lock (thumbsInProgress)
            {
                if (!thumbsInProgress.TryGetValue(key, out work))
                {
                    work = FindOrCreateThumbnailAsync(paths, systemId, relativeFile, original);
                    thumbsInProgress[key] = work;
                }
            }

            try
            {
                return await work ?? original;
            }
            catch (Exception)
            {
                return original;
            }
            finally
            {
                lock (thumbsInProgress)
                {
                    thumbsInProgress.Remove(key);
                }
            }
        }

        private async Task<StorageFile> FindOrCreateThumbnailAsync(
            LibraryPaths paths, string systemId, string relativeFile, StorageFile original)
        {
            string[] parts = (systemId + "/" + WithoutExtension(relativeFile) + ".jpg").Split('/');
            StorageFolder thumbs = await (await GetCacheRootAsync(paths))
                .CreateFolderAsync(ThumbnailFolder, CreationCollisionOption.OpenIfExists);
            StorageFolder folder = await CreateFoldersAsync(thumbs, SubArray(parts, 0, parts.Length - 1));
            string name = parts[parts.Length - 1];

            if (await folder.TryGetItemAsync(name) is StorageFile existing)
            {
                return existing;
            }

            await thumbGate.WaitAsync();
            try
            {
                StorageFile thumb = await folder.CreateFileAsync(name, CreationCollisionOption.ReplaceExisting);
                try
                {
                    await WriteThumbnailAsync(original, thumb);
                    return thumb;
                }
                catch (Exception)
                {
                    await thumb.DeleteAsync(); // que no quede una miniatura a medias
                    throw;
                }
            }
            finally
            {
                thumbGate.Release();
            }
        }

        private static async Task WriteThumbnailAsync(StorageFile original, StorageFile thumb)
        {
            using (IRandomAccessStream input = await original.OpenReadAsync())
            {
                BitmapDecoder decoder = await BitmapDecoder.CreateAsync(input);
                uint width = decoder.PixelWidth;
                uint height = decoder.PixelHeight;
                if (width > ThumbWidth)
                {
                    height = (uint)Math.Max(1, Math.Round(height * (double)ThumbWidth / width));
                    width = ThumbWidth;
                }

                var transform = new BitmapTransform
                {
                    ScaledWidth = width,
                    ScaledHeight = height,
                    InterpolationMode = BitmapInterpolationMode.Fant,
                };
                PixelDataProvider pixelData = await decoder.GetPixelDataAsync(
                    BitmapPixelFormat.Bgra8, BitmapAlphaMode.Straight, transform,
                    ExifOrientationMode.IgnoreExifOrientation, ColorManagementMode.DoNotColorManage);
                byte[] pixels = pixelData.DetachPixelData();

                // JPG no tiene transparencia: las esquinas transparentes quedan blancas
                for (int i = 0; i < pixels.Length; i += 4)
                {
                    int alpha = pixels[i + 3];
                    if (alpha < 255)
                    {
                        pixels[i] = (byte)((pixels[i] * alpha + 255 * (255 - alpha)) / 255);
                        pixels[i + 1] = (byte)((pixels[i + 1] * alpha + 255 * (255 - alpha)) / 255);
                        pixels[i + 2] = (byte)((pixels[i + 2] * alpha + 255 * (255 - alpha)) / 255);
                        pixels[i + 3] = 255;
                    }
                }

                using (IRandomAccessStream output = await thumb.OpenAsync(FileAccessMode.ReadWrite))
                {
                    var quality = new BitmapPropertySet
                    {
                        { "ImageQuality", new BitmapTypedValue(0.85f, PropertyType.Single) },
                    };
                    BitmapEncoder encoder = await BitmapEncoder.CreateAsync(BitmapEncoder.JpegEncoderId, output, quality);
                    encoder.SetPixelData(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Ignore, width, height, 96, 96, pixels);
                    await encoder.FlushAsync();
                }
            }
        }

        /// <summary>
        /// Borra la portada de un juego (en cualquier formato) y su miniatura.
        /// Así queda con la portada de color. key: ruta del juego sin extensión.
        /// </summary>
        public async Task DeleteCoverAsync(LibraryPaths paths, string systemId, string key)
        {
            string basePath = Path.Combine(paths.MediaRoot, systemId, "covers", key.Replace('/', '\\'));
            foreach (string extension in ImageExtensions)
            {
                StorageFile file = await LibraryReader.TryGetFileAsync(basePath + extension);
                if (file != null)
                {
                    await file.DeleteAsync();
                }
            }
            await DeleteThumbnailAsync(paths, systemId, key);
        }

        /// <summary>Al reemplazar una portada, su miniatura vieja se borra.</summary>
        private async Task DeleteThumbnailAsync(LibraryPaths paths, string systemId, string key)
        {
            try
            {
                StorageFolder root = await GetCacheRootAsync(paths);
                StorageFile old = await LibraryReader.TryGetFileAsync(
                    Path.Combine(root.Path, ThumbnailFolder, systemId, key.Replace('/', '\\') + ".jpg"));
                if (old != null)
                {
                    await old.DeleteAsync();
                }
            }
            catch (Exception)
            {
                // Si no se pudo borrar, se verá la miniatura anterior hasta borrar la caché.
            }
        }

        // ── Carpetas ────────────────────────────────────────────────────────

        /// <summary>
        /// Carpeta de caché: E:\relix\cache en el USB, para que sobreviva a
        /// reinstalar la app. Si el USB no deja escribir, la memoria interna.
        /// </summary>
        private async Task<StorageFolder> GetCacheRootAsync(LibraryPaths paths)
        {
            if (cacheRoot != null && cacheRootDrive == paths.DriveRoot)
            {
                return cacheRoot;
            }

            await LegacyFileNames.MigrateAsync(paths);
            try
            {
                cacheRoot = await CreateFoldersAsync(
                    await StorageFolder.GetFolderFromPathAsync(paths.DriveRoot), "relix", "cache");
            }
            catch (Exception)
            {
                cacheRoot = await ApplicationData.Current.LocalCacheFolder
                    .CreateFolderAsync("cache", CreationCollisionOption.OpenIfExists);
            }
            cacheRootDrive = paths.DriveRoot;
            return cacheRoot;
        }

        internal static async Task<StorageFolder> CreateFoldersAsync(StorageFolder parent, params string[] names)
        {
            StorageFolder folder = parent;
            foreach (string name in names)
            {
                folder = await folder.CreateFolderAsync(name, CreationCollisionOption.OpenIfExists);
            }
            return folder;
        }

        private static string[] SubArray(string[] source, int start, int length)
        {
            var result = new string[length];
            Array.Copy(source, start, result, 0, length);
            return result;
        }

        private static string WithoutExtension(string relativeFile)
        {
            int slash = relativeFile.LastIndexOf('/');
            int dot = relativeFile.LastIndexOf('.');
            return dot > slash + 1 ? relativeFile.Substring(0, dot) : relativeFile;
        }
    }
}
