import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { pendingUpdate, type UpdateInfo } from "./ipc";

/** The update waiting to be installed, if any: one already found, or one found later. */
export function usePendingUpdate(): UpdateInfo | null {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    pendingUpdate().then((u) => u && setUpdate(u)).catch(() => {});
    const un = listen<UpdateInfo>("update-available", (e) => setUpdate(e.payload));
    return () => void un.then((u) => u());
  }, []);
  return update;
}
