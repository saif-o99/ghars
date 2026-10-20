# غرس · Ghars

**Istighfar and adhkar in the gaps of your workday.**

Ghars is a small island at the top of your screen. Hover it to open, then scroll, drag the wheel, or
press ↑ — every notch is one count. While your AI coding agent is working, the island opens by
itself with adhkar, so the waiting time becomes remembrance.

The name means *planting*, from the hadith that whoever says *SubhanAllahil-'Azim wa bihamdihi* has a palm tree planted for them in Jannah
(at-Tirmidhi 3464).

Free and open source. No accounts, no tracking — every count stays on your device and never leaves it.
Ghars goes online for one thing only: once a day it checks GitHub Releases for a new version
(you can turn this off in Settings → About). Otherwise the only network use is a [local API](#local-api)
on `127.0.0.1:47821`, so your AI tools can tell Ghars when they're working.

## Features

- **The island** — sits at the top of the screen and expands on hover. Clicks pass through everywhere
  except the island itself, and it can hide during full-screen apps and presentations (off by default).
  - Two styles: **floating**, or a **notch** attached to the top edge of the screen.
  - Three sizes. Drag it anywhere along the top or the left / right side of the screen (or pick a
    preset), on the main screen, a chosen screen, or whichever screen the mouse pointer is on.
  - Optional slim mode: a thin bar at the edge until you hover it.
- **Tactile wheel** — a detented 3D scroll wheel: mouse wheel, trackpad, drag, the ▲ button or the
  ↑ key. One notch is exactly one count on every input device; ▼ or ↓ takes one back.
- **Listen** — a 🔊 button plays the Arabic of each built-in dhikr, to help non-Arabic speakers
  say it correctly (offline; whole surahs are left out until we have a human recitation).
- **Istighfar** with a daily goal, and **adhkar sets**: general, morning, evening, after prayer and
  Friday — plus **your own adhkar** with their own counts. Every built-in dhikr shows its source
  (hadith or ayah). In automatic mode the set follows the time of day.
- **AI-aware** — opens by itself when Claude Code, Cursor, Codex CLI, Gemini CLI or GitHub Copilot
  (CLI and VS Code agent mode) starts working.
  It never closes on its own: move the mouse over it and away, press Esc, or click ×.
- **Global shortcut** (default `Cmd+Option+G` on macOS, `Alt+Shift+G` on Windows and Linux) opens
  the island any time.
- **Prayer times** calculated offline: ~85 built-in cities or custom coordinates, any timezone,
  12 methods, Shafi'i/Hanafi Asr. Optional quiet note on the island at (or before) prayer time, and
  the **Hijri date** with a ±2 day adjustment for local moon sighting.
- **17 themes**, from the default graphite-and-emerald look to zellige, Iznik tile, mashrabiya, manuscript and
  more, each with its own Arabic typography bundled offline. Pick one, or a pair that follows your system's light/dark mode. The settings
  window keeps a **live, interactive preview** beside the controls.
- **Pause and quiet hours** — pause for 30 min / 1 h / 3 h / until resumed (also from the tray), and
  daily hours when the island stays hidden.
- **8 languages** — العربية, English, اردو, Bahasa Indonesia, Bahasa Melayu, Türkçe, Français, বাংলা.
  Translations other than Arabic and English are drafts awaiting review by native speakers.
- **Stats** — today, week and month views; export a backup and restore it later.
- **Accessible** — keyboard navigation, screen-reader labels, and animations that follow the system's reduced-motion setting.
- Optional click sound, and a gentle "slow down" hint when counting faster than one can say the words.

## Install

Download the installer for your system from the Releases page:
`.msi` / `.exe` (Windows), `.dmg` (macOS), `.AppImage` / `.deb` / `.rpm` (Linux).
Ghars lives in the system tray / menu bar; the settings window opens on first launch.
When a new version is out, Ghars offers it in the tray menu and installs it in place (each
update is signed and checked before it's installed).

The Windows installer isn't code-signed yet, so on first launch Windows may show "Windows protected
your PC": click **More info → Run anyway**. The macOS app is signed and notarized.

Maintainers: see [docs/RELEASING.md](docs/RELEASING.md) for publishing a release.

## Connect your AI tools

**Settings → AI tools → Connect.** Ghars adds hooks to the tool's user config and only touches
entries pointing at its own local URL. The first time it changes a file it keeps a
`<file>.ghars.bak` copy. **Disconnect** removes only Ghars's own hooks, never yours, even when they
share a group. The hooks always exit successfully, so your tools don't report an error while Ghars
isn't running, and after an update Ghars upgrades the hooks it installed on its first launch.
If another program holds port 47821, Settings → AI tools shows a warning.

| Tool | Config file | Notes |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | Command hook (`curl`); your prompt is never sent to Ghars |
| Cursor | `~/.cursor/hooks.json` | |
| Codex CLI | `~/.codex/hooks.json` | Codex asks you to trust new hooks once: run `/hooks` and approve the Ghars entries |
| Gemini CLI | `~/.gemini/settings.json` | |
| GitHub Copilot | `~/.copilot/hooks/ghars.json` (`$COPILOT_HOME/hooks/` if set) | A file of Ghars's own, deleted on Disconnect. Read by Copilot CLI (restart it after connecting) and by Copilot agent mode in VS Code, which always looks in `~/.copilot/hooks` |

Prefer to let your agent do it? Install the bundled **ghars-setup** skill (Settings → AI tools →
Install skill) and ask your agent to "set up Ghars". The skill lives in [`skills/ghars-setup`](skills/ghars-setup/SKILL.md).

### Local API

Ghars listens on `127.0.0.1:47821` only. Anything can tell it you're waiting:

```sh
curl -X POST http://127.0.0.1:47821/v1/busy   # island opens with adhkar
npm run build
curl -X POST http://127.0.0.1:47821/v1/idle
```

| Endpoint | |
|---|---|
| `POST /v1/event/{source}/{busy\|idle\|attention\|end}` | Used by hooks; the body may contain the tool's `session_id` |
| `POST /v1/busy`, `/v1/idle`, `/v1/attention` | For scripts (`?session=` optional) |
| `GET /v1/status` | `{ busy, attention, sources }` |
| `GET /health` | `200` while Ghars is running (used by the setup skill) |
| `GET /v1/integrations`, `POST /v1/setup` | Used by the setup skill (`POST` needs header `X-Ghars: 1`) |

Requests from web pages (anything sending an `Origin` header, or a `Host` other than `127.0.0.1` /
`localhost`) are rejected.

## Platform notes

| | Windows | macOS | Linux |
|---|---|---|---|
| Island, hooks, hotkey, prayer times | ✓ | ✓ | ✓ (hotkey: see Wayland below) |
| Click-through around the island | ✓ | ✓ | window resizes to fit the island instead |
| Island on the side edges | ✓ | ✓ | top edge only |
| Hide during full screen | ✓ (system API) | ✓ (window list) | ✓ X11 (window size) |
| Tray icon click | left: settings, right: menu | menu | menu |

On Linux, a compositing window manager is needed for transparency, and any click on the tray icon
opens its menu (there's no left-click action or tooltip).

Wayland is more limited, because apps can't grab keys globally, read the mouse pointer or place
their own windows:

- the global shortcut doesn't fire while a native Wayland app is focused;
- dragging the island and "the screen with the mouse pointer" don't work;
- staying on top, and where the island sits, depend on the compositor.

Starting Ghars with `GDK_BACKEND=x11` (so it runs through XWayland) often helps with placement.

## Content

The listen clips in `public/audio` are generated with `OPENAI_API_KEY=... node scripts/generate-audio.mjs`
(`--force --only id1,id2` to redo some; needs Node 22.18+, which runs the `.ts` content file directly).
Each clip must be checked by a native Arabic speaker.

Texts follow *Hisn al-Muslim*, with the hadith or ayah reference shown for each dhikr. Meanings in
languages other than English live in `src/i18n/<lang>.ts` and are drafts that need review. Qur'anic
passages use standard spelling with full tashkeel rather than the Uthmani script. The content lives
in [`src/shared/content.ts`](src/shared/content.ts) — **corrections from people of knowledge are very
welcome**: please open an issue with the item and the reference.

## Develop

Requirements: Node 22.12+, pnpm 10, Rust (stable), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
for your OS.

```sh
pnpm install
pnpm tauri dev          # run the app
pnpm dev                # UI only, in a normal browser with a fake backend:
                        #   http://localhost:1437/?theme=clay&lang=en&prayer=1
                        #   http://localhost:1437/settings.html
pnpm lint               # ESLint (TypeScript + React hooks rules)
pnpm test               # Vitest unit tests: prayer times, settings, stats, content, i18n
cd src-tauri && cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test
pnpm tauri build        # installers for your OS (needs the updater key, see docs/RELEASING.md)
```

In the browser mode, the console exposes `__ghars.agent("busy")`, `__ghars.waiting()` and
`__ghars.hotkey()` to simulate backend events.

Layout:

```
src/island/       the island window (React)
src/settings/     the settings window
src/shared/       content, themes, wheel, prayer times, settings & stats storage
src-tauri/src/    lib.rs (windows, tray, hotkey, click-through), server.rs (local API),
                  integrations.rs (AI tool hooks), watcher.rs (waiting guess, full screen),
                  tracker.rs (agent sessions), updates.rs (update checks)
skills/           the ghars-setup agent skill
```

Adding a theme: add a `.theme-<id>` block in `src/shared/themes.css` and an entry (with its top-edge
`solid` colour) in `src/shared/themes.ts`.

Adding a language: copy `src/i18n/ar.ts`, translate it, and register it in `src/i18n/index.ts`.
Anything missing falls back to English, but `pnpm test` expects every key and `{placeholder}` of `en.ts`.

## License

[MIT](LICENSE). Fonts are bundled from [Fontsource](https://fontsource.org) under the SIL Open Font License.
