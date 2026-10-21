import { afterAll, describe, expect, it, vi } from "vitest";

// settings.ts reads the store, and the platform when it loads. In-memory stand-ins:
const fake = vi.hoisted(() => ({ data: new Map<string, unknown>() }));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => structuredClone(fake.data.get(key)),
    set: async (key: string, value: unknown) => void fake.data.set(key, structuredClone(value)),
    save: async () => {},
  }),
}));
vi.mock("@tauri-apps/api/event", () => ({ emit: async () => {}, listen: async () => () => {} }));

/** A fresh copy of settings.ts on `platform`, over a store holding `saved`. */
async function setup(saved?: unknown, platform = "Win32") {
  vi.stubGlobal("navigator", { platform, userAgent: "" });
  vi.stubGlobal("location", { search: "" });
  vi.resetModules();
  fake.data.clear();
  if (saved !== undefined) fake.data.set("settings", saved);
  return import("./settings");
}

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("loadSettings", () => {
  it("returns the defaults for an empty store", async () => {
    const { loadSettings, DEFAULT_SETTINGS } = await setup();
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values", async () => {
    const { loadSettings } = await setup({
      themeMode: "system", islandStyle: "notch", islandSize: "large", islandEdge: "right", uiLang: "fr",
      packMode: "morning", autoOpen: "off", istighfarPhrase: "tawba", istighfarGoal: 33, hijriOffset: -1,
      prayer: { enabled: true, lat: 21.42, lng: 39.82, method: "UmmAlQura", madhab: "hanafi", highLatRule: "seventh", timezone: "Asia/Riyadh" },
    });
    const s = await loadSettings();
    expect(s).toMatchObject({
      themeMode: "system", islandStyle: "notch", islandSize: "large", islandEdge: "right", uiLang: "fr",
      packMode: "morning", autoOpen: "off", istighfarPhrase: "tawba", istighfarGoal: 33, hijriOffset: -1,
    });
    expect(s.prayer).toMatchObject({ enabled: true, lat: 21.42, lng: 39.82, method: "UmmAlQura", madhab: "hanafi", highLatRule: "seventh", timezone: "Asia/Riyadh" });
  });

  it("falls back to the default for values that aren't allowed", async () => {
    const { loadSettings, DEFAULT_SETTINGS: d } = await setup({
      themeMode: "dark", islandStyle: 3, islandSize: "huge", islandEdge: "bottom", uiLang: "de",
      packMode: "custom-ish", autoOpen: true, istighfarPhrase: null, theme: 42, hotkey: ["Alt+G"],
      sound: "yes", showHijri: 1,
      prayer: { method: "Atlantis", madhab: "maliki", highLatRule: "polar", enabled: "true", timezone: 3 },
    });
    const s = await loadSettings();
    expect(s.themeMode).toBe(d.themeMode);
    expect(s.islandStyle).toBe(d.islandStyle);
    expect(s.islandSize).toBe(d.islandSize);
    expect(s.islandEdge).toBe(d.islandEdge);
    expect(s.uiLang).toBe(d.uiLang);
    expect(s.packMode).toBe(d.packMode);
    expect(s.autoOpen).toBe(d.autoOpen);
    expect(s.istighfarPhrase).toBe(d.istighfarPhrase);
    expect(s.theme).toBe(d.theme);
    expect(s.hotkey).toBe(d.hotkey);
    expect(s.sound).toBe(d.sound);
    expect(s.showHijri).toBe(d.showHijri);
    expect(s.prayer).toEqual(d.prayer);
  });

  it("accepts every pack, including the custom one", async () => {
    const { loadSettings } = await setup({ packMode: "custom" });
    expect((await loadSettings()).packMode).toBe("custom");
  });

  it("clamps and rounds numbers into range", async () => {
    const { loadSettings } = await setup({
      islandPos: 5, istighfarGoal: 99_999, hijriOffset: -7,
      prayer: { notifyBefore: 120, notifyClose: -5 },
    });
    const s = await loadSettings();
    expect(s.islandPos).toBe(1);
    expect(s.istighfarGoal).toBe(10_000);
    expect(s.hijriOffset).toBe(-2);
    expect(s.prayer.notifyBefore).toBe(60);
    expect(s.prayer.notifyClose).toBe(0);

    const { loadSettings: load2 } = await setup({ islandPos: -1, istighfarGoal: 0.2, hijriOffset: 1.6, prayer: { notifyBefore: 4.4 } });
    const t = await load2();
    expect(t.islandPos).toBe(0);
    expect(t.istighfarGoal).toBe(1);
    expect(t.hijriOffset).toBe(2);
    expect(t.prayer.notifyBefore).toBe(4);
  });

  it("uses the default for numbers that aren't finite numbers", async () => {
    const { loadSettings, DEFAULT_SETTINGS: d } = await setup({ islandPos: "0.3", istighfarGoal: null, hijriOffset: Number.NaN });
    const s = await loadSettings();
    expect(s.islandPos).toBe(d.islandPos);
    expect(s.istighfarGoal).toBe(d.istighfarGoal);
    expect(s.hijriOffset).toBe(d.hijriOffset);
  });

  it("drops coordinates out of range", async () => {
    const { loadSettings } = await setup({ prayer: { lat: 91, lng: -181 } });
    expect((await loadSettings()).prayer).toMatchObject({ lat: null, lng: null });
    const { loadSettings: load2 } = await setup({ prayer: { lat: "51.5", lng: Number.NaN } });
    expect((await load2()).prayer).toMatchObject({ lat: null, lng: null });
    const { loadSettings: load3 } = await setup({ prayer: { lat: -90, lng: 180 } });
    expect((await load3()).prayer).toMatchObject({ lat: -90, lng: 180 });
  });

  it("uses the defaults when the nested objects aren't objects", async () => {
    const { loadSettings, DEFAULT_SETTINGS: d } = await setup({ prayer: "london", quiet: null, customAdhkar: "none" });
    const s = await loadSettings();
    expect(s.prayer).toEqual(d.prayer);
    expect(s.quiet).toEqual(d.quiet);
    expect(s.customAdhkar).toEqual([]);
  });

  it("fills in missing quiet-hours fields", async () => {
    const { loadSettings } = await setup({ quiet: { enabled: true, from: 7 } });
    expect((await loadSettings()).quiet).toEqual({ enabled: true, from: "22:00", to: "06:00" });
  });

  it("keeps only well-formed custom adhkar and fixes their fields", async () => {
    const { loadSettings } = await setup({
      customAdhkar: [
        { id: "c-1", ar: "سبحان الله", meaning: "Glory be to Allah", source: "", target: 33 },
        { id: "c-2", ar: "الحمد لله", target: 0 },
        { id: "c-3", ar: "الله أكبر", meaning: 5, source: null, target: 50_000 },
        { id: 4, ar: "x" },
        { id: "c-5" },
        null,
        "c-6",
      ],
    });
    expect((await loadSettings()).customAdhkar).toEqual([
      { id: "c-1", ar: "سبحان الله", meaning: "Glory be to Allah", source: "", target: 33 },
      { id: "c-2", ar: "الحمد لله", meaning: "", source: "", target: 1 },
      { id: "c-3", ar: "الله أكبر", meaning: "", source: "", target: 10_000 },
    ]);
  });

  it("moves the v0.2 islandAlign into islandPos", async () => {
    for (const [align, pos] of [["left", 0], ["center", 0.5], ["right", 1]] as const) {
      const { loadSettings } = await setup({ islandAlign: align });
      const s = await loadSettings();
      expect(s.islandPos).toBe(pos);
      expect(s).not.toHaveProperty("islandAlign");
    }
    const { loadSettings } = await setup({ islandAlign: "left", islandPos: 0.8 });
    expect((await loadSettings()).islandPos).toBe(0.8);
  });
});

describe("default hotkey", () => {
  it("avoids Ctrl+Alt (AltGr) on Windows and Linux", async () => {
    expect((await setup(undefined, "Win32")).DEFAULT_HOTKEY).toBe("Alt+Shift+G");
    expect((await setup(undefined, "Linux x86_64")).DEFAULT_HOTKEY).toBe("Alt+Shift+G");
  });

  it("is Cmd+Option+G on macOS", async () => {
    const mac = await setup(undefined, "MacIntel");
    expect(mac.IS_MAC).toBe(true);
    expect(mac.DEFAULT_HOTKEY).toBe("CommandOrControl+Alt+G");
    expect(mac.DEFAULT_SETTINGS.hotkey).toBe("CommandOrControl+Alt+G");
  });

  it("moves the early builds' saved Ctrl+Alt+G to Alt+Shift+G off macOS", async () => {
    expect((await (await setup({ hotkey: "CommandOrControl+Alt+G" }, "Win32")).loadSettings()).hotkey).toBe("Alt+Shift+G");
    expect((await (await setup({ hotkey: "CommandOrControl+Alt+G" }, "MacIntel")).loadSettings()).hotkey).toBe("CommandOrControl+Alt+G");
    expect((await (await setup({ hotkey: "Ctrl+Shift+K" }, "Win32")).loadSettings()).hotkey).toBe("Ctrl+Shift+K");
  });
});
