# Actualizar Relix en el PC (guía acumulada)

Esta guía junta **todo lo que cambió desde la última vez que actualizaste** el
proyecto en Visual Studio. Sirve aunque te hayas saltado varias versiones: los
pasos reemplazan todo el shell y agregan lo nuevo, así que no importa desde qué
versión vengas.

Rutas que se usan aquí (las de tu PC):

| Qué | Dónde |
|---|---|
| Proyecto web (este repositorio) | `C:\ProyectosVisual\relix` |
| Proyecto de Visual Studio | `C:\ProyectosVisual\RelixShell` (donde está `Package.appxmanifest`) |

---

## 1. Reemplaza el proyecto web

1. Cierra Visual Studio.
2. Descomprime `relix.zip` en `C:\ProyectosVisual\` y elige **Reemplazar los archivos en el destino**.

## 2. Copia el shell completo

Desde `C:\ProyectosVisual\relix\shell\RelixShell\`, copia **y reemplaza**:

| Archivo | Va a |
|---|---|
| `App.xaml`, `App.xaml.cs` | `C:\ProyectosVisual\RelixShell\` |
| `MainPage.xaml`, `MainPage.xaml.cs` | `C:\ProyectosVisual\RelixShell\` |
| Todos los `.cs` de `Shell\` | `C:\ProyectosVisual\RelixShell\Shell\` |

## 3. Agrega los archivos nuevos al proyecto

Copiar un `.cs` a la carpeta no basta: Visual Studio solo compila los que están
**dentro del proyecto**.

1. Abre la solución en Visual Studio.
2. En el **Explorador de soluciones**, abre la carpeta **Shell** y revisa qué archivos aparecen.
3. Por cada uno de esta lista que **no** aparezca: clic derecho en **Shell** →
   **Agregar → Elemento existente…** → elige el archivo en `C:\ProyectosVisual\RelixShell\Shell\`.

| Archivo | Desde |
|---|---|
| `CoverService.cs` | Paso 2 de la hoja de ruta (portadas) |
| `CollectionStore.cs` | Paso 3 (colecciones) |

Al final, la carpeta **Shell** debe tener cinco archivos: `CollectionStore.cs`,
`CoverService.cs`, `GamepadInput.cs`, `LibraryReader.cs` y `LocalServer.cs`.

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

1. Copia **todos** los PNG de `C:\ProyectosVisual\relix\brand\uwp\` a
   `C:\ProyectosVisual\RelixShell\Assets\` y elige **Reemplazar**.
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
4. Guarda (**Ctrl + S**).

## 5. Compila la interfaz y cópiala al proyecto

En `cmd` (no PowerShell):

```
cd C:\ProyectosVisual\relix
npm install
npm run build:shell -- "C:\ProyectosVisual\RelixShell"
```

`npm install` solo hace falta si cambió `package.json`; correrlo de más no hace daño.

## 6. Despliega en la Xbox

1. Si la IP de la consola cambió: clic derecho en **RelixShell** → **Propiedades** →
   **Depurar** → **Máquina remota** (con **Debug** y **x64** arriba).
2. **F5**.

---

## Qué probar en la TV (por paso)

### Paso 2 · Portadas
- [ ] **≡ → RB → Portadas**: cada consola dice "N de M con portada".
- [ ] **A** en una consola: "Buscando…", "Bajando X de Y" y el resumen.
- [ ] La grilla muestra las portadas (la primera vez tardan un poco: se crean las miniaturas).
- [ ] **Elegir a mano**: A guarda una candidata, X deja la de color.
- [ ] En el PC: portadas en `E:\ES-DE\downloaded_media\<consola>\covers\` y caché en `E:\relix\cache\`.

### Paso 3 · Encontrar juegos
- [ ] En una consola, **RT / LT** saltan de letra y aparece la letra grande.
- [ ] **Y** abre el menú del juego: favorito, colecciones, cambiar portada, ocultar, ordenar.
- [ ] **Y → Colecciones → Nueva colección…**: escribir un nombre con el teclado y **≡** para terminar.
- [ ] En el inicio aparece **Colecciones**; adentro, LB/RB cambia de colección.
- [ ] En el PC: `E:\ES-DE\collections\custom-<Nombre>.cfg`.
- [ ] **Vista ⧉** abre la búsqueda desde el inicio o la biblioteca; con → se pasa a los resultados.
- [ ] **Y → Ordenar biblioteca**: A–Z → Recientes (→ Año, si tus juegos traen año de ES-DE).
- [ ] **Y → Ocultar juego** y luego **≡ → Biblioteca → Juegos ocultos** para recuperarlo.

### Imagen de la app
- [ ] En la ficha de Relix de la Xbox (la de **Reanudar**), el cuadro muestra la gema y el nombre.

### Ajustes visuales (entre el paso 3 y el 4)
- [ ] En el inicio, al moverte entre canales el enfocado ya no toca a sus vecinos.
- [ ] En la búsqueda, el campo (blanco, con lupa) queda separado del teclado.
- [ ] En las grillas, el aro rosado del juego enfocado no toca la fila de arriba ni las portadas de al lado.

### Acerca de
- [ ] **≡ → RB hasta Acerca de** muestra la versión 0.4.0, la fecha de compilación y "Xbox · Modo Desarrollador".
- [ ] La tarjeta **Emuladores** dice qué abre cada consola, y **En tu USB** muestra tu letra de disco real.

Si algo falla, la tabla **Si algo falla** de [`shell/README.md`](shell/README.md) tiene las causas más comunes.

---

## Registro de cambios en el shell (C#)

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
