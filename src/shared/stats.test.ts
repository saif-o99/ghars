import { describe, expect, it, vi } from "vitest";

// stats.ts talks to the Tauri store and event bus, and to the window, when it loads.
// These stand in for them: one in-memory store per file name.
const fake = vi.hoisted(() => {
  vi.stubGlobal("window", {
    addEventListener: () => {},
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  return { files: new Map<string, Map<string, unknown>>(), saves: 0, emitted: [] as [string, unknown][] };
});

vi.mock("@tauri-apps/plugin-store", () => ({
  load: async (name: string) => {
    const data = fake.files.get(name) ?? new Map<string, unknown>();
    fake.files.set(name, data);
    return {
      get: async (key: string) => structuredClone(data.get(key)),
      set: async (key: string, value: unknown) => void data.set(key, structuredClone(value)),
      save: async () => void fake.saves++,
    };
  },
}));
vi.mock("@tauri-apps/api/event", () => ({
  emit: async (event: string, payload: unknown) => void fake.emitted.push([event, payload]),
  listen: async () => () => {},
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ label: "test" }) }));

/** A fresh copy of stats.ts over a store holding `days`. */
async function setup(days?: Record<string, Record<string, number>>) {
  vi.resetModules();
  fake.files.clear();
  fake.saves = 0;
  fake.emitted = [];
  if (days) fake.files.set("stats.json", new Map([["days", days]]));
  return import("./stats");
}

const saved = () => fake.files.get("stats.json")?.get("days");

describe("importDays", () => {
  it("skips keys that aren't real calendar days", async () => {
    const stats = await setup();
    const n = await stats.importDays({
      "2026-99-99": { istighfar: 5 },
      "2026-02-30": { istighfar: 5 },
      "2026-02-29": { istighfar: 5 }, // 2026 isn't a leap year
      "2026-13-01": { istighfar: 5 },
      "2026-00-10": { istighfar: 5 },
      "2026-1-5": { istighfar: 5 },
      "26-01-05": { istighfar: 5 },
      "2026-01-05T00:00": { istighfar: 5 },
      "not a day": { istighfar: 5 },
    });
    expect(n).toBe(0);
    expect(stats.allDays()).toEqual({});
  });

  it("accepts real days, including leap days", async () => {
    const stats = await setup();
    const n = await stats.importDays({ "2028-02-29": { istighfar: 3 }, "2026-12-31": { tahlil: 1 } });
    expect(n).toBe(2);
    expect(stats.allDays()).toEqual({ "2028-02-29": { istighfar: 3 }, "2026-12-31": { tahlil: 1 } });
  });

  it("skips days whose counts aren't an object", async () => {
    const stats = await setup();
    const n = await stats.importDays({
      "2026-01-01": 5,
      "2026-01-02": null,
      "2026-01-03": [1, 2, 3],
      "2026-01-04": "12",
      "2026-01-05": true,
    });
    expect(n).toBe(0);
    expect(stats.allDays()).toEqual({});
  });

  it("skips counts that aren't positive finite numbers, and rounds down", async () => {
    const stats = await setup();
    const n = await stats.importDays({
      "2026-01-05": { a: Number.NaN, b: Number.POSITIVE_INFINITY, c: "3", d: 0, e: -2, f: null, g: 0.5 },
      "2026-01-06": { a: Number.NaN, ok: 7.9 },
    });
    expect(n).toBe(1);
    expect(stats.allDays()).toEqual({ "2026-01-06": { ok: 7 } });
  });

  it("keeps the larger count when merging, so restoring twice never doubles", async () => {
    const stats = await setup({ "2026-03-01": { a: 10, b: 2 }, "2026-03-02": { a: 1 } });
    const backup = { "2026-03-01": { a: 4, b: 7, c: 1 }, "2026-03-03": { a: 2 } };
    expect(await stats.importDays(backup)).toBe(2);
    const once = structuredClone(stats.allDays());
    expect(once).toEqual({
      "2026-03-01": { a: 10, b: 7, c: 1 },
      "2026-03-02": { a: 1 },
      "2026-03-03": { a: 2 },
    });
    expect(await stats.importDays(backup)).toBe(2);
    expect(stats.allDays()).toEqual(once);
  });

  it("counts only the days that had a valid count", async () => {
    const stats = await setup();
    const n = await stats.importDays({
      "2026-04-01": { a: 1 },
      "2026-04-02": { a: 0 },
      "2026-04-03": {},
      "2026-04-31": { a: 1 },
      "2026-04-04": { a: "1", b: 2 },
    });
    expect(n).toBe(2);
    expect(Object.keys(stats.allDays()).sort()).toEqual(["2026-04-01", "2026-04-04"]);
  });

  it("saves the result and tells the other windows", async () => {
    const stats = await setup({ "2026-05-01": { a: 1 } });
    await stats.importDays({ "2026-05-02": { b: 3 } });
    expect(saved()).toEqual({ "2026-05-01": { a: 1 }, "2026-05-02": { b: 3 } });
    expect(fake.saves).toBe(1);
    expect(fake.emitted).toEqual([["stats-changed", "test"]]);
  });
});

describe("dayKey", () => {
  it("is the local date as YYYY-MM-DD", async () => {
    const { dayKey } = await setup();
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });
});
