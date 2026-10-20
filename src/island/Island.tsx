import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ISTIGHFAR, PACK_ORDER, packFor, type Dhikr, type PackId } from "../shared/content";
import { fmt, isRtl, locale, meaning } from "../i18n";
import { openSettings, setHitRect, setIslandOpen } from "../shared/ipc";
import { contextPack, formatCountdown, formatTime, hijriDate, nextPrayer } from "../shared/prayer";
import { ISLAND_SCALE, type Settings } from "../shared/settings";
import { countToday } from "../shared/stats";
import { getTheme, tileUrl } from "../shared/themes";
import { Wheel } from "../shared/Wheel";
import { SHOULDER, notchMask } from "../shared/notch";
import { AUDIO } from "../shared/audio";
import { Deco } from "./Deco";
import { NotchBackdrop } from "./NotchBackdrop";
import { CompactLayer } from "./components/CompactLayer";
import { ListenButton } from "./components/ListenButton";
import { PackBar } from "./components/PackBar";
import { PillLayer } from "./components/PillLayer";
import { Translation } from "./components/Translation";
import { useBackendEvents } from "./hooks/useBackendEvents";
import { useCounting } from "./hooks/useCounting";
import { useDhikrAudio } from "./hooks/useDhikrAudio";
import { useIslandDrag } from "./hooks/useIslandDrag";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useMinuteClock } from "./hooks/useMinuteClock";
import { usePrayerNotice } from "./hooks/usePrayerNotice";
import { useQuietHours } from "./hooks/useQuietHours";
import { useWheelInput } from "./hooks/useWheelInput";
import { WIN_H, WIN_W, arSize, place, sizeOf, type Anchor } from "./layout";
import type { IslandTimers, Mode, PrayerNotice, View } from "./types";

export function Island() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [view, setView] = useState<View>("collapsed");
  const [mode, setMode] = useState<Mode>("istighfar");
  const [packOverride, setPackOverride] = useState<PackId | null>(null);
  const [idx, setIdx] = useState(0);
  const [, setRev] = useState(0);
  const [now, setNow] = useMinuteClock();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const systemCalm = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [notice, setNotice] = useState<PrayerNotice | null>(null);
  const [setMenu, setSetMenu] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>({ edge: "top", x: WIN_W / 2, y: 0 });

  const viewRef = useRef(view);
  const settingsRef = useRef(settings);
  const timers = useRef<IslandTimers>({});
  // Event listeners read the latest view and settings through these refs.
  useLayoutEffect(() => {
    viewRef.current = view;
    settingsRef.current = settings;
  });
  const { dragging, drag, onPointerDown, onPointerMove, endDrag } = useIslandDrag({ view, setView, setSetMenu, timers });

  // ---------------------------------------------------------------- data
  const lang = settings?.uiLang ?? "ar";
  const L = locale(lang);
  const t = L.island;
  const custom = settings?.customAdhkar ?? [];
  const autoPack = settings ? (settings.packMode !== "auto" ? settings.packMode : contextPack(settings.prayer, now, settings.hijriOffset)) : "general";
  const packId: PackId = packOverride ?? autoPack;
  // An emptied "My adhkar" set falls back to the general one; `pack.id` says which is shown.
  const pack = packFor(packId, custom);
  const at = Math.min(idx, pack.items.length - 1);
  const item: Dhikr = mode === "istighfar" ? ISTIGHFAR[settings?.istighfarPhrase ?? "short"] : pack.items[at];
  const target = mode === "istighfar" ? settings?.istighfarGoal ?? 100 : item.target;
  const count = countToday(item.id);
  const istighfarToday = countToday(ISTIGHFAR[settings?.istighfarPhrase ?? "short"].id);
  const themeId = !settings ? "fes" : settings.themeMode === "system" ? (systemDark ? settings.themeDark : settings.themeLight) : settings.theme;
  const theme = getTheme(themeId);
  const notch = settings?.islandStyle === "notch";
  const edge = anchor.edge;
  const slim = !!settings?.islandSlim && view === "collapsed";
  const scale = ISLAND_SCALE[settings?.islandSize ?? "normal"];
  const calm = systemCalm;
  const prayer = settings ? nextPrayer(settings.prayer, now, settings.hijriOffset) : null;
  const hijri = settings?.showHijri ? hijriDate(lang, settings.hijriOffset, settings.prayer.timezone, now) : "";
  const size = slim ? (edge === "top" ? { w: 72, h: 6, r: 3 } : { w: 6, h: 72, r: 3 }) : sizeOf(view, item, notch, edge);
  // The notch is drawn wider (top) or taller (sides) by the shoulders on both ends.
  const shoulders = notch && !slim;
  const boxW = size.w + (shoulders && edge === "top" ? 2 * SHOULDER : 0);
  const boxH = size.h + (shoulders && edge !== "top" ? 2 * SHOULDER : 0);
  const spot = place(anchor, boxW, boxH, notch || slim ? 0 : 8, scale);
  const packs = PACK_ORDER.filter((p) => p !== "custom" || custom.length > 0);
  const setDone = pack.items.filter((d) => countToday(d.id) >= d.target).length;

  // ---------------------------------------------------------------- setup
  useBackendEvents({ settingsRef, viewRef, setSettings, setRev, setAnchor, setNow, setNotice, setView, setMode });

  // The island lays out left-to-right (text runs set their own direction); only the language changes.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // The backend lets WebView2 trim the island's memory while it is closed.
  const open = view !== "collapsed";
  useEffect(() => {
    setIslandOpen(open).catch(() => {});
  }, [open]);

  // Keep the click-through region in sync with what is drawn.
  // `spot.rect` is a new object every render, so the effect follows its numbers.
  const { x: rectX, y: rectY, w: rectW, h: rectH } = spot.rect;
  useEffect(() => {
    const m = 6;
    const hit = dragging ? { x: 0, y: 0, w: WIN_W, h: WIN_H } : { x: Math.max(0, rectX - m), y: Math.max(0, rectY - m), w: rectW + m * 2, h: rectH + m * 2 };
    setHitRect(hit).catch(() => {});
    if (view === "collapsed") {
      invoke("release_island_focus").catch(() => {});
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the island drops its prayer note
      setNotice(null);
    }
  }, [view, rectX, rectY, rectW, rectH, dragging]);

  // "Listen": play the recorded reading of the current dhikr.
  const { playing, toggleListen } = useDhikrAudio(item, view);

  // When the pack (or what is in it) changes, start at its first unfinished dhikr.
  const packKey = `${pack.id}:${pack.items.map((d) => d.id).join(",")}`;
  useEffect(() => {
    const first = pack.items.findIndex((d) => countToday(d.id) < d.target);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the position only when the pack changes
    setIdx(first === -1 ? 0 : first);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- packKey stands for the pack's ids; `pack` is a new object every render
  }, [packKey]);

  // Quiet hours hide the island (the backend owns visibility).
  useQuietHours(settings, now);

  // A quiet note at prayer time (or a few minutes before), closed again when untouched.
  usePrayerNotice({ settings, now, view, viewRef, setView, notice, setNotice });

  // ---------------------------------------------------------------- counting
  const { wheel, miniWheel, hint, flash, live, tick, untick, advance } = useCounting({ settingsRef, view, mode, item, target, pack, setIdx, setRev, timers });

  function choosePack(p: PackId | null) {
    setPackOverride(p);
    setSetMenu(false);
  }

  // ---------------------------------------------------------------- input
  const { onWheel, onKeyDown } = useWheelInput({ tick, untick, advance, mode, setView });

  // ---------------------------------------------------------------- hover
  function onEnter() {
    if (drag.current?.active) return;
    window.clearTimeout(timers.current.leave);
    // Both the page and (on macOS) the backend report hover; one pending open is enough.
    window.clearTimeout(timers.current.enter);
    if (view !== "expanded") {
      timers.current.enter = window.setTimeout(() => setView("expanded"), view === "collapsed" ? 160 : 60);
    }
  }

  function onLeave() {
    window.clearTimeout(timers.current.enter);
    setSetMenu(false);
    if (view === "expanded") timers.current.leave = window.setTimeout(() => setView("collapsed"), 380);
  }

  // On macOS the backend reports hover (see `hit_test`): WebKit sends no mouse enter/leave
  // to a page whose app isn't active, which a menu-bar app usually isn't.
  const hover = useRef({ onEnter, onLeave });
  useLayoutEffect(() => {
    hover.current = { onEnter, onLeave };
  });
  useEffect(() => {
    let cancelled = false;
    let un: (() => void) | undefined;
    listen<boolean>("island-hover", (e) => (e.payload ? hover.current.onEnter() : hover.current.onLeave()))
      .then((u) => (cancelled ? u() : (un = u)))
      .catch(() => {});
    return () => {
      cancelled = true;
      un?.();
    };
  }, []);

  // ---------------------------------------------------------------- render
  if (!settings) return null;

  const wrapStyle = {
    "--solid": theme.solid,
    "--scale": scale,
  } as CSSProperties;
  const mask = shoulders ? notchMask(edge, boxW, boxH, size.r) : undefined;
  const style = {
    "--tile": theme.tile ? tileUrl(theme.tile) : "none",
    "--radius": `${size.r}px`,
    "--ar-size": `${arSize(item.ar)}px`,
    width: boxW,
    height: boxH,
    ...(shoulders
      ? { borderRadius: 0, maskImage: mask, WebkitMaskImage: mask }
      : { borderRadius: size.r }),
  } as unknown as CSSProperties;
  const done = count >= target;
  const pct = Math.min(100, (count / target) * 100);
  const isFriday = now.getDay() === 5;
  const prayerIn = prayer ? formatCountdown(prayer.time.getTime() - now.getTime(), lang) : "";
  const prayerLabel = prayer ? `${L.prayers[prayer.name]} ${prayerIn}` : "";
  const noticeText = notice
    ? notice.time.getTime() > now.getTime()
      ? fmt(t.prayerSoon, { prayer: L.prayers[notice.name], min: Math.max(1, Math.round((notice.time.getTime() - now.getTime()) / 60_000)) }, lang)
      : fmt(t.prayerNow, { prayer: L.prayers[notice.name] })
    : "";
  const timeText = notice ? formatTime(settings.prayer, notice.time, lang) : "";
  const tr = meaning(item, lang);
  // The island lays out left-to-right; text runs follow the interface language.
  const textDir = isRtl(lang) ? "rtl" : "ltr";

  return (
    <div
      className={`wrap edge-${edge}${notch ? " notch" : ""}${slim ? " slim" : ""}${dragging ? " dragging" : ""}${calm ? " reduce-motion" : ""}`}
      style={{ ...wrapStyle, ...spot.css }}
      role="region"
      aria-label={L.settings.title}
      dir="ltr"
    >
      {notch && <NotchBackdrop themeId={theme.id} width={boxW} height={boxH} mask={mask} flash={flash} />}
      <div
        className={`island theme-${theme.id} is-${view}${flash ? " flash" : ""}${theme.light ? " is-light" : ""}`}
        style={style}
        tabIndex={-1}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onLostPointerCapture={endDrag}
      >
        <Deco theme={theme} />
        <span className="sr-only" aria-live="polite">{live}</span>

        {/* collapsed pill */}
        <PillLayer view={view} textDir={textDir} mode={mode} t={t} istighfarToday={istighfarToday} setDone={setDone} pack={pack} prayer={prayer} prayerName={prayer ? L.prayers[prayer.name] : ""} prayerIn={prayerIn} />

        {/* compact: opens by itself while the AI works, or for a prayer note */}
        <CompactLayer
          view={view}
          notice={notice}
          textDir={textDir}
          noticeText={noticeText}
          timeText={timeText}
          item={item}
          settings={settings}
          tr={tr}
          count={count}
          target={target}
          miniWheel={miniWheel}
          theme={theme}
          calm={calm}
          tick={tick}
          t={t}
          setView={setView}
        />

        {/* expanded */}
        <div className="layer layer-full" aria-hidden={view !== "expanded"} inert={view !== "expanded"}>
          <div className="topbar">
            <div className="chip-slot">
              {AUDIO[item.id] && <ListenButton playing={playing} t={t} toggleListen={toggleListen} />}
            </div>
            <div className={`tabs ${mode}`} role="tablist">
              <i className="tab-ind" aria-hidden />
              <button role="tab" aria-selected={mode === "istighfar"} className={`tab ${mode === "istighfar" ? "active" : ""}`} onClick={() => setMode("istighfar")}>
                {t.istighfar}
              </button>
              <button role="tab" aria-selected={mode === "adhkar"} className={`tab ${mode === "adhkar" ? "active" : ""}`} onClick={() => setMode("adhkar")}>
                {t.adhkar}
              </button>
            </div>
            <div className="chip-slot end">
              <button className="icon" title={t.settings} aria-label={t.settings} onClick={() => openSettings().catch(console.error)}>
                ⚙
              </button>
            </div>
          </div>

          <div className="body">
            {/* Keyed on what is shown, so switching tabs or adhkar fades the new text in. */}
            <div className="text" key={`${mode}:${item.id}`}>
              {mode === "adhkar" && (
                <PackBar L={L} t={t} pack={pack} packs={packs} packOverride={packOverride} setMenu={setMenu} setSetMenu={setSetMenu} choosePack={choosePack} advance={advance} at={at} textDir={textDir} />
              )}
              {mode === "adhkar" && packId === "friday" && isFriday && <div className="note">{t.fridayKahf}</div>}
              <div className={`ar${item.ar.length > 90 ? " long" : ""}`} lang="ar">{item.ar}</div>
              {settings.showTranslation && <Translation text={tr} dir={lang === "ar" ? "ltr" : textDir} />}
              <div className="count">
                {count}
                <small> / {target}</small>
                {done && mode === "adhkar" && <span className="check" aria-label={t.completed}> ✓</span>}
              </div>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(count, target)}>
                <i style={{ width: `${pct}%` }} />
              </div>
              {settings.showSource && item.source && <div className="src">{item.source}</div>}
            </div>
            <div className="col">
              <button className="arrow" aria-label={t.count} onClick={() => tick(-1)}>▲</button>
              {view === "expanded" && <Wheel ref={wheel} finish={theme.wheel} scale={0.5} onTick={tick} instant={calm} label={t.count} />}
              <button className="arrow" aria-label={t.undo} title={t.undo} disabled={count === 0} onClick={untick}>▼</button>
            </div>
          </div>
          {/* Information, not controls: plain text along the bottom edge. */}
          {(hijri || notice || prayer) && (
            <div className="meta" dir={textDir}>
              <span>{hijri}</span>
              {notice ? <span className="now">{noticeText}</span> : prayer && <span>{prayerLabel}</span>}
            </div>
          )}
          {hint && <div className="hint">{t.slowDown}</div>}
        </div>
      </div>
    </div>
  );
}
