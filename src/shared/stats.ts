import { load, type Store } from "@tauri-apps/plugin-store";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Counts per local day ("YYYY-MM-DD") per dhikr id. Stored only on this device. */
export type DayCounts = Record<string, number>;
type Days = Record<string, DayCounts>;

let storePromise: Promise<Store> | null = null;
let days: Days | null = null;
let saveTimer: number | undefined;
/** Changes made in this window that aren't saved yet, so reloading after another window's change keeps them. */
let unsaved: Days = {};
/** Store reads and writes run one at a time, so a reload can't overtake a save. */
let queue: Promise<unknown> = Promise.resolve();
/** Sent with "stats-changed" so a window can ignore its own saves. */
const self = () => getCurrentWindow().label;

function store(): Promise<Store> {
  storePromise ??= load("stats.json", { defaults: {}, autoSave: false });
  return storePromise;
}

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

/** Adds `delta` (a day → id → difference map) into `into`. */
function addInto(into: Days, delta: Days, floor = false) {
  for (const [day, counts] of Object.entries(delta)) {
    const d = (into[day] ??= {});
    for (const [id, n] of Object.entries(counts)) d[id] = floor ? Math.max(0, (d[id] ?? 0) + n) : (d[id] ?? 0) + n;
  }
}

export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function loadStats(): Promise<Days> {
  return serial(async () => {
    const saved = (await (await store()).get<Days>("days")) ?? {};
    addInto(saved, unsaved, true);
    days = saved;
    return days;
  });
}

export function today(): DayCounts {
  return days?.[dayKey()] ?? {};
}

export function countToday(id: string): number {
  return today()[id] ?? 0;
}

function change(id: string, by: number): number {
  days ??= {};
  const key = dayKey();
  const d = (days[key] ??= {});
  const before = d[id] ?? 0;
  d[id] = Math.max(0, before + by);
  addInto(unsaved, { [key]: { [id]: d[id] - before } });
  scheduleSave();
  return d[id];
}

export function addCount(id: string): number {
  return change(id, 1);
}

/** Removes one count from today (never below 0); returns the new total. */
export function removeCount(id: string): number {
  return change(id, -1);
}

export function lastDays(n: number): { key: string; total: number; counts: DayCounts }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    const counts = days?.[key] ?? {};
    out.push({ key, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  }
  return out;
}

/** Every recorded day (for the month view and backups). */
export function allDays(): Days {
  return days ?? {};
}

function persist(): Promise<void> {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  return serial(async () => {
    const pending = unsaved;
    unsaved = {};
    try {
      const s = await store();
      await s.set("days", days ?? {});
      await s.save();
    } catch (e) {
      addInto(unsaved, pending);
      throw e;
    }
    await emit("stats-changed", self());
  });
}

/** Writes counts that are still waiting for the save timer. */
export function flushStats(): Promise<void> {
  return saveTimer === undefined ? Promise.resolve() : persist();
}

export async function clearStats(): Promise<void> {
  days = {};
  unsaved = {};
  await persist();
}

/** A real calendar day written as "YYYY-MM-DD" (not 2026-02-30 or 2026-99-99). */
function isDay(key: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/**
 * Restores a backup. Counts are merged per day and dhikr, keeping the larger number,
 * so restoring the same file twice never doubles anything. Returns the days that had
 * valid counts.
 */
export async function importDays(incoming: Record<string, unknown>): Promise<number> {
  await flushStats();
  await loadStats();
  days ??= {};
  let touched = 0;
  for (const [day, counts] of Object.entries(incoming)) {
    if (!isDay(day) || typeof counts !== "object" || !counts || Array.isArray(counts)) continue;
    let any = false;
    for (const [id, n] of Object.entries(counts)) {
      if (typeof n !== "number" || !Number.isFinite(n) || n < 1) continue;
      const d = (days[day] ??= {});
      d[id] = Math.max(d[id] ?? 0, Math.floor(n));
      any = true;
    }
    if (any) touched++;
  }
  await persist();
  return touched;
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persist().catch((e) => console.error("Couldn't save stats", e));
  }, 400);
}

/**
 * Calls `cb` after another window changes the stats (a save, a restore or a reset), once
 * they are reloaded. Counts this window hasn't saved yet are kept.
 */
export function onStatsChanged(cb: () => void): Promise<UnlistenFn> {
  return listen<string>("stats-changed", (e) => {
    if (e.payload === self()) return;
    loadStats().then(cb, (err) => console.error("Couldn't reload stats", err));
  });
}

// Best effort: write pending counts when the window goes away.
const flushNow = () => void flushStats().catch(() => {});
window.addEventListener("pagehide", flushNow);
window.addEventListener("beforeunload", flushNow);
// Quitting from the tray ends the app without unloading the windows, so the backend asks first.
listen("app-quitting", flushNow).catch(() => {});
