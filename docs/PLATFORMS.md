# Platform notes

| | Windows | macOS | Linux |
|---|---|---|---|
| Island, hooks, hotkey, prayer times | ✓ | ✓ | ✓ (hotkey: see Wayland below) |
| Click-through around the island | ✓ | ✓ | window resizes to fit the island instead |
| Island on the side edges | ✓ | ✓ | top edge only |
| Hide during full screen | ✓ (system API) | ✓ (window list) | ✓ X11 (window size) |
| Tray icon click | left: settings, right: menu | menu | menu |

The global shortcut is `Cmd+Option+G` on macOS and `Alt+Shift+G` on Windows and Linux; you can
change it in Settings.

## Linux

A compositing window manager is needed for transparency, and any click on the tray icon opens its
menu (there's no left-click action or tooltip).

Wayland is more limited, because apps can't grab keys globally, read the mouse pointer or place
their own windows:

- the global shortcut doesn't fire while a native Wayland app is focused;
- dragging the island and "the screen with the mouse pointer" don't work;
- staying on top, and where the island sits, depend on the compositor.

Starting Ghars with `GDK_BACKEND=x11` (so it runs through XWayland) often helps with placement.
