import { useEffect, useRef } from "react";
import { setQuiet } from "../../shared/ipc";
import type { Settings } from "../../shared/settings";

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function inQuietHours(s: Settings, now: Date): boolean {
  if (!s.quiet.enabled) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  const from = minutes(s.quiet.from);
  const to = minutes(s.quiet.to);
  return from <= to ? t >= from && t < to : t >= from || t < to;
}

/** Quiet hours hide the island (the backend owns visibility). */
export function useQuietHours(settings: Settings | null, now: Date) {
  const quietRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!settings) return;
    const quiet = inQuietHours(settings, now);
    if (quiet !== quietRef.current) {
      quietRef.current = quiet;
      setQuiet(quiet).catch(() => {});
    }
  }, [settings, now]);
}
