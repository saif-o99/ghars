import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Dhikr } from "../../shared/content";
import type { Locale } from "../../i18n/en";
import type { Settings } from "../../shared/settings";
import { starPoints, type Theme } from "../../shared/themes";
import { Wheel, type WheelHandle } from "../../shared/Wheel";
import { Mosque } from "../Mosque";
import type { PrayerNotice, View } from "../types";

/** The compact island: opens by itself while the AI works, or for a prayer note. */
export function CompactLayer({ view, notice, textDir, noticeText, timeText, item, settings, tr, count, target, miniWheel, theme, calm, tick, t, setView }: {
  view: View;
  notice: PrayerNotice | null;
  textDir: "rtl" | "ltr";
  noticeText: string;
  timeText: string;
  item: Dhikr;
  settings: Settings;
  tr: string;
  count: number;
  target: number;
  miniWheel: RefObject<WheelHandle | null>;
  theme: Theme;
  calm: boolean;
  tick: (dir: number) => void;
  t: Locale["island"];
  setView: Dispatch<SetStateAction<View>>;
}) {
  return (
    // A prayer note mirrors for Arabic and Urdu (mosque on the right, × on the left); the
    // dhikr view keeps its left-to-right layout so the wheel stays where it always is.
    <div className="layer layer-compact" aria-hidden={view !== "compact"} inert={view !== "compact"} dir={notice ? textDir : "ltr"}>
      {notice ? (
        <>
          <Mosque className="notice-art" />
          <Mosque className="badge mosque" />
        </>
      ) : (
        <svg className="badge" viewBox="0 0 40 40" aria-hidden>
          <polygon points={starPoints(19, 10)} fill="var(--accent)" />
          <polygon points={starPoints(12.5, 6.6)} fill="var(--bg-solid, #000)" opacity=".85" />
        </svg>
      )}
      {notice ? (
        <div className="c-text c-notice">
          <div className="notice-title">{noticeText}</div>
          <div className="tr">{timeText}</div>
        </div>
      ) : (
        <div className="c-text">
          <div className="ar" lang="ar">{item.ar}</div>
          {settings.showTranslation && <div className="tr">{tr}</div>}
        </div>
      )}
      {notice ? (
        <span />
      ) : (
        <div className="count">
          {count}
          <small>/{target}</small>
        </div>
      )}
      {view === "compact" && !notice ? (
        <Wheel ref={miniWheel} finish={theme.wheel} scale={0.22} dragStep={7} onTick={tick} instant={calm} label={t.count} />
      ) : (
        <span />
      )}
      <button className="close" title={t.close} aria-label={notice ? t.dismiss : t.close} onClick={() => setView("collapsed")}>
        ×
      </button>
    </div>
  );
}
