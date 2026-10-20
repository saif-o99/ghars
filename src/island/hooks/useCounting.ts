import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { ISTIGHFAR, type Dhikr, type Pack } from "../../shared/content";
import { locale } from "../../i18n";
import { setTrayTooltip } from "../../shared/ipc";
import type { Settings } from "../../shared/settings";
import { click } from "../../shared/sound";
import { addCount, countToday, removeCount } from "../../shared/stats";
import type { WheelHandle } from "../../shared/Wheel";
import type { IslandTimers, Mode, View } from "../types";

/**
 * Counting the current dhikr: counts and takes back, spins the wheels, flashes on a
 * milestone, announces progress, nudges when counting too fast, and steps through a set.
 */
export function useCounting({ settingsRef, view, mode, item, target, pack, setIdx, setRev, timers }: {
  settingsRef: RefObject<Settings | null>;
  view: View;
  mode: Mode;
  item: Dhikr;
  target: number;
  pack: Pack;
  setIdx: Dispatch<SetStateAction<number>>;
  setRev: Dispatch<SetStateAction<number>>;
  timers: RefObject<IslandTimers>;
}) {
  const [hint, setHint] = useState(false);
  const [flash, setFlash] = useState(false);
  const [live, setLive] = useState("");
  const wheel = useRef<WheelHandle>(null);
  const miniWheel = useRef<WheelHandle>(null);
  const recent = useRef<number[]>([]);

  function tick(dir: number) {
    const s = settingsRef.current;
    if (!s || view === "collapsed") return;
    wheel.current?.spin(dir);
    miniWheel.current?.spin(dir);
    const n = addCount(item.id);
    setRev((r) => r + 1);

    if (s.sound) click(n === target);
    if (n === target || n % 33 === 0) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 450);
    }
    if (n === target || n % 10 === 0) setLive(`${n} / ${target}`);
    // A gentle reminder when counting faster than ~3 per second.
    const stamp = performance.now();
    recent.current = [...recent.current.slice(-5), stamp];
    if (recent.current.length === 6 && stamp - recent.current[0] < 6 * 330) {
      setHint(true);
      window.clearTimeout(timers.current.hint);
      timers.current.hint = window.setTimeout(() => setHint(false), 2600);
    }
    if (mode === "adhkar" && n === target) window.setTimeout(() => advance(1, true), 550);

    window.clearTimeout(timers.current.tray);
    timers.current.tray = window.setTimeout(() => {
      const today = countToday(ISTIGHFAR[s.istighfarPhrase].id);
      setTrayTooltip(`${locale(s.uiLang).settings.title} — ${locale(s.uiLang).island.istighfar}: ${today}`).catch(() => {});
    }, 800);
  }

  /** Takes back one count, for when you counted by mistake. */
  function untick() {
    if (view === "collapsed" || countToday(item.id) === 0) return;
    wheel.current?.spin(1);
    miniWheel.current?.spin(1);
    const n = removeCount(item.id);
    setRev((r) => r + 1);
    setLive(`${n} / ${target}`);
  }

  function advance(step: number, skipDone = false) {
    setIdx((i) => {
      const len = pack.items.length;
      for (let k = 1; k <= len; k++) {
        const j = (i + step * k + len * k) % len;
        if (!skipDone || countToday(pack.items[j].id) < pack.items[j].target) return j;
      }
      return i;
    });
  }

  return { wheel, miniWheel, hint, flash, live, tick, untick, advance };
}
