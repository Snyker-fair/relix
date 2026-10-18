# Compilar y publicar Relix

Cómo probar Relix en tu Xbox desde el código y cómo publicar una versión nueva.
El proyecto de Visual Studio está en este repositorio, en `shell/RelixShell/`:
no hay que copiar archivos a otro proyecto.

Las rutas son de ejemplo; cámbialas por las tuyas.

## Lo que necesitas (una vez)

- **Visual Studio 2022** (17.14 o posterior, para abrir `.slnx`) con la carga de
  trabajo **Desarrollo de la Plataforma universal de Windows**. Trae el SDK de
  Windows 10.0.26100 que pide el proyecto.
- **Node.js 22** y **Git**.
- El repositorio, en `cmd`:
  ```
  git clone https://github.com/Snyker-fair/relix C:\Proyectos\relix
  cd C:\Proyectos\relix
  npm install
  ```

> **Si venías del proyecto anterior** (tu propia carpeta `RelixShell` fuera del
> repositorio): ya no la necesitas. En la 1.0.0 el publicador del paquete pasó a
> `CN=snyker-fair`, así que la Xbox lo trata como una app distinta. **Desinstala
> Relix una vez** desde Dev Home antes de instalar la nueva; tus datos están en el
> USB y vuelven solos.

## Probar en tu Xbox

1. Trae lo último: `git pull` (y `npm install` si cambió `package.json`).
2. Compila la interfaz y cópiala dentro del proyecto:
   ```
   npm run build:shell
   ```
   Queda en `shell\RelixShell\ui\` (Git la ignora).
3. Abre `shell\RelixShell\RelixShell.slnx` en Visual Studio.
4. Arriba elige **Debug**, **x64** y **Máquina remota**. La primera vez, o si
   cambió la IP de la consola: clic derecho en **RelixShell** → **Propiedades** →
   **Depurar** → **Máquina remota**, con la IP que muestra Dev Home. Visual Studio
   pide el PIN de emparejamiento la primera vez (Dev Home › **Pair with Visual Studio**).
5. **F5**.

Si solo cambiaste la interfaz, basta con `npm run build:shell` y **F5** de nuevo.
Después, [`PROBAR.md`](PROBAR.md) dice qué revisar en la TV.

## Publicar una versión

GitHub arma, firma y publica el paquete solo, a partir de una etiqueta:

1. Anota los cambios en [`CHANGELOG.md`](../CHANGELOG.md), arriba, con el número
   nuevo (`## [1.0.1] - 2026-11-02`). Esa sección se usa como notas del release.
   Haz el commit.
2. Sube el número de versión y crea la etiqueta:
   ```
   npm version 1.0.1
   git push --follow-tags
   ```
   `npm version` cambia `package.json` y `package-lock.json`, hace el commit y crea
   la etiqueta `v1.0.1`.
3. En GitHub, pestaña **Actions** › **Release**: en unos 10 a 15 minutos la versión
   aparece en **Releases** con el `.msix`, el `.zip` de dependencias y `Relix.cer`.
4. Las Xbox con Relix lo avisan al abrir (como mucho un día después; en
   **Revisión › Revisar de nuevo**, en el acto).

Si el flujo falla, el registro del paso que falló dice por qué. La etiqueta tiene
que calzar con `package.json` (el flujo lo revisa), y el número del paquete UWP se
arma solo: `1.0.1` → `1.0.1.0`.

### Una vez: el certificado de firma

Los paquetes se firman con un certificado tuyo que GitHub guarda como secreto. Se
crea una sola vez, en el PC, en PowerShell desde la carpeta `relix`:

```
powershell -ExecutionPolicy Bypass -File scripts\crear-certificado.ps1
```

El script deja el certificado en el portapapeles y muestra su contraseña. En
GitHub, en el repositorio: **Settings** › **Secrets and variables** › **Actions** ›
**New repository secret**, dos veces:

| Name | Secret |
|---|---|
| `RELIX_CERT` | Pega (Ctrl + V) |
| `RELIX_CERT_PASSWORD` | La contraseña que mostró el script |

El certificado también queda en tu Windows (`certmgr.msc` › Personal ›
Certificados › Relix). Si algún día creas otro, usa el mismo publicador
(`CN=snyker-fair`, el de `Package.appxmanifest`).

## Qué corre GitHub solo

| Flujo | Cuándo | Qué hace |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Cada cambio en `main` y cada pull request | Tests, textos sin traducir y las dos compilaciones de la interfaz |
| [`pages.yml`](../.github/workflows/pages.yml) | Cada cambio en `main` | Publica la demo en `snyker-fair.github.io/relix` |
| [`release.yml`](../.github/workflows/release.yml) | Cada etiqueta `vX.Y.Z` | Compila el shell en Windows, firma el paquete y crea el release |
| [`release.yml`](../.github/workflows/release.yml) | Cada cambio en `shell/` en `main` | Lo mismo, como prueba y sin publicar: el paquete queda en la ejecución (**Artifacts**) por 14 días |
