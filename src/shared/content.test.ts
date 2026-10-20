import { describe, expect, it } from "vitest";
import { AUDIO } from "./audio";
import { ISTIGHFAR, PACKS, customPack, packFor } from "./content";

/** The files in public/audio, as the paths the app plays them from ("/audio/x.mp3"). */
const audioFiles = new Set(Object.keys(import.meta.glob("/public/audio/*")).map((p) => p.replace(/^\/public/, "")));

const builtIn = [...Object.values(ISTIGHFAR), ...Object.values(PACKS).flatMap((p) => p.items)];

describe("packs", () => {
  it.each(Object.values(PACKS).map((p) => [p.id, p] as const))("%s has unique ids", (_, pack) => {
    const ids = pack.items.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every pack is filed under its own id", () => {
    for (const [key, pack] of Object.entries(PACKS)) expect(pack.id).toBe(key);
  });

  it("every dhikr has text, a source and a positive target", () => {
    for (const d of builtIn) {
      expect(d.id).toMatch(/^[a-z][a-z-]*$/);
      expect(d.ar.trim()).not.toBe("");
      expect(d.en.trim()).not.toBe("");
      expect(d.source.trim()).not.toBe("");
      expect(Number.isInteger(d.target) && d.target > 0).toBe(true);
    }
  });

  it("an empty custom set falls back to the general pack", () => {
    expect(packFor("custom", [])).toBe(PACKS.general);
    const custom = packFor("custom", [{ id: "c-1", ar: "x", meaning: "y", source: "", target: 0 }]);
    expect(custom).toEqual(customPack([{ id: "c-1", ar: "x", meaning: "y", source: "", target: 0 }]));
    expect(custom.items[0]).toMatchObject({ id: "c-1", en: "y", target: 1 });
  });
});

describe("audio", () => {
  it("finds the audio folder", () => {
    expect(audioFiles.size).toBeGreaterThan(0);
  });

  it.each(Object.entries(AUDIO))("%s plays a file that exists (%s)", (_, path) => {
    expect(audioFiles).toContain(path);
  });

  it("only maps ids of built-in adhkar", () => {
    const ids = new Set(builtIn.map((d) => d.id));
    for (const id of Object.keys(AUDIO)) expect(ids).toContain(id);
  });
});
