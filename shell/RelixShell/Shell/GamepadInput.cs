using System;
using System.Collections.Generic;
using System.Diagnostics;
using Windows.Gaming.Input;
using Windows.UI.Xaml;

namespace RelixShell
{
    /// <summary>
    /// Lee el control de Xbox de forma nativa y lo traduce a las acciones de la
    /// interfaz: up, down, left, right, a, b, x, y, lb, rb, lt, rt, start, view.
    ///
    /// La interfaz no lee el control por su cuenta dentro de la consola: así no
    /// depende de cómo WebView2 maneje el gamepad y nunca aparece el cursor del
    /// "modo mouse". Usa los mismos tiempos que src/lib/ui/input.js.
    /// </summary>
    internal sealed class GamepadInput
    {
        private const double StickDeadzone = 0.5;

        /// <summary>Los gatillos son analógicos: cuentan como apretados desde la mitad.</summary>
        private const double TriggerThreshold = 0.5;
        private static readonly TimeSpan RepeatDelay = TimeSpan.FromMilliseconds(380);
        private static readonly TimeSpan RepeatRate = TimeSpan.FromMilliseconds(110);

        private static readonly Dictionary<GamepadButtons, string> ButtonActions =
            new Dictionary<GamepadButtons, string>
            {
                { GamepadButtons.A, "a" },
                { GamepadButtons.B, "b" },
                { GamepadButtons.X, "x" },
                { GamepadButtons.Y, "y" },
                { GamepadButtons.LeftShoulder, "lb" },
                { GamepadButtons.RightShoulder, "rb" },
                { GamepadButtons.Menu, "start" },
                { GamepadButtons.View, "view" },
                { GamepadButtons.DPadUp, "up" },
                { GamepadButtons.DPadDown, "down" },
                { GamepadButtons.DPadLeft, "left" },
                { GamepadButtons.DPadRight, "right" },
            };

        /// <summary>Acciones que se repiten al mantenerlas (moverse y saltar de letra).</summary>
        private static readonly HashSet<string> Repeating =
            new HashSet<string> { "up", "down", "left", "right", "lt", "rt" };

        /// <summary>Se dispara una vez por pulsación (y repetido al mantener una dirección).</summary>
        public event Action<string> ActionPressed;

        private readonly DispatcherTimer timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(16) };
        private readonly Stopwatch clock = Stopwatch.StartNew();

        /// <summary>Acción mantenida -> momento en que toca repetirla.</summary>
        private readonly Dictionary<string, TimeSpan> held = new Dictionary<string, TimeSpan>();

        private bool started;
        private bool prime = true;

        public GamepadInput()
        {
            timer.Tick += (s, e) => Poll();

            // Escuchar estos eventos hace que Gamepad.Gamepads se llene apenas
            // la app ve un control conectado.
            Gamepad.GamepadAdded += (s, pad) => { };
            Gamepad.GamepadRemoved += (s, pad) => { };
        }

        public void Start()
        {
            started = true;
            Resume();
        }

        public void Pause()
        {
            timer.Stop();
        }

        public void Resume()
        {
            if (!started)
            {
                return;
            }
            Prime();
            timer.Start();
        }

        /// <summary>
        /// Ignora los botones que ya están apretados en la próxima lectura, por
        /// ejemplo el que usaste para cerrar el emulador.
        /// </summary>
        public void Prime()
        {
            prime = true;
        }

        private void Poll()
        {
            TimeSpan now = clock.Elapsed;
            HashSet<string> pressed = ReadPressed();

            if (prime)
            {
                prime = false;
                held.Clear();
                foreach (string action in pressed)
                {
                    held[action] = TimeSpan.MaxValue; // no se repite hasta soltarlo
                }
                return;
            }

            foreach (string action in pressed)
            {
                TimeSpan next;
                if (!held.TryGetValue(action, out next))
                {
                    held[action] = now + RepeatDelay;
                    ActionPressed?.Invoke(action);
                }
                else if (Repeating.Contains(action) && now >= next)
                {
                    held[action] = now + RepeatRate;
                    ActionPressed?.Invoke(action);
                }
            }

            var released = new List<string>();
            foreach (string action in held.Keys)
            {
                if (!pressed.Contains(action))
                {
                    released.Add(action);
                }
            }
            foreach (string action in released)
            {
                held.Remove(action);
            }
        }

        private static HashSet<string> ReadPressed()
        {
            var pressed = new HashSet<string>();
            foreach (Gamepad pad in Gamepad.Gamepads)
            {
                GamepadReading reading = pad.GetCurrentReading();

                foreach (KeyValuePair<GamepadButtons, string> pair in ButtonActions)
                {
                    if ((reading.Buttons & pair.Key) == pair.Key)
                    {
                        pressed.Add(pair.Value);
                    }
                }

                if (reading.LeftTrigger > TriggerThreshold) pressed.Add("lt");
                if (reading.RightTrigger > TriggerThreshold) pressed.Add("rt");

                // En Windows.Gaming.Input, Y positivo es hacia arriba.
                if (reading.LeftThumbstickX < -StickDeadzone) pressed.Add("left");
                if (reading.LeftThumbstickX > StickDeadzone) pressed.Add("right");
                if (reading.LeftThumbstickY > StickDeadzone) pressed.Add("up");
                if (reading.LeftThumbstickY < -StickDeadzone) pressed.Add("down");
            }
            return pressed;
        }
    }
}
