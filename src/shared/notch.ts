/** Width of the concave "shoulders" that join the notch to the screen edge. */
export const SHOULDER = 14;

export type Edge = "top" | "left" | "right";

type Cmd = ["M" | "L", number, number] | ["A", number, number, number, number, number, number, number] | ["Z"];

/**
 * Notch outline for the top edge: flush with the edge, concave shoulders on both ends,
 * rounded far corners. `len` runs along the edge, `thick` away from it; the shape is
 * `len + 2 × SHOULDER` long.
 */
function topOutline(len: number, thick: number, r: number, R = SHOULDER): Cmd[] {
  const W = len + 2 * R;
  const rr = Math.max(0, Math.min(r, thick - R, len / 2));
  return [
    ["M", 0, 0],
    ["L", W, 0],
    ["A", R, R, 0, 0, 0, W - R, R],
    ["L", W - R, thick - rr],
    ["A", rr, rr, 0, 0, 1, W - R - rr, thick],
    ["L", R + rr, thick],
    ["A", rr, rr, 0, 0, 1, R, thick - rr],
    ["L", R, R],
    ["A", R, R, 0, 0, 0, 0, 0],
    ["Z"],
  ];
}

/**
 * Notch outline for any edge, as an SVG path in a `width × height` box. Side edges reuse
 * the top shape: transposed for the left edge (a reflection, so arc sweeps flip) and
 * transposed + mirrored for the right edge (a rotation, so they don't).
 */
export function notchPath(edge: Edge, width: number, height: number, r: number): string {
  const top = edge === "top";
  const [len, thick] = top ? [width - 2 * SHOULDER, height] : [height - 2 * SHOULDER, width];
  const map = (x: number, y: number): [number, number] => (top ? [x, y] : edge === "left" ? [y, x] : [thick - y, x]);
  const flip = edge === "left";
  return topOutline(len, thick, r)
    .map((c) => {
      if (c[0] === "Z") return "Z";
      if (c[0] === "A") {
        const [, rx, ry, rot, large, sweep, x, y] = c;
        const [px, py] = map(x, y);
        return `A${rx} ${ry} ${rot} ${large} ${flip ? 1 - sweep : sweep} ${px} ${py}`;
      }
      const [px, py] = map(c[1], c[2]);
      return `${c[0]}${px} ${py}`;
    })
    .join("");
}

/** CSS mask for the island drawn `width × height` (shoulders included) on `edge`. */
export function notchMask(edge: Edge, width: number, height: number, r: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}' preserveAspectRatio='none'><path d='${notchPath(edge, width, height, r)}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
