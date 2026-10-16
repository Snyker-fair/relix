# RelixShell: de app en blanco a Relix en la TV

El shell es la parte en C# que corre en la Xbox. Tiene cuatro trabajos:

1. **Mostrar la interfaz.** La interfaz de Relix corre dentro de un WebView2 a
   pantalla completa.
2. **Leer el control** de forma nativa y pasarle cada botón a la interfaz.
3. **Leer y escribir en el USB:** escanea `roms\<consola>\`, lee los gamelists de ES-DE y
   guarda las portadas descargadas, sus miniaturas y tus colecciones.
4. **Abrir los emuladores** y volver a Relix cuando los cierras.

```
Shell/
  GamepadInput.cs   control de Xbox -> acciones (up, a, b, lb...)
  LocalServer.cs    sirve la interfaz y las portadas en https://relix.example
  LibraryReader.cs  encuentra el USB, escanea roms y lee los gamelists
MainPage.xaml(.cs)  el WebView2 y los mensajes con la interfaz
App.xaml(.cs)       arranque, sin modo mouse, vuelta desde el emulador (relix:)
```

### Por qué el control se lee en C#

WebView2 en Xbox tiene un problema conocido: atrapa el foco y el botón B, y su
contenido usa un cursor de "modo mouse". Por eso el foco se queda en la página
de XAML y nunca pasa al WebView2. El control se lee con `Windows.Gaming.Input`
y cada botón llega a la interfaz como un mensaje.

---

## Pasos en Visual Studio

Las rutas de ejemplo suponen esto. Ajústalas a las tuyas:

```
C:\Proyectos\relix\                       el proyecto web (este repo)
C:\Proyectos\RelixShell\RelixShell\       la carpeta con Package.appxmanifest
```

### 1. Instala WinUI 2 (trae WebView2)

1. En el **Explorador de soluciones**, haz clic derecho en el proyecto
   **RelixShell** y elige **Administrar paquetes NuGet…**
2. En la pestaña **Examinar**, busca **Microsoft.UI.Xaml**.
3. Instala la última versión estable **2.8.x** y acepta la licencia.
   `Microsoft.Web.WebView2` se instala solo, como dependencia.

### 2. Reemplaza los cuatro archivos de la plantilla

Copia estos archivos de `relix\shell\RelixShell\` a `C:\Proyectos\RelixShell\RelixShell\`
y acepta reemplazar:

- `App.xaml` y `App.xaml.cs`
- `MainPage.xaml` y `MainPage.xaml.cs`

Visual Studio los recarga solo. Si te pregunta, elige **Sí a todo**.

### 3. Agrega la carpeta Shell

1. Haz clic derecho en el proyecto **RelixShell** y elige **Agregar → Nueva carpeta**.
   Llámala `Shell`.
2. Haz clic derecho en la carpeta **Shell** y elige **Agregar → Elemento existente…**
3. Selecciona los seis `.cs` de `relix\shell\RelixShell\Shell\`. Visual Studio los copia al proyecto.

| Archivo | Qué hace |
|---|---|
| `GamepadInput.cs` | Lee el control y lo manda a la interfaz |
| `LocalServer.cs` | Sirve la interfaz, las portadas y las miniaturas desde `https://relix.example` |
| `LibraryReader.cs` | Encuentra el USB y recorre la carpeta `roms` |
| `CoverService.cs` | Baja portadas de libretro, crea las miniaturas y las borra si eliges la de color |
| `CollectionStore.cs` | Lee y guarda las colecciones en `ES-DE\collections` |
| `UserDataStore.cs` | Guarda tus datos en `relix\datos.json`, con copia anterior y respaldos diarios |

### 4. Ajusta el manifiesto

Haz doble clic en **Package.appxmanifest** y revisa estas pestañas:

| Pestaña | Qué cambiar |
|---|---|
| **Aplicación** (*Application*) | Nombre para mostrar: `Relix`. Descripción: `Tus reliquias, listas para jugar.` |
| **Recursos visuales** (*Visual Assets*) | Color de fondo del icono: `#DDEBF7`. En *Pantalla de presentación*, color de fondo: `#DDEBF7` |
| **Funcionalidades** (*Capabilities*) | Marca **Almacenamiento extraíble** (*Removable Storage*) |
| **Declaraciones** (*Declarations*) | Agrega **Protocolo**. Nombre: `relix`. Nombre para mostrar: `Relix` |
| **Empaquetado** (*Packaging*) | Nombre para mostrar del paquete: `Relix` |

Guarda con **Ctrl+S**. En `shell/manifest-cambios.xml` está cómo debe quedar el XML.

> El protocolo **tiene que llamarse `relix`**. Es el que usan los emuladores para
> devolverte a la app (`launchOnExit=relix:`).

### 5. Pon los íconos de Relix

Copia todos los PNG de `relix\brand\uwp\` a la carpeta `Assets` del proyecto
(`C:\ProyectosVisual\RelixShell\Assets\`) y acepta reemplazar.

`Square310x310Logo.scale-200.png` no viene en la plantilla: agrégalo al proyecto
con clic derecho en la carpeta **Assets** → **Agregar → Elemento existente…**, y
decláralo en el manifiesto como muestra `manifest-cambios.xml` (atributo
`Square310x310Logo` del `uap:DefaultTile`).

### 6. Haz que el paquete incluya la interfaz

1. Haz clic derecho en el proyecto **RelixShell** y elige **Descargar el proyecto**
   (*Unload Project*).
2. Vuelve a hacer clic derecho y elige **Editar archivo del proyecto**.
3. Justo antes de la última línea `</Project>`, pega:
   ```xml
   <ItemGroup>
     <Content Include="ui\**\*" />
   </ItemGroup>
   ```
4. Guarda, haz clic derecho y elige **Volver a cargar el proyecto**.

### 7. Compila la interfaz y cópiala al proyecto

En una terminal, dentro de `C:\Proyectos\relix`:

```bash
npm install
npm run build:shell -- "C:\Proyectos\RelixShell\RelixShell"
```

Esto crea la carpeta `ui` dentro de RelixShell. **Repite este comando cada vez
que cambies la interfaz** y luego vuelve a presionar F5.

### 8. Prepara un USB de prueba

1. Usa un disco formateado en **NTFS**.
2. Copia el **contenido** de `relix\shell\usb-de-prueba\` a la raíz del disco. Debe quedar:
   ```
   E:\ES-DE\gamelists\ps2\gamelist.xml   (y las demás consolas)
   E:\roms\ps2\                          (vacía por ahora)
   ```
3. Con el disco conectado al PC, corre la **Xbox USB Permissions Tool** de
   [DevStore](https://xbdev.store/). Da permiso a las apps de la Xbox para leer
   el disco. Los emuladores también lo necesitan.
4. Conecta el disco a la Xbox.

Relix lista lo que encuentra en `roms\<consola>\`. Con la carpeta de prueba,
que tiene `roms` vacía, verás cada consola con el aviso de que no hay juegos y
en qué carpeta ponerlos. Copia un juego real en esa carpeta y aparecerá solo.

Nombres de carpeta que Relix reconoce:

| Consola | Carpeta dentro de `roms` | Formatos |
|---|---|---|
| PS1 | `psx`, `ps1` o `playstation` | .chd .cue .pbp .m3u |
| PSP | `psp` | .iso .cso .chd .pbp |
| PS2 | `ps2` o `playstation2` | .chd .iso .cso |
| GameCube | `gc`, `gamecube` o `ngc` | .rvz .iso .gcz .gcm .ciso |
| Wii U | `wiiu` | .wua .wux .wud y carpetas con `code\*.rpx` |

Juegos de varios discos: usa un `.m3u` (Relix muestra solo ese) o deja los
discos con `(Disc 1)`, `(Disc 2)` en el nombre (Relix muestra solo el disco 1).

Lo que Relix escribe en el disco (por eso necesita los permisos del punto 3):

```
E:\ES-DE\downloaded_media\<consola>\covers\   portadas descargadas (la misma carpeta de ES-DE)
E:\relix\cache\libretro\                      lista de portadas de cada consola (se renueva cada mes)
E:\relix\cache\miniaturas\                    miniaturas JPG de la grilla
E:\ES-DE\collections\custom-<Nombre>.cfg        tus colecciones (las ve también ES-DE)
```

`E:\relix\cache` se puede borrar cuando quieras: Relix la vuelve a crear. Si
reemplazas portadas desde el PC, bórrala para que se rehagan las miniaturas.

### 9. Ejecuta en la Xbox

Usa la misma configuración de antes: **Debug**, **x64** y **Máquina remota**. Luego presiona **F5**.

Deberías ver, en este orden:

1. La pantalla de carga celeste con el logo de Relix.
2. La gema apareciendo con su destello y la fila de consolas.
3. El control moviéndose entre consolas, **sin cursor**.
4. Con A, la biblioteca de prueba. Con B, la vuelta al inicio. B no cierra la app.

### 10. Prueba un juego real (cuando tengas uno)

1. Copia un juego a `E:\roms\<consola>\` con el mismo nombre de archivo que en
   su `gamelist.xml`.
2. Instala el emulador de esa consola desde el Device Portal y márcalo como **Game**.
3. Elige el juego en Relix y presiona **A**. Al cerrar el emulador, la consola vuelve sola a Relix.

Deja Relix marcado como **App**, el valor por defecto. Es solo un lanzador, y
así el emulador tiene todos los recursos de la consola.

---

## Si algo falla

| Qué ves | Qué revisar |
|---|---|
| Error de compilación con `XamlControlsResources` o `WebView2` | Falta el paso 1 (NuGet Microsoft.UI.Xaml) |
| Error con `GamepadInput`, `LocalServer`, `LibraryReader`, `CoverService`, `CollectionStore` o `UserDataStore` | Falta el paso 3 (carpeta Shell) |
| "No pude guardar tus datos en el USB" | El USB no deja escribir: vuelve a aplicarle los permisos con la USB Permissions Tool. Mientras, tus datos quedan en la app y pasan al USB cuando se pueda |
| Pantalla celeste vacía | Falta el paso 6 o el 7: la carpeta `ui` no quedó en el paquete |
| "No encontré la carpeta roms en ningún disco USB" | La carpeta `roms` debe estar en la raíz del disco. Corre la USB Permissions Tool |
| Un juego no aparece | Revisa que su formato esté en la tabla del paso 8 y que esté a 3 carpetas de profundidad como máximo |
| No hay sonido | Revisa que `MainPage.xaml.cs` tenga la línea `--autoplay-policy=no-user-gesture-required` |
| "… no está instalado en la consola" | Ese emulador no está instalado, o su protocolo es otro |
| "No pude conectarme al servidor de portadas" | La Xbox no tiene internet, o falta `internetClient` en el manifiesto (paso 4) |
| "No pude guardar en el USB" | Vuelve a correr la herramienta de permisos del paso 8 con el disco conectado al PC |
| Una portada equivocada | Pon al archivo del juego su nombre estándar (p. ej. `Gran Turismo 4 (USA).chd`), borra su portada de `ES-DE\downloaded_media\<consola>\covers\` y busca de nuevo. En el paso 3 de la hoja de ruta, el menú del juego (Y) tendrá "Cambiar portada" |
| Muchos juegos de PSP sin portada | libretro tiene cerca de la mitad de las portadas de PSP; ES-DE en el PC las completa (paso 7 de la hoja de ruta) |
| Aparece un cursor o B saca a Relix | Avísame: es justo lo que hay que validar en la consola |

### Ver la consola de la interfaz desde el PC

Solo funciona en compilaciones **Debug**, que activan la depuración remota:

1. En Edge, abre `https://<IP-de-la-Xbox>:11443` y acepta la advertencia de seguridad.
2. Descarga `https://<IP-de-la-Xbox>:11443/config/rootcertificate` e instálalo en
   **Usuario actual → Entidades de certificación raíz de confianza**.
3. Reinicia Edge y abre `edge://inspect`.
4. En **Connect to a remote Windows device**, escribe `https://<IP-de-la-Xbox>:11443`.
5. Con Relix abierto en la Xbox, haz clic en **inspect** bajo el WebView2 llamado **Edge**.

Ahí ves los errores de JavaScript y los mensajes entre la interfaz y el shell.
