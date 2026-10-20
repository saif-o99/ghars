import type { Dhikr } from "../shared/content";
import { ar } from "./ar";
import { bn } from "./bn";
import { en, type Locale, type PartialLocale } from "./en";
import { fr } from "./fr";
import { id } from "./id";
import { ms } from "./ms";
import { tr } from "./tr";
import { ur } from "./ur";

export type Lang = "ar" | "en" | "ur" | "id" | "tr" | "ms" | "fr" | "bn";

export const LANGS: { id: Lang; name: string; rtl: boolean }[] = [
  { id: "ar", name: "العربية", rtl: true },
  { id: "en", name: "English", rtl: false },
  { id: "ur", name: "اردو", rtl: true },
  { id: "id", name: "Bahasa Indonesia", rtl: false },
  { id: "ms", name: "Bahasa Melayu", rtl: false },
  { id: "tr", name: "Türkçe", rtl: false },
  { id: "fr", name: "Français", rtl: false },
  { id: "bn", name: "বাংলা", rtl: false },
];

const PARTIALS: Record<Lang, PartialLocale> = { en: {}, ar, ur, id, tr, ms, fr, bn };

function merge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object") return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v === undefined) continue;
    const b = out[k];
    out[k] = b && typeof b === "object" && v && typeof v === "object" ? merge(b, v) : v;
  }
  return out as T;
}

const cache = new Map<Lang, Locale>();

/** Full strings for a language; anything it doesn't translate falls back to English. */
export function locale(lang: Lang): Locale {
  let l = cache.get(lang);
  if (!l) {
    l = merge(en, PARTIALS[lang] ?? {});
    cache.set(lang, l);
  }
  return l;
}

export function isRtl(lang: Lang): boolean {
  return LANGS.find((l) => l.id === lang)?.rtl ?? false;
}

/**
 * Fills `{name}` placeholders. A placeholder can also pick the plural form for the
 * language, e.g. `{n|one:a day|other:# days}` (`#` is the number). Categories are
 * those of Intl.PluralRules: zero, one, two, few, many, other.
 */
export function fmt(template: string, values: Record<string, string | number>, lang = "en"): string {
  return template.replace(/\{(\w+)(?:\|([^{}]*))?\}/g, (whole, k: string, forms?: string) => {
    const v = values[k];
    if (v === undefined) return whole;
    if (!forms) return String(v);
    const byCat = Object.fromEntries(forms.split("|").map((f) => [f.slice(0, f.indexOf(":")), f.slice(f.indexOf(":") + 1)]));
    const cat = new Intl.PluralRules(lang).select(Number(v));
    return (byCat[cat] ?? byCat.other ?? String(v)).replace(/#/g, String(v));
  });
}

/**
 * The meaning of a dhikr in the interface language. Items that appear in several
 * sets share a meaning, so `m-tahlil` falls back to `tahlil`, and so on. Arabic
 * readers get the English meaning (the text itself is already Arabic).
 */
export function meaning(d: Dhikr, lang: Lang): string {
  if (lang === "en" || lang === "ar" || d.id.startsWith("c-")) return d.en;
  const content = locale(lang).content;
  return content[d.id] ?? content[d.id.replace(/^[mepf]-/, "")] ?? d.en;
}
