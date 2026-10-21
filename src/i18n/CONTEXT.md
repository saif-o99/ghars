# Translator's guide

Ghars (غرس, "planting") is a free desktop app for Muslims. A small "island" sits at the
top of the screen. Hovering it opens it, and the user counts istighfar and adhkar by
turning a 3D scroll wheel. It also opens by itself while an AI coding agent (Claude
Code, Cursor, Codex, Gemini CLI, GitHub Copilot) is working, so the user can do dhikr while they wait.

`en.ts` is the source. Every other file is a partial copy, and any key it leaves out
falls back to English.

## How to translate

- Translate the meaning in context, not word for word. Write the way a native-speaking
  designer would label a modern app (think of how Apple or Google localise their
  settings screens). Keep it short where the space is short: tabs, buttons and
  segmented options.
- Keep a respectful, warm tone for the religious wording. Use the usual Muslim terms of
  your language (for example istighfar, dhikr/zikir/zikr, adhkar/wirid, Fajr…) rather
  than literal translations.
- Placeholders such as `{prayer}`, `{n}`, `{city}` must stay exactly as written.
- **Plurals.** A placeholder can choose a form by number:
  `{n|one:# day|other:# days}`. `#` is replaced by the number, and the categories are
  those of `Intl.PluralRules` for your language (`zero`, `one`, `two`, `few`, `many`,
  `other`). Use this wherever your grammar needs it; leave it out where it doesn't.
- Keep product and technical names as they are: Ghars (Arabic: غرس), Claude Code,
  Cursor, Codex, Gemini, GitHub Copilot, Copilot CLI, VS Code, CSV, JSON, Enter, `ghars-setup`, shortcut names such as Alt+Shift+G,
  Task Manager / Activity Monitor (use your OS's localised names if they are well
  known, e.g. French "Gestionnaire des tâches").
- "Island" is the app's floating panel, like Apple's Dynamic Island. Use the word your
  language uses for Dynamic Island if there is one, otherwise a natural equivalent.
- "Agent" means an AI coding assistant that runs on its own.
- "Hooks" are small settings entries that let the AI tool tell Ghars when it starts and
  stops.

## Where each string appears

### `island` (the floating island; very little space)
- `istighfar`, `adhkar`: the two tabs at the top of the open island.
- `slowDown`: a small pill shown when the user counts too fast ("let the heart follow
  the tongue").
- `next`, `prev`: arrows that move between adhkar.
- `count`: accessible label of the wheel and the arrows (screen readers).
- `fridayKahf`: a note on Fridays in the Friday set.
- `prayerNow`, `prayerSoon`: a quiet note when prayer time comes, or a few minutes before.
- `dismiss`, `close`: the × button. `completed`: screen-reader text for the ✓ when a
  dhikr's count is reached.

### `settings` (the settings window, with a sidebar of sections)
- `title`, `tagline`: shown under the logo in the sidebar.
- `sections.*`: sidebar items and page titles. `desc.*`: one line under each page title.
- `welcomeBody`, `step1-3`, `finish`: the first-run page. "Every notch counts" means
  each click of the wheel counts once.
- **Appearance:** `preview`/`previewHint` (live preview panel beside the controls),
  `themes` (heading above the theme swatches), `islandStyle` (Floating vs. Notch:
  attached to the top edge of the screen), `size`, `position`, `screen` (which monitor;
  `screenCursor` = the island moves to the screen the mouse pointer is on; `screenHelp`
  explains it), `themeMode` (one theme, or a different theme for light and dark mode;
  `themeFor` + `light`/`dark` pick which of the two you are editing),
  `showTranslation` (show the meaning under the Arabic), `showSource` (hadith/ayah
  reference).
- **Counting:** `istighfarPhrase` (which istighfar wording), `goal` (daily istighfar
  target), `pack` (which adhkar set; `packAuto` = chosen by time of day), `sound`,
  `myAdhkar*` (user's own adhkar:
  text, meaning, count, source).
- **AI tools:** one card per tool: `detected` (installed on this computer),
  `notDetected`, `connected`, `connect`/`disconnect`. `autoOpen*` = what the island does when the AI starts.
  `codexNote` = an extra step Codex needs. `copilotNote` = shown on the connected Copilot
  card: the same hooks serve the Copilot CLI and VS Code's Copilot agent mode. `skill*` = numbered steps to let the AI tool
  set itself up. `advanced` is a collapsible section that holds `api` (an example for
  scripts).
- **Prayer times:** city picker (searchable), coordinates, timezone (searchable),
  calculation method, `madhab` (the Asr calculation: majority vs. Hanafi), reminders
  (`notifyBefore` uses `{n}` = 5, 10 or 15 minutes), Hijri date and its ±day adjustment.
  `highLat*` is the rule for places where twilight lasts all night in summer: Fajr and
  Isha come from the middle, or one-seventh, of the night, or from the twilight angle.
- **General (`behavior`):** start with the system, hide in full-screen apps, keyboard
  shortcut, pause for 30 min / 1 h / 3 h / until resumed, quiet hours.
- **Stats:** today, week/month views, backup export/restore (`imported` uses `{n}` days).
- **About:** version, updates (`checkUpdates` toggle, `checkNow` button and its results;
  `updateAvailable` uses `{version}` such as 1.2.3, `updateDownloading` uses `{progress}` =
  "45%" or "3.2 MB"), privacy, sources (Hisn al-Muslim), translation note, licence, `madeBy` (`{name}` = the
  author, kept in Latin letters) and `reportIssue` (followed by a link to GitHub issues).
- **Messages and controls:** `*Failed`, `importInvalid`, `coordsInvalid` and `serverError`
  (`{port}` is a number) are error notes. `minimize`/`maximize`/`restore`/`closeWindow`
  are the title-bar buttons, `prevMonth`/`nextMonth` the month arrows in Stats,
  `statsRange` names the week/month switch, `noResults` shows when a search finds
  nothing. `hotkeyHelp` uses `{key}` = the default shortcut.

### `packs`, `prayers`
Names of the adhkar sets and the five prayers, in the usual form for your language.

### `content`
Meanings of the adhkar, keyed by id; the English meanings live in
`src/shared/content.ts`. Follow established translations of the hadith and Qur'an in
your language where they exist.
