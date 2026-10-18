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
    /// Relix's entry point on the Xbox.
    /// It opens from Dev Home or, when an emulator closes, with the relix: protocol
    /// (the interface asks for it with launchOnExit=relix: on every launch).
    /// </summary>
    sealed partial class App : Application
    {
        public App()
        {
            InitializeComponent();

            // No "mouse mode" cursor: Relix is used only with the controller.
            RequiresPointerMode = ApplicationRequiresPointerMode.WhenRequested;

            // The Relix interface plays its own sounds, not XAML's.
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
                // We're back from an emulator
                MainPage.Current?.OnReturnedFromGame();
            }
        }

        private void Start(bool prelaunch)
        {
            // Use the whole TV screen; the interface handles the safe margins.
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
            throw new Exception("Failed to load Page " + e.SourcePageType.FullName);
        }

        private void OnSuspending(object sender, SuspendingEventArgs e)
        {
            var deferral = e.SuspendingOperation.GetDeferral();
            deferral.Complete();
        }
    }
}
