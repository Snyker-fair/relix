using System;
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
#if DEBUG
            // Permite inspeccionar la interfaz desde Edge en el PC (edge://inspect).
            Environment.SetEnvironmentVariable(
                "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                "--enable-features=msEdgeDevToolsWdpRemoteDebugging");
#endif

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

        private async Task<IJsonValue> LoadLibraryAsync(JsonObject payload)
        {
            paths = await LibraryReader.FindAsync();
            if (paths == null)
            {
                throw new UserFacingException(
                    "no-library",
                    "No encontré la carpeta ES-DE en ningún disco USB. Conecta el disco y revisa que tenga las carpetas ES-DE y roms en la raíz.");
            }

            var gamelists = new JsonObject();
            foreach (IJsonValue system in payload.GetNamedArray("systems", new JsonArray()))
            {
                string id = system.GetString();
                string xml = await LibraryReader.ReadGamelistAsync(paths, id);
                if (xml != null)
                {
                    gamelists.SetNamedValue(id, JsonValue.CreateStringValue(xml));
                }
            }

            var result = new JsonObject();
            result.SetNamedValue("romRoot", JsonValue.CreateStringValue(paths.RomRoot));
            result.SetNamedValue("mediaBase", JsonValue.CreateStringValue(Origin + "/media"));
            result.SetNamedValue("gamelists", gamelists);
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
