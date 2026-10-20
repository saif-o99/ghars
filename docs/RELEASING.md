# Releasing Ghars

Push a version tag and GitHub Actions builds installers for Windows, macOS (Apple
Silicon and Intel) and Linux, and attaches them to a **draft** release.

1. Bump the version in all three places, to the same number (e.g. `0.3.0`):
   `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`. Run
   `cargo check --manifest-path src-tauri/Cargo.toml` so `Cargo.lock` picks it up, and commit.
2. Tag that commit with `v` + the version and push the tag:

   ```sh
   git tag v0.3.0
   git push origin v0.3.0
   ```

3. Check the draft on GitHub, then publish it. Installed copies see the update only once
   it's published (see [Updates](#updates-one-time-setup)).

The workflow first checks that the tag matches the version in all three files, and stops
before building if it doesn't. It only runs on tag pushes: to rebuild a release, use
*Re-run jobs* on the run, or delete the draft and the tag, fix things, and push the tag again.

## Updates (one-time setup)

Ghars checks for updates once a day (users can turn this off in Settings → About). It reads
`latest.json` from the newest **published** GitHub release, which the release workflow builds
and uploads with the installers. Every update is signed, and the app only installs one whose
signature matches the public key in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).

### 1. The signing key

The key pair was generated with

```sh
pnpm tauri signer generate --ci -w "%USERPROFILE%\.tauri\ghars-updater.key"
```

- private key: `%USERPROFILE%\.tauri\ghars-updater.key` (no password). Never put it in the
  repository, and back it up somewhere safe: **if it's lost, installed copies of Ghars can
  never be updated again**, because they only trust updates signed with it.
- public key: `%USERPROFILE%\.tauri\ghars-updater.key.pub`, already copied into
  `tauri.conf.json`. If you ever generate a new pair, replace `pubkey` there too.

### 2. Add two GitHub secrets

Repository → *Settings* → *Secrets and variables* → *Actions* → **New repository secret**:

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | The whole contents of `ghars-updater.key` (one line of text) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The key's password. The current key has none, and GitHub doesn't store empty secrets, so skip this one until you use a key with a password |

The workflow stops before building if `TAURI_SIGNING_PRIVATE_KEY` is missing, and gives the
two secrets only to the build steps.

### 3. The updater points at the repository

`plugins.updater.endpoints` in `src-tauri/tauri.conf.json` is

```
https://github.com/saif-o99/ghars/releases/latest/download/latest.json
```

If the repository moves, update it there. (The workflow refuses to build a release while the
old `OWNER/REPO` placeholder is present.)

### How it resolves

`releases/latest/download/latest.json` points at the newest **published**, non-prerelease
release. Drafts are invisible to it, so users see an update only after you publish the draft.
Each build job adds its platforms to the same `latest.json`, so publish only once all four
jobs have finished.

### Local builds

`bundle.createUpdaterArtifacts` is on, so `pnpm tauri build` signs the update bundles too
and fails without the key. Set it for the shell first (PowerShell):

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\ghars-updater.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
pnpm tauri build
```

Without the key (a contributor's test build), skip the update bundles instead:
`pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'`.

## macOS: signing and notarization (one-time setup)

Without this, macOS refuses to open the app ("cannot be opened because the developer
cannot be verified"). It needs an Apple Developer account.

### 1. Get a "Developer ID Application" certificate

**On a Mac:** Xcode → Settings → Accounts → select your team → *Manage Certificates* →
**+** → *Developer ID Application*. Then open Keychain Access, find
"Developer ID Application: …", right-click → *Export* → save as `ghars.p12` with a password.

**Without a Mac (OpenSSL, e.g. Git Bash on Windows):**

```sh
openssl genrsa -out ghars.key 2048
openssl req -new -key ghars.key -out ghars.csr -subj "/emailAddress=you@example.com/CN=Your Name/C=JO"
```

On [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates/list)
click **+**, choose *Developer ID Application*, upload `ghars.csr` and download the `.cer`. Then:

```sh
openssl x509 -inform DER -in developerID_application.cer -out ghars.pem
openssl pkcs12 -export -legacy -inkey ghars.key -in ghars.pem -out ghars.p12 -name "Developer ID Application"
```

Keep `ghars.key` and `ghars.p12` private and out of the repository. The `.gitignore` already
excludes `*.p12`, `*.key`, `*.pem`, `*.cer`, `*.csr` and `.env` files, but it's safest to
create them outside the project folder.

### 2. Collect the values

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | `ghars.p12` in base64: `base64 -w0 ghars.p12` (Linux/Git Bash) or `base64 -i ghars.p12` (Mac) |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | The certificate's name, e.g. `Developer ID Application: Your Name (ABCDE12345)` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | An **app-specific password** from [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords (not your normal password) |
| `APPLE_TEAM_ID` | The 10-character Team ID from [developer.apple.com → Membership](https://developer.apple.com/account#MembershipDetailsCard) |

### 3. Add them to GitHub

Repository → *Settings* → *Secrets and variables* → *Actions* → **New repository secret**,
once for each name above. The next tagged release is signed and notarized automatically;
the workflow log says "Apple secrets not set" while they're missing. The workflow gives the
secrets only to the macOS build step.

## Windows

Windows builds are **not signed**, so on first launch SmartScreen shows "Windows protected
your PC". Users click **More info → Run anyway**. The README says so.

A free option for later: [SignPath Foundation](https://signpath.org) gives open-source
projects a code-signing certificate at no cost, once the project is public and meets their
criteria. That would remove the warning.

## Linux

AppImage, `.deb` and `.rpm` are built unsigned, which is normal for Linux.
