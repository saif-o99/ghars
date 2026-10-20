import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { prayersAround } from "../../shared/prayer";
import type { Settings } from "../../shared/settings";
import type { PrayerNotice, View } from "../types";

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
  const notified = useRef(new Set<string>());

  // A quiet note at prayer time (or a few minutes before).
  useEffect(() => {
    const s = settings;
    if (!s?.prayer.enabled || !s.prayer.notify) return;
    // Includes yesterday's Isha, which can fall after midnight.
    for (const { name, time, day } of prayersAround(s.prayer, now, s.hijriOffset)) {
      const at = time.getTime();
      const from = at - s.prayer.notifyBefore * 60_000;
      const key = `${day}-${name}`;
      if (now.getTime() >= from && now.getTime() < at + 20 * 60_000 && !notified.current.has(key)) {
        notified.current.add(key);
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
