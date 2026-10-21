//! Updates from GitHub Releases. Once a day (if enabled in the settings) the app asks the
//! updater endpoint for a newer version; a found update is kept here, announced to the
//! windows and offered in the tray menu. Installing downloads it, checks its signature
//! against the public key in tauri.conf.json, installs it and restarts Ghars.
//! This is the app's only network access besides the local API.

use crate::CONFIG;
use serde::Serialize;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The first background check waits for the app to settle (and for the windows to send
/// the settings, so a disabled check never runs).
const FIRST_CHECK: Duration = Duration::from_secs(2 * 60);
const CHECK_EVERY: Duration = Duration::from_secs(24 * 60 * 60);
/// How often the background thread wakes to see whether a check is due. The interval is
/// measured in wall-clock time, so a laptop that sleeps at night still checks daily.
const WAKE: Duration = Duration::from_secs(10 * 60);
/// At most this often an `update-progress` event while downloading.
const PROGRESS_EVERY: Duration = Duration::from_millis(100);

/// The last update any check found, until it is installed.
static PENDING: Mutex<Option<Update>> = Mutex::new(None);
static INSTALLING: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Debug, Serialize)]
pub struct UpdateInfo {
    version: String,
    notes: Option<String>,
    /// RFC 3339, as written in latest.json.
    date: Option<String>,
}

impl UpdateInfo {
    fn of(update: &Update) -> Self {
        UpdateInfo {
            version: update.version.clone(),
            notes: update.body.clone().filter(|n| !n.trim().is_empty()),
            date: update
                .raw_json
                .get("pub_date")
                .and_then(|d| d.as_str())
                .map(String::from),
        }
    }
}

#[derive(Clone, Serialize)]
struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

/// The version of the update waiting to be installed, for the tray menu.
pub fn pending_version() -> Option<String> {
    PENDING.lock().unwrap().as_ref().map(|u| u.version.clone())
}

pub fn pending() -> Option<UpdateInfo> {
    PENDING.lock().unwrap().as_ref().map(UpdateInfo::of)
}

pub fn installing() -> bool {
    INSTALLING.load(Ordering::SeqCst)
}

/// Asks the endpoint for a newer version. A new find is stored, announced with
/// `update-available` and added to the tray menu and tooltip.
pub async fn check(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let found = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let Some(update) = found else { return Ok(None) };
    let info = UpdateInfo::of(&update);
    let new = {
        let mut pending = PENDING.lock().unwrap();
        let new = pending.as_ref().map(|u| u.version.as_str()) != Some(update.version.as_str());
        *pending = Some(update);
        new
    };
    if new {
        log::info!("Update available: {}", info.version);
        let _ = app.emit("update-available", info.clone());
        crate::rebuild_tray_menu(app);
        crate::refresh_tray_tooltip(app);
    }
    Ok(Some(info))
}

/// The background check: first a while after startup, then once a day, each time only if
/// the setting is on. Runs on its own thread; failures (offline, say) are only logged.
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(FIRST_CHECK);
        let mut last: Option<SystemTime> = None;
        loop {
            // A clock that went backwards counts as due rather than never.
            let due = last.is_none_or(|t| !matches!(t.elapsed(), Ok(d) if d < CHECK_EVERY));
            if due && CONFIG.read().unwrap().check_updates && !installing() {
                last = Some(SystemTime::now());
                if let Err(e) = tauri::async_runtime::block_on(check(&app)) {
                    log::warn!("Update check failed: {e}");
                }
            }
            std::thread::sleep(WAKE);
        }
    });
}

/// Downloads, verifies and installs the pending update, then restarts Ghars. Windows'
/// installer closes the app itself and starts the new version when it's done. Progress
/// goes out as `update-progress`; a failure as `update-error` (and the returned error).
pub async fn install(app: AppHandle) -> Result<(), String> {
    let result = download_and_install(&app).await;
    if let Err(e) = &result {
        log::warn!("Could not install the update: {e}");
        let _ = app.emit("update-error", e.clone());
    }
    result?;
    app.restart()
}

async fn download_and_install(app: &AppHandle) -> Result<(), String> {
    let update = PENDING
        .lock()
        .unwrap()
        .clone()
        .ok_or("There is no update to install.")?;
    if INSTALLING.swap(true, Ordering::SeqCst) {
        return Err("The update is already being installed.".into());
    }
    crate::rebuild_tray_menu(app);
    let result = async {
        let (mut downloaded, mut last) = (0u64, None::<Instant>);
        let bytes = update
            .download(
                |chunk, total| {
                    downloaded += chunk as u64;
                    if last.is_none_or(|t| t.elapsed() >= PROGRESS_EVERY) || Some(downloaded) == total {
                        last = Some(Instant::now());
                        let _ = app.emit("update-progress", Progress { downloaded, total });
                    }
                },
                || {},
            )
            .await
            .map_err(|e| e.to_string())?;
        // Like quitting from the tray: give the windows a moment to save counts still
        // waiting for their save timer, since Windows' installer ends the app at once.
        let _ = app.emit("app-quitting", ());
        tauri::async_runtime::spawn_blocking(move || {
            std::thread::sleep(Duration::from_millis(600));
            update.install(bytes).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    .await;
    if result.is_err() {
        INSTALLING.store(false, Ordering::SeqCst);
        crate::rebuild_tray_menu(app);
    }
    result
}

/// For the tray menu, which can't wait for the install.
pub fn install_in_background(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = install(app).await;
    });
}
