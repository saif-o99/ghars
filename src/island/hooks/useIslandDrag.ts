import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { focusIsland } from "../../shared/ipc";
import { updateSettings } from "../../shared/settings";
import type { Placement } from "../layout";
import type { IslandTimers, View } from "../types";

/**
 * Drag to move. Grab the island anywhere except its buttons, the wheel and the set menu,
 * and drop it anywhere along the top or side edges. The backend snaps it to the nearest edge.
 */
export function useIslandDrag({ view, setView, setSetMenu, timers }: {
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  setSetMenu: Dispatch<SetStateAction<boolean>>;
  timers: RefObject<IslandTimers>;
}) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; active: boolean; result?: Placement } | null>(null);
  const dragFrame = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    if (view === "expanded") focusIsland().catch(console.error);
    if (e.button !== 0 || (e.target as Element).closest("button, .col, .sw, .setmenu, .tr-full")) return;
    drag.current = { x: e.screenX, y: e.screenY, active: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.screenX - d.x, e.screenY - d.y) < 6) return;
      d.active = true;
      window.clearTimeout(timers.current.enter);
      setSetMenu(false);
      setView("collapsed");
      setDragging(true);
    }
    if (dragFrame.current) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = 0;
      invoke<Placement | null>("drag_island")
        .then((p) => {
          if (p && drag.current) drag.current.result = p;
        })
        .catch(() => {});
    });
  }

  function endDrag() {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    setDragging(false);
    // Merged into the latest saved settings, so changes made in the settings window survive.
    if (d.result) updateSettings({ islandEdge: d.result.edge, islandPos: d.result.pos, islandMonitor: d.result.monitor }).catch(console.error);
  }

  return { dragging, drag, onPointerDown, onPointerMove, endDrag };
}
