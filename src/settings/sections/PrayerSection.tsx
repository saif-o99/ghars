import { useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { fmt } from "../../i18n";
import { METHODS, PRAYERS, formatTime, hijriDate, prayerTimes } from "../../shared/prayer";
import { CITIES, allTimezones, guessCity, systemTimezone, type City } from "../../shared/cities";
import type { Settings } from "../../shared/settings";
import { CoordInput } from "../components/CoordInput";
import { Group } from "../components/Group";
import { Row } from "../components/Row";
import { Seg } from "../components/Seg";
import { Toggle } from "../components/Toggle";
import { withDetail } from "../errors";
import { Select } from "../Select";
import type { SectionProps } from "../types";

export function PrayerSection({ s, L, l, update }: SectionProps) {
  const p = s.prayer;
  const set = (patch: Partial<Settings["prayer"]>) => update({ prayer: { ...p, ...patch } });
  const times = prayerTimes(p, new Date(), 0, s.hijriOffset);
  const [locErr, setLocErr] = useState("");
  const [badCoord, setBadCoord] = useState({ lat: false, lng: false });
  const sysTz = systemTimezone();
  const effectiveTz = p.timezone || sysTz;
  const city = CITIES.find((c) => c.id === p.cityId);
  const custom = p.cityId === "custom" || (!city && p.lat != null);
  const name = (c: City) => (s.uiLang === "ar" ? c.ar : c.en);
  const sorted = [...CITIES].sort((a, b) => name(a).localeCompare(name(b), s.uiLang));

  function enable(on: boolean) {
    if (on && p.lat == null) {
      // First time: start from the city matching the computer's timezone.
      const guess = guessCity();
      if (guess) return set({ enabled: true, cityId: guess.id, lat: guess.lat, lng: guess.lng, label: guess.en, method: guess.method });
    }
    set({ enabled: on });
  }

  function pickCity(id: string) {
    if (id === "custom") return set({ cityId: "custom" });
    const c = CITIES.find((x) => x.id === id);
    if (c) set({ cityId: c.id, lat: c.lat, lng: c.lng, label: c.en, method: c.method });
  }

  return (
    <>
      <Group>
        <Row label={l.prayerEnable}><Toggle label={l.prayerEnable} on={p.enabled} onChange={enable} /></Row>
      </Group>
      {p.enabled && (
        <>
          <Group>
            <Row label={l.city} help={city && !p.timezone && city.tz === sysTz ? l.cityGuess : undefined}>
              <Select
                searchable
                value={custom ? "custom" : city ? p.cityId : ""}
                ariaLabel={l.city}
                searchPlaceholder={l.city}
                noResults={l.noResults}
                options={[
                  ...(!city && !custom ? [{ value: "", label: "—" }] : []),
                  ...sorted.map((c) => ({ value: c.id, label: name(c) })),
                  { value: "custom", label: l.customLocation },
                ]}
                onChange={pickCity}
              />
            </Row>
            {custom && (
              <Row label={`${l.lat} / ${l.lng}`} help={badCoord.lat || badCoord.lng ? l.coordsInvalid : undefined}>
                <div className="pair">
                  <CoordInput value={p.lat} limit={90} placeholder="21.4225" label={l.lat} onValid={(ok) => setBadCoord((b) => ({ ...b, lat: !ok }))} onCommit={(lat) => set({ lat })} />
                  <CoordInput value={p.lng} limit={180} placeholder="39.8262" label={l.lng} onValid={(ok) => setBadCoord((b) => ({ ...b, lng: !ok }))} onCommit={(lng) => set({ lng })} />
                  <button
                    onClick={() =>
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setLocErr("");
                          set({ lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4) });
                        },
                        (e) => setLocErr(withDetail(l.locationFailed, e.message)),
                        { timeout: 10_000 },
                      )
                    }
                  >
                    {l.useLocation}
                  </button>
                </div>
              </Row>
            )}
            <Row label={l.timezone} help={l.timezoneHelp}>
              <Select
                searchable
                value={p.timezone}
                ariaLabel={l.timezone}
                searchPlaceholder={l.timezone}
                noResults={l.noResults}
                options={[{ value: "", label: l.systemTz, hint: sysTz }, ...allTimezones().map((tz) => ({ value: tz, label: tz }))]}
                onChange={(v) => set({ timezone: v })}
              />
            </Row>
          </Group>
          {locErr && <div className="error" role="alert">{locErr}</div>}
          {city && city.tz !== effectiveTz && (
            <div className="warn">
              {fmt(l.tzMismatch, { city: name(city), tz: city.tz, current: effectiveTz })}{" "}
              <button className="link" onClick={() => set({ timezone: city.tz })}>{l.useCityTz}</button>
            </div>
          )}
          <Group>
            <Row label={l.method}>
              <Select
                width={300}
                value={p.method}
                ariaLabel={l.method}
                options={METHODS.map((m) => ({ value: m.id, label: s.uiLang === "ar" ? m.ar : m.en }))}
                onChange={(v) => set({ method: v })}
              />
            </Row>
            <Row label={l.madhab}>
              <Seg value={p.madhab} label={l.madhab} options={[["shafi", l.shafi], ["hanafi", l.hanafi]]} onChange={(v) => set({ madhab: v })} />
            </Row>
            <Row label={l.highLat} help={l.highLatHelp}>
              <Select
                width={300}
                value={p.highLatRule}
                ariaLabel={l.highLat}
                options={[
                  { value: "auto", label: l.highLatAuto },
                  { value: "middle", label: l.highLatMiddle },
                  { value: "seventh", label: l.highLatSeventh },
                  { value: "twilight", label: l.highLatTwilight },
                ]}
                onChange={(v) => set({ highLatRule: v })}
              />
            </Row>
          </Group>
          {times && (
            <div className="times">
              {PRAYERS.map((n) => (
                <div key={n}>
                  <small>{L.prayers[n]}</small>
                  <b>{formatTime(p, times[n], s.uiLang)}</b>
                </div>
              ))}
            </div>
          )}
          <Group>
            <Row label={l.notify} help={l.notifyHelp}><Toggle label={l.notify} on={p.notify} onChange={(v) => set({ notify: v })} /></Row>
            {p.notify && (
              <Row label={l.notifyWhen}>
                <Seg
                  value={p.notifyBefore}
                  label={l.notifyWhen}
                  options={[[0, l.notifyAt], [5, fmt(l.notifyBefore, { n: 5 }, s.uiLang)], [10, fmt(l.notifyBefore, { n: 10 }, s.uiLang)], [15, fmt(l.notifyBefore, { n: 15 }, s.uiLang)]]}
                  onChange={(v) => set({ notifyBefore: v })}
                />
              </Row>
            )}
            {p.notify && (
              <Row label={l.notifyClose}>
                <Seg
                  value={p.notifyClose}
                  label={l.notifyClose}
                  options={[[1, fmt(l.minutes, { n: 1 }, s.uiLang)], [2, fmt(l.minutes, { n: 2 }, s.uiLang)], [5, fmt(l.minutes, { n: 5 }, s.uiLang)], [0, l.keepOpen]]}
                  onChange={(v) => set({ notifyClose: v })}
                />
              </Row>
            )}
          </Group>
          {/* TEMPORARY test buttons, English only — remove before release. */}
          <div className="actions test-actions">
            <button onClick={() => emit("test-prayer", "now")}>Test: prayer time now</button>
            <button onClick={() => emit("test-prayer", "soon")}>Test: prayer in 5 min</button>
          </div>
        </>
      )}
      <Group>
        <Row label={l.hijri} help={s.showHijri ? hijriDate(s.uiLang, s.hijriOffset, p.timezone) : undefined}>
          <Toggle label={l.hijri} on={s.showHijri} onChange={(v) => update({ showHijri: v })} />
        </Row>
        {s.showHijri && (
          <Row label={l.hijriAdjust} help={l.hijriAdjustHelp}>
            <div dir="ltr"><Seg
              value={s.hijriOffset}
              label={l.hijriAdjust}
              options={[[-2, "−2"], [-1, "−1"], [0, "0"], [1, "+1"], [2, "+2"]]}
              onChange={(v) => update({ hijriOffset: v })}
            /></div>
          </Row>
        )}
      </Group>
    </>
  );
}
