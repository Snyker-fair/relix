using System;
using Windows.Storage;
using Windows.System.UserProfile;

namespace RelixShell
{
    /// <summary>
    /// Idioma de los mensajes del shell (errores que se ven en la interfaz y la
    /// línea del registro cuando la interfaz se cae): el mismo de la interfaz,
    /// que lo avisa con el mensaje setLanguage al abrir y cada vez que cambia.
    ///
    /// Se guarda en LocalSettings, así los mensajes de antes de que la interfaz
    /// hable (por ejemplo, "no encontré la carpeta roms") ya salen en su idioma.
    /// La primera vez sigue al idioma de la consola, igual que Automático.
    /// </summary>
    internal static class Text
    {
        private const string SettingKey = "language";

        /// <summary>true: inglés; false: español</summary>
        public static bool English { get; private set; } = LoadSaved();

        /// <summary>El texto en el idioma de la interfaz.</summary>
        public static string Pick(string spanish, string english)
        {
            return English ? english : spanish;
        }

        /// <summary>"es" o "en", como lo manda la interfaz.</summary>
        public static void SetLanguage(string language)
        {
            English = language == "en";
            try
            {
                ApplicationData.Current.LocalSettings.Values[SettingKey] = English ? "en" : "es";
            }
            catch (Exception)
            {
                // sin LocalSettings vale solo mientras la app está abierta
            }
        }

        private static bool LoadSaved()
        {
            try
            {
                string saved = ApplicationData.Current.LocalSettings.Values[SettingKey] as string;
                if (saved == "en" || saved == "es")
                {
                    return saved == "en";
                }
                // Todavía no hay: el idioma de la consola (español o, si no, inglés)
                string first = GlobalizationPreferences.Languages.Count > 0 ? GlobalizationPreferences.Languages[0] : "";
                return !first.StartsWith("es", StringComparison.OrdinalIgnoreCase);
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
