import type { ReactNode } from "react";
import type { Locale } from "../../i18n/en";
import type { Settings } from "../../shared/settings";
import { IslandPreview } from "./IslandPreview";

/** Controls on one side, the live preview pinned on the other so it stays visible while scrolling. */
export function WithPreview({ s, L, themeId, children }: { s: Settings; L: Locale; themeId: string; children: ReactNode }) {
  return (
    <div className="with-preview">
      <div className="wp-controls">{children}</div>
      <div className="wp-preview">
        <div className="gtitle">{L.settings.preview}</div>
        <IslandPreview s={s} L={L} themeId={themeId} />
        <p className="help center">{L.settings.previewHint}</p>
      </div>
    </div>
  );
}
