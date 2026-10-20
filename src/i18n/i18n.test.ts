import { describe, expect, it } from "vitest";
import { ISTIGHFAR, PACKS } from "../shared/content";
import { ar } from "./ar";
import { bn } from "./bn";
import { en } from "./en";
import { fr } from "./fr";
import { id } from "./id";
import { fmt, LANGS } from "./index";
import { ms } from "./ms";
import { tr } from "./tr";
import { ur } from "./ur";

const LOCALES: Record<string, unknown> = { ar, bn, fr, id, ms, tr, ur };

/** Every string in a locale by its dotted path, leaving out `content` (meanings by dhikr id). */
function strings(obj: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (path === "content") continue;
    if (typeof v === "string") out.set(path, v);
    else for (const [p, s] of strings(v, path)) out.set(p, s);
  }
  return out;
}

/** The `{name}` placeholders in a string (plural forms included), sorted. */
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const source = strings(en);

describe("locales", () => {
  it("covers every language in LANGS", () => {
    expect(Object.keys(LOCALES).sort()).toEqual(LANGS.map((l) => l.id).filter((l) => l !== "en").sort());
  });

  describe.each(Object.entries(LOCALES))("%s", (_, locale) => {
    const own = strings(locale);

    it("has exactly the keys of en.ts", () => {
      expect([...own.keys()].sort()).toEqual([...source.keys()].sort());
    });

    it("keeps the same placeholders", () => {
      for (const [path, text] of own) {
        const want = source.get(path);
        if (want === undefined) continue;
        expect(placeholders(text), path).toEqual(placeholders(want));
      }
    });

    it("only translates meanings of known adhkar", () => {
      const ids = new Set([...Object.values(ISTIGHFAR), ...Object.values(PACKS).flatMap((p) => p.items)].map((d) => d.id));
      const content = (locale as { content?: Record<string, string> }).content ?? {};
      for (const key of Object.keys(content)) expect(ids, key).toContain(key);
    });
  });
});

describe("fmt", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(fmt("{prayer} in {min} min", { prayer: "Asr", min: 5 })).toBe("Asr in 5 min");
    expect(fmt("{a} {b}", { a: 1 })).toBe("1 {b}");
  });

  it("picks the plural form for the language", () => {
    const t = "{n|one:# day|other:# days}";
    expect(fmt(t, { n: 1 })).toBe("1 day");
    expect(fmt(t, { n: 3 })).toBe("3 days");
    const a = "{min|one:دقيقة|two:دقيقتين|few:# دقائق|many:# دقيقة|other:# دقيقة}";
    expect(fmt(a, { min: 2 }, "ar")).toBe("دقيقتين");
    expect(fmt(a, { min: 5 }, "ar")).toBe("5 دقائق");
  });
});
