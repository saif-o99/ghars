import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, type CalculationParameters } from "adhan";
import type { PackId } from "./content";
import type { CalcMethodId, PrayerSettings } from "./settings";

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export const PRAYERS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export const METHODS: { id: CalcMethodId; en: string; ar: string }[] = [
  { id: "MuslimWorldLeague", en: "Muslim World League", ar: "رابطة العالم الإسلامي" },
  { id: "UmmAlQura", en: "Umm al-Qura (Makkah)", ar: "أم القرى (مكة)" },
  { id: "Egyptian", en: "Egyptian General Authority", ar: "الهيئة المصرية العامة للمساحة" },
  { id: "Karachi", en: "University of Karachi", ar: "جامعة كراتشي" },
  { id: "Dubai", en: "Dubai", ar: "دبي" },
  { id: "Kuwait", en: "Kuwait", ar: "الكويت" },
  { id: "Qatar", en: "Qatar", ar: "قطر" },
  { id: "Singapore", en: "Singapore", ar: "سنغافورة" },
  { id: "Turkey", en: "Diyanet (Turkey)", ar: "رئاسة الشؤون الدينية (تركيا)" },
  { id: "Tehran", en: "Tehran", ar: "طهران" },
  { id: "NorthAmerica", en: "ISNA (North America)", ar: "أمريكا الشمالية (ISNA)" },
  { id: "MoonsightingCommittee", en: "Moonsighting Committee", ar: "لجنة رؤية الهلال" },
];

/**
 * Settings for one calendar day (`day` as made by dayIn). The day matters for Umm al-Qura,
 * whose Isha is 120 minutes after Maghrib in Ramadan instead of 90.
 */
function params(p: PrayerSettings, coordinates: Coordinates, day: Date, hijriOffset: number): CalculationParameters {
  const params = CalculationMethod[p.method]();
  params.madhab = p.madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  // Where twilight lasts all night in summer, Fajr and Isha come from a share of the night.
  // "auto" uses one-seventh above 48° and the middle of the night below.
  params.highLatitudeRule =
    p.highLatRule === "middle" ? HighLatitudeRule.MiddleOfTheNight
    : p.highLatRule === "seventh" ? HighLatitudeRule.SeventhOfTheNight
    : p.highLatRule === "twilight" ? HighLatitudeRule.TwilightAngle
    : HighLatitudeRule.recommended(coordinates);
  if (p.method === "UmmAlQura" && hijriMonth(day, hijriOffset) === 9) params.ishaInterval = 120;
  return params;
}

// Formatters are slow to create and the island re-renders often, so they are reused.
const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(lang: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${lang}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(lang, options);
    dateFormats.set(key, f);
  }
  return f;
}

/** The calendar day [year, month (1-12), day] of `instant` in the chosen timezone. */
function ymdIn(timezone: string, instant: Date): [number, number, number] {
  const parts = dateFormat("en-US", { timeZone: timezone || undefined, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((x) => x.type === type)?.value);
  return [part("year"), part("month"), part("day")];
}

/** The calendar day of `instant` in the chosen timezone, as a local Date adhan understands. */
function dayIn(timezone: string, instant: Date, addDays = 0): Date {
  const [y, m, d] = ymdIn(timezone, instant);
  return new Date(y, m - 1, d + addDays, 12);
}

const valid = (d: Date) => !Number.isNaN(d.getTime());

/**
 * The Umm al-Qura Hijri month (1-12) of a calendar day (`day` as made by dayIn), shifted by
 * the user's Hijri adjustment; 0 if the engine can't tell.
 */
function hijriMonth(day: Date, offsetDays: number): number {
  try {
    const d = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate() + offsetDays, 12));
    const parts = dateFormat("en-u-ca-islamic-umalqura-nu-latn", { month: "numeric", timeZone: "UTC" }).formatToParts(d);
    return Number(parts.find((x) => x.type === "month")?.value) || 0;
  } catch {
    return 0;
  }
}

/**
 * Null when prayer times are off, the coordinates are out of range, or the times can't be
 * calculated. `hijriOffset` is the user's Hijri date adjustment (it decides when Ramadan starts).
 */
export function prayerTimes(p: PrayerSettings, date = new Date(), addDays = 0, hijriOffset = 0): PrayerTimes | null {
  const { lat, lng } = p;
  if (!p.enabled || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const day = dayIn(p.timezone, date, addDays);
  if (!valid(day)) return null;
  const coordinates = new Coordinates(lat, lng);
  const t = new PrayerTimes(coordinates, day, params(p, coordinates, day, hijriOffset));
  return PRAYERS.every((name) => valid(t[name])) ? t : null;
}

/**
 * Today's five prayers, preceded by yesterday's Isha. At high latitudes in summer Isha
 * comes after midnight (London in June: about 1:00), so before Fajr the Isha still ahead,
 * or just past, belongs to yesterday. `day` is the date the prayer belongs to, for
 * remembering which reminders were shown. Yesterday's Isha uses yesterday's settings (the
 * Ramadan Isha of Umm al-Qura starts and ends with the month).
 */
export function prayersAround(p: PrayerSettings, now = new Date(), hijriOffset = 0): { name: PrayerName; time: Date; day: string }[] {
  const t = prayerTimes(p, now, 0, hijriOffset);
  if (!t) return [];
  const y = prayerTimes(p, now, -1, hijriOffset);
  const key = (addDays: number) => {
    const d = dayIn(p.timezone, now, addDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const today = key(0);
  return [
    ...(y ? [{ name: "isha" as const, time: y.isha, day: key(-1) }] : []),
    ...PRAYERS.map((name) => ({ name, time: t[name], day: today })),
  ];
}

export function formatTime(p: PrayerSettings, d: Date, lang: string): string {
  if (!valid(d)) return "";
  return dateFormat(lang, { hour: "2-digit", minute: "2-digit", timeZone: p.timezone || undefined }).format(d);
}

export function nextPrayer(p: PrayerSettings, now = new Date(), hijriOffset = 0): { name: PrayerName; time: Date } | null {
  const list = prayersAround(p, now, hijriOffset);
  if (!list.length) return null;
  const next = list.find((x) => x.time > now);
  if (next) return { name: next.name, time: next.time };
  const t2 = prayerTimes(p, now, 1, hijriOffset);
  return t2 ? { name: "fajr", time: t2.fajr } : null;
}

/** The pack that fits the moment: after-prayer, morning, evening, Friday, or general. */
export function contextPack(p: PrayerSettings, now = new Date(), hijriOffset = 0): PackId {
  const t = prayerTimes(p, now, 0, hijriOffset);
  const min = 60_000;
  if (t) {
    for (const { time } of prayersAround(p, now, hijriOffset)) {
      const since = now.getTime() - time.getTime();
      if (since >= 8 * min && since <= 45 * min) return "afterPrayer";
    }
    if (now >= t.fajr && now < t.dhuhr) return "morning";
    // Isha can come after midnight; the evening lasts until then.
    const lateIsha = prayerTimes(p, now, -1, hijriOffset)?.isha;
    if ((now >= t.asr && now < t.isha) || (lateIsha && now < lateIsha)) return "evening";
  } else {
    const h = now.getHours();
    if (h >= 4 && h < 11) return "morning";
    if (h >= 15 && h < 20) return "evening";
  }
  if (now.getDay() === 5) return "friday";
  return "general";
}

/**
 * Today's Hijri (Umm al-Qura) date, shifted by the user's adjustment. The shift is done on
 * the calendar day (not by adding 24-hour blocks), so days with a DST change can't land on
 * the wrong date.
 */
export function hijriDate(lang: string, offsetDays: number, timezone = "", now = new Date()): string {
  try {
    const [y, m, d] = ymdIn(timezone, now);
    const day = new Date(Date.UTC(y, m - 1, d + offsetDays, 12));
    return dateFormat(`${lang}-u-ca-islamic-umalqura`, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(day);
  } catch {
    return "";
  }
}

const minuteFormats = new Map<string, Intl.NumberFormat>();

/** "1:05" for an hour or more, otherwise minutes in the language's short unit ("36m", "36 د"). */
export function formatCountdown(ms: number, lang = "en"): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  let f = minuteFormats.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(lang, { style: "unit", unit: "minute", unitDisplay: "narrow" });
    minuteFormats.set(lang, f);
  }
  return f.format(m);
}
