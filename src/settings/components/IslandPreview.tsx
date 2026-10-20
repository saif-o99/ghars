import { useRef, useState, type CSSProperties } from "react";
import { ISTIGHFAR } from "../../shared/content";
import { isRtl, meaning } from "../../i18n";
import type { Locale } from "../../i18n/en";
import { hijriDate } from "../../shared/prayer";
import { ISLAND_SCALE, type Settings } from "../../shared/settings";
import { getTheme, tileUrl } from "../../shared/themes";
import { Wheel, type WheelHandle } from "../../shared/Wheel";
import { Deco } from "../../island/Deco";
import { NotchBackdrop } from "../../island/NotchBackdrop";
import { SHOULDER, notchMask } from "../../shared/notch";

/** The preview "screen" is drawn at this fraction of real size so the large island still fits. */
const STAGE_ZOOM = 0.8;

/** A real, interactive island rendered with the island's own styles. */
export function IslandPreview({ s, L, themeId }: { s: Settings; L: Locale; themeId: string }) {
  const theme = getTheme(themeId);
  const [count, setCount] = useState(33);
  const wheel = useRef<WheelHandle>(null);
  const notch = s.islandStyle === "notch";
  const scale = ISLAND_SCALE[s.islandSize];
  const item = ISTIGHFAR[s.istighfarPhrase];
  const tick = (dir: number) => {
    wheel.current?.spin(dir);
    setCount((c) => c + 1);
  };
  const untick = () => {
    if (count === 0) return;
    wheel.current?.spin(1);
    setCount((c) => c - 1);
  };
  const [w, h, r] = [404, 310, 24];
  const mask = notchMask("top", w + 2 * SHOULDER, h, r);
  const style = {
    "--tile": theme.tile ? tileUrl(theme.tile) : "none",
    "--radius": `${r}px`,
    "--ar-size": "27px",
    ...(notch
      ? { width: w + 2 * SHOULDER, height: h, borderRadius: 0, maskImage: mask, WebkitMaskImage: mask }
      : { width: w, height: h, borderRadius: r }),
  } as unknown as CSSProperties;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="stage" aria-label={L.settings.preview}>
      <div
        className={`wrap align-center${notch ? " notch" : ""}${calm ? " reduce-motion" : ""}`}
        style={{ "--solid": theme.solid, "--scale": scale * STAGE_ZOOM } as CSSProperties}
        dir="ltr"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) >= 1) tick(Math.sign(e.deltaY));
        }}
      >
        {notch && <NotchBackdrop themeId={theme.id} width={w + 2 * SHOULDER} height={h} mask={mask} />}
        <div className={`island theme-${theme.id} is-expanded${theme.light ? " is-light" : ""}`} style={style}>
          <Deco theme={theme} />
          <div className="layer layer-full">
            <div className="topbar">
              <div className="chip-slot" />
              <div className="tabs istighfar">
                <i className="tab-ind" aria-hidden />
                <span className="tab active">{L.island.istighfar}</span>
                <span className="tab">{L.island.adhkar}</span>
              </div>
              <div className="chip-slot end" />
            </div>
            <div className="body">
              <div className="text">
                <div className="ar" lang="ar">{item.ar}</div>
                {s.showTranslation && <div className="tr">{meaning(item, s.uiLang)}</div>}
                <div className="count">
                  {count}
                  <small> / {s.istighfarGoal}</small>
                </div>
                <div className="progress"><i style={{ width: `${Math.min(100, (count / s.istighfarGoal) * 100)}%` }} /></div>
                {s.showSource && <div className="src">{item.source}</div>}
              </div>
              <div className="col">
                <button className="arrow" aria-label={L.island.count} onClick={() => tick(-1)}>▲</button>
                <Wheel ref={wheel} finish={theme.wheel} scale={0.5} onTick={tick} instant={calm} label={L.island.count} />
                <button className="arrow" aria-label={L.island.undo} title={L.island.undo} disabled={count === 0} onClick={untick}>▼</button>
              </div>
            </div>
            {s.showHijri && (
              <div className="meta" dir={isRtl(s.uiLang) ? "rtl" : "ltr"}>
                <span>{hijriDate(s.uiLang, s.hijriOffset, s.prayer.timezone)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
