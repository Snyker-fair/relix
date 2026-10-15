using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Windows.Data.Json;
using Windows.System;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

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
        private LocalServer server;
        private LibraryPaths paths;

        public MainPage()
        {
            InitializeComponent();
            Current = this;

            gamepad.ActionPressed += action => SendEvent("input", action);

            // En Xbox, B también es "volver" para el sistema. Lo marcamos como
            // manejado para que no saque a Relix; la interfaz recibe la B igual.
            SystemNavigationManager.GetForCurrentView().BackRequested += (s, e) => e.Handled = true;

            Window.Current.Activated += OnWindowActivated;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            Focus(FocusState.Programmatic);

            // Fondo celeste mientras carga, sin destello blanco (formato AARRGGBB).
            // Estas variables deben quedar antes de crear el WebView2.
            Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "FFDDEBF7");

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

            server = new LocalServer(core, () => paths);
            core.WebMessageReceived += OnWebMessage;

            // Si el proceso que dibuja la web se cae, se vuelve a cargar la interfaz.
            core.ProcessFailed += (s, failure) =>
            {
                if (failure.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited)
                {
                    core.Navigate(Origin + "/index.html");
                }
            };

            core.Navigate(Origin + "/index.html");
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
            foreach (IJsonValue value in payload.GetNamedArray("systems", new JsonArray()))
            {
                string id = value.GetObject().GetNamedString("id");
                string xml = await LibraryReader.ReadGamelistAsync(paths, id);
                if (xml != null)
                {
                    gamelists.SetNamedValue(id, JsonValue.CreateStringValue(xml));
                }
            }

            var result = new JsonObject();
            result.SetNamedValue("romRoot", JsonValue.CreateStringValue(paths.RomRoot));
            // Identifica el disco: si cambia, la interfaz descarta la lista guardada.
            result.SetNamedValue("driveId", JsonValue.CreateStringValue(paths.DriveRoot + "|" + paths.DriveName));
            result.SetNamedValue("mediaBase", JsonValue.CreateStringValue(Origin + "/media"));
            result.SetNamedValue("gamelists", gamelists);
            return result;
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
