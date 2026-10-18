using System;
using Windows.Storage;
using Windows.System.UserProfile;

namespace RelixShell
{
    /// <summary>
    /// The language of the shell's messages (errors shown in the interface and
    /// the log line when the interface crashes): the same as the interface's,
    /// which reports it with the setLanguage message when it opens and every time it changes.
    ///
    /// It's saved in LocalSettings, so the messages from before the interface
    /// talks (for example, "I couldn't find the roms folder") already come out in its language.
    /// The first time, it follows the console's language, just like Automatic.
    /// </summary>
    internal static class Text
    {
        private const string SettingKey = "language";

        /// <summary>true: English; false: Spanish</summary>
        public static bool English { get; private set; } = LoadSaved();

        /// <summary>The text in the interface's language.</summary>
        public static string Pick(string spanish, string english)
        {
            return English ? english : spanish;
        }

        /// <summary>"es" or "en", as the interface sends it.</summary>
        public static void SetLanguage(string language)
        {
            English = language == "en";
            try
            {
                ApplicationData.Current.LocalSettings.Values[SettingKey] = English ? "en" : "es";
            }
            catch (Exception)
            {
                // without LocalSettings it only lasts while the app is open
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
                // Not set yet: the console's language (Spanish or, otherwise, English)
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
