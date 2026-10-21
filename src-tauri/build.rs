fn main() {
    // Listing the app's commands makes Tauri generate an `allow-<command>` permission for
    // each one, so every window only gets the commands its capability file grants.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "set_hit_rect",
            "island_anchor",
            "drag_island",
            "apply_config",
            "set_quiet",
            "set_island_open",
            "pause_island",
            "island_paused",
            "list_monitors",
            "export_backup",
            "import_backup",
            "simulate_agent",
            "open_settings",
            "autostarted",
            "focus_island",
            "release_island_focus",
            "set_tray_tooltip",
            "integrations_status",
            "integration_install",
            "integration_uninstall",
            "install_skill",
            "server_port",
            "server_error",
            "check_update",
            "pending_update",
            "install_update",
        ])),
    )
    .expect("failed to run tauri-build");
}
