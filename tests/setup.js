// Los tests escriben lo esperado en español. jsdom dice que el navegador está
// en inglés, así que aquí la "consola" queda en español de Chile: Automático
// elige español. tests/i18n.test.js prueba el inglés.
Object.defineProperty(window.navigator, 'language', { value: 'es-CL', configurable: true })
Object.defineProperty(window.navigator, 'languages', { value: ['es-CL', 'es'], configurable: true })
