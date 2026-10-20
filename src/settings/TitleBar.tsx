import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IS_MAC } from "../shared/settings";

interface Labels {
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
}

/**
 * A transparent strip over the top of the settings window: it drags the window and, on
 * Windows and Linux (undecorated), holds the window buttons. The sidebar already shows the
 * app's name, so there is no title. On macOS the native traffic lights sit over its left end.
 */
export function TitleBar({ labels }: { labels: Labels }) {
  if (IS_MAC) return <header className="titlebar mac" data-tauri-drag-region dir="ltr" />;
  return <WindowsTitleBar labels={labels} />;
}

/** Windows and Linux: the window is undecorated, so the bar draws its own buttons. */
function WindowsTitleBar({ labels }: { labels: Labels }) {
  const win = getCurrentWindow();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    // `win` is a new handle every render; the window itself never changes.
    const win = getCurrentWindow();
    const sync = () => win.isMaximized().then(setMaximized).catch(() => {});
    sync();
    const un = win.onResized(sync);
    return () => void un.then((u) => u());
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region dir="ltr">
      <div className="tb-controls">
        <button aria-label={labels.minimize} onClick={() => win.minimize().catch(console.error)}>
          <svg viewBox="0 0 10 10"><path d="M1 5h8" /></svg>
        </button>
        <button aria-label={maximized ? labels.restore : labels.maximize} onClick={() => win.toggleMaximize().catch(console.error)}>
          {maximized ? (
            <svg viewBox="0 0 10 10"><path d="M3 1h6v6M1 3h6v6H1z" /></svg>
          ) : (
            <svg viewBox="0 0 10 10"><path d="M1 1h8v8H1z" /></svg>
          )}
        </button>
        <button className="close" aria-label={labels.close} onClick={() => win.close().catch(console.error)}>
          <svg viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" /></svg>
        </button>
      </div>
    </header>
  );
}
