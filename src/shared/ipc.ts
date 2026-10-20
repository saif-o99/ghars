import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "./settings";

export interface AgentStatus {
  busy: boolean;
  attention: boolean;
  sources: string[];
}

export interface AgentEvent extends AgentStatus {
  kind: "busy" | "idle" | "attention" | "end";
  source: string;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  detected: boolean;
  installed: boolean;
  configPath: string;
  note: string;
}

export interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A newer version (`check_update`, `pending_update`, and the `update-available` event). */
export interface UpdateInfo {
  version: string;
  notes?: string | null;
  date?: string | null;
}

/** Download progress of `install_update` (the `update-progress` event); `total` may be unknown. */
export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

/** The parts of the settings the backend needs (hotkey, detection, full-screen hiding, update checks). */
export function applyConfig(s: Settings) {
  return invoke("apply_config", {
    config: {
      hideInFullscreen: s.hideInFullscreen,
      hotkey: s.hotkey,
      uiLang: s.uiLang,
      islandEdge: s.islandEdge,
      islandPos: s.islandPos,
      islandMonitor: s.islandMonitor,
      islandStyle: s.islandStyle,
      checkUpdates: s.checkUpdates,
    },
  });
}

export const setHitRect = (rect: HitRect) => invoke("set_hit_rect", { rect });
export const openSettings = () => invoke("open_settings");
export const setTrayTooltip = (text: string) => invoke("set_tray_tooltip", { text });
export const focusIsland = () => invoke("focus_island");
export const simulateAgent = (kind: "busy" | "idle" | "attention") => invoke("simulate_agent", { kind });
export const integrations = () => invoke<IntegrationStatus[]>("integrations_status");
export const installIntegration = (id: string) => invoke<IntegrationStatus>("integration_install", { id });
export const uninstallIntegration = (id: string) => invoke<IntegrationStatus>("integration_uninstall", { id });
export const serverPort = () => invoke<number>("server_port");
/** Why the local listener (127.0.0.1:47821) couldn't start, or null when it is running. */
export const serverError = () => invoke<string | null>("server_error");
export const setQuiet = (quiet: boolean) => invoke("set_quiet", { quiet });
/** Whether the island is open (anything but the collapsed pill). */
export const setIslandOpen = (open: boolean) => invoke("set_island_open", { open });
/** `null` pauses until resumed, `0` resumes. */
export const pauseIsland = (minutes: number | null) => invoke("pause_island", { minutes });
export const islandPaused = () => invoke<boolean>("island_paused");
export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  primary: boolean;
}
export const listMonitors = () => invoke<MonitorInfo[]>("list_monitors");
/** Shows a save dialog and writes `contents` to the chosen file; false if cancelled. */
export const exportBackup = (fileName: string, contents: string) => invoke<boolean>("export_backup", { fileName, contents });
/** Shows an open dialog and returns the chosen file's text; null if cancelled. */
export const importBackup = () => invoke<string | null>("import_backup");
/** Asks the update server now; null when this is the latest version. Rejects with the reason. */
export const checkUpdate = () => invoke<UpdateInfo | null>("check_update");
/** An update found earlier (by the automatic check), or null. */
export const pendingUpdate = () => invoke<UpdateInfo | null>("pending_update");
/** Downloads and installs the update, then restarts the app. Reports `update-progress` meanwhile. */
export const installUpdate = () => invoke<void>("install_update");
