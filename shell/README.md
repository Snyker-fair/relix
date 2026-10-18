# RelixShell

El shell es la parte en C# que corre en la Xbox: una app UWP con un WebView2 a
pantalla completa. Tiene cuatro trabajos:

1. **Mostrar la interfaz** (la de `src/`, compilada en `ui/`) y hablar con ella por
   mensajes.
2. **Leer el control** de forma nativa y pasarle cada botón a la interfaz.
3. **Leer y escribir en el USB:** escanea `roms\<consola>\`, lee lo de ES-DE, guarda
   portadas, miniaturas, colecciones, tus datos y el registro.
4. **Abrir los emuladores** y volver a Relix cuando los cierras.

Para compilarlo y probarlo en la Xbox, y para publicar una versión, sigue
[`docs/COMPILAR.md`](../docs/COMPILAR.md).

```
RelixShell/
  RelixShell.slnx         la solución: ábrela en Visual Studio 2022
  RelixShell.csproj       el proyecto (WinUI 2 trae WebView2; ui\** va en el paquete)
  Package.appxmanifest    identidad, protocolo relix:, permisos (USB e internet)
  App.xaml(.cs)           arranque, sin modo mouse, vuelta desde el emulador (relix:)
  MainPage.xaml(.cs)      el WebView2 y los mensajes con la interfaz
  Shell/                  el trabajo de verdad (ver la tabla)
  Assets/                 íconos de la app (los genera brand/build-assets.py)
  Properties/             AssemblyInfo y directivas de .NET Native
  ui/                     la interfaz compilada: la copia `npm run build:shell` (Git la ignora)
```

| Archivo de `Shell/` | Qué hace |
|---|---|
| `GamepadInput.cs` | Lee el control y lo manda a la interfaz |
| `LocalServer.cs` | Sirve la interfaz, las imágenes, las miniaturas y los videos (por partes) desde `https://relix.example` |
| `LibraryReader.cs` | Encuentra el USB y recorre la carpeta `roms` |
| `CoverService.cs` | Baja portadas y capturas de libretro, crea las miniaturas, lista lo que hay en `downloaded_media` |
| `CollectionStore.cs` | Lee y guarda las colecciones en `ES-DE\collections` |
| `UserDataStore.cs` | Guarda tus datos en `relix\datos.json`, con copia anterior y respaldos diarios |
| `SystemCheck.cs` | Revisa permisos, espacio, carpetas, archivos de BIOS e internet (Opciones › Revisión) |
| `DiagnosticLog.cs` | Escribe y lee el registro de diagnóstico (`relix\registro.txt`) |
| `Text.cs` | Idioma de los mensajes del shell: el mismo de la interfaz |

### Por qué el control se lee en C#

WebView2 en Xbox tiene un problema conocido: atrapa el foco y el botón B, y su
contenido usa un cursor de "modo mouse". Por eso el foco se queda en la página
de XAML y nunca pasa al WebView2. El control se lee con `Windows.Gaming.Input`
y cada botón llega a la interfaz como un mensaje.

### Lo que no se puede cambiar en el manifiesto

- El protocolo **tiene que llamarse `relix`**: es el que usan los emuladores para
  devolverte a la app (`launchOnExit=relix:`).
- **Almacenamiento extraíble** (`removableStorage`) para el USB e **Internet
  (cliente)** para las portadas y el aviso de versión nueva.
- El publicador (`CN=snyker-fair`) tiene que ser el mismo del certificado con que
  GitHub firma los releases.

---

## Un USB de prueba

1. Usa un disco formateado en **NTFS**.
2. Copia el **contenido** de `shell\usb-de-prueba\` a la raíz del disco. Debe quedar:
   ```
   E:\ES-DE\gamelists\ps2\gamelist.xml   (y las demás consolas)
   E:\roms\ps2\                          (vacía por ahora)
   ```
3. Con el disco conectado al PC, corre la **Xbox USB Permissions Tool** de
   [DevStore](https://xbdev.store/). Da permiso a las apps de la Xbox para leer y
   escribir el disco. Los emuladores también lo necesitan.
4. Conecta el disco a la Xbox.

Relix lista lo que encuentra en `roms\<consola>\`. Con la carpeta de prueba, que
tiene `roms` vacía, verás cada consola con el aviso de que no hay juegos y en qué
carpeta ponerlos. Copia un juego real en esa carpeta y aparecerá al escanear.

Juegos de varios discos: usa un `.m3u` (Relix muestra solo ese) o deja los discos
con `(Disc 1)`, `(Disc 2)` en el nombre (Relix muestra solo el disco 1). Las
carpetas y formatos de cada consola están en la guía de cada una, dentro de Relix.

`E:\relix\cache` se puede borrar cuando quieras: Relix la vuelve a crear. Si
reemplazas portadas desde el PC, bórrala para que se rehagan las miniaturas.

## Lo que deberías ver al abrir

1. La pantalla de carga celeste (o azul noche, con el tema oscuro) con el logo.
2. La gema apareciendo con su destello y la fila de consolas.
3. El control moviéndose entre consolas, **sin cursor**.
4. Con A, la biblioteca. Con B, la vuelta al inicio. B no cierra la app.

Al abrir un juego y cerrar el emulador, la consola vuelve sola a Relix.

---

## Si algo falla

| Qué ves | Qué revisar |
|---|---|
| Visual Studio no abre `RelixShell.slnx` | Hace falta Visual Studio 2022 17.14 o posterior |
| Error de que falta el SDK 10.0.26100 o la plataforma UWP | Instala la carga de trabajo **Desarrollo de la Plataforma universal de Windows** en el Visual Studio Installer |
| Error de compilación con `XamlControlsResources` o `WebView2` | Los paquetes NuGet no se restauraron: clic derecho en la solución → **Restaurar paquetes NuGet** |
| Pantalla celeste vacía | Falta `npm run build:shell`: la carpeta `ui` no quedó en el paquete |
| Opciones › Revisión dice "No se pudo revisar el USB a fondo" | El shell no respondió en 15 segundos: casi siempre es una interfaz nueva con un shell viejo. Vuelve a desplegar con F5 |
| "No pude guardar tus datos en el USB" | El USB no deja escribir: vuelve a aplicarle los permisos con la USB Permissions Tool. Mientras, tus datos quedan en la app y pasan al USB cuando se pueda |
| "No encontré la carpeta roms en ningún disco USB" | La carpeta `roms` debe estar en la raíz del disco. Corre la USB Permissions Tool |
| Un juego no aparece | Revisa que su formato esté en la guía de la consola y que esté a 3 carpetas de profundidad como máximo |
| No hay sonido | Revisa que `MainPage.xaml.cs` tenga la línea `--autoplay-policy=no-user-gesture-required` |
| "… no está instalado en la consola" | Ese emulador no está instalado, o su protocolo es otro |
| "No pude conectarme al servidor de portadas" | La Xbox no tiene internet |
| Una portada equivocada | Menú del juego (Y) › **Cambiar portada** |
| Un video de vista previa no aparece | Revisa que esté en `ES-DE\downloaded_media\<consola>\videos\` con el mismo nombre que el juego y sea `.mp4` (H.264) o `.webm`. Si el resto anda, puede ser un formato que la Xbox no reproduce |
| Aparecen dos Relix en Dev Home | Uno es de antes de la 1.0.0 (otro publicador): desinstala el viejo |

### Ver la consola de la interfaz desde el PC

Solo funciona en compilaciones **Debug**, que activan la depuración remota:

1. En Edge, abre `https://<IP-de-la-Xbox>:11443` y acepta la advertencia de seguridad.
2. Descarga `https://<IP-de-la-Xbox>:11443/config/rootcertificate` e instálalo en
   **Usuario actual → Entidades de certificación raíz de confianza**.
3. Reinicia Edge y abre `edge://inspect`.
4. En **Connect to a remote Windows device**, escribe `https://<IP-de-la-Xbox>:11443`.
5. Con Relix abierto en la Xbox, haz clic en **inspect** bajo el WebView2 llamado **Edge**.

Ahí ves los errores de JavaScript y los mensajes entre la interfaz y el shell.
