using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Windows.Storage;
using Windows.Storage.Streams;

namespace RelixShell
{
    /// <summary>
    /// Responde los pedidos de la interfaz a https://relix.example sin pasar por la red:
    ///
    ///   /index.html, /assets/...         archivos de la interfaz (carpeta ui del paquete)
    ///   /media/psx/covers/Juego.png      imágenes de ES-DE en el USB, por su nombre exacto
    ///   /media/psx/covers/Juego          sin extensión: prueba .png, .jpg, .jpeg y .webp
    ///   /media/psx/videos/Juego.mp4      videos de ES-DE, por partes (Range) para poder repetirlos
    ///   /thumb/psx/Juego.png             miniatura JPG de esa portada (ver CoverService)
    ///
    /// Todo pasa por el mismo origen, así la interfaz no tiene problemas de CORS.
    /// </summary>
    internal sealed class LocalServer
    {
        private const string MediaPrefix = "/media/";
        private const string ThumbPrefix = "/thumb/";

        private static readonly string[] ImageExtensions = { ".png", ".jpg", ".jpeg", ".webp" };
        private static readonly string[] VideoExtensions = { ".mp4", ".webm", ".m4v" };

        /// <summary>
        /// Lo más que se manda de un video por pedido. El reproductor pide el resto
        /// a medida que lo necesita, así no se lee el archivo entero a memoria.
        /// </summary>
        private const ulong MaxVideoChunk = 2 * 1024 * 1024;

        private static readonly Dictionary<string, string> ContentTypes =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { ".html", "text/html; charset=utf-8" },
                { ".js", "text/javascript; charset=utf-8" },
                { ".css", "text/css; charset=utf-8" },
                { ".json", "application/json" },
                { ".svg", "image/svg+xml" },
                { ".png", "image/png" },
                { ".jpg", "image/jpeg" },
                { ".jpeg", "image/jpeg" },
                { ".webp", "image/webp" },
                { ".mp4", "video/mp4" },
                { ".m4v", "video/mp4" },
                { ".webm", "video/webm" },
                { ".woff2", "font/woff2" },
                { ".woff", "font/woff" },
            };

        private readonly CoreWebView2 core;
        private readonly Func<LibraryPaths> getPaths;
        private readonly CoverService covers;

        public LocalServer(CoreWebView2 core, Func<LibraryPaths> getPaths, CoverService covers)
        {
            this.core = core;
            this.getPaths = getPaths;
            this.covers = covers;
            core.AddWebResourceRequestedFilter(MainPage.Origin + "/*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += OnRequest;
        }

        private async void OnRequest(CoreWebView2 sender, CoreWebView2WebResourceRequestedEventArgs args)
        {
            var deferral = args.GetDeferral();
            try
            {
                string path = Uri.UnescapeDataString(new Uri(args.Request.Uri).AbsolutePath);
                bool isMedia = path.StartsWith(MediaPrefix, StringComparison.Ordinal);
                bool isThumb = path.StartsWith(ThumbPrefix, StringComparison.Ordinal);

                StorageFile file = isThumb
                    ? await FindThumbnailAsync(path.Substring(ThumbPrefix.Length))
                    : isMedia
                        ? await FindMediaAsync(path.Substring(MediaPrefix.Length))
                        : await FindUiFileAsync(path);

                if (file == null)
                {
                    args.Response = core.Environment.CreateWebResourceResponse(null, 404, "Not Found", "");
                    return;
                }

                if (isMedia && IsVideo(file.FileType))
                {
                    args.Response = await VideoResponseAsync(file, args.Request.Headers);
                    return;
                }

                IRandomAccessStream stream = await file.OpenReadAsync();
                args.Response = core.Environment.CreateWebResourceResponse(
                    stream, 200, "OK", Headers(file.FileType, isMedia || isThumb));
            }
            catch (Exception)
            {
                args.Response = core.Environment.CreateWebResourceResponse(null, 500, "Error", "");
            }
            finally
            {
                deferral.Complete();
            }
        }

        /// <summary>Archivos de la interfaz: carpeta ui dentro del paquete de la app.</summary>
        private static async Task<StorageFile> FindUiFileAsync(string path)
        {
            if (path.Length == 0 || path == "/")
            {
                path = "/index.html";
            }
            if (GoesUp(path))
            {
                return null;
            }

            try
            {
                return await StorageFile.GetFileFromApplicationUriAsync(new Uri("ms-appx:///ui" + path));
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>Imágenes de ES-DE: carpeta downloaded_media del USB.</summary>
        private async Task<StorageFile> FindMediaAsync(string relative)
        {
            LibraryPaths paths = getPaths();
            if (paths == null || GoesUp(relative))
            {
                return null;
            }

            string basePath = Path.Combine(paths.MediaRoot, relative.Replace('/', '\\'));

            // La interfaz ya sabe qué imágenes y videos hay (con su extensión): una sola búsqueda
            string extension = Path.GetExtension(basePath).ToLowerInvariant();
            if (Array.IndexOf(ImageExtensions, extension) >= 0 || Array.IndexOf(VideoExtensions, extension) >= 0)
            {
                return await LibraryReader.TryGetFileAsync(basePath);
            }

            foreach (string imageExtension in ImageExtensions)
            {
                StorageFile file = await LibraryReader.TryGetFileAsync(basePath + imageExtension);
                if (file != null)
                {
                    return file;
                }
            }
            return null;
        }

        /// <summary>"psx/Juego.png" -> miniatura de downloaded_media\psx\covers\Juego.png</summary>
        private async Task<StorageFile> FindThumbnailAsync(string relative)
        {
            LibraryPaths paths = getPaths();
            int slash = relative.IndexOf('/');
            if (paths == null || slash <= 0 || GoesUp(relative))
            {
                return null;
            }
            return await covers.GetThumbnailAsync(paths, relative.Substring(0, slash), relative.Substring(slash + 1));
        }

        private static bool IsVideo(string extension)
        {
            return Array.IndexOf(VideoExtensions, extension.ToLowerInvariant()) >= 0;
        }

        /// <summary>
        /// Un video: si el reproductor pide un trozo (Range: bytes=inicio-fin), se
        /// responde 206 con ese trozo (hasta 2 MB); si no, el archivo entero
        /// avisando que acepta trozos. Sin esto, el WebView2 no puede volver al
        /// principio para repetir el video.
        /// </summary>
        private async Task<CoreWebView2WebResourceResponse> VideoResponseAsync(
            StorageFile file, CoreWebView2HttpRequestHeaders requestHeaders)
        {
            string contentType;
            if (!ContentTypes.TryGetValue(file.FileType, out contentType))
            {
                contentType = "video/mp4";
            }
            ulong size = (await file.GetBasicPropertiesAsync()).Size;
            string common = "Content-Type: " + contentType + "\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache";

            ulong start;
            ulong end;
            if (!TryParseRange(requestHeaders, size, out start, out end))
            {
                IRandomAccessStream whole = await file.OpenReadAsync();
                return core.Environment.CreateWebResourceResponse(
                    whole, 200, "OK", common + "\r\nContent-Length: " + size);
            }
            if (start >= size)
            {
                return core.Environment.CreateWebResourceResponse(
                    null, 416, "Range Not Satisfiable", "Content-Range: bytes */" + size);
            }

            end = Math.Min(end, start + MaxVideoChunk - 1);
            uint length = (uint)(end - start + 1);
            var chunk = new InMemoryRandomAccessStream();
            uint read;
            using (IRandomAccessStream input = await file.OpenReadAsync())
            {
                input.Seek(start);
                IBuffer buffer = await input.ReadAsync(new Windows.Storage.Streams.Buffer(length), length, InputStreamOptions.None);
                read = buffer.Length;
                await chunk.WriteAsync(buffer);
            }
            if (read == 0)
            {
                return core.Environment.CreateWebResourceResponse(
                    null, 416, "Range Not Satisfiable", "Content-Range: bytes */" + size);
            }
            chunk.Seek(0);
            return core.Environment.CreateWebResourceResponse(
                chunk, 206, "Partial Content",
                common + "\r\nContent-Range: bytes " + start + "-" + (start + read - 1) + "/" + size
                    + "\r\nContent-Length: " + read);
        }

        /// <summary>
        /// Lee "Range: bytes=inicio-fin" (fin opcional) o "bytes=-N" (los últimos N).
        /// false si el pedido no trae Range o no se entiende.
        /// </summary>
        private static bool TryParseRange(CoreWebView2HttpRequestHeaders headers, ulong size, out ulong start, out ulong end)
        {
            start = 0;
            end = size == 0 ? 0 : size - 1;
            if (size == 0 || !headers.Contains("Range"))
            {
                return false;
            }

            string value = headers.GetHeader("Range").Trim();
            if (!value.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            string spec = value.Substring(6).Split(',')[0].Trim();
            int dash = spec.IndexOf('-');
            if (dash < 0)
            {
                return false;
            }

            string from = spec.Substring(0, dash).Trim();
            string to = spec.Substring(dash + 1).Trim();
            ulong first;
            ulong last;
            if (from.Length == 0)
            {
                if (!ulong.TryParse(to, out last) || last == 0)
                {
                    return false;
                }
                start = last >= size ? 0 : size - last;
                return true;
            }
            if (!ulong.TryParse(from, out first))
            {
                return false;
            }
            start = first;
            if (to.Length > 0 && ulong.TryParse(to, out last) && last >= first)
            {
                end = Math.Min(last, end);
            }
            return true;
        }

        /// <summary>
        /// true si la ruta intenta salir de su carpeta ("../"). Un nombre como
        /// "Juego... (USA)" sí es válido.
        /// </summary>
        private static bool GoesUp(string path)
        {
            return Array.IndexOf(path.Split('/', '\\'), "..") >= 0;
        }

        private static string Headers(string extension, bool isMedia)
        {
            string contentType;
            if (!ContentTypes.TryGetValue(extension, out contentType))
            {
                contentType = "application/octet-stream";
            }

            // Las portadas casi nunca cambian: que el WebView2 las guarde una semana.
            // Si Relix reemplaza una, la interfaz cambia la URL (?v=...).
            string cache = isMedia ? "max-age=604800" : "no-cache";
            return "Content-Type: " + contentType + "\r\nCache-Control: " + cache;
        }
    }
}
