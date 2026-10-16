import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { userData } from './lib/ui/userData.svelte.js'

// Primero tus datos del USB (E:\relix\datos.json), así cada pantalla parte con
// ellos. Si el shell tarda, se abre igual: los datos llegan después y cada
// estado los vuelve a leer solo.
const tooSlow = new Promise((resolve) => setTimeout(resolve, 3000))

Promise.race([userData.start(), tooSlow]).finally(() => {
  mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
})
