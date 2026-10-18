# Building and releasing Relix

How to try Relix on your Xbox from the source code, and how to release a new
version. The Visual Studio project lives in this repository, in
`shell/RelixShell/`: there's nothing to copy into another project.

The paths are examples; change them to yours.

## What you need (once)

- **Visual Studio 2022** (17.14 or later, to open `.slnx`) with the
  **Universal Windows Platform development** workload. It brings the Windows SDK
  10.0.26100 the project asks for.
- **Node.js 22** and **Git**.
- The repository, in `cmd`:
  ```
  git clone https://github.com/Snyker-fair/relix C:\Projects\relix
  cd C:\Projects\relix
  npm install
  ```

## Try it on your Xbox

1. Get the latest: `git pull` (and `npm install` if `package.json` changed).
2. Build the interface and copy it into the project:
   ```
   npm run build:shell
   ```
   It goes to `shell\RelixShell\ui\` (Git ignores it).
3. Open `shell\RelixShell\RelixShell.slnx` in Visual Studio.
4. At the top, pick **Debug**, **x64** and **Remote Machine**. The first time, or
   if the console's IP changed: right-click **RelixShell** → **Properties** →
   **Debug** → **Remote machine**, with the IP Dev Home shows. Visual Studio asks
   for the pairing PIN the first time (Dev Home › **Pair with Visual Studio**).
5. **F5**.

If you only changed the interface, `npm run build:shell` and **F5** again is
enough. Then [`TESTING.md`](TESTING.md) says what to check on the TV.

## Commits

Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <description>

<body, optional: why the change was made>

<footers, optional>
```

**Type:**

| Type | For |
|---|---|
| `feat` | A new feature for people who use Relix |
| `fix` | A bug fix |
| `docs` | Documentation only: README, guides, CHANGELOG |
| `style` | Code formatting, without changing what it does |
| `refactor` | Reorganizing code without changing what it does |
| `perf` | Making something faster or lighter |
| `test` | Tests |
| `build` | Build, dependencies, the Visual Studio project |
| `ci` | GitHub Actions workflows |
| `chore` | Upkeep that fits no other type, such as each version number |
| `revert` | Undoing an earlier commit |

**Scope**, optional: the part of Relix that changes. `ui` (the interface,
`src/`), `shell` (the C#), `i18n` (translations), `release` (versions and
releases), `demo` (GitHub Pages), `brand` (logo and icons), `deps`
(dependencies) or `changelog`.

**Description:** in English, lowercase, in the imperative ("add", "fix") and
without a final period, in about 70 characters at most.

**Breaking change:** a `!` after the type and a `BREAKING CHANGE:` footer that
says what to do; for example, if the folders on the USB drive change. The type
also tells which number goes up in the next version: a breaking change, the
first one (`2.0.0`); a `feat`, the middle one (`1.1.0`); only `fix`, the last
one (`1.0.1`).

```
feat(ui): add sorting by release date
fix(shell): return to Relix when Xenia closes
docs(changelog): add the changes in 1.0.1
ci(release): drop Relix.cer from releases
chore(release): 1.0.1
```

`npm version` writes the last one by itself: it's set up in `.npmrc`.

## Release a version

GitHub builds and signs the package by itself from a tag, and leaves it as a
draft so you can try it before releasing it:

1. Add the changes to [`CHANGELOG.md`](../CHANGELOG.md), at the top, with the new
   number (`## [1.0.1] - 2026-11-02`). That section becomes the release notes.
   Commit it: `docs(changelog): add the changes in 1.0.1`.
2. Bump the version number and create the tag:
   ```
   npm version 1.0.1
   git push --follow-tags
   ```
   `npm version` changes `package.json` and `package-lock.json`, makes the commit
   (`chore(release): 1.0.1`) and creates the `v1.0.1` tag.
3. On GitHub, **Actions** tab › **Release**: in 3 to 5 minutes a **draft** shows
   up in **Releases** with the `.msix` and the dependencies `.zip`. Only you can
   see it.
4. Download the `.msix` and the `.zip` from the draft and install them on the
   Xbox as the README says (**Install**). Go through the quick test in
   [`TESTING.md`](TESTING.md).
5. If it works: on the draft, **Edit** (the pencil) › **Publish release**. From
   then on it's public, and Xboxes with Relix announce it when they open (a day
   later at most; right away with **Checkup › Check again**). If it doesn't work,
   delete it (**Delete**), fix it and release the next version.

If the workflow fails, the log of the failed step says why. The tag has to match
`package.json` (the workflow checks it), and the UWP package number is built by
itself: `1.0.1` → `1.0.1.0`.

### Once: the signing certificate

Packages are signed with a certificate of yours that GitHub keeps as a secret.
It's created only once, on the PC, in PowerShell from the `relix` folder:

```
powershell -ExecutionPolicy Bypass -File scripts\create-certificate.ps1
```

The script puts the certificate on the clipboard and shows its password. On
GitHub, in the repository: **Settings** › **Secrets and variables** › **Actions**
› **New repository secret**, twice:

| Name | Secret |
|---|---|
| `RELIX_CERT` | Paste (Ctrl + V) |
| `RELIX_CERT_PASSWORD` | The password the script showed |

The certificate also stays in your Windows (`certmgr.msc` › Personal ›
Certificates › Relix). If you ever create another one, use the same publisher
(`CN=snyker-fair`, the one in `Package.appxmanifest`).

## What GitHub runs by itself

| Workflow | When | What it does |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Every change on `main` and every pull request | Tests, untranslated texts and both interface builds |
| [`pages.yml`](../.github/workflows/pages.yml) | Every change on `main` | Deploys the demo to `snyker-fair.github.io/relix` |
| [`release.yml`](../.github/workflows/release.yml) | Every `vX.Y.Z` tag | Builds the shell on Windows, signs the package and creates the release as a draft |
| [`release.yml`](../.github/workflows/release.yml) | Every change in `shell/` on `main` | The same, as a test and without releasing: the package stays in the run (**Artifacts**) for 14 days |
