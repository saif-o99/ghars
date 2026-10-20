import { describe, expect, it } from "vitest";
import { formatCountdown, hijriDate, nextPrayer, PRAYERS, prayersAround, prayerTimes } from "./prayer";
import type { PrayerSettings } from "./settings";

const at = (iso: string) => new Date(iso);
const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

// The defaults from settings.ts (not imported: that module reads the browser at load).
const BASE: PrayerSettings = {
  enabled: true, lat: null, lng: null, label: "", method: "MuslimWorldLeague", madhab: "shafi",
  cityId: "", timezone: "", notify: true, notifyBefore: 0, notifyClose: 2, highLatRule: "auto",
};

function place(over: Partial<PrayerSettings>): PrayerSettings {
  return { ...BASE, ...over };
}

const london = place({ lat: 51.5074, lng: -0.1278, timezone: "Europe/London", method: "MuslimWorldLeague" });
const cairo = place({ lat: 30.0444, lng: 31.2357, timezone: "Africa/Cairo", method: "MuslimWorldLeague" });
const makkah = place({ lat: 21.4225, lng: 39.8262, timezone: "Asia/Riyadh", method: "UmmAlQura" });

describe("Isha after midnight", () => {
  // Late June in London: with the middle-of-the-night rule Isha falls at about 01:03 BST.
  const p = { ...london, highLatRule: "middle" as const };

  it("puts yesterday's Isha first, still ahead after midnight", () => {
    const now = at("2026-06-24T23:30:00Z"); // 00:30 BST, 25 June
    const list = prayersAround(p, now);
    expect(list.map((x) => x.name)).toEqual(["isha", ...PRAYERS]);
    expect(list[0].day).toBe("2026-06-24");
    expect(list.slice(1).every((x) => x.day === "2026-06-25")).toBe(true);
    expect(list[0].time > now).toBe(true);
    expect(list[0].time.getTime()).toBeLessThan(at("2026-06-25T01:00:00Z").getTime());
  });

  it("makes yesterday's Isha the next prayer, not Fajr", () => {
    const now = at("2026-06-24T23:30:00Z");
    const next = nextPrayer(p, now);
    expect(next?.name).toBe("isha");
    expect(next?.time).toEqual(prayersAround(p, now)[0].time);
  });

  it("before midnight, the next prayer is today's Isha, after midnight", () => {
    const now = at("2026-06-24T22:30:00Z"); // 23:30 BST, 24 June
    const next = nextPrayer(p, now);
    expect(next?.name).toBe("isha");
    expect(next!.time > at("2026-06-24T23:00:00Z")).toBe(true); // after midnight BST
  });

  it("after Isha, it is the next day's Fajr", () => {
    const p = { ...london, highLatRule: "seventh" as const };
    const now = at("2026-06-24T22:00:00Z"); // 23:00 BST, past Isha (about 22:25)
    const next = nextPrayer(p, now);
    expect(next?.name).toBe("fajr");
    expect(next?.time).toEqual(prayerTimes(p, now, 1)!.fajr);
  });
});

describe("high-latitude rule", () => {
  const june = at("2026-06-24T12:00:00Z");
  const times = (p: PrayerSettings) => PRAYERS.map((n) => prayerTimes(p, june)![n].getTime());

  it("auto uses one-seventh of the night above 48° (London)", () => {
    const auto = times({ ...london, highLatRule: "auto" });
    expect(auto).toEqual(times({ ...london, highLatRule: "seventh" }));
    expect(auto).not.toEqual(times({ ...london, highLatRule: "middle" }));
  });

  it("auto uses the middle of the night below 48° (Cairo)", () => {
    expect(times({ ...cairo, highLatRule: "auto" })).toEqual(times({ ...cairo, highLatRule: "middle" }));
  });

  it("the explicit rules change Isha in London", () => {
    const middle = prayerTimes({ ...london, highLatRule: "middle" }, june)!;
    const seventh = prayerTimes({ ...london, highLatRule: "seventh" }, june)!;
    expect(minutes(seventh.isha, middle.isha)).toBeGreaterThan(120);
  });
});

describe("Umm al-Qura Ramadan Isha", () => {
  // Ramadan 1447 begins on 18 February 2026 (Umm al-Qura).
  const feb17 = at("2026-02-17T09:00:00Z"); // noon in Makkah, 29 Sha'ban
  const feb18 = at("2026-02-18T09:00:00Z"); // noon in Makkah, 1 Ramadan
  const gap = (now: Date, offset = 0) => {
    const t = prayerTimes(makkah, now, 0, offset)!;
    return minutes(t.maghrib, t.isha);
  };

  it("is 90 minutes after Maghrib outside Ramadan and 120 in Ramadan", () => {
    expect(gap(feb17)).toBe(90);
    expect(gap(feb18)).toBe(120);
  });

  it("follows the Hijri adjustment", () => {
    expect(gap(feb17, 1)).toBe(120);
    expect(gap(feb18, -1)).toBe(90);
  });

  it("only applies to Umm al-Qura", () => {
    const t = prayerTimes({ ...makkah, method: "MuslimWorldLeague" }, feb18)!;
    expect(minutes(t.maghrib, t.isha)).not.toBe(120);
  });

  it("uses yesterday's month for yesterday's Isha", () => {
    // Just after midnight on 1 Ramadan: yesterday's Isha (29 Sha'ban) keeps the short gap.
    const now = at("2026-02-17T21:30:00Z"); // 00:30 on 18 February in Makkah
    const list = prayersAround(makkah, now);
    const yesterday = prayerTimes(makkah, feb17)!;
    expect(list[0]).toMatchObject({ name: "isha", day: "2026-02-17" });
    expect(list[0].time).toEqual(yesterday.isha);
    expect(minutes(yesterday.maghrib, list[0].time)).toBe(90);
    expect(gap(now)).toBe(120);
  });
});

describe("invalid settings", () => {
  const now = at("2026-06-24T12:00:00Z");
  const cases: [string, Partial<PrayerSettings>][] = [
    ["latitude above 90", { lat: 91 }],
    ["latitude below -90", { lat: -90.5 }],
    ["longitude above 180", { lng: 181 }],
    ["missing latitude", { lat: null }],
    ["missing longitude", { lng: null }],
    ["NaN", { lat: Number.NaN }],
    ["Infinity", { lng: Number.POSITIVE_INFINITY }],
    ["prayer times off", { enabled: false }],
  ];

  it.each(cases)("%s gives no times", (_, over) => {
    const p = { ...london, ...over };
    expect(prayerTimes(p, now)).toBeNull();
    expect(prayersAround(p, now)).toEqual([]);
    expect(nextPrayer(p, now)).toBeNull();
  });

  it("accepts the edges of the range", () => {
    expect(prayerTimes({ ...cairo, lat: 0, lng: 180 }, now)).not.toBeNull();
    expect(prayerTimes({ ...cairo, lat: -30, lng: -180 }, now)).not.toBeNull();
  });
});

describe("Hijri date", () => {
  const tz = "Europe/London";
  // The clocks go forward in London at 01:00 UTC on 29 March 2026.
  const mar29 = at("2026-03-29T12:00:00Z");
  const mar30 = at("2026-03-30T12:00:00Z");

  it("shifts by calendar days across a DST change", () => {
    expect(hijriDate("en", 1, tz, mar29)).toBe(hijriDate("en", 0, tz, mar30));
    expect(hijriDate("en", -1, tz, mar30)).toBe(hijriDate("en", 0, tz, mar29));
    expect(hijriDate("en", 0, tz, mar29)).not.toBe(hijriDate("en", 0, tz, mar30));
  });

  it("uses the day in the chosen timezone", () => {
    const late = at("2026-03-29T23:30:00Z"); // 00:30 on 30 March in London
    expect(hijriDate("en", 0, tz, late)).toBe(hijriDate("en", 0, tz, mar30));
    expect(hijriDate("en", 0, "UTC", late)).toBe(hijriDate("en", 0, tz, mar29));
  });

  it("is the Umm al-Qura date", () => {
    const s = hijriDate("en", 0, tz, mar29);
    expect(s).toContain("1447");
    expect(s).toContain("10");
    expect(hijriDate("en", 0, "Asia/Riyadh", at("2026-02-18T09:00:00Z"))).toMatch(/Ramadan/);
  });
});

describe("formatCountdown", () => {
  const min = 60_000;

  it("shows minutes under an hour", () => {
    expect(formatCountdown(36 * min, "en")).toBe("36m");
    expect(formatCountdown(0, "en")).toBe("0m");
    expect(formatCountdown(59 * min + 29_000, "en")).toBe("59m");
  });

  it("shows h:mm from an hour", () => {
    expect(formatCountdown(59 * min + 31_000, "en")).toBe("1:00");
    expect(formatCountdown(65 * min, "en")).toBe("1:05");
    expect(formatCountdown(10 * 60 * min + 9 * min, "ar")).toBe("10:09");
  });

  it("never goes below zero", () => {
    expect(formatCountdown(-5 * min, "en")).toBe("0m");
  });

  it("uses the language's unit", () => {
    expect(formatCountdown(36 * min, "ar")).not.toBe(formatCountdown(36 * min, "en"));
  });
});
