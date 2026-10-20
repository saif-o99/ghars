import { useRef, type Dispatch, type SetStateAction } from "react";
import type { Mode, View } from "../types";

/** Counting with the mouse wheel or trackpad, and with the keyboard. */
export function useWheelInput({ tick, untick, advance, mode, setView }: {
  tick: (dir: number) => void;
  untick: () => void;
  advance: (step: number) => void;
  mode: Mode;
  setView: Dispatch<SetStateAction<View>>;
}) {
  const wheelAcc = useRef({ acc: 0, at: 0 });

  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    const w = wheelAcc.current;
    const stamp = performance.now();
    if (stamp - w.at > 250) w.acc = 0;
    w.at = stamp;
    // A mouse notch arrives as one big delta: count it once. Trackpads send many
    // small deltas: accumulate them.
    if (e.deltaMode !== 0 || Math.abs(e.deltaY) >= 50) {
      w.acc = 0;
      tick(Math.sign(e.deltaY));
      return;
    }
    w.acc += e.deltaY;
    if (Math.abs(w.acc) >= 50) {
      tick(Math.sign(w.acc));
      w.acc = 0;
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // ↑ counts, ↓ takes one back (like the ▲ ▼ buttons). Scrolling always counts.
    // Holding a key down counts once, not once per key repeat.
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!e.repeat) tick(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!e.repeat) untick();
    } else if (mode === "adhkar" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      advance(e.key === "ArrowLeft" ? 1 : -1);
    } else if (e.key === "Escape") {
      setView("collapsed");
    }
  }

  return { onWheel, onKeyDown };
}
