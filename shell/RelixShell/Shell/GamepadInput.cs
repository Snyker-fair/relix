using System;
using System.Collections.Generic;
using System.Diagnostics;
using Windows.Gaming.Input;
using Windows.UI.Xaml;

namespace RelixShell
{
    /// <summary>
    /// Reads the Xbox controller natively and turns it into the interface's
    /// actions: up, down, left, right, a, b, x, y, lb, rb, lt, rt, start, view.
    ///
    /// The interface doesn't read the controller on its own on the console: that
    /// way it doesn't depend on how WebView2 handles the gamepad, and the "mouse
    /// mode" cursor never shows up. It uses the same timings as src/lib/ui/input.js.
    /// </summary>
    internal sealed class GamepadInput
    {
        private const double StickDeadzone = 0.5;

        /// <summary>The triggers are analog: they count as pressed from halfway.</summary>
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

        /// <summary>Actions that repeat while held (moving and jumping by letter).</summary>
        private static readonly HashSet<string> Repeating =
            new HashSet<string> { "up", "down", "left", "right", "lt", "rt" };

        /// <summary>Fires once per press (and repeatedly while a direction is held).</summary>
        public event Action<string> ActionPressed;

        private readonly DispatcherTimer timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(16) };
        private readonly Stopwatch clock = Stopwatch.StartNew();

        /// <summary>Held action -> the moment it's due to repeat.</summary>
        private readonly Dictionary<string, TimeSpan> held = new Dictionary<string, TimeSpan>();

        private bool started;
        private bool prime = true;

        public GamepadInput()
        {
            timer.Tick += (s, e) => Poll();

            // Listening to these events makes Gamepad.Gamepads fill up as soon as
            // the app sees a connected controller.
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
        /// Ignores the buttons that are already pressed on the next read, for
        /// example the one you used to close the emulator.
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
                    held[action] = TimeSpan.MaxValue; // it doesn't repeat until released
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

                // In Windows.Gaming.Input, positive Y is up.
                if (reading.LeftThumbstickX < -StickDeadzone) pressed.Add("left");
                if (reading.LeftThumbstickX > StickDeadzone) pressed.Add("right");
                if (reading.LeftThumbstickY > StickDeadzone) pressed.Add("up");
                if (reading.LeftThumbstickY < -StickDeadzone) pressed.Add("down");
            }
            return pressed;
        }
    }
}
