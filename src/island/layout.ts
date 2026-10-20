import type { CSSProperties } from "react";
import type { Dhikr } from "../shared/content";
import type { Edge } from "../shared/notch";
import type { View } from "./types";

/** Must match the island window size in tauri.conf.json / lib.rs. */
export const WIN_W = 600;
export const WIN_H = 520;
const EDGE = 12;

/** Where the backend placed the window: the edge, and the island's anchor on it (window px). */
export type Anchor = { edge: Edge; x: number; y: number };
export type Placement = { edge: Edge; pos: number; monitor: string };

/**
 * Puts a `w × h` island (unscaled) on the anchor, centred on it unless that would push it
 * out of the window near the ends of the screen. Returns the drawn box (for the
 * click-through region) and the CSS that draws it there.
 */
export function place(a: Anchor, w: number, h: number, gap: number, scale: number): { rect: { x: number; y: number; w: number; h: number }; css: CSSProperties } {
  const W = w * scale;
  const H = h * scale;
  const s = `scale(${scale})`;
  if (a.edge === "top") {
    if (a.x - W / 2 < EDGE) return { rect: { x: EDGE, y: gap, w: W, h: H }, css: { left: EDGE, top: gap, transform: s, transformOrigin: "top left" } };
    if (a.x + W / 2 > WIN_W - EDGE)
      return { rect: { x: WIN_W - EDGE - W, y: gap, w: W, h: H }, css: { right: EDGE, top: gap, transform: s, transformOrigin: "top right" } };
    return { rect: { x: a.x - W / 2, y: gap, w: W, h: H }, css: { left: a.x, top: gap, transform: `translateX(-50%) ${s}`, transformOrigin: "top center" } };
  }
  const left = a.edge === "left";
  const x = left ? gap : WIN_W - gap - W;
  const side: CSSProperties = left ? { left: gap } : { right: gap };
  const ox = left ? "left" : "right";
  if (a.y - H / 2 < EDGE) return { rect: { x, y: EDGE, w: W, h: H }, css: { ...side, top: EDGE, transform: s, transformOrigin: `top ${ox}` } };
  if (a.y + H / 2 > WIN_H - EDGE)
    return { rect: { x, y: WIN_H - EDGE - H, w: W, h: H }, css: { ...side, top: "auto", bottom: EDGE, transform: s, transformOrigin: `bottom ${ox}` } };
  return { rect: { x, y: a.y - H / 2, w: W, h: H }, css: { ...side, top: a.y, transform: `translateY(-50%) ${s}`, transformOrigin: `center ${ox}` } };
}

export function arSize(text: string): number {
  const n = text.length;
  return n <= 40 ? 27 : n <= 90 ? 20 : n <= 170 ? 17 : 15;
}

export function sizeOf(view: View, item: Dhikr, notch: boolean, edge: Edge = "top"): { w: number; h: number; r: number } {
  // On a side edge the pill stands upright, so it takes as little of the screen's width as it can.
  if (view === "collapsed" && edge !== "top") return notch ? { w: 44, h: 132, r: 22 } : { w: 50, h: 140, r: 25 };
  if (view === "collapsed") return notch ? { w: 220, h: 34, r: 17 } : { w: 228, h: 36, r: 18 };
  if (view === "compact") return { w: 440, h: 84, r: notch ? 30 : 42 };
  return { w: 404, h: item.ar.length > 170 ? 394 : 310, r: 24 };
}
