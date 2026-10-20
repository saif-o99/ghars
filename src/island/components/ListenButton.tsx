import type { Locale } from "../../i18n/en";

/** Plays (or stops) the recorded reading of the current dhikr. */
export function ListenButton({ playing, t, toggleListen }: { playing: boolean; t: Locale["island"]; toggleListen: () => void }) {
  return (
    <button className={`icon listen${playing ? " on" : ""}`} title={playing ? t.stopListening : t.listen} aria-label={playing ? t.stopListening : t.listen} onClick={toggleListen}>
      {playing ? (
        <svg viewBox="0 0 16 16" aria-hidden><rect x="4.5" y="4.5" width="7" height="7" rx="1.2" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M3 6h2.2L8.5 3.3v9.4L5.2 10H3z" />
          <path className="wave" d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8M12.4 3.9a5.6 5.6 0 0 1 0 8.2" />
        </svg>
      )}
    </button>
  );
}
