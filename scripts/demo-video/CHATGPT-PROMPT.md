# Prompt: record the Ghars demo video on a Mac

Copy everything below the line into ChatGPT on the Mac.

---

You're helping me record a polished demo video of my app **Ghars** on my Mac (Intel, macOS).
Guide me step by step and wait for my answer after each step. If you can run Terminal commands
yourself, run them; otherwise tell me exactly what to type and what output to expect.

## What Ghars is

Ghars is a free desktop app for istighfar and adhkar (Islamic remembrance). It shows a small
"island" at the top of the screen. Hovering it opens it; scrolling counts (one scroll notch = one
count). It opens by itself while an AI coding agent is working. It has adhkar sets, 17 themes,
8 languages including Arabic (the whole interface mirrors right-to-left), prayer times and stats.
The bundle ID is `com.ghars.desktop`. It's already installed on this Mac.

## How the video is made

A Swift script plays a guided tour of the app by moving the mouse smoothly, scrolling, clicking
and pressing keys, while the screen recorder **Recordly** records. The script finds buttons by
their accessibility names (what VoiceOver reads), not by screen position. It's here:
https://github.com/saif-o99/ghars/blob/main/scripts/demo-video/ghars-demo.swift

The tour, about 60 seconds:

1. Opens the island by hovering it and counts istighfar by scrolling.
2. Switches to the Adhkar tab, counts, goes to the next dhikr twice, then picks "Morning adhkar"
   from the set menu.
3. Moves away so the island closes, opens it again with the shortcut ⌘⌥G, then presses Esc.
4. Simulates an AI agent starting work (a POST to `http://127.0.0.1:47821/v1/busy`, the same
   signal a connected agent sends), so the island opens by itself; counts a few, then sends idle.
5. Opens Settings from the island's ⚙ button. On the Appearance page it clicks through the themes
   Classic Fes, Iznik Tile, Lantern Night, Marrakech Red and back to Graphite; switches the island
   to Floating, moves it to the left screen edge and back to the top, then back to Notch.
6. Shows the Prayer times page, then the Stats page.
7. Switches the interface language to العربية and back to English.
8. Closes Settings.

## Steps

### 1. Get the tools

- Check Apple's Command Line Tools with `xcode-select -p`. If it prints no path, run
  `xcode-select --install` and wait for it to finish (it provides the `swift` command).
- Download the script:
  ```sh
  mkdir -p ~/ghars-demo && cd ~/ghars-demo
  curl -fsSLO https://raw.githubusercontent.com/saif-o99/ghars/main/scripts/demo-video/ghars-demo.swift
  ```
- Install Recordly from https://www.recordly.dev (open-source screen recorder for demo videos).
  Give it Screen Recording permission when macOS asks.

### 2. Prepare Ghars (in its Settings window)

- Interface language: **English**.
- Appearance: theme **Graphite**, island style **Notch**, screen edge **Top**, size **Normal**.
- Prayer times: turned **on**, with a city chosen (so the Prayer times page isn't empty).
- AI tools: "When the AI starts" set to **Open small** (the default).
- Count a little first, so the Stats page has some numbers.
- Close the Settings window.

### 3. Prepare the Mac

- Turn on **Do Not Disturb** (Control Center → Focus).
- Hide desktop icons: `defaults write com.apple.finder CreateDesktop false; killall Finder`
  (undo afterwards with `defaults write com.apple.finder CreateDesktop true; killall Finder`).
- Choose a calm, simple wallpaper (System Settings → Wallpaper).
- Quit apps that might pop up windows or notifications.
- Give **Terminal** Accessibility permission: System Settings → Privacy & Security →
  Accessibility → turn on Terminal. The script can't move the mouse or read Ghars's buttons without it.

### 4. Practice run (not recorded)

```sh
cd ~/ghars-demo
swift ghars-demo.swift --slow
```

It counts down from 3, hides Terminal, plays the tour at half speed and prints each step.
Don't touch the mouse or keyboard while it runs. Watch whether each step does the right thing.
Lines starting with `⚠️ NOT FOUND` mean a button wasn't found.

### 5. Fix problems, if any

Only edit `ghars-demo.swift`; never change the Ghars app itself.

- **A button isn't found:** run `swift ghars-demo.swift --list` while the relevant window is open
  (for Settings, open it first). It prints every control with its role, accessible name, position
  and parent names. Find the right name and update the matching `clickOn("…")` line in `SCENES`.
  If a role is missing from `clickableRoles`, add it there.
- **The island doesn't open on hover:** `hoverIsland()` aims 14 px below the island's top edge.
  Use `--list` to see the frame of the "Ghars" region and adjust the offset.
- **Scrolling counts more or less than once per notch:** change `pixelsPerCount`. Ghars counts
  once per 50 px of scrolling, so each event should be just over 50 px.
- **⌘⌥G doesn't open the island:** check Ghars's shortcut in Settings → General.
- **Re-test one scene:** `swift ghars-demo.swift --only 5 --slow` runs only scene 5 (scenes are
  numbered 1–8 in the order above). Scenes 6–8 expect the Settings window to be open already.

Repeat until a `--slow` run is clean.

### 6. Record

1. In Recordly, set up a recording of the **entire display** (no microphone or system audio needed).
2. Start recording.
3. In Terminal, run `swift ghars-demo.swift` (normal speed), then keep your hands off.
4. When Terminal comes back and prints "Done", stop the recording.

### 7. Edit in Recordly

- Cursor: turn on smoothing, and use the macOS-style cursor.
- Zoom: use the automatic zoom suggestions, keep the ones that zoom into the island or the
  Settings controls being clicked, and remove any that feel too fast or jumpy. Keep zooms gentle.
- Background: put the recording in a frame with a soft gradient or blurred wallpaper, some
  padding, rounded corners and a shadow.
- Trim dead time at the start and end.

### 8. Export two videos

1. **`ghars-tour.mp4`:** the whole tour, 1080p MP4, **under 10 MB** (GitHub's limit for videos
   in a README). If it's bigger, lower the quality or export at 720p.
2. **`ghars-hero.mp4`:** only the first scene (the island opening and counting), about 8 seconds,
   1080p, small file.

### 9. Hand them over

GitHub only plays a video inline in a README if it was uploaded through the GitHub website.
To get a link for each video:

1. Open https://github.com/saif-o99/ghars/issues/new in the browser (signed in).
2. Drag both MP4 files into the comment box and wait until each turns into a
   `https://github.com/user-attachments/assets/…` link.
3. Copy the two links. Don't submit the issue; just close the tab.

Then I'll give those two links to Claude, which adds them to both READMEs.

Undo the desktop-icons change from step 3 when you're done.
