# Compilar una versión nueva de Relix

Cómo llevar una versión nueva de Relix a un proyecto de Visual Studio que ya
existe. Para armar el proyecto la primera vez, sigue [`shell/README.md`](../shell/README.md).

La guía es acumulada: sirve aunque te hayas saltado varias versiones, porque los
pasos reemplazan todo el shell y agregan lo nuevo.

Las rutas son de ejemplo; cámbialas por las tuyas:

| Qué | Dónde |
|---|---|
| Proyecto web (este repositorio) | `C:\Proyectos\relix` |
| Proyecto de Visual Studio | `C:\Proyectos\RelixShell\RelixShell` (donde está `Package.appxmanifest`) |

---

## 1. Trae la versión nueva

1. Cierra Visual Studio.
2. En `C:\Proyectos\relix`, corre `git pull`. Si bajaste un `.zip` de la versión,
   descomprímelo encima y elige **Reemplazar los archivos en el destino**.

## 2. Copia el shell completo

Desde `C:\Proyectos\relix\shell\RelixShell\`, copia **y reemplaza**:

| Archivo | Va a |
|---|---|
| `App.xaml`, `App.xaml.cs` | `C:\Proyectos\RelixShell\RelixShell\` |
| `MainPage.xaml`, `MainPage.xaml.cs` | `C:\Proyectos\RelixShell\RelixShell\` |
| Todos los `.cs` de `Shell\` | `C:\Proyectos\RelixShell\RelixShell\Shell\` |

## 3. Agrega los archivos nuevos al proyecto

Copiar un `.cs` a la carpeta no basta: Visual Studio solo compila los que están
**dentro del proyecto**.

1. Abre la solución en Visual Studio.
2. En el **Explorador de soluciones**, abre la carpeta **Shell** y revisa qué archivos aparecen.
3. Por cada uno de esta lista que **no** aparezca: clic derecho en **Shell** →
   **Agregar → Elemento existente…** → elige el archivo en `C:\Proyectos\RelixShell\RelixShell\Shell\`.

| Archivo | Desde |
|---|---|
| `CoverService.cs` | Paso 2 de la hoja de ruta (portadas) |
| `CollectionStore.cs` | Paso 3 (colecciones) |
| `UserDataStore.cs` | Paso 4 (tus datos en el USB y tiempo de juego) |
| `SystemCheck.cs` | Paso 6 (revisión del sistema) |

Al final, la carpeta **Shell** debe tener siete archivos: `CollectionStore.cs`,
`CoverService.cs`, `GamepadInput.cs`, `LibraryReader.cs`, `LocalServer.cs`,
`SystemCheck.cs` y `UserDataStore.cs`.

> **Ojo:** si un archivo ya aparece en **Shell**, no lo agregues otra vez. Y haz
> el clic derecho sobre la carpeta **Shell**, no sobre el proyecto: si no, Visual
> Studio deja una segunda copia en la raíz y la compilación falla con
> `CS0101: El espacio de nombres 'RelixShell' ya contiene una definición para...`.
> Para revisarlo, escribe el nombre del archivo en el buscador del Explorador de
> soluciones: debe aparecer **una sola vez**, dentro de **Shell**.

## 4. Revisa el manifiesto

Doble clic en `Package.appxmanifest` → pestaña **Funcionalidades**. Deben estar marcadas:

- **Internet (cliente)**: para bajar portadas.
- **Almacenamiento extraíble**: para leer y escribir en el USB.

## 4b. Íconos nuevos (gema y nombre)

La imagen de la app en la ficha de la Xbox ahora lleva la gema y el nombre, y hay
una versión grande para TV 4K.

1. Copia **todos** los PNG de `C:\Proyectos\relix\brand\uwp\` a
   `C:\Proyectos\RelixShell\RelixShell\Assets\` y elige **Reemplazar**.
2. En el Explorador de soluciones, abre la carpeta **Assets**. Si no aparece
   `Square310x310Logo.scale-200.png`: clic derecho en **Assets** →
   **Agregar → Elemento existente…** → elige ese archivo (una sola vez).
3. Clic derecho en `Package.appxmanifest` → **Ver código**. Busca
   `<uap:DefaultTile` y déjalo así (agrega el atributo `Square310x310Logo`):
   ```xml
   <uap:DefaultTile
     Wide310x150Logo="Assets\Wide310x150Logo.png"
     Square310x310Logo="Assets\Square310x310Logo.png" />
   ```
   Si dentro de `<uap:DefaultTile>` hay un bloque `<uap:ShowNameOnTiles>`, bórralo:
   las imágenes ya traen el nombre y la Xbox lo pondría dos veces.
4. En el mismo XML, dentro de `<Properties>`, pon tu nombre o alias como publicador:
   ```xml
   <PublisherDisplayName>tu-alias</PublisherDisplayName>
   ```
   Es solo el nombre que se muestra: no cambia la identidad de la app ni hace
   falta desinstalarla.
5. Guarda (**Ctrl + S**).

## 5. Compila la interfaz y cópiala al proyecto

En `cmd` (no PowerShell):

```
cd C:\Proyectos\relix
npm install
npm run build:shell -- "C:\Proyectos\RelixShell\RelixShell"
```

`npm install` solo hace falta cuando cambian las dependencias (la última vez fue
`uqr`, los códigos QR de las guías, en la 0.6.0). Correrlo de más no hace daño.

## 6. Despliega en la Xbox

1. Si la IP de la consola cambió: clic derecho en **RelixShell** → **Propiedades** →
   **Depurar** → **Máquina remota** (con **Debug** y **x64** arriba).
2. **F5**.

Después, la lista de [`PROBAR.md`](PROBAR.md) dice qué revisar en la TV.

## Cambios en el shell (C#) por paso

| Paso | Archivo | Cambio |
|---|---|---|
| 2 | `Shell/CoverService.cs` | **Nuevo.** Lista de libretro, descargas, miniaturas |
| 2 | `Shell/LocalServer.cs` | Rutas `/thumb/` y portadas por nombre exacto |
| 2 | `Shell/LibraryReader.cs` | `CollectFilesAsync` pasa a `internal` |
| 2 | `MainPage.xaml.cs` | Mensajes `listCovers`, `coverIndex`, `downloadCovers` |
| 3 | `Shell/CollectionStore.cs` | **Nuevo.** Colecciones en `ES-DE\collections` |
| 3 | `Shell/CoverService.cs` | `DeleteCoverAsync` (usar la portada de color) |
| 3 | `Shell/GamepadInput.cs` | Gatillos LT/RT (con repetición) y botón Vista |
| 3 | `MainPage.xaml.cs` | Mensajes `deleteCover`, `listCollections`, `saveCollection` |
| 4 | `Shell/UserDataStore.cs` | **Nuevo.** `E:\relix\datos.json`, copia anterior y respaldos diarios |
| 4 | `MainPage.xaml.cs` | Mensajes `loadUserData`, `saveUserData`; evento `visible` al volver a primer plano |
| 5 | `MainPage.xaml.cs` | Mensaje `emulatorStatus` (qué emuladores tiene la consola) |
| 6 | `Shell/SystemCheck.cs` | **Nuevo.** Permisos de escritura, espacio libre, carpetas de `roms`, archivos de BIOS e internet |
| 6 | `MainPage.xaml.cs` | Mensaje `systemCheck`; responde un error a los mensajes que no conoce (antes la interfaz quedaba esperando) |
| 7 | `Shell/CoverService.cs` | Baja también capturas (`Named_Snaps`) y pantallas de título de libretro; lista cualquier carpeta de `downloaded_media` |
| 7 | `Shell/LocalServer.cs` | Videos (`.mp4`, `.webm`, `.m4v`) por partes (Range), para que se repitan sin cargarlos enteros |
| 7 | `MainPage.xaml.cs` | Mensaje `listMedia`; `downloadCovers` acepta `kind` (portadas, capturas o pantallas de título) |
| 7 · tema | `MainPage.xaml.cs` | Mensaje `setBackground`: guarda el fondo del tema y lo usa al abrir (página y WebView2) |
