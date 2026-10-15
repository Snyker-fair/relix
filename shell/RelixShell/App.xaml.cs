using System;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Activation;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Navigation;

namespace RelixShell
{
    /// <summary>
    /// Punto de entrada de Relix en la Xbox.
    /// Se abre desde Dev Home o, al cerrar un emulador, con el protocolo relix:
    /// (la interfaz lo pide con launchOnExit=relix: en cada lanzamiento).
    /// </summary>
    sealed partial class App : Application
    {
        public App()
        {
            InitializeComponent();

            // Sin cursor de "modo mouse": Relix se maneja solo con el control.
            RequiresPointerMode = ApplicationRequiresPointerMode.WhenRequested;

            // Los sonidos los pone la interfaz de Relix, no los de XAML.
            ElementSoundPlayer.State = ElementSoundPlayerState.Off;

            Suspending += OnSuspending;
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            Start(e.PrelaunchActivated);
        }

        protected override void OnActivated(IActivatedEventArgs args)
        {
            Start(false);

            if (args.Kind == ActivationKind.Protocol)
            {
                // Volvimos desde un emulador
                MainPage.Current?.OnReturnedFromGame();
            }
        }

        private void Start(bool prelaunch)
        {
            // Usar toda la pantalla de la TV; los márgenes seguros los maneja la interfaz.
            ApplicationView.GetForCurrentView().SetDesiredBoundsMode(ApplicationViewBoundsMode.UseCoreWindow);

            Frame rootFrame = Window.Current.Content as Frame;
            if (rootFrame == null)
            {
                rootFrame = new Frame();
                rootFrame.NavigationFailed += OnNavigationFailed;
                Window.Current.Content = rootFrame;
            }

            if (prelaunch)
            {
                return;
            }

            if (rootFrame.Content == null)
            {
                rootFrame.Navigate(typeof(MainPage));
            }

            Window.Current.Activate();
        }

        private void OnNavigationFailed(object sender, NavigationFailedEventArgs e)
        {
            throw new Exception("No se pudo cargar la página " + e.SourcePageType.FullName);
        }

        private void OnSuspending(object sender, SuspendingEventArgs e)
        {
            var deferral = e.SuspendingOperation.GetDeferral();
            deferral.Complete();
        }
    }
}
