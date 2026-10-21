# Developing Ghars

Ghars is a [Tauri 2](https://tauri.app) app: a Rust backend with React + TypeScript windows.

## Build and run

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
pnpm tauri build        # installers for your OS (needs the updater key, see RELEASING.md)
```

In the browser mode, the console exposes `__ghars.agent("busy")`, `__ghars.waiting()` and
`__ghars.hotkey()` to simulate backend events. The URL options are listed at the top of
[`src/dev/browser-mock.ts`](../src/dev/browser-mock.ts); `?open=1&count=33` opens the island with
a count, which is how the README screenshots are taken.

To publish a release, see [RELEASING.md](RELEASING.md).

## Layout

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

## Content

Texts follow *Hisn al-Muslim*, with the hadith or ayah reference shown for each dhikr. Meanings in
languages other than English live in `src/i18n/<lang>.ts` and are drafts that need review. Qur'anic
passages use standard spelling with full tashkeel rather than the Uthmani script. The content lives
in [`src/shared/content.ts`](../src/shared/content.ts).

The listen clips in `public/audio` are generated with `OPENAI_API_KEY=... node scripts/generate-audio.mjs`
(`--force --only id1,id2` to redo some; needs Node 22.18+, which runs the `.ts` content file directly).
Each clip must be checked by a native Arabic speaker. Whole surahs are left out until there is a
human recitation.
