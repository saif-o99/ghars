import type { Pack } from "../../shared/content";
import type { Locale } from "../../i18n/en";
import type { nextPrayer } from "../../shared/prayer";
import { starPoints } from "../../shared/themes";
import type { Mode, View } from "../types";

/**
 * The collapsed pill: what you are counting, how far you are today, the next prayer. On a
 * side edge it stands upright (see island.css): the label is left to screen readers and the
 * prayer's name and countdown stack.
 */
export function PillLayer({ view, textDir, mode, t, istighfarToday, setDone, pack, prayer, prayerName, prayerIn }: {
  view: View;
  textDir: "rtl" | "ltr";
  mode: Mode;
  t: Locale["island"];
  istighfarToday: number;
  setDone: number;
  pack: Pack;
  prayer: ReturnType<typeof nextPrayer>;
  prayerName: string;
  prayerIn: string;
}) {
  return (
    <div className="layer layer-pill" aria-hidden={view !== "collapsed"} inert={view !== "collapsed"} dir={textDir}>
      <svg className="star" viewBox="0 0 40 40" aria-hidden>
        <polygon points={starPoints(19, 10)} fill="var(--accent)" />
        <polygon points={starPoints(12, 6.4)} fill="var(--pill-hole, var(--bg))" />
      </svg>
      <span className="pill-label">{mode === "istighfar" ? t.istighfar : t.adhkar}</span>
      <span className="pill-count">{mode === "istighfar" ? istighfarToday : `${setDone}/${pack.items.length}`}</span>
      {prayer && (
        <span className="pill-prayer">
          <span className="pill-prayer-name">{prayerName}</span> <span className="pill-prayer-in">{prayerIn}</span>
        </span>
      )}
    </div>
  );
}
