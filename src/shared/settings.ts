import { load, type Store } from "@tauri-apps/plugin-store";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { PACK_ORDER, type CustomDhikr, type PackId } from "./content";
import { LANGS, type Lang } from "../i18n";
import { METHODS } from "./prayer";
import { DEFAULT_THEME } from "./themes";

export type CalcMethodId =
  | "MuslimWorldLeague" | "Egyptian" | "Karachi" | "UmmAlQura" | "Dubai" | "MoonsightingCommittee"
  | "NorthAmerica" | "Kuwait" | "Qatar" | "Singapore" | "Tehran" | "Turkey";

export interface PrayerSettings {
  enabled: boolean;
  lat: number | null;
  lng: number | null;
  label: string;
  method: CalcMethodId;
  madhab: "shafi" | "hanafi";
  /** Id from cities.ts, or "custom" for hand-entered coordinates. */
  cityId: string;
  /** IANA timezone for showing times; "" means the computer's timezone. */
  timezone: string;
  /** Show a quiet note on the island at prayer time. */
  notify: boolean;
  /** Minutes before the prayer to show the note (0 = at the time). */
  notifyBefore: number;
  /** Minutes before an untouched prayer note closes itself; 0 keeps it open. */
  notifyClose: number;
  /**
   * How Fajr and Isha are found where twilight lasts all night in summer. "auto" uses
   * one-seventh of the night above 48° latitude and the middle of the night below.
   */
  highLatRule: "auto" | "middle" | "seventh" | "twilight";
}

export interface Settings {
  /** Theme used when themeMode is "fixed". */
  theme: string;
  themeMode: "fixed" | "system";
  themeLight: string;
  themeDark: string;
  islandStyle: "floating" | "notch";
  islandSize: "small" | "normal" | "large";
  /** Screen edge the island sits on, and where along it (0 = left/top end, 1 = right/bottom end). */
  islandEdge: "top" | "left" | "right";
  islandPos: number;
  /** Shrink to a thin bar at the edge when not in use. */
  islandSlim: boolean;
  /** "primary", "cursor" (follow the mouse), or a monitor index. */
  islandMonitor: string;
  uiLang: Lang;
  showTranslation: boolean;
  showSource: boolean;
  sound: boolean;
  istighfarPhrase: "short" | "tawba";
  istighfarGoal: number;
  packMode: "auto" | PackId;
  /** How the island opens by itself when an AI tool starts working. */
  autoOpen: "compact" | "full" | "off";
  hideInFullscreen: boolean;
  /** macOS: the floating island on the top edge sits over the menu bar, at the very top. */
  islandOverMenuBar: boolean;
  hotkey: string;
  /** Daily hours when the island stays hidden ("HH:MM", may wrap past midnight). */
  quiet: { enabled: boolean; from: string; to: string };
  customAdhkar: CustomDhikr[];
  showHijri: boolean;
  /** Days to shift the Hijri date to match local moon sighting. */
  hijriOffset: number;
  prayer: PrayerSettings;
  /** Check for a new version now and then (the app's only network access). */
  checkUpdates: boolean;
  onboarded: boolean;
}

/** Running on macOS (WebKit reports "MacIntel" there). In the browser preview, `?mac=1` pretends so. */
export const IS_MAC =
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) || (import.meta.env.DEV && new URLSearchParams(location.search).has("mac"));

/**
 * Ctrl+Alt is AltGr on Windows (and on some Linux layouts), so a Ctrl+Alt shortcut can
 * swallow characters people type. macOS has no AltGr and keeps Cmd+Option+G.
 */
export const DEFAULT_HOTKEY = IS_MAC ? "CommandOrControl+Alt+G" : "Alt+Shift+G";

/** How much each island size scales the island. */
export const ISLAND_SCALE: Record<Settings["islandSize"], number> = { small: 0.85, normal: 1, large: 1.2 };

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME,
  themeMode: "fixed",
  themeLight: "clay",
  themeDark: DEFAULT_THEME,
  islandStyle: "floating",
  islandSize: "normal",
  islandEdge: "top",
  islandPos: 0.5,
  islandSlim: false,
  islandMonitor: "primary",
  uiLang: "ar",
  showTranslation: true,
  showSource: true,
  sound: false,
  istighfarPhrase: "short",
  istighfarGoal: 100,
  packMode: "auto",
  autoOpen: "compact",
  hideInFullscreen: true,
  islandOverMenuBar: false,
  hotkey: DEFAULT_HOTKEY,
  quiet: { enabled: false, from: "22:00", to: "06:00" },
  customAdhkar: [],
  showHijri: true,
  hijriOffset: 0,
  prayer: {
    enabled: false, lat: null, lng: null, label: "", method: "MuslimWorldLeague", madhab: "shafi",
    cityId: "", timezone: "", notify: true, notifyBefore: 0, notifyClose: 2, highLatRule: "auto",
  },
  checkUpdates: true,
  onboarded: false,
};

let storePromise: Promise<Store> | null = null;
function store(): Promise<Store> {
  storePromise ??= load("settings.json", { defaults: {}, autoSave: false });
  return storePromise;
}

/** `v` if it is one of `allowed`, otherwise `fallback` (for hand-edited or imported files). */
function oneOf<T>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function num(v: unknown, min: number, max: number, fallback: number, integer = false): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  const n = Math.min(max, Math.max(min, v));
  return integer ? Math.round(n) : n;
}

const coord = (v: unknown, limit: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit ? v : null);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const obj = (v: unknown) => (v && typeof v === "object" ? v : {});

/** Fills in defaults for anything missing or not one of the allowed values. */
function normalize(saved: Partial<Settings>): Settings {
  const d = DEFAULT_SETTINGS;
  const s = { ...d, ...saved };
  const p: Partial<PrayerSettings> = obj(saved.prayer);
  const q: Partial<Settings["quiet"]> = obj(saved.quiet);
  return {
    ...s,
    theme: str(s.theme, d.theme),
    themeMode: oneOf(s.themeMode, ["fixed", "system"], d.themeMode),
    themeLight: str(s.themeLight, d.themeLight),
    themeDark: str(s.themeDark, d.themeDark),
    islandStyle: oneOf(s.islandStyle, ["floating", "notch"], d.islandStyle),
    islandSize: oneOf(s.islandSize, ["small", "normal", "large"], d.islandSize),
    islandEdge: oneOf(s.islandEdge, ["top", "left", "right"], d.islandEdge),
    islandPos: num(s.islandPos, 0, 1, d.islandPos),
    islandSlim: bool(s.islandSlim, d.islandSlim),
    islandMonitor: str(s.islandMonitor, d.islandMonitor),
    uiLang: oneOf(s.uiLang, LANGS.map((l) => l.id), d.uiLang),
    showTranslation: bool(s.showTranslation, d.showTranslation),
    showSource: bool(s.showSource, d.showSource),
    sound: bool(s.sound, d.sound),
    istighfarPhrase: oneOf(s.istighfarPhrase, ["short", "tawba"], d.istighfarPhrase),
    istighfarGoal: num(s.istighfarGoal, 1, 10_000, d.istighfarGoal, true),
    packMode: oneOf<Settings["packMode"]>(s.packMode, ["auto", ...PACK_ORDER], d.packMode),
    autoOpen: oneOf(s.autoOpen, ["compact", "full", "off"], d.autoOpen),
    hideInFullscreen: bool(s.hideInFullscreen, d.hideInFullscreen),
    islandOverMenuBar: bool(s.islandOverMenuBar, d.islandOverMenuBar),
    hotkey: str(s.hotkey, d.hotkey),
    quiet: { enabled: bool(q.enabled, d.quiet.enabled), from: str(q.from, d.quiet.from), to: str(q.to, d.quiet.to) },
    customAdhkar: Array.isArray(s.customAdhkar)
      ? s.customAdhkar
          .filter((c) => c && typeof c === "object" && typeof c.id === "string" && typeof c.ar === "string")
          .map((c) => ({ ...c, meaning: str(c.meaning, ""), source: str(c.source, ""), target: num(c.target, 1, 10_000, 33, true) }))
      : d.customAdhkar,
    showHijri: bool(s.showHijri, d.showHijri),
    hijriOffset: num(s.hijriOffset, -2, 2, d.hijriOffset, true),
    prayer: {
      enabled: bool(p.enabled, d.prayer.enabled),
      lat: coord(p.lat, 90),
      lng: coord(p.lng, 180),
      label: str(p.label, d.prayer.label),
      method: oneOf(p.method, METHODS.map((m) => m.id), d.prayer.method),
      madhab: oneOf(p.madhab, ["shafi", "hanafi"], d.prayer.madhab),
      cityId: str(p.cityId, d.prayer.cityId),
      timezone: str(p.timezone, d.prayer.timezone),
      notify: bool(p.notify, d.prayer.notify),
      notifyBefore: num(p.notifyBefore, 0, 60, d.prayer.notifyBefore, true),
      notifyClose: num(p.notifyClose, 0, 60, d.prayer.notifyClose, true),
      highLatRule: oneOf(p.highLatRule, ["auto", "middle", "seventh", "twilight"], d.prayer.highLatRule),
    },
    checkUpdates: bool(s.checkUpdates, d.checkUpdates),
    onboarded: bool(s.onboarded, d.onboarded),
  };
}

export async function loadSettings(): Promise<Settings> {
  const saved = (await (await store()).get<Partial<Settings> & { islandAlign?: string }>("settings")) ?? {};
  // v0.2 stored left / center / right on the top edge.
  if (saved.islandPos === undefined && saved.islandAlign) {
    saved.islandPos = saved.islandAlign === "left" ? 0 : saved.islandAlign === "right" ? 1 : 0.5;
  }
  delete saved.islandAlign;
  return normalize(saved);
}

export async function saveSettings(next: Settings): Promise<void> {
  const s = await store();
  await s.set("settings", next);
  await s.save();
  await emit("settings-changed", next);
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Merges `patch` into the latest saved settings and saves the result. Use this rather than
 * saving a copy kept in state: the other window may have saved newer values since (the
 * island saves its position after a drag). Calls from one window run one at a time.
 */
export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const run = queue.then(async () => {
    const next = { ...(await loadSettings()), ...patch };
    await saveSettings(next);
    return next;
  });
  queue = run.catch(() => {});
  return run;
}

export function onSettingsChanged(cb: (s: Settings) => void): Promise<UnlistenFn> {
  return listen<Settings>("settings-changed", (e) => cb(e.payload));
}
