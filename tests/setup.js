// The tests write what's expected in Spanish. jsdom says the browser is
// in English, so here the "console" is set to Chilean Spanish: Automatic
// picks Spanish. tests/i18n.test.js tests English.
Object.defineProperty(window.navigator, 'language', { value: 'es-CL', configurable: true })
Object.defineProperty(window.navigator, 'languages', { value: ['es-CL', 'es'], configurable: true })
