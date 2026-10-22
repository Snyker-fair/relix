using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Windows.Data.Json;
using Windows.System;
using Windows.Storage;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Media;

namespace RelixShell
{
    /// <summary>
    /// The shell's only screen: a full-screen WebView2 with the Relix
    /// interface. This class is the bridge between the interface and the
    /// console (see src/lib/core/bridge.js in the web project).
    /// </summary>
    public sealed partial class MainPage : Page
    {
        /// <summary>
        /// The interface's internal address. It doesn't exist on the internet: LocalServer
        /// answers every request from the app package or from the USB drive.
        /// </summary>
        public const string Origin = "https://relix.example";

        public static MainPage Current { get; private set; }

        private readonly GamepadInput gamepad = new GamepadInput();
        private readonly CoverService covers = new CoverService();
        private LocalServer server;
        private LibraryPaths paths;

        public MainPage()
        {
            InitializeComponent();
            Current = this;
            // The theme background the interface had last time (see SavedBackground)
            Background = new SolidColorBrush(ParseColor(SavedBackground()));

            gamepad.ActionPressed += action => SendEvent("input", action);

            // On Xbox, B is also "back" for the system. We mark it as
            // handled so it doesn't take you out of Relix; the interface still gets the B.
            SystemNavigationManager.GetForCurrentView().BackRequested += (s, e) => e.Handled = true;

            Window.Current.Activated += OnWindowActivated;
            Window.Current.VisibilityChanged += OnVisibilityChanged;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            Focus(FocusState.Programmatic);

            // Background while loading, without a white flash (AARRGGBB format): the
            // theme the interface had last time (light blue, or night blue if it
            // was dark). These variables must be set before creating the WebView2.
            Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", SavedBackground());

            // Sound: the browser only lets audio play after a click or a key press.
            // In Relix the controller arrives as messages from C#, which don't
            // count as a gesture, so without this the sounds stay muted.
            string browserArguments = "--autoplay-policy=no-user-gesture-required";
#if DEBUG
            // Lets you inspect the interface from Edge on the PC (edge://inspect).
            browserArguments += " --enable-features=msEdgeDevToolsWdpRemoteDebugging";
#endif
            Environment.SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", browserArguments);

            await Web.EnsureCoreWebView2Async();
            CoreWebView2 core = Web.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsStatusBarEnabled = false;

            server = new LocalServer(core, () => paths, covers);
            core.WebMessageReceived += OnWebMessage;

            // Near the limit, WebView2 lets go of what it keeps (see OnMemoryLevelChanged)
            MemoryManager.AppMemoryUsageIncreased += (source, args) => OnMemoryLevelChanged();
            MemoryManager.AppMemoryUsageDecreased += (source, args) => OnMemoryLevelChanged();

            // If the process that draws the web page crashes, the interface loads again.
            core.ProcessFailed += (s, failure) =>
            {
                if (failure.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited)
                {
                    // The interface doesn't get to log it: the shell does
                    var ignored = DiagnosticLog.AppendAsync(paths, new[]
                    {
                        LogLine("ERROR", Text.Pick(
                            "La interfaz se cerró sola (" + failure.ProcessFailedKind + ") y se volvió a cargar",
                            "The interface closed on its own (" + failure.ProcessFailedKind + ") and was reloaded")),
                    });
                    core.Navigate(Origin + "/index.html");
                }
            };

            core.Navigate(Origin + "/index.html");
        }

        // ── Diagnostic log (E:\relix\log.txt) ───────────────────────────────

        private async Task AppendLogAsync(JsonArray values)
        {
            var lines = new List<string>();
            foreach (IJsonValue value in values)
            {
                if (value.ValueType == JsonValueType.String)
                {
                    lines.Add(value.GetString());
                }
            }
            try
            {
                await EnsurePathsAsync(refresh: false);
            }
            catch (UserFacingException)
            {
                return; // without a USB drive there's nowhere to write
            }
            await DiagnosticLog.AppendAsync(paths, lines);
        }

        /// <summary>A line in the same format the interface builds (src/lib/core/diagnostics.js).</summary>
        private static string LogLine(string kind, string text)
        {
            return DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture)
                + "  " + kind.PadRight(9) + " " + text;
        }

        // ── Theme background ────────────────────────────────────────────────

        /// <summary>Relix's light blue (light theme), in AARRGGBB.</summary>
        private const string DefaultBackground = "FFDDEBF7";

        /// <summary>The background the interface asked for last time, or the light blue.</summary>
        private static string SavedBackground()
        {
            object saved;
            ApplicationData.Current.LocalSettings.Values.TryGetValue("background", out saved);
            string color = saved as string;
            return IsColor(color) ? color : DefaultBackground;
        }

        private void SaveBackground(string color)
        {
            if (!IsColor(color))
            {
                return;
            }
            ApplicationData.Current.LocalSettings.Values["background"] = color;
            Background = new SolidColorBrush(ParseColor(color));
        }

        /// <summary>"FF0F1524": eight hexadecimal digits.</summary>
        private static bool IsColor(string value)
        {
            if (value == null || value.Length != 8)
            {
                return false;
            }
            foreach (char c in value)
            {
                if (!Uri.IsHexDigit(c))
                {
                    return false;
                }
            }
            return true;
        }

        private static Windows.UI.Color ParseColor(string aarrggbb)
        {
            return Windows.UI.Color.FromArgb(
                Convert.ToByte(aarrggbb.Substring(0, 2), 16),
                Convert.ToByte(aarrggbb.Substring(2, 2), 16),
                Convert.ToByte(aarrggbb.Substring(4, 2), 16),
                Convert.ToByte(aarrggbb.Substring(6, 2), 16));
        }

        /// <summary>App calls it when coming back from an emulator.</summary>
        public void OnReturnedFromGame()
        {
            gamepad.Prime();
            SendEvent("resumed", null);
        }

        private void OnWindowActivated(object sender, WindowActivatedEventArgs e)
        {
            if (e.WindowActivationState == CoreWindowActivationState.Deactivated)
            {
                gamepad.Pause();
            }
            else
            {
                gamepad.Resume();
            }
        }

        /// <summary>
        /// Relix is visible again (after leaving the emulator or with the Xbox button):
        /// the interface closes the session in progress and adds up the playtime.
        /// </summary>
        private void OnVisibilityChanged(object sender, VisibilityChangedEventArgs e)
        {
            if (e.Visible)
            {
                SendEvent("visible", null);
            }
        }

        private void OnWebGotFocus(object sender, RoutedEventArgs e)
        {
            // If the WebView2 ever takes the focus, we give it back to the page.
            Focus(FocusState.Programmatic);
        }

        // ── Messages from the interface ─────────────────────────────────────

        private async void OnWebMessage(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            JsonObject message;
            if (!JsonObject.TryParse(args.WebMessageAsJson, out message))
            {
                return;
            }

            string type = message.GetNamedString("type", "");
            double id = message.GetNamedNumber("id", 0);
            JsonObject payload = message.GetNamedObject("payload", new JsonObject());

            try
            {
                switch (type)
                {
                    case "ready":
                        // The interface is on screen: we start reading the controller.
                        gamepad.Start();
                        break;

                    case "appendLog":
                        // No answer: the log never makes the interface wait
                        await AppendLogAsync(payload.GetNamedArray("lines", new JsonArray()));
                        break;

                    case "readLog":
                        await EnsurePathsAsync(refresh: false);
                        var log = new JsonObject();
                        log.SetNamedValue("lines", StringArray(await DiagnosticLog.ReadLastAsync(paths, (int)payload.GetNamedNumber("count", 200))));
                        Reply(id, log);
                        break;

                    case "setLanguage":
                        // The interface changed language (or just opened): the shell's messages follow it
                        Text.SetLanguage(payload.GetNamedString("language", "es"));
                        break;

                    case "setBackground":
                        // The theme changed: that background is used from now on and the next time it opens
                        SaveBackground(payload.GetNamedString("color", DefaultBackground));
                        break;

                    case "loadLibrary":
                        Reply(id, await LoadLibraryAsync(payload));
                        break;

                    case "scanRoms":
                        Reply(id, await ScanRomsAsync(payload));
                        break;

                    case "launch":
                        await LaunchAsync(payload);
                        Reply(id, JsonValue.CreateBooleanValue(true));
                        break;

                    case "listCovers":
                        await EnsurePathsAsync(refresh: false);
                        var listed = new JsonObject();
                        listed.SetNamedValue("covers", await ListCoversAsync(SystemIds(payload)));
                        Reply(id, listed);
                        break;

                    case "coverIndex":
                        Reply(id, await CoverIndexAsync(payload));
                        break;

                    case "listMedia":
                        await EnsurePathsAsync(refresh: false);
                        Reply(id, await ListMediaAsync(payload));
                        break;

                    case "downloadCovers":
                        Reply(id, await DownloadCoversAsync(payload));
                        break;

                    case "deleteCover":
                        await EnsurePathsAsync(refresh: false);
                        await covers.DeleteCoverAsync(paths, payload.GetNamedString("system"), payload.GetNamedString("key"));
                        Reply(id, JsonValue.CreateBooleanValue(true));
                        break;

                    case "readGamelist":
                        // Y › Find info…: the gamelist as it is now, to add to it
                        await EnsurePathsAsync(refresh: false);
                        string gamelistText = await LibraryReader.ReadGamelistAsync(paths, payload.GetNamedString("system"));
                        var gamelist = new JsonObject();
                        gamelist.SetNamedValue("text", gamelistText == null ? JsonValue.CreateNullValue() : JsonValue.CreateStringValue(gamelistText));
                        Reply(id, gamelist);
                        break;

                    case "writeDiscList":
                        // A game on several discs without an .m3u: Relix makes it in E:\relix\discs
                        await EnsurePathsAsync(refresh: false);
                        var discList = new JsonObject();
                        discList.SetNamedValue("path", JsonValue.CreateStringValue(await DiscLists.WriteAsync(
                            paths, payload.GetNamedString("system"), payload.GetNamedString("name"), payload.GetNamedString("text"))));
                        Reply(id, discList);
                        break;

                    case "writeGamelist":
                        await EnsurePathsAsync(refresh: false);
                        await GamelistWriter.WriteAsync(paths, payload.GetNamedString("system"), payload.GetNamedString("text"));
                        Reply(id, JsonValue.CreateBooleanValue(true));
                        break;

                    case "renamePreview":
                    case "renameGame":
                        // Y › Rename file…: renamePreview only counts what would move
                        await EnsurePathsAsync(refresh: false);
                        Reply(id, await RomRenamer.RunAsync(paths, covers, payload, dryRun: type == "renamePreview"));
                        break;

                    case "listCollections":
                        Reply(id, await ListCollectionsAsync());
                        break;

                    case "saveCollection":
                        await EnsurePathsAsync(refresh: false);
                        await CollectionStore.SaveAsync(paths, payload.GetNamedString("file"), payload.GetNamedString("text", ""));
                        Reply(id, JsonValue.CreateBooleanValue(true));
                        break;

                    case "emulatorStatus":
                        Reply(id, await EmulatorStatusAsync(payload));
                        break;

                    case "memory":
                        // How much Relix uses now: the interface asks every so often and logs the peaks
                        Reply(id, SystemCheck.Memory());
                        break;

                    case "systemCheck":
                        await EnsurePathsAsync(refresh: false);
                        Reply(id, await SystemCheck.RunAsync(paths, payload.GetNamedArray("folders", new JsonArray())));
                        break;

                    case "loadUserData":
                        Reply(id, await LoadUserDataAsync());
                        break;

                    case "saveUserData":
                        await EnsurePathsAsync(refresh: false);
                        await UserDataStore.SaveAsync(paths, payload.GetNamedString("text"));
                        Reply(id, JsonValue.CreateBooleanValue(true));
                        break;

                    default:
                        // A message from an interface newer than this shell: it's
                        // answered so the interface doesn't keep waiting
                        if (id != 0) ReplyError(id, Text.Pick(
                            "Esta versión del shell no conoce \"" + type + "\". Actualiza el proyecto C#.",
                            "This version of the shell doesn't know \"" + type + "\". Update the C# project."), "unknown-message");
                        break;
                }
            }
            catch (UserFacingException ex)
            {
                ReplyError(id, ex.Message, ex.Code);
            }
            catch (Exception ex)
            {
                ReplyError(id, Text.Pick("Error inesperado en Relix: ", "Unexpected error in Relix: ") + ex.Message, "error");
            }
        }

        /// <summary>
        /// Finds the USB drive and reads ES-DE's data. It doesn't walk the roms
        /// folders: ScanRomsAsync does that, only for the consoles asked for.
        /// </summary>
        private async Task<IJsonValue> LoadLibraryAsync(JsonObject payload)
        {
            await EnsurePathsAsync(refresh: true);

            var gamelists = new JsonObject();
            // Each console arrives as { id: "psx", folders: ["psx", "ps1", "playstation"] }
            List<string> systemIds = SystemIds(payload);
            foreach (string id in systemIds)
            {
                string xml = await LibraryReader.ReadGamelistAsync(paths, id);
                if (xml != null)
                {
                    gamelists.SetNamedValue(id, JsonValue.CreateStringValue(xml));
                }
            }

            var result = new JsonObject();
            result.SetNamedValue("romRoot", JsonValue.CreateStringValue(paths.RomRoot));
            // Identifies the drive: if it changes, the interface drops the saved list.
            result.SetNamedValue("driveId", JsonValue.CreateStringValue(DriveId()));
            result.SetNamedValue("mediaBase", JsonValue.CreateStringValue(Origin + "/media"));
            result.SetNamedValue("thumbBase", JsonValue.CreateStringValue(Origin + "/thumb"));
            result.SetNamedValue("gamelists", gamelists);
            result.SetNamedValue("covers", await ListCoversAsync(systemIds));
            return result;
        }

        /// <summary>Identifies the drive: if it changes, the interface doesn't mix data from two USB drives.</summary>
        private string DriveId()
        {
            return paths.DriveRoot + "|" + paths.DriveName;
        }

        // ── Your data (E:\relix\data.json) ──────────────────────────────────

        /// <summary>
        /// { driveId, text, source }. text is null if the USB drive has no data yet;
        /// source says which file it came from (data.json, the previous one or a backup).
        /// </summary>
        private async Task<IJsonValue> LoadUserDataAsync()
        {
            await EnsurePathsAsync(refresh: false);
            UserDataFile file = await UserDataStore.LoadAsync(paths);

            var result = new JsonObject();
            result.SetNamedValue("driveId", JsonValue.CreateStringValue(DriveId()));
            result.SetNamedValue("text", file == null ? JsonValue.CreateNullValue() : JsonValue.CreateStringValue(file.Text));
            result.SetNamedValue("source", file == null ? JsonValue.CreateNullValue() : JsonValue.CreateStringValue(file.Source));
            return result;
        }

        // ── Covers ──────────────────────────────────────────────────────────

        /// <summary>{ psx: ["Okami (USA).png", ...] } for the consoles asked for.</summary>
        private async Task<JsonObject> ListCoversAsync(List<string> systemIds)
        {
            var result = new JsonObject();
            foreach (string id in systemIds)
            {
                result.SetNamedValue(id, StringArray(await CoverService.ListCoversAsync(paths, id)));
            }
            return result;
        }

        /// <summary>
        /// What's in downloaded_media for each console. Request:
        /// { systems: ["psx"], types: ["screenshots", "fanart", "marquees", "videos"] }.
        /// Answer: { media: { psx: { screenshots: ["Okami (USA).png"], videos: [...] } } }.
        /// </summary>
        private async Task<IJsonValue> ListMediaAsync(JsonObject payload)
        {
            JsonArray types = payload.GetNamedArray("types", new JsonArray());
            var media = new JsonObject();
            foreach (string systemId in SystemIds(payload))
            {
                var bySystem = new JsonObject();
                foreach (IJsonValue value in types)
                {
                    string type = value.GetString();
                    if (CoverService.IsMediaType(type))
                    {
                        bySystem.SetNamedValue(type, StringArray(await CoverService.ListMediaAsync(paths, systemId, type)));
                    }
                }
                media.SetNamedValue(systemId, bySystem);
            }
            var result = new JsonObject();
            result.SetNamedValue("media", media);
            return result;
        }

        /// <summary>libretro's list of covers for a console: { names: [...] }.</summary>
        private async Task<IJsonValue> CoverIndexAsync(JsonObject payload)
        {
            await EnsurePathsAsync(refresh: false);
            List<string> names = await covers.GetIndexAsync(paths, payload.GetNamedString("libretro"));
            var result = new JsonObject();
            result.SetNamedValue("names", StringArray(names));
            return result;
        }

        /// <summary>
        /// Downloads covers (or screenshots) to the USB drive. Request: { system, libretro, kind?, items: [{ key, remote }] }.
        /// kind: "covers" (the default), "screenshots" or "titlescreens".
        /// While downloading, it sends coverProgress { system, done, total } events.
        /// </summary>
        private async Task<IJsonValue> DownloadCoversAsync(JsonObject payload)
        {
            await EnsurePathsAsync(refresh: false);
            string systemId = payload.GetNamedString("system");

            var items = new List<CoverRequest>();
            foreach (IJsonValue value in payload.GetNamedArray("items", new JsonArray()))
            {
                JsonObject item = value.GetObject();
                items.Add(new CoverRequest(item.GetNamedString("key"), item.GetNamedString("remote")));
            }

            CoverDownloadResult download = await covers.DownloadAsync(
                paths, systemId, payload.GetNamedString("libretro"), payload.GetNamedString("kind", "covers"), items,
                (done, total) =>
                {
                    var progress = new JsonObject();
                    progress.SetNamedValue("event", JsonValue.CreateStringValue("coverProgress"));
                    progress.SetNamedValue("system", JsonValue.CreateStringValue(systemId));
                    progress.SetNamedValue("done", JsonValue.CreateNumberValue(done));
                    progress.SetNamedValue("total", JsonValue.CreateNumberValue(total));
                    Post(progress);
                });

            var failed = new JsonArray();
            foreach (KeyValuePair<string, string> failure in download.Failed)
            {
                var entry = new JsonObject();
                entry.SetNamedValue("key", JsonValue.CreateStringValue(failure.Key));
                entry.SetNamedValue("error", JsonValue.CreateStringValue(failure.Value));
                failed.Add(entry);
            }
            var result = new JsonObject();
            result.SetNamedValue("saved", StringArray(download.Saved));
            result.SetNamedValue("failed", failed);
            return result;
        }

        // ── Collections ─────────────────────────────────────────────────────

        /// <summary>{ collections: [{ file: "custom-Name.cfg", text: "..." }] }</summary>
        private async Task<IJsonValue> ListCollectionsAsync()
        {
            await EnsurePathsAsync(refresh: false);
            var list = new JsonArray();
            foreach (KeyValuePair<string, string> collection in await CollectionStore.ListAsync(paths))
            {
                var entry = new JsonObject();
                entry.SetNamedValue("file", JsonValue.CreateStringValue(collection.Key));
                entry.SetNamedValue("text", JsonValue.CreateStringValue(collection.Value));
                list.Add(entry);
            }
            var result = new JsonObject();
            result.SetNamedValue("collections", list);
            return result;
        }

        /// <summary>Ids from "systems", which arrive as ["psx"] or as [{ id: "psx", ... }].</summary>
        private static List<string> SystemIds(JsonObject payload)
        {
            var ids = new List<string>();
            foreach (IJsonValue value in payload.GetNamedArray("systems", new JsonArray()))
            {
                ids.Add(value.ValueType == JsonValueType.String
                    ? value.GetString()
                    : value.GetObject().GetNamedString("id"));
            }
            return ids;
        }

        private static JsonArray StringArray(IEnumerable<string> values)
        {
            var array = new JsonArray();
            foreach (string value in values)
            {
                array.Add(JsonValue.CreateStringValue(value));
            }
            return array;
        }

        /// <summary>
        /// Walks roms\&lt;console&gt;\ only for the consoles asked for. The interface
        /// uses it the first time and from Options, console by console.
        /// </summary>
        private async Task<IJsonValue> ScanRomsAsync(JsonObject payload)
        {
            await EnsurePathsAsync(refresh: false);

            var roms = new JsonObject();
            foreach (IJsonValue value in payload.GetNamedArray("systems", new JsonArray()))
            {
                JsonObject system = value.GetObject();
                string id = system.GetNamedString("id");

                var folderNames = new List<string>();
                foreach (IJsonValue name in system.GetNamedArray("folders", new JsonArray()))
                {
                    folderNames.Add(name.GetString());
                }
                if (folderNames.Count == 0)
                {
                    folderNames.Add(id);
                }

                // No folder for that console: it's reported empty, with the first accepted name
                RomFolder scan = await LibraryReader.ScanRomsAsync(paths, folderNames)
                    ?? new RomFolder(folderNames[0], new List<string>());

                var files = new JsonArray();
                foreach (string file in scan.Files)
                {
                    files.Add(JsonValue.CreateStringValue(file));
                }
                var entry = new JsonObject();
                entry.SetNamedValue("folder", JsonValue.CreateStringValue(scan.Folder));
                entry.SetNamedValue("files", files);
                roms.SetNamedValue(id, entry);
            }

            var result = new JsonObject();
            result.SetNamedValue("roms", roms);
            return result;
        }

        /// <summary>Looks for the USB drive (always if refresh is true; otherwise only the first time).</summary>
        private async Task EnsurePathsAsync(bool refresh)
        {
            if (paths == null || refresh)
            {
                paths = await LibraryReader.FindAsync();
            }
            if (paths == null)
            {
                throw new UserFacingException(
                    "no-library",
                    Text.Pick(
                        "No encontré la carpeta roms en ningún disco USB. Conecta el disco y revisa que tenga la carpeta roms en la raíz.",
                        "I couldn't find a roms folder on any USB drive. Plug in the drive and make sure it has the roms folder at its root."));
            }
        }

        /// <summary>
        /// Which emulators the console has: { status: { retroarch: true, duckstation: false } }.
        /// It asks about each protocol, the same as the "isn't installed" notice.
        /// </summary>
        private static async Task<IJsonValue> EmulatorStatusAsync(JsonObject payload)
        {
            var status = new JsonObject();
            foreach (IJsonValue value in payload.GetNamedArray("protocols", new JsonArray()))
            {
                string protocol = value.GetString();
                bool available = false;
                try
                {
                    LaunchQuerySupportStatus support = await Launcher.QueryUriSupportAsync(
                        new Uri(protocol + ":?"), LaunchQuerySupportType.Uri);
                    available = support == LaunchQuerySupportStatus.Available;
                }
                catch (Exception)
                {
                    // an invalid protocol: it counts as not installed
                }
                status.SetNamedValue(protocol, JsonValue.CreateBooleanValue(available));
            }

            var result = new JsonObject();
            result.SetNamedValue("status", status);
            return result;
        }

        private static async Task LaunchAsync(JsonObject payload)
        {
            string uriText = payload.GetNamedString("uri");
            string romPath = payload.GetNamedString("romPath", "");

            if (romPath.Length > 0 && !await LibraryReader.FileExistsAsync(romPath))
            {
                throw new UserFacingException(
                    "rom-missing",
                    Text.Pick(
                        "No encontré el juego en " + romPath + ". Revisa que esté en el USB.",
                        "I couldn't find the game at " + romPath + ". Make sure it's on the USB drive."));
            }

            var uri = new Uri(uriText);
            if (await Launcher.LaunchUriAsync(uri))
            {
                return;
            }

            // It didn't open: we find out whether it's because the emulator isn't installed.
            LaunchQuerySupportStatus support =
                await Launcher.QueryUriSupportAsync(uri, LaunchQuerySupportType.Uri);
            if (support != LaunchQuerySupportStatus.Available)
            {
                throw new UserFacingException(
                    "emulator-missing",
                    Text.Pick("No hay ninguna app instalada que abra ", "No installed app opens ") + uri.Scheme + ":");
            }
            throw new UserFacingException(
                "launch-failed",
                Text.Pick("La consola no pudo abrir el emulador.", "The console couldn't open the emulator."));
        }

        // ── Sending messages to the interface ───────────────────────────────

        private void Reply(double id, IJsonValue result)
        {
            var message = new JsonObject();
            message.SetNamedValue("id", JsonValue.CreateNumberValue(id));
            message.SetNamedValue("ok", JsonValue.CreateBooleanValue(true));
            message.SetNamedValue("result", result);
            Post(message);
        }

        private void ReplyError(double id, string error, string code)
        {
            var message = new JsonObject();
            message.SetNamedValue("id", JsonValue.CreateNumberValue(id));
            message.SetNamedValue("ok", JsonValue.CreateBooleanValue(false));
            message.SetNamedValue("error", JsonValue.CreateStringValue(error));
            message.SetNamedValue("code", JsonValue.CreateStringValue(code));
            Post(message);
        }

        /// <summary>Whether WebView2 was asked to keep the minimum.</summary>
        private bool memorySaving;

        /// <summary>
        /// WebView2 sizes what it keeps by the console's memory, not by Relix's (about
        /// 1 GB as an App): going through games with fan art, it holds on to every image
        /// it already showed. When the Xbox says Relix's use is high, WebView2 is asked
        /// to keep the minimum, and once it's back down, the usual. With Relix on screen
        /// the interface logs it, with how much it was using before and after.
        /// </summary>
        private void OnMemoryLevelChanged()
        {
            // The events arrive on another thread; the level is read here, when it changed
            bool high = MemoryManager.AppMemoryUsageLevel >= AppMemoryUsageLevel.High;
            _ = Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
            {
                CoreWebView2 core = Web.CoreWebView2;
                if (core == null || high == memorySaving) return;
                memorySaving = high;
                try
                {
                    core.MemoryUsageTargetLevel = high
                        ? CoreWebView2MemoryUsageTargetLevel.Low
                        : CoreWebView2MemoryUsageTargetLevel.Normal;
                }
                catch (Exception)
                {
                    // An older WebView2 doesn't have it: the log still says the memory was high
                }
                // While a game plays the Xbox leaves Relix 128 MB, so it's always "high": not logged
                if (high && Window.Current.Visible) SendEvent("memoryLevel", "high");
            });
        }

        private void SendEvent(string name, string action)
        {
            var message = new JsonObject();
            message.SetNamedValue("event", JsonValue.CreateStringValue(name));
            if (action != null)
            {
                message.SetNamedValue("action", JsonValue.CreateStringValue(action));
            }
            Post(message);
        }

        private void Post(JsonObject message)
        {
            Web.CoreWebView2?.PostWebMessageAsJson(message.Stringify());
        }
    }
}
