//! macOS: the island as a non-activating panel, the cursor, full-screen detection, and the
//! app menu.

use crate::macos_geometry::{self, Bounds, WindowInfo};
use crate::{AppState, CONFIG, WIN_H, WIN_W, island};
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_app_kit::{NSEvent, NSResponder, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask};
use objc2_foundation::{NSArray, NSDictionary, NSNumber, NSRect, NSString, ns_string};
use std::ffi::c_void;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_nspanel::{ManagerExt, WebviewWindowExt};

// The macro also generates helpers Ghars doesn't use.
#[allow(dead_code)]
mod panel {
    use std::sync::atomic::Ordering;

    tauri_nspanel::tauri_panel! {
        panel!(IslandPanel {
            config: {
                can_become_key_window: super::KEYABLE.load(Ordering::Relaxed),
                can_become_main_window: false,
                hides_on_deactivate: false
            }
        })
    }
}

/// Whether the island may become the key window (take the keyboard): only while it is
/// focused by the hotkey or a click on the open island, as on the other platforms.
static KEYABLE: AtomicBool = AtomicBool::new(false);

/// NSMainMenuWindowLevel + 1: the notch style covers the menu bar.
const NOTCH_LEVEL: i64 = 25;
/// The level tao gives always-on-top windows: above other apps' windows (full-screen ones
/// included), below the menu bar and the Dock.
const FLOATING_LEVEL: i64 = 5;

fn island_level() -> i64 {
    if CONFIG.read().unwrap().island_style == "notch" {
        NOTCH_LEVEL
    } else {
        FLOATING_LEVEL
    }
}

/// Turns the island window into a non-activating panel. A background app's ordinary window
/// isn't reliably shown over another app's full-screen Space, a panel is; and a
/// non-activating one takes clicks without making Ghars the active app, which would also pull
/// the user out of a full-screen app. Must run on the main thread.
pub fn make_island_panel(app: &AppHandle) {
    let Some(win) = island(app) else { return };
    let panel = match win.to_panel::<panel::IslandPanel>() {
        Ok(panel) => panel,
        Err(e) => {
            log::error!("Could not turn the island into a panel: {e}");
            return;
        }
    };
    if let Err(e) = panel.add_style_mask(NSWindowStyleMask::NonactivatingPanel) {
        log::error!("Could not make the island non-activating: {e}");
    }
    // On every Space, other apps' full-screen ones included; it stays put when Spaces switch
    // and out of the window cycle.
    panel.set_collection_behavior(
        NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::Stationary
            | NSWindowCollectionBehavior::IgnoresCycle
            | NSWindowCollectionBehavior::FullScreenAuxiliary,
    );
    let level = island_level();
    panel.set_level(level);
    log::info!("The island is a non-activating panel, at window level {level}");
}

/// The notch style hugs the top of the screen, so it sits above the menu bar.
pub fn set_island_level(app: &AppHandle) {
    let Ok(panel) = app.get_webview_panel("island") else {
        return;
    };
    let level = island_level();
    let _ = app.run_on_main_thread(move || panel.set_level(level));
}

/// Shows the island in front without making it key or activating Ghars (a plain `show`
/// would do both), or hides it.
pub fn set_island_visible(app: &AppHandle, visible: bool) {
    match app.get_webview_panel("island") {
        Ok(panel) => {
            let _ = app.run_on_main_thread(move || if visible { panel.show() } else { panel.hide() });
        }
        Err(_) => {
            if let Some(win) = island(app) {
                let _ = if visible { win.show() } else { win.hide() };
            }
        }
    }
}

/// Gives the island the keyboard without activating Ghars: a non-activating panel can be the
/// key window while another app stays active. The page must be the first responder too, or
/// the keys stop at the window.
pub fn focus_island(app: &AppHandle) {
    KEYABLE.store(true, Ordering::Relaxed);
    let (Some(win), Ok(panel)) = (island(app), app.get_webview_panel("island")) else {
        return;
    };
    let _ = win.with_webview(move |webview| {
        panel.make_key_window();
        // SAFETY: the island's WKWebView (an NSResponder), alive as long as its window.
        if let Some(view) = unsafe { webview.inner().cast::<NSResponder>().as_ref() } {
            let _ = panel.make_first_responder(Some(view));
        }
    });
}

/// Stops the island taking the keyboard. If it has it, ordering it out and straight back in
/// hands the keyboard back to the app in front.
pub fn release_island_focus(app: &AppHandle) {
    KEYABLE.store(false, Ordering::Relaxed);
    let Ok(panel) = app.get_webview_panel("island") else {
        return;
    };
    let _ = app.run_on_main_thread(move || {
        if panel.as_panel().isKeyWindow() && panel.is_visible() {
            panel.hide();
            panel.show();
        }
    });
}

/// Lets the settings window go full screen from its green button: the windows of a menu-bar
/// (accessory) app can only zoom unless they ask for it.
pub fn allow_full_screen(win: &WebviewWindow) {
    let Ok(ns_window) = win.ns_window() else { return };
    let ns_window = ns_window as usize;
    let _ = win.run_on_main_thread(move || {
        // SAFETY: the settings window's NSWindow, used on the main thread.
        let window = unsafe { &*(ns_window as *const NSWindow) };
        window.setCollectionBehavior(window.collectionBehavior() | NSWindowCollectionBehavior::FullScreenPrimary);
    });
}

// ---------------------------------------------------------------- app menu

/// The app menu, shown while the settings window is in front: macOS's default one with
/// Settings… added, and Quit going the tray's way so the windows get to save first. Both use
/// the tray menu's ids; its handler gets every menu event.
pub fn app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let t = crate::labels();
    let menu = Menu::default(app)?;
    let items = menu.items()?;
    if let Some(sub) = items.first().and_then(|i| i.as_submenu()) {
        // About, separator, Services, separator, Hide, Hide Others, separator, Quit.
        let sub_items = sub.items()?;
        if let Some(quit) = sub_items.last() {
            sub.remove(quit)?;
        }
        sub.append(&MenuItem::with_id(app, "quit", t.quit, true, Some("CmdOrCtrl+Q"))?)?;
        let settings = format!("{}…", t.settings);
        sub.insert(
            &MenuItem::with_id(app, "settings", settings, true, Some("CmdOrCtrl+,"))?,
            2,
        )?;
        sub.insert(&PredefinedMenuItem::separator(app)?, 3)?;
    }
    Ok(menu)
}

/// Rebuilt when the interface language changes.
pub fn rebuild_app_menu(app: &AppHandle) {
    match app_menu(app) {
        Ok(menu) => {
            let _ = app.set_menu(menu);
        }
        Err(e) => log::warn!("Could not rebuild the app menu: {e}"),
    }
}

// ---------------------------------------------------------------- cursor and displays

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGMainDisplayID() -> u32;
    fn CGDisplayBounds(display: u32) -> NSRect;
    fn CGGetActiveDisplayList(max_displays: u32, displays: *mut u32, count: *mut u32) -> i32;
    fn CGWindowListCopyWindowInfo(option: u32, relative_to_window: u32) -> *mut c_void;
    fn CGRectMakeWithDictionaryRepresentation(dict: *const c_void, rect: *mut NSRect) -> bool;
}

fn bounds(r: NSRect) -> Bounds {
    Bounds {
        x: r.origin.x,
        y: r.origin.y,
        w: r.size.width,
        h: r.size.height,
    }
}

/// The cursor in points from the top-left of the main display, the coordinates CoreGraphics
/// and tao use. `+[NSEvent mouseLocation]` may be called from any thread, so this needs no
/// round trip through the event loop. It counts from the bottom-left; the main display's
/// height to flip it is cached, and read again every so often in case the displays changed.
pub fn cursor_position() -> (f64, f64) {
    static MAIN_HEIGHT: AtomicU64 = AtomicU64::new(0);
    static CALLS: AtomicU32 = AtomicU32::new(0);
    let mut height = f64::from_bits(MAIN_HEIGHT.load(Ordering::Relaxed));
    if height <= 0.0 || CALLS.fetch_add(1, Ordering::Relaxed).is_multiple_of(64) {
        height = unsafe { CGDisplayBounds(CGMainDisplayID()) }.size.height;
        MAIN_HEIGHT.store(height.to_bits(), Ordering::Relaxed);
    }
    let p = NSEvent::mouseLocation();
    (p.x, height - p.y)
}

/// Every display's bounds in points, from the top-left of the main display.
fn displays() -> Vec<Bounds> {
    let mut ids = [0u32; 16];
    let mut count = 0u32;
    if unsafe { CGGetActiveDisplayList(ids.len() as u32, ids.as_mut_ptr(), &mut count) } != 0 {
        return Vec::new();
    }
    ids[..(count as usize).min(ids.len())]
        .iter()
        .map(|&id| bounds(unsafe { CGDisplayBounds(id) }))
        .collect()
}

// ---------------------------------------------------------------- full screen

/// Whether a full-screen app is in front on the island's display. It reads the window list
/// from CoreGraphics (from any thread, and window bounds and owners need no permission)
/// rather than asking which app is frontmost: that may be Ghars itself, and with several
/// displays the app in front of the island isn't necessarily the active one.
pub fn is_fullscreen(app: &AppHandle) -> bool {
    let Some((pos, scale)) = *app.state::<AppState>().island_geom.lock().unwrap() else {
        return false;
    };
    let (cx, cy) = (pos.x as f64 / scale + WIN_W / 2.0, pos.y as f64 / scale + WIN_H / 2.0);
    let Some(display) = displays().into_iter().find(|d| d.contains(cx, cy)) else {
        return false;
    };
    let windows = on_screen_windows();
    let found = macos_geometry::full_screen_window(&display, &windows, std::process::id() as i64);
    log_full_screen(&display, found);
    found.is_some()
}

/// The windows on screen, front to back.
fn on_screen_windows() -> Vec<WindowInfo> {
    const ON_SCREEN_ONLY: u32 = 1 << 0;
    const EXCLUDE_DESKTOP_ELEMENTS: u32 = 1 << 4;
    // SAFETY: a CFArray of CFDictionary we own (a Copy function), toll-free bridged to
    // NSArray and NSDictionary.
    let list = unsafe {
        Retained::from_raw(
            CGWindowListCopyWindowInfo(ON_SCREEN_ONLY | EXCLUDE_DESKTOP_ELEMENTS, 0)
                .cast::<NSArray<NSDictionary<NSString, AnyObject>>>(),
        )
    };
    let Some(list) = list else { return Vec::new() };
    list.iter()
        .filter_map(|w| {
            let number = |key: &NSString| w.objectForKey(key)?.downcast_ref::<NSNumber>().map(|n| n.doubleValue());
            let dict = w.objectForKey(ns_string!("kCGWindowBounds"))?;
            let mut rect = NSRect::default();
            if !unsafe { CGRectMakeWithDictionaryRepresentation(Retained::as_ptr(&dict).cast(), &mut rect) } {
                return None;
            }
            let owner = w
                .objectForKey(ns_string!("kCGWindowOwnerName"))
                .and_then(|o| o.downcast_ref::<NSString>().map(|s| s.to_string()))
                .unwrap_or_default();
            Some(WindowInfo {
                pid: number(ns_string!("kCGWindowOwnerPID"))? as i64,
                layer: number(ns_string!("kCGWindowLayer"))? as i64,
                alpha: number(ns_string!("kCGWindowAlpha")).unwrap_or(1.0),
                bounds: bounds(rect),
                owner,
            })
        })
        .collect()
}

/// Logs which full-screen window (if any) is in front when that changes.
fn log_full_screen(display: &Bounds, found: Option<&WindowInfo>) {
    static LAST: Mutex<Option<String>> = Mutex::new(None);
    let now = found.map(|w| format!("{} (pid {}, layer {}, {:?})", w.owner, w.pid, w.layer, w.bounds));
    let mut last = LAST.lock().unwrap();
    if *last != now {
        match &now {
            Some(w) => log::info!("Full-screen window in front on display {display:?}: {w}"),
            None => log::info!("No full-screen window in front on display {display:?}"),
        }
        *last = now;
    }
}
