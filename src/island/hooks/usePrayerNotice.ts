import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { prayersAround } from "../../shared/prayer";
import type { Settings } from "../../shared/settings";
import type { PrayerNotice, View } from "../types";

/** Prayers whose note was already shown ("YYYY-MM-DD-name"), kept so a restart doesn't repeat it. */
const NOTIFIED_KEY = "ghars.prayerNotified";

function loadNotified(): Set<string> {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "[]");
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Saves only the keys still in `current`, so the list never grows past a day's prayers. */
function saveNotified(notified: Set<string>, current: string[]) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(current.filter((k) => notified.has(k))));
  } catch {
    // Storage full or blocked: the note may show again after a restart, nothing worse.
  }
}

/**
 * Opens the prayer note when its time comes, expires it, and closes an untouched note.
 * The note itself is the island's state (closing the island drops it too). The setters
 * and `viewRef` come from the island and never change, so they don't re-run the effects.
 */
export function usePrayerNotice({ settings, now, view, viewRef, setView, notice, setNotice }: {
  settings: Settings | null;
  now: Date;
  view: View;
  viewRef: RefObject<View>;
  setView: Dispatch<SetStateAction<View>>;
  notice: PrayerNotice | null;
  setNotice: Dispatch<SetStateAction<PrayerNotice | null>>;
}) {
  const notified = useRef<Set<string> | null>(null);
  notified.current ??= loadNotified();

  // A quiet note at prayer time (or a few minutes before).
  useEffect(() => {
    const s = settings;
    if (!s?.prayer.enabled || !s.prayer.notify) return;
    const seen = notified.current!;
    // Includes yesterday's Isha, which can fall after midnight.
    const prayers = prayersAround(s.prayer, now, s.hijriOffset);
    for (const { name, time, day } of prayers) {
      const at = time.getTime();
      const from = at - s.prayer.notifyBefore * 60_000;
      const key = `${day}-${name}`;
      if (now.getTime() >= from && now.getTime() < at + 20 * 60_000 && !seen.has(key)) {
        seen.add(key);
        saveNotified(seen, prayers.map((x) => `${x.day}-${x.name}`));
        setNotice({ name, time });
        if (viewRef.current === "collapsed") setView("compact");
        break;
      }
    }
  }, [settings, now, setNotice, setView, viewRef]);
  useEffect(() => {
    // The minute clock expires an old note.
    if (notice && now.getTime() > notice.time.getTime() + 20 * 60_000) setNotice(null);
  }, [notice, now, setNotice]);
  // An untouched prayer note closes itself after a while (hovering opens the full island,
  // which cancels this).
  const closeAfter = settings?.prayer.notifyClose ?? 2;
  useEffect(() => {
    if (!notice || view !== "compact" || closeAfter <= 0) return;
    const timer = window.setTimeout(() => setView("collapsed"), closeAfter * 60_000);
    return () => window.clearTimeout(timer);
  }, [notice, view, closeAfter, setView]);
}
