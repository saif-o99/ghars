import { useEffect, useState } from "react";

/**
 * The current time, refreshed on the minute. The setter is returned too, so an event can
 * bring the clock up to date right away.
 */
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Everything time-based (countdown, prayer notes, quiet hours) works in whole minutes,
    // so the clock ticks on the minute, and not at all while the window is hidden.
    let clock = 0;
    // A second past the minute: adhan keeps sub-second parts in its rounded times.
    const toNextMinute = () => 60_000 - (Date.now() % 60_000) + 1000;
    const tickClock = () => {
      window.clearTimeout(clock);
      if (document.hidden) return;
      setNow(new Date());
      clock = window.setTimeout(tickClock, toNextMinute());
    };
    clock = window.setTimeout(tickClock, toNextMinute());
    document.addEventListener("visibilitychange", tickClock);
    return () => {
      window.clearTimeout(clock);
      document.removeEventListener("visibilitychange", tickClock);
    };
  }, []);
  return [now, setNow] as const;
}
