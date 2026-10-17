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
    /// La única pantalla del shell: un WebView2 a pantalla completa con la
    /// interfaz de Relix. Esta clase hace de puente entre la interfaz y la
    /// consola (ver src/lib/core/bridge.js en el proyecto web).
    /// </summary>
    public sealed partial class MainPage : Page
    {
        /// <summary>
        /// Dirección interna de la interfaz. No existe en internet: LocalServer
        /// responde cada pedido desde el paquete de la app o desde el USB.
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
            // El fondo del tema que tenía la interfaz la última vez (ver SavedBackground)
            Background = new SolidColorBrush(ParseColor(SavedBackground()));

            gamepad.ActionPressed += action => SendEvent("input", action);

            // En Xbox, B también es "volver" para el sistema. Lo marcamos como
            // manejado para que no saque a Relix; la interfaz recibe la B igual.
            SystemNavigationManager.GetForCurrentView().BackRequested += (s, e) => e.Handled = true;

            Window.Current.Activated += OnWindowActivated;
            Window.Current.VisibilityChanged += OnVisibilityChanged;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            Focus(FocusState.Programmatic);

            // Fondo mientras carga, sin destello blanco (formato AARRGGBB): el del
            // tema que tenía la interfaz la última vez (celeste, o azul noche si
            // estaba en oscuro). Estas variables deben quedar antes de crear el WebView2.
            Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", SavedBackground());

            // Sonido: el navegador solo deja sonar audio después de un clic o una
            // tecla. En Relix el control llega por mensajes desde C#, que no
            // cuentan como gesto, así que sin esto los sonidos quedan mudos.
            string browserArguments = "--autoplay-policy=no-user-gesture-required";
#if DEBUG
            // Permite inspeccionar la interfaz desde Edge en el PC (edge://inspect).
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

            // Si el proceso que dibuja la web se cae, se vuelve a cargar la interfaz.
            core.ProcessFailed += (s, failure) =>
            {
                if (failure.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited)
                {
                    // La interfaz no alcanza a anotarlo: lo anota el shell
                    var ignored = DiagnosticLog.AppendAsync(paths, new[]
                    {
                        LogLine("ERROR", "La interfaz se cerró sola (" + failure.ProcessFailedKind + ") y se volvió a cargar"),
                    });
                    core.Navigate(Origin + "/index.html");
                }
            };

            core.Navigate(Origin + "/index.html");
        }

        // ── Registro de diagnóstico (E:\relix\registro.txt) ─────────────────

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
                return; // sin USB no hay dónde anotar
            }
            await DiagnosticLog.AppendAsync(paths, lines);
        }

        /// <summary>Una línea con el mismo formato que arma la interfaz (src/lib/core/diagnostics.js).</summary>
        private static string LogLine(string kind, string text)
        {
            return DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture)
                + "  " + kind.PadRight(9) + " " + text;
        }

        // ── Fondo del tema ──────────────────────────────────────────────────

        /// <summary>Celeste de Relix (tema claro), en AARRGGBB.</summary>
        private const string DefaultBackground = "FFDDEBF7";

        /// <summary>El fondo que pidió la interfaz la última vez, o el celeste.</summary>
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

        /// <summary>"FF0F1524": ocho dígitos hexadecimales.</summary>
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

        /// <summary>Lo llama App al volver desde un emulador.</summary>
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
        /// Relix volvió a verse (al salir del emulador o con el botón Xbox): la
        /// interfaz cierra la partida en curso y suma el tiempo jugado.
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
            // Si el WebView2 llega a tomar el foco, se lo devolvemos a la página.
            Focus(FocusState.Programmatic);
        }

        // ── Mensajes de la interfaz ─────────────────────────────────────────

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
                        // La interfaz ya está en pantalla: empezamos a leer el control.
                        gamepad.Start();
                        break;

                    case "appendLog":
                        // Sin respuesta: el registro nunca hace esperar a la interfaz
                        await AppendLogAsync(payload.GetNamedArray("lines", new JsonArray()));
                        break;

                    case "readLog":
                        await EnsurePathsAsync(refresh: false);
                        var log = new JsonObject();
                        log.SetNamedValue("lines", StringArray(await DiagnosticLog.ReadLastAsync(paths, (int)payload.GetNamedNumber("count", 200))));
                        Reply(id, log);
                        break;

                    case "setBackground":
                        // El tema cambió: se usa ese fondo desde ahora y al abrir la próxima vez
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
                        // Un mensaje de una interfaz más nueva que este shell: se
                        // responde para que la interfaz no se quede esperando
                        if (id != 0) ReplyError(id, "Esta versión del shell no conoce \"" + type + "\". Actualiza el proyecto C#.", "unknown-message");
                        break;
                }
            }
            catch (UserFacingException ex)
            {
                ReplyError(id, ex.Message, ex.Code);
            }
            catch (Exception ex)
            {
                ReplyError(id, "Error inesperado en Relix: " + ex.Message, "error");
            }
        }

        /// <summary>
        /// Encuentra el USB y lee los datos de ES-DE. No recorre las carpetas de
        /// roms: eso lo hace ScanRomsAsync, solo para las consolas que se pidan.
        /// </summary>
        private async Task<IJsonValue> LoadLibraryAsync(JsonObject payload)
        {
            await EnsurePathsAsync(refresh: true);

            var gamelists = new JsonObject();
            // Cada consola llega como { id: "psx", folders: ["psx", "ps1", "playstation"] }
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
            // Identifica el disco: si cambia, la interfaz descarta la lista guardada.
            result.SetNamedValue("driveId", JsonValue.CreateStringValue(DriveId()));
            result.SetNamedValue("mediaBase", JsonValue.CreateStringValue(Origin + "/media"));
            result.SetNamedValue("thumbBase", JsonValue.CreateStringValue(Origin + "/thumb"));
            result.SetNamedValue("gamelists", gamelists);
            result.SetNamedValue("covers", await ListCoversAsync(systemIds));
            return result;
        }

        /// <summary>Identifica el disco: si cambia, la interfaz no mezcla datos de dos USB.</summary>
        private string DriveId()
        {
            return paths.DriveRoot + "|" + paths.DriveName;
        }

        // ── Tus datos (E:\relix\datos.json) ──────────────────────────────────

        /// <summary>
        /// { driveId, text, source }. text es null si el USB aún no tiene datos;
        /// source dice de qué archivo salió (datos.json, la anterior o un respaldo).
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

        // ── Portadas ────────────────────────────────────────────────────────

        /// <summary>{ psx: ["Okami (USA).png", ...] } para las consolas pedidas.</summary>
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
        /// Lo que hay en downloaded_media para cada consola. Pedido:
        /// { systems: ["psx"], types: ["screenshots", "fanart", "marquees", "videos"] }.
        /// Respuesta: { media: { psx: { screenshots: ["Okami (USA).png"], videos: [...] } } }.
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

        /// <summary>Lista de portadas de libretro para una consola: { names: [...] }.</summary>
        private async Task<IJsonValue> CoverIndexAsync(JsonObject payload)
        {
            await EnsurePathsAsync(refresh: false);
            List<string> names = await covers.GetIndexAsync(paths, payload.GetNamedString("libretro"));
            var result = new JsonObject();
            result.SetNamedValue("names", StringArray(names));
            return result;
        }

        /// <summary>
        /// Baja portadas (o capturas) al USB. Pedido: { system, libretro, kind?, items: [{ key, remote }] }.
        /// kind: "covers" (por defecto), "screenshots" o "titlescreens".
        /// Mientras baja, manda eventos coverProgress { system, done, total }.
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

        // ── Colecciones ─────────────────────────────────────────────────────

        /// <summary>{ collections: [{ file: "custom-Nombre.cfg", text: "..." }] }</summary>
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

        /// <summary>Ids de "systems", que llegan como ["psx"] o como [{ id: "psx", ... }].</summary>
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
        /// Recorre roms\&lt;consola&gt;\ solo para las consolas pedidas. La interfaz
        /// lo usa la primera vez y desde Opciones, consola por consola.
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

                // Sin carpeta para esa consola: se informa vacía, con el primer nombre aceptado
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

        /// <summary>Busca el USB (siempre si refresh es true; si no, solo la primera vez).</summary>
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
                    "No encontré la carpeta roms en ningún disco USB. Conecta el disco y revisa que tenga la carpeta roms en la raíz.");
            }
        }

        /// <summary>
        /// Qué emuladores tiene la consola: { status: { retroarch: true, duckstation: false } }.
        /// Pregunta por cada protocolo, igual que el aviso de "no está instalado".
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
                    // protocolo no válido: queda como no instalado
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
                    "No encontré el juego en " + romPath + ". Revisa que esté en el USB.");
            }

            var uri = new Uri(uriText);
            if (await Launcher.LaunchUriAsync(uri))
            {
                return;
            }

            // No se abrió: averiguamos si es porque el emulador no está instalado.
            LaunchQuerySupportStatus support =
                await Launcher.QueryUriSupportAsync(uri, LaunchQuerySupportType.Uri);
            if (support != LaunchQuerySupportStatus.Available)
            {
                throw new UserFacingException(
                    "emulator-missing",
                    "No hay ninguna app instalada que abra " + uri.Scheme + ":");
            }
            throw new UserFacingException("launch-failed", "La consola no pudo abrir el emulador.");
        }

        // ── Envío de mensajes a la interfaz ─────────────────────────────────

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
