import { fmt } from "../../i18n";
import type { Locale } from "../../i18n/en";
import { openSettings, type UpdateInfo } from "../../shared/ipc";

/** Takes the settings button's place while an update waits, and opens About. */
export function UpdateButton({ update, l }: { update: UpdateInfo; l: Locale["settings"] }) {
  const label = fmt(l.updateAvailable, { version: update.version });
  return (
    <button className="icon update" title={label} aria-label={label} onClick={() => openSettings("about").catch(console.error)}>
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3.5 13h9" />
      </svg>
    </button>
  );
}
