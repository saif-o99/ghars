mod integrations;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(any(target_os = "macos", test))]
mod macos_geometry;
mod server;
mod tracker;
mod updates;
mod watcher;

use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::sync::atomic::AtomicU64;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex, RwLock};
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
#[cfg(not(target_os = "macos"))]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// Island window size in logical pixels. It is large enough for the biggest island
/// size; the island is drawn inside and everything else is click-through.
const WIN_W: f64 = 600.0;
const WIN_H: f64 = 520.0;

/// Passed by the login item, so a launch at login can be told apart from the user opening Ghars.
const AUTOSTART_ARG: &str = "--autostart";

fn launched_at_login() -> bool {
    std::env::args().any(|a| a == AUTOSTART_ARG)
}

/// Missing fields take their defaults, so a partial payload still applies.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    pub hide_in_fullscreen: bool,
    pub hotkey: String,
    pub ui_lang: String,
    /// Screen edge the island sits on: "top" | "left" | "right".
    pub island_edge: String,
    /// Where along that edge, 0 (left / top end) to 1 (right / bottom end).
    pub island_pos: f64,
    /// "primary" | "cursor" | a monitor index
    pub island_monitor: String,
    /// "floating" | "notch"
    pub island_style: String,
    /// Check GitHub Releases for a new version once a day.
    pub check_updates: bool,
    /// macOS: the floating island on the top edge sits at the very top of the screen, over
    /// the menu bar, instead of below it.
    pub island_over_menu_bar: bool,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            hide_in_fullscreen: false,
            hotkey: String::new(),
            ui_lang: "ar".into(),
            island_edge: "top".into(),
            island_pos: 0.5,
            island_monitor: "primary".into(),
            island_style: "floating".into(),
            check_updates: true,
            island_over_menu_bar: false,
        }
    }
}

pub static CONFIG: LazyLock<RwLock<Config>> = LazyLock::new(|| RwLock::new(Config::default()));

/// Where the island hangs inside its window: the edge, and the anchor point on that
/// edge in window (logical) pixels. The island is centred on the anchor and the
/// frontend clamps it to stay inside the window near the ends of the screen.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Anchor {
    edge: String,
    x: f64,
    y: f64,
}

impl Default for Anchor {
    fn default() -> Self {
        Anchor {
            edge: "top".into(),
            x: WIN_W / 2.0,
            y: 0.0,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
pub struct Rect {
    // Linux only resizes the window to the island's height; the hit test that reads x and w
    // doesn't exist there.
    #[cfg_attr(target_os = "linux", allow(dead_code))]
    x: f64,
    y: f64,
    #[cfg_attr(target_os = "linux", allow(dead_code))]
    w: f64,
    h: f64,
}

#[derive(Default)]
pub struct AppState {
    pub tracker: Mutex<tracker::Tracker>,
    hit_rect: Mutex<Rect>,
    pub fullscreen: AtomicBool,
    /// Quiet hours, reported by the island.
    quiet: AtomicBool,
    /// Paused from the tray or settings.
    pause: Mutex<Pause>,
    tray: Mutex<Option<TrayIcon>>,
    anchor: Mutex<Anchor>,
    /// The island window's position and scale factor, kept up to date from window events
    /// so the hit-testing loop never has to ask the event loop for them.
    island_geom: Mutex<Option<(PhysicalPosition<i32>, f64)>>,
    island_shown: AtomicBool,
    /// The island is open (not just the collapsed pill), as reported by the island.
    island_open: AtomicBool,
    /// Whether WebView2 was last asked to keep the island's memory low.
    island_memory_low: Mutex<Option<bool>>,
    /// The global shortcut that is actually registered (empty if none), so one that
    /// failed to register is tried again on the next `apply_config`.
    hotkey: Mutex<String>,
}

#[derive(Clone, Copy, Debug, Default)]
enum Pause {
    #[default]
    Off,
    /// Until resumed.
    Indefinite,
    Until(Instant),
}

/// The longest timed pause, so a huge `minutes` can't overflow the deadline.
const MAX_PAUSE_MINUTES: u64 = 7 * 24 * 60;

fn island(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("island")
}

/// The cursor and the display under it, with the cursor in the same physical pixels as
/// that display's position and size.
#[cfg(not(target_os = "macos"))]
fn cursor_and_monitor(app: &AppHandle) -> Option<(PhysicalPosition<f64>, Monitor)> {
    let c = app.cursor_position().ok()?;
    let monitor = app.monitor_from_point(c.x, c.y).ok().flatten()?;
    Some((c, monitor))
}

/// macOS finds displays by points but gives each display's bounds in its own scale.
#[cfg(target_os = "macos")]
fn cursor_and_monitor(app: &AppHandle) -> Option<(PhysicalPosition<f64>, Monitor)> {
    let (x, y) = macos::cursor_position();
    let monitor = app.monitor_from_point(x, y).ok().flatten()?;
    let scale = monitor.scale_factor();
    Some((PhysicalPosition::new(x * scale, y * scale), monitor))
}

fn target_monitor(app: &AppHandle, win: &WebviewWindow) -> Option<Monitor> {
    let choice = CONFIG.read().unwrap().island_monitor.clone();
    let picked = match choice.as_str() {
        "cursor" => cursor_and_monitor(app).map(|(_, m)| m),
        "" | "primary" => None,
        n => n
            .parse::<usize>()
            .ok()
            .and_then(|i| win.available_monitors().ok()?.into_iter().nth(i)),
    };
    picked.or_else(|| win.primary_monitor().ok().flatten())
}

/// Side edges need the window to follow the island around, which Linux (Wayland) can't
/// do, so there the island always sits on the top edge.
fn edge_of(c: &Config) -> &'static str {
    match c.island_edge.as_str() {
        "left" if !cfg!(target_os = "linux") => "left",
        "right" if !cfg!(target_os = "linux") => "right",
        _ => "top",
    }
}

/// The part of a display the island lives in: the whole screen for the notch style
/// (it hugs the physical edge), otherwise the work area (clear of menu bar / taskbar).
fn island_area(monitor: &Monitor, notch: bool) -> (PhysicalPosition<i32>, tauri::PhysicalSize<u32>) {
    if notch {
        (*monitor.position(), *monitor.size())
    } else {
        let a = monitor.work_area();
        (a.position, a.size)
    }
}

/// Places the island window on the chosen display and edge. The window is centred on
/// the island's anchor where possible and kept on screen; the anchor (in window
/// coordinates) is sent to the island so it can draw itself there.
pub fn position_island(app: &AppHandle) {
    let Some(win) = island(app) else { return };
    let Some(monitor) = target_monitor(app, &win) else {
        return;
    };
    let (edge, frac, notch, over_menu_bar) = {
        let c = CONFIG.read().unwrap();
        let edge = edge_of(&c);
        let over_menu_bar = cfg!(target_os = "macos") && c.island_over_menu_bar && edge == "top";
        (
            edge,
            c.island_pos.clamp(0.0, 1.0),
            c.island_style == "notch",
            over_menu_bar,
        )
    };
    let scale = monitor.scale_factor();
    // Over the menu bar, the floating island measures from the screen's top edge like the notch.
    let (pos, size) = island_area(&monitor, notch || over_menu_bar);
    let (ww, wh) = ((WIN_W * scale) as i32, (WIN_H * scale) as i32);
    let (left, top) = (pos.x, pos.y);
    let (right, bottom) = (left + size.width as i32, top + size.height as i32);
    let (x, y, anchor) = if edge == "top" {
        let cx = left + (frac * size.width as f64) as i32;
        let x = (cx - ww / 2).clamp(left, (right - ww).max(left));
        (
            x,
            top,
            Anchor {
                edge: edge.into(),
                x: (cx - x) as f64 / scale,
                y: 0.0,
            },
        )
    } else {
        let cy = top + (frac * size.height as f64) as i32;
        let y = (cy - wh / 2).clamp(top, (bottom - wh).max(top));
        let x = if edge == "left" { left } else { right - ww };
        (
            x,
            y,
            Anchor {
                edge: edge.into(),
                x: 0.0,
                y: (cy - y) as f64 / scale,
            },
        )
    };
    let target = PhysicalPosition::new(x, y);
    if win.outer_position().ok() != Some(target) {
        let _ = win.set_position(target);
    }
    let state = app.state::<AppState>();
    let changed = {
        let mut current = state.anchor.lock().unwrap();
        let changed = *current != anchor;
        *current = anchor.clone();
        changed
    };
    if changed {
        let _ = app.emit_to("island", "island-anchor", anchor);
    }
}

/// Read-only: the watcher ends an expired timed pause (`end_expired_pause`).
pub fn is_paused(app: &AppHandle) -> bool {
    match *app.state::<AppState>().pause.lock().unwrap() {
        Pause::Off => false,
        Pause::Indefinite => true,
        Pause::Until(until) => Instant::now() < until,
    }
}

pub fn sync_island_visibility(app: &AppHandle) {
    let Some(win) = island(app) else { return };
    let state = app.state::<AppState>();
    let hide = is_paused(app) || state.quiet.load(Ordering::Relaxed) || state.fullscreen.load(Ordering::Relaxed);
    if hide == win.is_visible().unwrap_or(true) {
        #[cfg(target_os = "macos")]
        macos::set_island_visible(app, !hide);
        #[cfg(not(target_os = "macos"))]
        let _ = if hide { win.hide() } else { win.show() };
    }
    state.island_shown.store(!hide, Ordering::Relaxed);
    update_island_memory_target(app);
}

/// While the island is closed or hidden, asks WebView2 to keep its memory low (it trims
/// caches and lets the OS reclaim memory); back to normal as soon as it opens.
fn update_island_memory_target(app: &AppHandle) {
    let state = app.state::<AppState>();
    let low = !(state.island_shown.load(Ordering::Relaxed) && state.island_open.load(Ordering::Relaxed));
    {
        let mut current = state.island_memory_low.lock().unwrap();
        if *current == Some(low) {
            return;
        }
        *current = Some(low);
    }
    #[cfg(windows)]
    if let Some(win) = island(app) {
        let _ = win.with_webview(move |webview| {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
                ICoreWebView2_19,
            };
            use windows::core::Interface;
            let level = if low {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
            } else {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
            };
            unsafe {
                if let Ok(core) = webview.controller().CoreWebView2()
                    && let Ok(core) = core.cast::<ICoreWebView2_19>()
                {
                    let _ = core.SetMemoryUsageTargetLevel(level);
                }
            }
        });
    }
}

/// Keeps the island's cached position and scale current (see `AppState::island_geom`).
fn track_island_geometry(window: &tauri::Window, event: &tauri::WindowEvent) {
    if window.label() != "island" {
        return;
    }
    let state = window.state::<AppState>();
    match event {
        tauri::WindowEvent::Moved(pos) => {
            let mut geom = state.island_geom.lock().unwrap();
            if let Some(scale) = geom.map(|g| g.1).or_else(|| window.scale_factor().ok()) {
                *geom = Some((*pos, scale));
            }
        }
        tauri::WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
            let mut geom = state.island_geom.lock().unwrap();
            if let Some(pos) = geom.map(|g| g.0).or_else(|| window.outer_position().ok()) {
                *geom = Some((pos, *scale_factor));
            }
        }
        _ => {}
    }
}

/// The island window is mostly transparent. Clicks pass through it except over the
/// island itself: we watch the cursor and toggle click-through accordingly.
#[cfg(not(target_os = "linux"))]
fn start_hit_testing(app: AppHandle) {
    std::thread::spawn(move || {
        let mut ignoring: Option<bool> = None;
        loop {
            let wait = hit_test(&app, &mut ignoring);
            std::thread::sleep(wait);
        }
    });
}

/// One hit-testing pass. Returns how long to wait before the next one: often while the
/// cursor is near the island, less often when it's far away, and rarely while the island
/// is hidden. Positions come from caches and (on Windows) straight from the OS, so a pass
/// doesn't wake the event loop unless click-through actually has to change.
#[cfg(not(target_os = "linux"))]
fn hit_test(app: &AppHandle, ignoring: &mut Option<bool>) -> Duration {
    // macOS reports hover to the island from here (see below), so it is polled at about the
    // display's rate there; a pass costs next to nothing.
    const NEAR: Duration = Duration::from_millis(if cfg!(target_os = "macos") { 16 } else { 30 });
    const FAR: Duration = Duration::from_millis(100);
    const HIDDEN: Duration = Duration::from_millis(250);
    /// Logical pixels around the island within which the cursor counts as near.
    const NEAR_DISTANCE: f64 = 150.0;

    let state = app.state::<AppState>();
    if !state.island_shown.load(Ordering::Relaxed) {
        return HIDDEN;
    }
    let Some((pos, scale)) = *state.island_geom.lock().unwrap() else {
        return HIDDEN;
    };
    let Some((x, y)) = cursor_position(app) else {
        return NEAR;
    };
    let rect = *state.hit_rect.lock().unwrap();
    // The cursor relative to the window, in logical pixels.
    #[cfg(windows)]
    let (cx, cy) = ((x - pos.x as f64) / scale, (y - pos.y as f64) / scale);
    #[cfg(target_os = "macos")]
    let (cx, cy) = (x - pos.x as f64 / scale, y - pos.y as f64 / scale);
    let inside = cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
    if *ignoring != Some(!inside)
        && let Some(win) = island(app)
    {
        *ignoring = Some(!inside);
        let _ = win.set_ignore_cursor_events(!inside);
        // WebKit only reports mouse enter/leave to the page while its app is active, which a
        // menu-bar app usually isn't, so the island learns about hover from here instead.
        #[cfg(target_os = "macos")]
        let _ = app.emit_to("island", "island-hover", inside);
    }
    let dx = (rect.x - cx).max(cx - (rect.x + rect.w)).max(0.0);
    let dy = (rect.y - cy).max(cy - (rect.y + rect.h)).max(0.0);
    if dx.hypot(dy) < NEAR_DISTANCE { NEAR } else { FAR }
}

/// The cursor in physical screen pixels, asked of the OS directly: much cheaper than a
/// round trip through the event loop.
#[cfg(windows)]
fn cursor_position(_app: &AppHandle) -> Option<(f64, f64)> {
    let mut p = windows::Win32::Foundation::POINT::default();
    unsafe { windows::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut p) }.ok()?;
    Some((p.x as f64, p.y as f64))
}

/// The cursor in points (logical pixels), asked of AppKit directly.
#[cfg(target_os = "macos")]
fn cursor_position(_app: &AppHandle) -> Option<(f64, f64)> {
    Some(macos::cursor_position())
}

/// Linux (notably Wayland) can't report the global cursor position, so instead the
/// window is resized to hug the island.
#[cfg(target_os = "linux")]
fn start_hit_testing(_app: AppHandle) {}

#[cfg(target_os = "linux")]
fn fit_window_to(app: &AppHandle, rect: Rect) {
    /// Bumped on every call, so a delayed shrink never overrides a newer size.
    static GENERATION: AtomicU64 = AtomicU64::new(0);
    let Some(win) = island(app) else { return };
    let app = app.clone();
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let grow = win
        .inner_size()
        .map(|s| (rect.h + rect.y + 16.0) * win.scale_factor().unwrap_or(1.0) > s.height as f64)
        .unwrap_or(true);
    std::thread::spawn(move || {
        if !grow {
            std::thread::sleep(Duration::from_millis(380)); // let the collapse animation finish
        }
        if GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        let Some(win) = island(&app) else { return };
        // GTK may ignore a new size for a window that isn't resizable.
        let _ = win.set_resizable(true);
        let _ = win.set_size(tauri::LogicalSize::new(WIN_W, (rect.y + rect.h + 24.0).min(WIN_H)));
        let _ = win.set_resizable(false);
        position_island(&app);
    });
}

// ---------------------------------------------------------------- commands

#[tauri::command]
fn set_hit_rect(app: AppHandle, state: tauri::State<AppState>, rect: Rect) {
    *state.hit_rect.lock().unwrap() = rect;
    #[cfg(target_os = "linux")]
    fit_window_to(&app, rect);
    #[cfg(not(target_os = "linux"))]
    let _ = app;
}

#[tauri::command]
fn apply_config(app: AppHandle, state: tauri::State<AppState>, config: Config) -> Result<(), String> {
    let old_lang = CONFIG.read().unwrap().ui_lang.clone();
    let hotkey = config.hotkey.clone();
    let lang_changed = config.ui_lang != old_lang;
    *CONFIG.write().unwrap() = config;
    if lang_changed {
        rebuild_tray_menu(&app);
        #[cfg(target_os = "macos")]
        macos::rebuild_app_menu(&app);
    }
    position_island(&app);
    #[cfg(target_os = "macos")]
    macos::sync_full_screen_spaces(&app);
    // Compared with the shortcut that actually registered rather than the previous
    // config, so one that failed (another app held it) is tried again next time.
    let mut registered = state.hotkey.lock().unwrap();
    if hotkey != *registered {
        let gs = app.global_shortcut();
        let _ = gs.unregister_all();
        registered.clear();
        if !hotkey.trim().is_empty() {
            if let Err(e) = gs.register(hotkey.as_str()) {
                log::warn!("Could not register the shortcut {hotkey:?}: {e}");
                return Err(format!("Could not register the shortcut \"{hotkey}\": {e}"));
            }
            *registered = hotkey;
        }
    }
    Ok(())
}

#[tauri::command]
fn island_anchor(state: tauri::State<AppState>) -> Anchor {
    state.anchor.lock().unwrap().clone()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Placement {
    edge: String,
    pos: f64,
    /// Display index, or "cursor" when the island follows the mouse.
    monitor: String,
}

/// Called while the island is being dragged: snaps it to the nearest edge (top, left or
/// right) of the display under the mouse, at the mouse's position along that edge.
#[tauri::command]
fn drag_island(app: AppHandle) -> Option<Placement> {
    let (cursor, monitor) = cursor_and_monitor(&app)?;
    let notch = CONFIG.read().unwrap().island_style == "notch";
    let (pos, size) = island_area(&monitor, notch);
    let (w, h) = (size.width as f64, size.height as f64);
    let (cx, cy) = (cursor.x - pos.x as f64, cursor.y - pos.y as f64);
    let sides = !cfg!(target_os = "linux");
    let edge = if sides && cx < cy && cx < w - cx {
        "left"
    } else if sides && w - cx < cy {
        "right"
    } else {
        "top"
    };
    let frac = if edge == "top" { cx / w } else { cy / h }.clamp(0.0, 1.0);
    let index = app
        .available_monitors()
        .ok()?
        .iter()
        .position(|m| m.position() == monitor.position())
        .map(|i| i.to_string())
        .unwrap_or_else(|| "primary".into());
    let placement = {
        let mut c = CONFIG.write().unwrap();
        c.island_edge = edge.into();
        c.island_pos = frac;
        if c.island_monitor != "cursor" {
            c.island_monitor = index;
        }
        Placement {
            edge: edge.into(),
            pos: frac,
            monitor: c.island_monitor.clone(),
        }
    };
    position_island(&app);
    Some(placement)
}

#[tauri::command]
fn set_island_open(app: AppHandle, state: tauri::State<AppState>, open: bool) {
    state.island_open.store(open, Ordering::Relaxed);
    update_island_memory_target(&app);
}

#[tauri::command]
fn set_quiet(app: AppHandle, state: tauri::State<AppState>, quiet: bool) {
    state.quiet.store(quiet, Ordering::Relaxed);
    sync_island_visibility(&app);
}

/// `minutes`: `None` pauses until resumed, `Some(0)` resumes.
#[tauri::command]
fn pause_island(app: AppHandle, minutes: Option<u64>) {
    set_pause(&app, minutes);
}

#[tauri::command]
fn island_paused(app: AppHandle) -> bool {
    is_paused(&app)
}

#[derive(Serialize)]
struct MonitorInfo {
    index: usize,
    name: String,
    width: u32,
    height: u32,
    primary: bool,
}

#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let primary = app.primary_monitor().ok().flatten().map(|m| *m.position());
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(index, m)| MonitorInfo {
            index,
            name: m.name().cloned().unwrap_or_else(|| format!("Display {}", index + 1)),
            width: m.size().width,
            height: m.size().height,
            primary: Some(*m.position()) == primary,
        })
        .collect()
}

/// Asks where to save a stats backup and writes it there. The path comes from the
/// native dialog, never from the webview, so the frontend can't write anywhere else.
/// Returns false if the user cancelled.
#[tauri::command]
async fn export_backup(window: WebviewWindow, file_name: String, contents: String) -> Result<bool, String> {
    // The dialog blocks until closed, so keep it off the async runtime's threads.
    tauri::async_runtime::spawn_blocking(move || {
        let picked = window
            .dialog()
            .file()
            .set_parent(&window)
            .add_filter("JSON", &["json"])
            .set_file_name(file_name)
            .blocking_save_file();
        let Some(path) = picked else { return Ok(false) };
        let path = path.into_path().map_err(|e| e.to_string())?;
        std::fs::write(&path, contents).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Backups are small; anything bigger than this isn't one.
const MAX_BACKUP_BYTES: u64 = 10 * 1024 * 1024;

/// Asks for a stats backup to restore and returns its text, or `None` if cancelled.
#[tauri::command]
async fn import_backup(window: WebviewWindow) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let picked = window
            .dialog()
            .file()
            .set_parent(&window)
            .add_filter("JSON", &["json"])
            .blocking_pick_file();
        let Some(path) = picked else { return Ok(None) };
        let path = path.into_path().map_err(|e| e.to_string())?;
        if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > MAX_BACKUP_BYTES {
            return Err("This file is too large to be a Ghars backup.".into());
        }
        std::fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn simulate_agent(app: AppHandle, kind: String) -> Result<(), String> {
    let kind = tracker::Kind::parse(&kind).ok_or("unknown kind")?;
    server::record(&app, "test", "simulated", kind);
    Ok(())
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    show_settings(&app);
}

/// Whether the system started Ghars at login (the island skips the welcome window then).
#[tauri::command]
fn autostarted() -> bool {
    launched_at_login()
}

#[tauri::command]
fn focus_island(app: AppHandle) {
    // On macOS the island is a panel: `set_focus` would activate Ghars, and tao's
    // `set_focusable` doesn't apply to it.
    #[cfg(target_os = "macos")]
    macos::focus_island(&app);
    #[cfg(not(target_os = "macos"))]
    if let Some(win) = island(&app) {
        let _ = win.set_focusable(true);
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn release_island_focus(app: AppHandle) {
    #[cfg(target_os = "macos")]
    macos::release_island_focus(&app);
    #[cfg(not(target_os = "macos"))]
    if let Some(win) = island(&app) {
        let _ = win.set_focusable(false);
    }
}

#[tauri::command]
fn set_tray_tooltip(state: tauri::State<AppState>, text: String) {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        let _ = tray.set_tooltip(Some(text));
    }
}

// The integration commands read and write the AI tools' config files, so they run off
// the main thread (`async`).

#[tauri::command(async)]
fn integrations_status() -> Vec<integrations::IntegrationStatus> {
    integrations::all()
}

#[tauri::command(async)]
fn integration_install(id: String) -> Result<integrations::IntegrationStatus, String> {
    integrations::install(&id)
}

#[tauri::command(async)]
fn integration_uninstall(id: String) -> Result<integrations::IntegrationStatus, String> {
    integrations::uninstall(&id)
}

#[tauri::command(async)]
fn install_skill() -> Result<Vec<String>, String> {
    integrations::install_skill()
}

#[tauri::command]
fn server_port() -> u16 {
    server::PORT
}

/// Why the local server couldn't start (port taken, say), or `None` if it's running.
#[tauri::command]
fn server_error() -> Option<String> {
    server::bind_error()
}

/// Checks for a new version now. `None` if this one is the latest.
#[tauri::command]
async fn check_update(app: AppHandle) -> Result<Option<updates::UpdateInfo>, String> {
    updates::check(&app).await
}

/// The update the last check (this one or the background one) found, if any.
#[tauri::command]
fn pending_update() -> Option<updates::UpdateInfo> {
    updates::pending()
}

/// Installs the pending update and restarts Ghars; only returns if that failed.
#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    updates::install(app).await
}

// ---------------------------------------------------------------- windows & tray

fn show_settings(app: &AppHandle) {
    /// Set while the window is being built, so two quick clicks don't build it twice.
    static OPENING: AtomicBool = AtomicBool::new(false);
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    if OPENING.swap(true, Ordering::SeqCst) {
        return;
    }
    let t = labels();
    let title = format!("{} — {}", t.ghars, t.settings);
    // Building a window from a sync command or an event handler (tray menu, single
    // instance) deadlocks the event loop on Windows, so build it from another thread.
    // Wide enough for the appearance page's live preview beside its controls, but never
    // larger than ~92% of the main screen on small laptops.
    let (mut w, mut h) = (1180.0, 760.0);
    if let Ok(Some(m)) = app.primary_monitor() {
        let s = m.scale_factor();
        w = f64::min(w, m.size().width as f64 / s * 0.92);
        h = f64::min(h, m.size().height as f64 / s * 0.9);
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let builder = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("settings.html".into()))
            .title(title)
            .inner_size(w, h)
            .min_inner_size(f64::min(900.0, w), f64::min(560.0, h))
            .center();
        // The page draws its own title bar. On macOS the native traffic lights sit on top of
        // it (the page leaves room for them); elsewhere it has its own buttons.
        #[cfg(target_os = "macos")]
        let builder = builder
            .decorations(true)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            // tao makes the title bar (the button height, 16 pt, plus y) tall and AppKit centres
            // the buttons in it, so y = 40 - 16 centres them in the page's 40 px bar; x is the
            // inset of the first button, as in Apple's own apps.
            .traffic_light_position(tauri::LogicalPosition::new(20.0, 24.0));
        #[cfg(not(target_os = "macos"))]
        let builder = builder.decorations(false);
        let built = builder.build();
        OPENING.store(false, Ordering::SeqCst);
        match built {
            #[cfg(target_os = "macos")]
            Ok(win) => macos::allow_full_screen(&win),
            #[cfg(not(target_os = "macos"))]
            Ok(_) => {}
            Err(e) => log::error!("Could not open the settings window: {e}"),
        }
    });
}

fn set_pause(app: &AppHandle, minutes: Option<u64>) {
    {
        let state = app.state::<AppState>();
        *state.pause.lock().unwrap() = match minutes {
            Some(0) => Pause::Off,
            Some(m) => {
                let wait = Duration::from_secs(m.min(MAX_PAUSE_MINUTES) * 60);
                Instant::now().checked_add(wait).map_or(Pause::Indefinite, Pause::Until)
            }
            None => Pause::Indefinite,
        };
    }
    sync_island_visibility(app);
    rebuild_tray_menu(app);
    let _ = app.emit("pause-changed", is_paused(app));
}

struct TrayLabels {
    ghars: &'static str,
    open: &'static str,
    settings: &'static str,
    pause: &'static str,
    m30: &'static str,
    h1: &'static str,
    h3: &'static str,
    forever: &'static str,
    resume: &'static str,
    quit: &'static str,
    /// Followed by the new version.
    update: &'static str,
}

fn labels() -> TrayLabels {
    let lang = CONFIG.read().unwrap().ui_lang.clone();
    match lang.as_str() {
        "en" => TrayLabels {
            ghars: "Ghars",
            open: "Open the island",
            settings: "Settings",
            pause: "Pause",
            m30: "For 30 minutes",
            h1: "For 1 hour",
            h3: "For 3 hours",
            forever: "Until I resume",
            resume: "Resume",
            quit: "Quit Ghars",
            update: "Install update",
        },
        "ur" => TrayLabels {
            ghars: "غرس",
            open: "پینل کھولیں",
            settings: "ترتیبات",
            pause: "وقفہ لیں",
            m30: "30 منٹ",
            h1: "1 گھنٹہ",
            h3: "3 گھنٹے",
            forever: "جب تک خود دوبارہ نہ چلاؤں",
            resume: "دوبارہ چلائیں",
            quit: "غرس بند کریں",
            update: "اپ ڈیٹ انسٹال کریں",
        },
        "id" => TrayLabels {
            ghars: "Ghars",
            open: "Buka panel",
            settings: "Pengaturan",
            pause: "Jeda",
            m30: "30 menit",
            h1: "1 jam",
            h3: "3 jam",
            forever: "Sampai saya lanjutkan",
            resume: "Lanjutkan",
            quit: "Keluar dari Ghars",
            update: "Pasang pembaruan",
        },
        "tr" => TrayLabels {
            ghars: "Ghars",
            open: "Adayı aç",
            settings: "Ayarlar",
            pause: "Duraklat",
            m30: "30 dakika",
            h1: "1 saat",
            h3: "3 saat",
            forever: "Ben devam ettirene kadar",
            resume: "Devam et",
            quit: "Ghars'tan çık",
            update: "Güncellemeyi yükle",
        },
        "ms" => TrayLabels {
            ghars: "Ghars",
            open: "Buka pulau",
            settings: "Tetapan",
            pause: "Henti sementara",
            m30: "30 minit",
            h1: "1 jam",
            h3: "3 jam",
            forever: "Hingga disambung semula",
            resume: "Sambung semula",
            quit: "Keluar Ghars",
            update: "Pasang kemas kini",
        },
        "fr" => TrayLabels {
            ghars: "Ghars",
            open: "Ouvrir l’îlot",
            settings: "Paramètres",
            pause: "Mettre en pause",
            m30: "30 min",
            h1: "1 h",
            h3: "3 h",
            forever: "Jusqu’à la reprise",
            resume: "Reprendre",
            quit: "Quitter Ghars",
            update: "Installer la mise à jour",
        },
        "bn" => TrayLabels {
            ghars: "Ghars",
            open: "আইল্যান্ড খুলুন",
            settings: "সেটিংস",
            pause: "বিরতি দিন",
            m30: "৩০ মিনিট",
            h1: "১ ঘণ্টা",
            h3: "৩ ঘণ্টা",
            forever: "আবার চালু না করা পর্যন্ত",
            resume: "আবার চালু করুন",
            quit: "Ghars বন্ধ করুন",
            update: "আপডেট ইনস্টল করুন",
        },
        _ => TrayLabels {
            ghars: "غرس",
            open: "فتح الجزيرة",
            settings: "الإعدادات",
            pause: "إيقاف مؤقت",
            m30: "لمدة نصف ساعة",
            h1: "لمدة ساعة",
            h3: "لمدة ٣ ساعات",
            forever: "حتى الاستئناف",
            resume: "استئناف",
            quit: "إنهاء غرس",
            update: "تثبيت التحديث",
        },
    }
}

fn tray_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let t = labels();
    let paused = is_paused(app);
    let pause = Submenu::with_id_and_items(
        app,
        "pause",
        t.pause,
        !paused,
        &[
            &MenuItem::with_id(app, "pause-30", t.m30, true, None::<&str>)?,
            &MenuItem::with_id(app, "pause-60", t.h1, true, None::<&str>)?,
            &MenuItem::with_id(app, "pause-180", t.h3, true, None::<&str>)?,
            &MenuItem::with_id(app, "pause-forever", t.forever, true, None::<&str>)?,
        ],
    )?;
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "open", t.open, !paused, None::<&str>)?,
            &MenuItem::with_id(app, "settings", t.settings, true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &pause,
            &MenuItem::with_id(app, "resume", t.resume, paused, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", t.quit, true, None::<&str>)?,
        ],
    )?;
    if let Some(version) = updates::pending_version() {
        let label = format!("{} {version}", t.update);
        menu.prepend_items(&[
            &MenuItem::with_id(app, "install-update", label, !updates::installing(), None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
        ])?;
    }
    Ok(menu)
}

pub fn rebuild_tray_menu(app: &AppHandle) {
    let tray = app.state::<AppState>().tray.lock().unwrap().clone();
    if let (Some(tray), Ok(menu)) = (tray, tray_menu(app)) {
        let _ = tray.set_menu(Some(menu));
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    // macOS menu bar icons are monochrome templates the system tints to match the menu
    // bar; elsewhere the tray shows the app icon.
    #[cfg(target_os = "macos")]
    let builder = TrayIconBuilder::with_id("main")
        .icon(tauri::include_image!("icons/tray-template.png"))
        .icon_as_template(true);
    #[cfg(not(target_os = "macos"))]
    let builder = TrayIconBuilder::with_id("main").icon(
        app.default_window_icon()
            .ok_or_else(|| tauri::Error::AssetNotFound("app icon".into()))?
            .clone(),
    );
    // A click on a menu bar icon opens its menu, as everywhere on macOS (the menu has
    // Settings… and Quit). On Windows a left click opens the settings instead.
    let builder = builder
        .tooltip("Ghars")
        .menu(&tray_menu(app)?)
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                let _ = app.emit_to("island", "hotkey", "open");
            }
            "settings" => show_settings(app),
            "install-update" => updates::install_in_background(app),
            "pause-30" => set_pause(app, Some(30)),
            "pause-60" => set_pause(app, Some(60)),
            "pause-180" => set_pause(app, Some(180)),
            "pause-forever" => set_pause(app, None),
            "resume" => set_pause(app, Some(0)),
            "quit" => {
                // Give the windows a moment to save counts still waiting for their save timer.
                let _ = app.emit("app-quitting", ());
                let app = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(600));
                    app.exit(0);
                });
            }
            _ => {}
        });
    #[cfg(not(target_os = "macos"))]
    let builder = builder.on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            show_settings(tray.app_handle());
        }
    });
    let tray = builder.build(app)?;
    *app.state::<AppState>().tray.lock().unwrap() = Some(tray);
    Ok(())
}

/// Called by the watcher: ends a timed pause that has run out and lets everything know.
/// This is the only place a timed pause ends by itself, so the change is never missed.
pub fn end_expired_pause(app: &AppHandle) {
    {
        let state = app.state::<AppState>();
        let mut pause = state.pause.lock().unwrap();
        match *pause {
            Pause::Until(until) if Instant::now() >= until => *pause = Pause::Off,
            _ => return,
        }
    }
    sync_island_visibility(app);
    rebuild_tray_menu(app);
    let _ = app.emit("pause-changed", false);
}

/// Rewrites an existing login item so it starts this copy of Ghars with `AUTOSTART_ARG`.
/// Items from older versions lack the flag, and one left by another build (an old copy, or
/// one with a different identifier) would start that instead. Not in dev builds, which would
/// take the login item over.
fn refresh_login_item(app: &AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    if cfg!(debug_assertions) {
        return;
    }
    let launcher = app.autolaunch();
    if launcher.is_enabled().unwrap_or(false)
        && let Err(e) = launcher.enable()
    {
        log::warn!("Could not update the login item: {e}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Opening Ghars again shows the settings. A second launch at login doesn't: macOS also
        // reopens the apps of the last session, so Ghars can be started twice there.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !args.iter().any(|a| a == AUTOSTART_ARG) {
                show_settings(app)
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_ARG]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = app.emit_to("island", "hotkey", "toggle");
                    }
                })
                .build(),
        );
    // The island is an NSPanel (see `macos::make_island_panel`), and the app menu quits the
    // way the tray does.
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init()).menu(macos::app_menu);
    builder
        .manage(AppState::default())
        .on_window_event(track_island_geometry)
        .invoke_handler(tauri::generate_handler![
            set_hit_rect,
            island_anchor,
            drag_island,
            apply_config,
            set_quiet,
            set_island_open,
            pause_island,
            island_paused,
            list_monitors,
            export_backup,
            import_backup,
            simulate_agent,
            open_settings,
            autostarted,
            focus_island,
            release_island_focus,
            set_tray_tooltip,
            integrations_status,
            integration_install,
            integration_uninstall,
            install_skill,
            server_port,
            server_error,
            check_update,
            pending_update,
            install_update,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            build_tray(&handle)?;
            #[cfg(target_os = "macos")]
            macos::make_island_panel(&handle);
            if let Some(win) = island(&handle) {
                let _ = win.set_size(tauri::LogicalSize::new(WIN_W, WIN_H));
                // Linux has no hit-testing (the window hugs the island instead), so there
                // the window must stay clickable.
                #[cfg(not(target_os = "linux"))]
                let _ = win.set_ignore_cursor_events(true);
            }
            position_island(&handle);
            if let Some(win) = island(&handle) {
                #[cfg(target_os = "macos")]
                macos::set_island_visible(&handle, true);
                #[cfg(not(target_os = "macos"))]
                let _ = win.show();
                let state = handle.state::<AppState>();
                state.island_shown.store(true, Ordering::Relaxed);
                update_island_memory_target(&handle);
                if let (Ok(pos), Ok(scale)) = (win.outer_position(), win.scale_factor()) {
                    *state.island_geom.lock().unwrap() = Some((pos, scale));
                }
            }
            refresh_login_item(&handle);
            server::start(handle.clone());
            // Rewrites outdated Ghars hooks in the AI tools' configs; file I/O, so off the
            // main thread.
            std::thread::spawn(integrations::migrate);
            watcher::start(handle.clone());
            updates::start(handle.clone());
            start_hit_testing(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Ghars");
}
