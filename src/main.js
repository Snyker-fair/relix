import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { startLanguage } from './lib/ui/language.svelte.js'
import { theme } from './lib/ui/theme.svelte.js'
import { userData } from './lib/ui/userData.svelte.js'

// Language and theme first: if your data from the USB drive has others, they change by themselves.
// The language goes before any request to the shell, so its errors already come out
// in the interface's language.
startLanguage()
theme.start()

// Your data from the USB drive first (E:\relix\data.json), so each screen starts with
// it. If the shell takes a while, it opens anyway: the data arrives later and each
// state reads it again by itself.
const tooSlow = new Promise((resolve) => setTimeout(resolve, 3000))

Promise.race([userData.start(), tooSlow]).finally(() => {
  mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
})
