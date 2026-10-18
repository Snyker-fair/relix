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
    /// Answers the interface's requests to https://relix.example without going through the network:
    ///
    ///   /index.html, /assets/...         the interface's files (the package's ui folder)
    ///   /media/psx/covers/Game.png       ES-DE images on the USB drive, by their exact name
    ///   /media/psx/covers/Game           without an extension: tries .png, .jpg, .jpeg and .webp
    ///   /media/psx/videos/Game.mp4       ES-DE videos, in ranges (Range) so they can loop
    ///   /thumb/psx/Game.png              the JPG thumbnail of that cover (see CoverService)
    ///
    /// Everything goes through the same origin, so the interface has no CORS problems.
    /// </summary>
    internal sealed class LocalServer
    {
        private const string MediaPrefix = "/media/";
        private const string ThumbPrefix = "/thumb/";

        private static readonly string[] ImageExtensions = { ".png", ".jpg", ".jpeg", ".webp" };
        private static readonly string[] VideoExtensions = { ".mp4", ".webm", ".m4v" };

        /// <summary>
        /// The most of a video sent per request. The player asks for the rest
        /// as it needs it, so the whole file isn't read into memory.
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

        /// <summary>The interface's files: the ui folder inside the app package.</summary>
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

        /// <summary>ES-DE's images: the downloaded_media folder on the USB drive.</summary>
        private async Task<StorageFile> FindMediaAsync(string relative)
        {
            LibraryPaths paths = getPaths();
            if (paths == null || GoesUp(relative))
            {
                return null;
            }

            string basePath = Path.Combine(paths.MediaRoot, relative.Replace('/', '\\'));

            // The interface already knows which images and videos there are (with their extension): a single lookup
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

        /// <summary>"psx/Game.png" -> the thumbnail of downloaded_media\psx\covers\Game.png</summary>
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
        /// A video: if the player asks for a piece (Range: bytes=start-end), it's
        /// answered with a 206 and that piece (up to 2 MB); otherwise the whole file,
        /// saying it accepts ranges. Without this, the WebView2 can't go back to
        /// the start to loop the video.
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
        /// Reads "Range: bytes=start-end" (end optional) or "bytes=-N" (the last N).
        /// false if the request has no Range or it can't be understood.
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
        /// true if the path tries to leave its folder ("../"). A name like
        /// "Game... (USA)" is valid.
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

            // Covers almost never change: let the WebView2 keep them for a week.
            // If Relix replaces one, the interface changes the URL (?v=...).
            string cache = isMedia ? "max-age=604800" : "no-cache";
            return "Content-Type: " + contentType + "\r\nCache-Control: " + cache;
        }
    }
}
