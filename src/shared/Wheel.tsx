import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { WheelStyle } from "./themes";
import "./wheel.css";

export interface WheelHandle {
  /** Rotate one detent (one ridge) in the given direction. */
  spin(dir: number): void;
}

interface Props {
  finish: WheelStyle;
  scale?: number;
  /** Pixels of drag per count. */
  dragStep?: number;
  onTick?: (dir: number) => void;
  /** Skip the turning animation (reduced motion). */
  instant?: boolean;
  /** Accessible name, in the interface language. */
  label: string;
  ref?: Ref<WheelHandle>;
}

const N = 64;
const STEP = (Math.PI * 2) / N;

// Wheel face in authored pixels (see .sw-wheel), and one ridge half (see wheel.css).
const W = 68;
const H = 246;
const HALF = 27;
/** The ridge outline, as fractions of a half's box. */
const OUTLINE = [[0.07, 0], [0.86, 0], [1, 0.72], [1, 1], [0.13, 1], [0, 0.3]];
/** Room above and below a ridge in its sprite for the drop shadow. */
const PAD = 2;
const SPRITE_H = 9 + 2 * PAD + 4;
/** Ridge sprites are cached per height, in steps of 1/HEIGHT_STEPS authored px, and per
 *  sub-pixel offset, in steps of 1/SHIFT_STEPS device px: far finer than anything visible. */
const HEIGHT_STEPS = 10;
const SHIFT_STEPS = 4;
const ROWS = Math.ceil(8.8 * HEIGHT_STEPS) + 1;
/** The turn ends when it is this close to the detent (about a tenth of a pixel). */
const SETTLE = 0.002;

interface Stop {
  at: number;
  color: string;
}

interface Finish {
  ridge: Stop[];
  ridge2: Stop[];
  left: string;
  right: string;
  hi: string;
  drop: string;
}

/** Splits on commas that aren't inside parentheses. */
function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return parts;
}

/** Colour stops of a `linear-gradient(<angle>, <color> [<pct>], ...)` theme variable. */
function parseStops(gradient: string): Stop[] {
  const inner = gradient.slice(gradient.indexOf("(") + 1, gradient.lastIndexOf(")"));
  const parts = splitTop(inner).filter((p) => !/^-?[\d.]+(deg|turn|rad)$|^to /.test(p));
  const stops = parts.map((p) => {
    const m = p.match(/^(.*\S)\s+(-?[\d.]+)%$/);
    return m ? { color: m[1], at: Number(m[2]) / 100 } : { color: p, at: NaN };
  });
  // Stops without a position are spread evenly between their neighbours, as in CSS.
  if (stops.length && isNaN(stops[0].at)) stops[0].at = 0;
  if (stops.length && isNaN(stops[stops.length - 1].at)) stops[stops.length - 1].at = 1;
  for (let i = 1; i < stops.length; i++) {
    if (!isNaN(stops[i].at)) continue;
    let j = i;
    while (isNaN(stops[j].at)) j++;
    for (let k = i; k < j; k++) stops[k].at = stops[i - 1].at + ((stops[j].at - stops[i - 1].at) * (k - i + 1)) / (j - i + 1);
  }
  return stops.map((s) => ({ ...s, at: Math.min(1, Math.max(0, s.at)) }));
}

function readFinish(el: Element): Finish {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    ridge: parseStops(v("--sw-ridge")),
    ridge2: parseStops(v("--sw-ridge2")),
    left: v("--sw-ridge-ls"),
    right: v("--sw-ridge-rs"),
    hi: v("--sw-ridge-hi"),
    drop: v("--sw-ridge-drop"),
  };
}

/**
 * Draws one ridge (both halves) `h` px tall into the sprite cell at device pixels
 * (`x`, `y`), `PAD` px from its top, matching the .sw-ridge CSS it replaces: a vertical
 * gradient cut to the outline, a horizontal shade towards the outer edge, a 1px highlight
 * along the top, and a small drop shadow. `shift` is a sub-pixel offset in device
 * pixels, so the sprite can be copied on whole pixels without being resampled (which
 * would blur it).
 */
function drawRidge(ctx: CanvasRenderingContext2D, f: Finish, h: number, k: number, shift: number, x: number, y: number, cw: number, ch: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(x, y, cw, ch);
  ctx.clip();
  const halves: [Stop[], string, number][] = [[f.ridge, f.left, 0.55], [f.ridge2, f.right, 0.65]];
  halves.forEach(([stops, shade, fade], side) => {
    // The right half is the left one mirrored, as with `transform: scaleX(-1)` in CSS.
    ctx.setTransform(side ? -k : k, 0, 0, k, x + (side ? W * k : 0), y + shift);
    const path = new Path2D();
    OUTLINE.forEach(([x, y], i) => (i ? path.lineTo(x * HALF, PAD + y * h) : path.moveTo(x * HALF, PAD + y * h)));
    path.closePath();

    const body = ctx.createLinearGradient(0, PAD, 0, PAD + h);
    stops.forEach((s) => body.addColorStop(s.at, s.color));
    ctx.shadowColor = f.drop;
    ctx.shadowOffsetY = 2 * k;
    ctx.shadowBlur = 2 * k;
    ctx.fillStyle = body;
    ctx.fill(path);
    ctx.shadowColor = "transparent";

    const edge = ctx.createLinearGradient(0, 0, HALF, 0);
    edge.addColorStop(0, shade);
    edge.addColorStop(fade, "#0000");
    ctx.fillStyle = edge;
    ctx.fill(path);

    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = f.hi;
    ctx.fillRect(0, PAD, HALF, 1);
    ctx.restore();
  });
  ctx.restore();
}

export function Wheel({ finish, scale = 0.5, dragStep = 12, onTick, instant = false, label, ref }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  /** Sprite sheet of ridges: a column per sub-pixel offset, a row per height. */
  const sprites = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(new Uint8Array(ROWS * SHIFT_STEPS));
  const look = useRef<Finish | null>(null);
  /** Device pixels per authored pixel. */
  const density = useRef(0);
  const angle = useRef(0);
  const target = useRef(0);
  const raf = useRef(0);
  const drag = useRef<{ last: number; acc: number } | null>(null);

  /** Sizes the canvases for the wheel's current on-screen scale (and empties the sprite
   *  sheet, which depends on it). */
  const measure = (force = false) => {
    const c = canvas.current;
    if (!c) return;
    const k = (c.getBoundingClientRect().height / H) * devicePixelRatio || 1;
    if (!force && Math.abs(k - density.current) < 0.001) return;
    density.current = k;
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    const s = (sprites.current ??= document.createElement("canvas"));
    s.width = c.width * SHIFT_STEPS;
    s.height = Math.ceil(SPRITE_H * k) * ROWS;
    drawn.current.fill(0);
  };

  // Each ridge is copied from its sprite onto the wheel with its opacity, so the opacity
  // applies to the ridge as a whole, as it did in CSS. Sprites are drawn the first time
  // they are needed.
  const draw = () => {
    const c = canvas.current;
    const f = look.current;
    const s = sprites.current;
    if (!c || !f || !s) return;
    // A CPU canvas: it is tiny, and unlike a GPU one it is painted in place with the rest
    // of the wheel instead of as a separate layer, which would land on half pixels and
    // soften the whole wheel.
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const sctx = s.getContext("2d", { willReadFrequently: true })!;
    const k = density.current;
    const [cw, ch] = [c.width, Math.ceil(SPRITE_H * k)];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < N; i++) {
      const a = ((i / N) * Math.PI * 2 + angle.current) % (Math.PI * 2);
      const cos = Math.cos(a);
      if (cos <= 0) continue;
      const row = Math.round(Math.max(0.65, cos * 8.8) * HEIGHT_STEPS);
      const h = row / HEIGHT_STEPS;
      const y = (123 + Math.sin(a) * 122 - h / 2 - PAD) * k;
      let top = Math.floor(y);
      let col = Math.round((y - top) * SHIFT_STEPS);
      if (col === SHIFT_STEPS) [col, top] = [0, top + 1];
      const cell = row * SHIFT_STEPS + col;
      if (!drawn.current[cell]) {
        drawRidge(sctx, f, h, k, col / SHIFT_STEPS, col * cw, row * ch, cw, ch);
        drawn.current[cell] = 1;
      }
      ctx.globalAlpha = 0.5 + cos * 0.5;
      ctx.drawImage(s, col * cw, row * ch, cw, ch, 0, top, cw, ch);
    }
    ctx.globalAlpha = 1;
  };

  const animate = () => {
    const d = target.current - angle.current;
    angle.current = Math.abs(d) < SETTLE ? target.current : angle.current + d * 0.28;
    draw();
    raf.current = angle.current === target.current ? 0 : requestAnimationFrame(animate);
  };

  useEffect(() => {
    look.current = readFinish(canvas.current!);
    measure(true);
    draw();
  }, [finish, scale]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useImperativeHandle(ref, () => ({
    spin(dir: number) {
      target.current += dir * STEP;
      if (instant) {
        angle.current = target.current;
        measure();
        draw();
      } else if (!raf.current) {
        measure();
        raf.current = requestAnimationFrame(animate);
      }
    },
  }));

  return (
    <div className={`sw sw-${finish}`} style={{ ["--sw-scale" as string]: scale }}>
      <div className="sw-housing">
        <span className="sw-screw" />
        <button
          className="sw-wheel"
          tabIndex={-1}
          aria-label={label}
          onPointerDown={(e) => {
            drag.current = { last: e.clientY, acc: 0 };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            d.acc += e.clientY - d.last;
            d.last = e.clientY;
            while (Math.abs(d.acc) >= dragStep) {
              const dir = Math.sign(d.acc);
              d.acc -= dir * dragStep;
              onTick?.(dir);
            }
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <span className="sw-grooves">
            <canvas className="sw-ridges" ref={canvas} aria-hidden />
          </span>
        </button>
        <span className="sw-tick" />
      </div>
    </div>
  );
}
