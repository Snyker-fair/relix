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

## The next version: the `next` branch

While a version is being tested on the Xbox, the next one is built on the `next`
branch, so the tag doesn't take anything that isn't finished. GitHub runs the
tests on it too and, when the shell changes, builds a test package (**Actions ›
Release**, artifact `Relix_<version>.<run>_test`). Its fourth number goes up
with every build, so it installs over what the Xbox has, without uninstalling.
If only the interface changed, **Actions › Release › Run workflow** (choose the
branch) builds that package too. Once the version is published, `next` is merged
into `main` and the new version starts from there.

## Release a version

GitHub builds and signs the package by itself from a tag, and leaves it as a
draft so you can try it before releasing it:

1. The changes go in [`CHANGELOG.md`](../CHANGELOG.md) while they're made, at
   the top, in the new number's section: `## [1.0.1] - unreleased`. That section
   becomes the release notes.
2. Bump the version number and create the tag:
   ```
   npm version 1.0.1
   git push --follow-tags
   ```
   `npm version` first checks that `CHANGELOG.md` has the `1.0.1` section with
   something in it (if not, it stops without changing anything). Then it changes
   `package.json` and `package-lock.json`, writes today's date in the section
   (`## [1.0.1] - 2026-11-02`, with
   [`scripts/changelog-date.mjs`](../scripts/changelog-date.mjs)), makes the
   commit (`chore(release): 1.0.1`) and creates the `v1.0.1` tag.
3. On GitHub, **Actions** tab › **Release**: in 3 to 5 minutes a **draft** shows
   up in **Releases** with the `.msix` and the dependencies `.zip`. Only you can
   see it.
4. Download the `.msix` and the `.zip` from the draft and install them on the
   Xbox as the README says (**Install**). Go through the quick test in
   [`TESTING.md`](TESTING.md).
5. If it works: on the draft, **Edit** (the pencil) › **Publish release**. From
   then on it's public, and Xboxes with Relix announce it when they open (a day
   later at most; right away with **Checkup › Check again**). If it doesn't work,
   fix it and make the draft again with the same number (below).

If the workflow fails, the log of the failed step says why. The tag has to match
`package.json` and the CHANGELOG section has to be dated (the workflow checks
both). The UWP package number is built by itself, with the run number last:
`1.0.1` → `1.0.1.142`. That's why a test package, or the draft of a tag made
again, installs over the one before.

### Make a draft again, with the same number

While the draft isn't published, the fix can go in the same version:

1. In **Releases**, delete the draft (**Delete**).
2. Commit the fix (and its line in `CHANGELOG.md`, inside the same section) and
   push it: `git push`.
3. Move the tag to that commit:
   ```
   git tag -d v1.0.1
   git push origin --delete v1.0.1
   git tag -a v1.0.1 -m "chore(release): 1.0.1"
   git push origin v1.0.1
   ```
   GitHub builds the new draft. Its package has a higher fourth number, so it
   installs over the one you were testing.

Once published, a version isn't changed anymore: the fix goes in the next one.

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
| [`ci.yml`](../.github/workflows/ci.yml) | Every change on `main` and `next`, and every pull request | Types (`npm run check`), tests, translations, both interface builds and, in a second job, the smoke tests in Chromium (`npm run e2e`) |
| [`pages.yml`](../.github/workflows/pages.yml) | Every change on `main` | Deploys the demo to `snyker-fair.github.io/relix` |
| [`release.yml`](../.github/workflows/release.yml) | Every `vX.Y.Z` tag | Builds the shell on Windows, signs the package and creates the release as a draft |
| [`release.yml`](../.github/workflows/release.yml) | Every change in `shell/` on `main` or `next` | The same, as a test and without releasing: the package stays in the run (**Artifacts**) for 14 days |

## The README's screenshots

`docs/media` (the screenshots and `tour.webp`) comes from the demo, in English,
with a fixed clock: [`scripts/readme-media.py`](../scripts/readme-media.py). Once:
`pip install playwright pillow` and `python -m playwright install chromium`.
Then, with the demo served in another terminal
(`npm run build && npx vite preview --port 5200`):

```
python scripts/readme-media.py
```

If a screen changed, the script's steps (which keys, how long to wait) may need
a touch.
