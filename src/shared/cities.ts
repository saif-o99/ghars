import type { CalcMethodId } from "./settings";

export interface City {
  id: string;
  en: string;
  ar: string;
  lat: number;
  lng: number;
  tz: string;
  /** The calculation method most commonly used there. */
  method: CalcMethodId;
}

type Row = [id: string, en: string, ar: string, lat: number, lng: number, tz: string, method: CalcMethodId];

// Offline list so choosing a location never needs the network. Missing your city?
// Pick the nearest one or enter coordinates manually.
const ROWS: Row[] = [
  ["makkah", "Makkah", "مكة المكرمة", 21.4225, 39.8262, "Asia/Riyadh", "UmmAlQura"],
  ["madinah", "Madinah", "المدينة المنورة", 24.4672, 39.6111, "Asia/Riyadh", "UmmAlQura"],
  ["riyadh", "Riyadh", "الرياض", 24.7136, 46.6753, "Asia/Riyadh", "UmmAlQura"],
  ["jeddah", "Jeddah", "جدة", 21.4858, 39.1925, "Asia/Riyadh", "UmmAlQura"],
  ["dammam", "Dammam", "الدمام", 26.4207, 50.0888, "Asia/Riyadh", "UmmAlQura"],
  ["amman", "Amman", "عمّان", 31.9539, 35.9106, "Asia/Amman", "MuslimWorldLeague"],
  ["irbid", "Irbid", "إربد", 32.5556, 35.85, "Asia/Amman", "MuslimWorldLeague"],
  ["zarqa", "Zarqa", "الزرقاء", 32.0728, 36.088, "Asia/Amman", "MuslimWorldLeague"],
  ["alquds", "Jerusalem (al-Quds)", "القدس", 31.778, 35.2354, "Asia/Jerusalem", "MuslimWorldLeague"],
  ["ramallah", "Ramallah", "رام الله", 31.9038, 35.2034, "Asia/Hebron", "MuslimWorldLeague"],
  ["gaza", "Gaza", "غزة", 31.5017, 34.4668, "Asia/Gaza", "MuslimWorldLeague"],
  ["cairo", "Cairo", "القاهرة", 30.0444, 31.2357, "Africa/Cairo", "Egyptian"],
  ["alexandria", "Alexandria", "الإسكندرية", 31.2001, 29.9187, "Africa/Cairo", "Egyptian"],
  ["damascus", "Damascus", "دمشق", 33.5138, 36.2765, "Asia/Damascus", "MuslimWorldLeague"],
  ["aleppo", "Aleppo", "حلب", 36.2021, 37.1343, "Asia/Damascus", "MuslimWorldLeague"],
  ["beirut", "Beirut", "بيروت", 33.8938, 35.5018, "Asia/Beirut", "MuslimWorldLeague"],
  ["baghdad", "Baghdad", "بغداد", 33.3152, 44.3661, "Asia/Baghdad", "MuslimWorldLeague"],
  ["basra", "Basra", "البصرة", 30.5085, 47.7804, "Asia/Baghdad", "MuslimWorldLeague"],
  ["kuwait", "Kuwait City", "الكويت", 29.3759, 47.9774, "Asia/Kuwait", "Kuwait"],
  ["doha", "Doha", "الدوحة", 25.2854, 51.531, "Asia/Qatar", "Qatar"],
  ["manama", "Manama", "المنامة", 26.2285, 50.586, "Asia/Bahrain", "MuslimWorldLeague"],
  ["abudhabi", "Abu Dhabi", "أبوظبي", 24.4539, 54.3773, "Asia/Dubai", "Dubai"],
  ["dubai", "Dubai", "دبي", 25.2048, 55.2708, "Asia/Dubai", "Dubai"],
  ["sharjah", "Sharjah", "الشارقة", 25.3463, 55.4209, "Asia/Dubai", "Dubai"],
  ["muscat", "Muscat", "مسقط", 23.588, 58.3829, "Asia/Muscat", "MuslimWorldLeague"],
  ["sanaa", "Sana'a", "صنعاء", 15.3694, 44.191, "Asia/Aden", "MuslimWorldLeague"],
  ["aden", "Aden", "عدن", 12.7855, 45.0187, "Asia/Aden", "MuslimWorldLeague"],
  ["khartoum", "Khartoum", "الخرطوم", 15.5007, 32.5599, "Africa/Khartoum", "Egyptian"],
  ["tripoli", "Tripoli", "طرابلس", 32.8872, 13.1913, "Africa/Tripoli", "Egyptian"],
  ["tunis", "Tunis", "تونس", 36.8065, 10.1815, "Africa/Tunis", "MuslimWorldLeague"],
  ["algiers", "Algiers", "الجزائر", 36.7538, 3.0588, "Africa/Algiers", "MuslimWorldLeague"],
  ["rabat", "Rabat", "الرباط", 34.0209, -6.8416, "Africa/Casablanca", "MuslimWorldLeague"],
  ["casablanca", "Casablanca", "الدار البيضاء", 33.5731, -7.5898, "Africa/Casablanca", "MuslimWorldLeague"],
  ["fes", "Fes", "فاس", 34.0181, -5.0078, "Africa/Casablanca", "MuslimWorldLeague"],
  ["nouakchott", "Nouakchott", "نواكشوط", 18.0735, -15.9582, "Africa/Nouakchott", "MuslimWorldLeague"],
  ["mogadishu", "Mogadishu", "مقديشو", 2.0469, 45.3182, "Africa/Mogadishu", "MuslimWorldLeague"],
  ["istanbul", "Istanbul", "إسطنبول", 41.0082, 28.9784, "Europe/Istanbul", "Turkey"],
  ["ankara", "Ankara", "أنقرة", 39.9334, 32.8597, "Europe/Istanbul", "Turkey"],
  ["tehran", "Tehran", "طهران", 35.6892, 51.389, "Asia/Tehran", "Tehran"],
  ["karachi", "Karachi", "كراتشي", 24.8607, 67.0011, "Asia/Karachi", "Karachi"],
  ["lahore", "Lahore", "لاهور", 31.5204, 74.3587, "Asia/Karachi", "Karachi"],
  ["islamabad", "Islamabad", "إسلام آباد", 33.6844, 73.0479, "Asia/Karachi", "Karachi"],
  ["kabul", "Kabul", "كابل", 34.5553, 69.2075, "Asia/Kabul", "Karachi"],
  ["delhi", "Delhi", "دلهي", 28.6139, 77.209, "Asia/Kolkata", "Karachi"],
  ["mumbai", "Mumbai", "مومباي", 19.076, 72.8777, "Asia/Kolkata", "Karachi"],
  ["hyderabad", "Hyderabad", "حيدر آباد", 17.385, 78.4867, "Asia/Kolkata", "Karachi"],
  ["dhaka", "Dhaka", "دكا", 23.8103, 90.4125, "Asia/Dhaka", "Karachi"],
  ["kualalumpur", "Kuala Lumpur", "كوالالمبور", 3.139, 101.6869, "Asia/Kuala_Lumpur", "Singapore"],
  ["singapore", "Singapore", "سنغافورة", 1.3521, 103.8198, "Asia/Singapore", "Singapore"],
  ["jakarta", "Jakarta", "جاكرتا", -6.2088, 106.8456, "Asia/Jakarta", "Singapore"],
  ["surabaya", "Surabaya", "سورابايا", -7.2575, 112.7521, "Asia/Jakarta", "Singapore"],
  ["tashkent", "Tashkent", "طشقند", 41.2995, 69.2401, "Asia/Tashkent", "MuslimWorldLeague"],
  ["almaty", "Almaty", "ألماتي", 43.222, 76.8512, "Asia/Almaty", "MuslimWorldLeague"],
  ["baku", "Baku", "باكو", 40.4093, 49.8671, "Asia/Baku", "MuslimWorldLeague"],
  ["lagos", "Lagos", "لاغوس", 6.5244, 3.3792, "Africa/Lagos", "MuslimWorldLeague"],
  ["kano", "Kano", "كانو", 12.0022, 8.592, "Africa/Lagos", "MuslimWorldLeague"],
  ["dakar", "Dakar", "داكار", 14.7167, -17.4677, "Africa/Dakar", "MuslimWorldLeague"],
  ["nairobi", "Nairobi", "نيروبي", -1.2921, 36.8219, "Africa/Nairobi", "MuslimWorldLeague"],
  ["johannesburg", "Johannesburg", "جوهانسبرغ", -26.2041, 28.0473, "Africa/Johannesburg", "MuslimWorldLeague"],
  ["capetown", "Cape Town", "كيب تاون", -33.9249, 18.4241, "Africa/Johannesburg", "MuslimWorldLeague"],
  ["london", "London", "لندن", 51.5074, -0.1278, "Europe/London", "MoonsightingCommittee"],
  ["birmingham", "Birmingham", "برمنغهام", 52.4862, -1.8904, "Europe/London", "MoonsightingCommittee"],
  ["manchester", "Manchester", "مانشستر", 53.4808, -2.2426, "Europe/London", "MoonsightingCommittee"],
  ["paris", "Paris", "باريس", 48.8566, 2.3522, "Europe/Paris", "MuslimWorldLeague"],
  ["berlin", "Berlin", "برلين", 52.52, 13.405, "Europe/Berlin", "MuslimWorldLeague"],
  ["amsterdam", "Amsterdam", "أمستردام", 52.3676, 4.9041, "Europe/Amsterdam", "MuslimWorldLeague"],
  ["brussels", "Brussels", "بروكسل", 50.8503, 4.3517, "Europe/Brussels", "MuslimWorldLeague"],
  ["madrid", "Madrid", "مدريد", 40.4168, -3.7038, "Europe/Madrid", "MuslimWorldLeague"],
  ["rome", "Rome", "روما", 41.9028, 12.4964, "Europe/Rome", "MuslimWorldLeague"],
  ["vienna", "Vienna", "فيينا", 48.2082, 16.3738, "Europe/Vienna", "MuslimWorldLeague"],
  ["stockholm", "Stockholm", "ستوكهولم", 59.3293, 18.0686, "Europe/Stockholm", "MuslimWorldLeague"],
  ["oslo", "Oslo", "أوسلو", 59.9139, 10.7522, "Europe/Oslo", "MuslimWorldLeague"],
  ["copenhagen", "Copenhagen", "كوبنهاغن", 55.6761, 12.5683, "Europe/Copenhagen", "MuslimWorldLeague"],
  ["sarajevo", "Sarajevo", "سراييفو", 43.8563, 18.4131, "Europe/Sarajevo", "MuslimWorldLeague"],
  ["moscow", "Moscow", "موسكو", 55.7558, 37.6173, "Europe/Moscow", "MuslimWorldLeague"],
  ["kazan", "Kazan", "قازان", 55.7963, 49.1088, "Europe/Moscow", "MuslimWorldLeague"],
  ["newyork", "New York", "نيويورك", 40.7128, -74.006, "America/New_York", "NorthAmerica"],
  ["dearborn", "Dearborn", "ديربورن", 42.3223, -83.1763, "America/Detroit", "NorthAmerica"],
  ["chicago", "Chicago", "شيكاغو", 41.8781, -87.6298, "America/Chicago", "NorthAmerica"],
  ["houston", "Houston", "هيوستن", 29.7604, -95.3698, "America/Chicago", "NorthAmerica"],
  ["losangeles", "Los Angeles", "لوس أنجلوس", 34.0522, -118.2437, "America/Los_Angeles", "NorthAmerica"],
  ["toronto", "Toronto", "تورنتو", 43.6532, -79.3832, "America/Toronto", "NorthAmerica"],
  ["montreal", "Montreal", "مونتريال", 45.5017, -73.5673, "America/Toronto", "NorthAmerica"],
  ["vancouver", "Vancouver", "فانكوفر", 49.2827, -123.1207, "America/Vancouver", "NorthAmerica"],
  ["saopaulo", "São Paulo", "ساو باولو", -23.5505, -46.6333, "America/Sao_Paulo", "MuslimWorldLeague"],
  ["sydney", "Sydney", "سيدني", -33.8688, 151.2093, "Australia/Sydney", "MuslimWorldLeague"],
  ["melbourne", "Melbourne", "ملبورن", -37.8136, 144.9631, "Australia/Melbourne", "MuslimWorldLeague"],
];

export const CITIES: City[] = ROWS.map(([id, en, ar, lat, lng, tz, method]) => ({ id, en, ar, lat, lng, tz, method }));

export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Best guess from the computer's timezone; the user can always change it. */
export function guessCity(): City | undefined {
  return CITIES.find((c) => c.tz === systemTimezone());
}

export function allTimezones(): string[] {
  // Older webviews lack supportedValuesOf.
  return Intl.supportedValuesOf?.("timeZone") ?? CITIES.map((c) => c.tz).filter((tz, i, a) => a.indexOf(tz) === i);
}
