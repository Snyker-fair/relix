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
    ///   /thumb/psx/Game.png              the JPG thumbnail of that cover (see CoverService)
    ///
    /// Everything goes through the same origin, so the interface has no CORS problems.
    /// ES-DE's videos aren't served: Relix doesn't play them (they'd cost more memory
    /// and smoothness than it can spare as an App).
    /// </summary>
    internal sealed class LocalServer
    {
        private const string MediaPrefix = "/media/";
        private const string ThumbPrefix = "/thumb/";

        private static readonly string[] ImageExtensions = { ".png", ".jpg", ".jpeg", ".webp" };

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

            // The interface already knows which images there are (with their extension): a single lookup
            string extension = Path.GetExtension(basePath).ToLowerInvariant();
            if (Array.IndexOf(ImageExtensions, extension) >= 0)
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
