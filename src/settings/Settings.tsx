import { useEffect, useRef, useState } from "react";
import { LANGS, isRtl, locale, type Lang } from "../i18n";
import { IS_MAC, loadSettings, onSettingsChanged, updateSettings, type Settings } from "../shared/settings";
import { loadStats } from "../shared/stats";
import { starPoints } from "../shared/themes";
import { TitleBar } from "./TitleBar";
import { Icon } from "./icons";
import { Select } from "./Select";
import { withDetail } from "./errors";
import type { Section } from "./types";
import { AboutSection } from "./sections/AboutSection";
import { AiToolsSection } from "./sections/AiToolsSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { BehaviorSection } from "./sections/BehaviorSection";
import { CountingSection } from "./sections/CountingSection";
import { PrayerSection } from "./sections/PrayerSection";
import { StatsSection } from "./sections/StatsSection";
import { WelcomeSection } from "./sections/WelcomeSection";

export function SettingsApp() {
  const [s, setS] = useState<Settings | null>(null);
  const [section, setSection] = useState<Section>("appearance");
  const [error, setError] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  // Each page starts at the top.
  useEffect(() => {
    // Block body: newer WebView2 returns a Promise from scrollTo, which React would
    // otherwise take as the effect's cleanup and crash on the next page switch.
    mainRef.current?.scrollTo({ top: 0 });
  }, [section]);

  /** Changes still being saved. They stay on top of what other windows report meanwhile. */
  const pending = useRef<Partial<Settings>[]>([]);
  const withPending = (base: Settings): Settings => Object.assign({ ...base }, ...pending.current);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loaded] = await Promise.all([loadSettings(), loadStats()]);
        if (cancelled) return;
        setS((cur) => cur ?? loaded);
        if (!loaded.onboarded) setSection("welcome");
      } catch (e) {
        console.error("Couldn't load settings", e);
      }
    })();
    // Follow changes saved elsewhere (the island saves its position after a drag).
    const un = onSettingsChanged((next) => setS(withPending(next)));
    return () => {
      cancelled = true;
      void un.then((u) => u());
    };
  }, []);

  const lang = s?.uiLang;
  useEffect(() => {
    if (!lang) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);

  if (!s) return null;
  const L = locale(s.uiLang);
  const l = L.settings;

  /**
   * Saves a change. Only the changed fields are written, merged into the latest saved
   * settings, so a copy held here can never overwrite something newer.
   */
  async function update(patch: Partial<Settings>) {
    pending.current.push(patch);
    setS((cur) => cur && { ...cur, ...patch });
    setError("");
    try {
      await updateSettings(patch);
      pending.current.splice(pending.current.indexOf(patch), 1);
    } catch (e) {
      console.error("Couldn't save settings", e);
      pending.current.splice(pending.current.indexOf(patch), 1);
      setError(withDetail(l.saveFailed, e));
      // Go back to what is actually saved.
      const saved = await loadSettings().catch(() => null);
      if (saved) setS(withPending(saved));
    }
  }

  const sections: Section[] = [...(s.onboarded ? [] : (["welcome"] as Section[])), "appearance", "counting", "ai", "prayer", "behavior", "stats", "about"];
  const props = { s, L, l, update };

  return (
    <div className={`window${IS_MAC ? " mac" : ""}`} lang={s.uiLang}>
      <TitleBar labels={{ minimize: l.minimize, maximize: l.maximize, restore: l.restore, close: l.closeWindow }} />
      <div className={`app ${s.uiLang}`} dir={isRtl(s.uiLang) ? "rtl" : "ltr"}>
        <aside>
          <div className="brand">
            <svg viewBox="0 0 40 40" aria-hidden>
              <polygon points={starPoints(19, 10)} fill="var(--s-accent)" />
              <polygon points={starPoints(12.5, 6.6)} fill="var(--s-panel)" />
              <circle cx="20" cy="20" r="3" fill="var(--s-accent)" />
            </svg>
            <div>
              <b>{l.title}</b>
              <small>{l.tagline}</small>
            </div>
          </div>
          <nav aria-label={l.title}>
            {sections.map((id) => (
              <button key={id} className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>
                <Icon name={id} />
                {l.sections[id]}
              </button>
            ))}
          </nav>
          <div className="lang">
            <Select
              className="lang-select"
              width="100%"
              value={s.uiLang}
              ariaLabel={l.language}
              options={LANGS.map((x) => ({ value: x.id, label: x.name }))}
              onChange={(v) => update({ uiLang: v as Lang })}
            />
          </div>
        </aside>

        <main ref={mainRef}>
          <header className="page-hdr">
            <span className="page-ico"><Icon name={section} /></span>
            <div>
              <h1>{l.sections[section]}</h1>
              <p>{l.desc[section]}</p>
            </div>
          </header>
          {error && <div className="error" role="alert">{error}</div>}
          {/* Keyed on the section so each page fades in when you switch. */}
          <div className="page" key={section}>
            {section === "welcome" && <WelcomeSection {...props} go={setSection} />}
            {section === "appearance" && <AppearanceSection {...props} />}
            {section === "counting" && <CountingSection {...props} />}
            {section === "ai" && <AiToolsSection {...props} />}
            {section === "prayer" && <PrayerSection {...props} />}
            {section === "behavior" && <BehaviorSection {...props} setError={setError} />}
            {section === "stats" && <StatsSection {...props} />}
            {section === "about" && <AboutSection {...props} />}
          </div>
        </main>
      </div>
    </div>
  );
}
