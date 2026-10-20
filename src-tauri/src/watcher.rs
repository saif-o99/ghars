//! Background loop for the things that need polling:
//! - hiding the island while a full-screen app or presentation is in front,
//! - ending timed pauses,
//! - expiring agent sessions that never reported their end,
//! - keeping the island in place if the display layout changes or it follows the mouse.

use crate::server::broadcast;
use crate::tracker::Kind;
use crate::{AppState, position_island};
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const TICK: Duration = Duration::from_secs(1);

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut w = Watcher::default();
        let mut tick: u64 = 0;
        loop {
            std::thread::sleep(TICK);
            tick += 1;
            w.fullscreen(&app);
            crate::end_expired_pause(&app);
            if crate::CONFIG.read().unwrap().island_monitor == "cursor" {
                position_island(&app);
            }
            if tick.is_multiple_of(30) {
                expire(&app);
                position_island(&app);
            }
        }
    });
}

#[derive(Default)]
struct Watcher {
    hidden_for_fullscreen: bool,
}

impl Watcher {
    fn fullscreen(&mut self, app: &AppHandle) {
        let state = app.state::<AppState>();
        let enabled = crate::CONFIG.read().unwrap().hide_in_fullscreen;
        let full = enabled && is_fullscreen(app);
        if full == self.hidden_for_fullscreen {
            return;
        }
        self.hidden_for_fullscreen = full;
        state.fullscreen.store(full, Ordering::Relaxed);
        crate::sync_island_visibility(app);
    }
}

fn expire(app: &AppHandle) {
    let state = app.state::<AppState>();
    let changed = state.tracker.lock().unwrap().expire();
    if changed {
        broadcast(app, Kind::Idle, "timeout");
    }
}

#[cfg(windows)]
fn is_fullscreen(_app: &AppHandle) -> bool {
    use windows::Win32::UI::Shell::{
        QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN, SHQueryUserNotificationState,
    };
    match unsafe { SHQueryUserNotificationState() } {
        Ok(s) => s == QUNS_BUSY || s == QUNS_RUNNING_D3D_FULL_SCREEN || s == QUNS_PRESENTATION_MODE,
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
fn is_fullscreen(app: &AppHandle) -> bool {
    let Ok(w) = active_win_pos_rs::get_active_window() else {
        return false;
    };
    if w.process_id == std::process::id() as u64 {
        return false;
    }
    let p = w.position;
    let Ok(Some(m)) = app.monitor_from_point(p.x + p.width / 2.0, p.y + p.height / 2.0) else {
        return false;
    };
    // active-win-pos-rs reports logical points on macOS.
    let scale = m.scale_factor();
    let (mw, mh) = (m.size().width as f64 / scale, m.size().height as f64 / scale);
    p.width >= mw - 1.0 && p.height >= mh - 1.0
}

/// active-win-pos-rs reports physical pixels here, but `monitor_from_point` takes GTK's
/// logical coordinates, which differ once displays are scaled. So the display is picked by
/// comparing the window's centre with each display's physical bounds instead.
#[cfg(not(any(windows, target_os = "macos")))]
fn is_fullscreen(app: &AppHandle) -> bool {
    let Ok(w) = active_win_pos_rs::get_active_window() else {
        return false;
    };
    if w.process_id == std::process::id() as u64 {
        return false;
    }
    let p = w.position;
    let (cx, cy) = (p.x + p.width / 2.0, p.y + p.height / 2.0);
    let Ok(monitors) = app.available_monitors() else {
        return false;
    };
    let Some(m) = monitors.into_iter().find(|m| {
        let (pos, size) = (m.position(), m.size());
        let (left, top) = (pos.x as f64, pos.y as f64);
        cx >= left && cx < left + size.width as f64 && cy >= top && cy < top + size.height as f64
    }) else {
        return false;
    };
    p.width >= m.size().width as f64 - 1.0 && p.height >= m.size().height as f64 - 1.0
}
