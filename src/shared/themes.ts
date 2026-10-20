export type WheelStyle = "ice" | "gold" | "copper" | "steel" | "clay" | "glass" | "paper" | "emerald" | "porcelain" | "lapis" | "pearl";
export type Deco =
  | "zellige" | "hairline" | "dunes" | "arch" | "paper" | "glow"
  | "iznik" | "lattice" | "muqarnas" | "horizon" | "merlons" | "none";

interface TileColors {
  bg: string;
  star: string;
  inner: string;
  dot: string;
  corner: string;
}

export interface Theme {
  id: string;
  /** Colour at the top edge of the island (used for the notch's curved shoulders). */
  solid: string;
  ar: string;
  en: string;
  light: boolean;
  deco: Deco;
  tile?: TileColors;
  wheel: WheelStyle;
  /** Three colours for the theme picker swatch. */
  swatch: [string, string, string];
}

export const THEMES: Theme[] = [
  {
    id: "graphite", solid: "#17181b", ar: "جرافيت", en: "Graphite", light: false, deco: "glow", wheel: "emerald",
    swatch: ["#141518", "#34d399", "#2a2c30"],
  },
  {
    id: "fes", solid: "#082f33", ar: "فاس", en: "Classic Fes", light: false, deco: "zellige", wheel: "gold",
    tile: { bg: "#0e4f55", star: "#f4ead3", inner: "#1f3f8a", dot: "#d4a937", corner: "#c45a3c" },
    swatch: ["#082f33", "#d4a937", "#c45a3c"],
  },
  {
    id: "clay", solid: "#e6ebe5", ar: "طين", en: "Soft Clay", light: true, deco: "none", wheel: "clay",
    swatch: ["#e6ebe5", "#5f8b6e", "#c3cbc2"],
  },
  {
    id: "glass", solid: "#222938", ar: "زجاج", en: "Glass", light: false, deco: "none", wheel: "glass",
    swatch: ["#1c2230", "#bfe9ff", "#ffffff"],
  },
  {
    id: "riad", solid: "#f7f1e3", ar: "رياض", en: "Ivory Riad", light: true, deco: "zellige", wheel: "paper",
    tile: { bg: "#fbf6ea", star: "#0b6e4f", inner: "#fbf6ea", dot: "#1f3f8a", corner: "#c45a3c" },
    swatch: ["#f7f1e3", "#0b6e4f", "#c45a3c"],
  },
  {
    id: "emerald", solid: "#0b3d2f", ar: "زمرد ونحاس", en: "Emerald & Copper", light: false, deco: "zellige", wheel: "copper",
    tile: { bg: "#0b6e4f", star: "#f6efe2", inner: "#0b3d2f", dot: "#d08a5a", corner: "#d08a5a" },
    swatch: ["#0b3d2f", "#d08a5a", "#f6efe2"],
  },
  {
    id: "chefchaouen", solid: "#0f2f5a", ar: "شفشاون", en: "Chefchaouen Blue", light: false, deco: "zellige", wheel: "steel",
    tile: { bg: "#1d4e89", star: "#f3f6fb", inner: "#5b8fd1", dot: "#f3f6fb", corner: "#0f2f5a" },
    swatch: ["#0f2f5a", "#e9eef4", "#5b8fd1"],
  },
  {
    id: "obsidian", solid: "#16140f", ar: "أسود وذهب", en: "Obsidian & Gold", light: false, deco: "hairline", wheel: "gold",
    swatch: ["#0c0c0d", "#d6b56c", "#2a2416"],
  },
  {
    id: "minimal", solid: "#000000", ar: "بسيط", en: "Minimal", light: false, deco: "none", wheel: "ice",
    swatch: ["#000000", "#30d158", "#2c2c2e"],
  },
  {
    id: "dusk", solid: "#f3a37b", ar: "غروب الصحراء", en: "Desert Dusk", light: false, deco: "dunes", wheel: "copper",
    swatch: ["#f3a37b", "#d07386", "#5a3f86"],
  },
  {
    id: "manuscript", solid: "#f3e9d4", ar: "مخطوطة", en: "Manuscript", light: true, deco: "paper", wheel: "paper",
    swatch: ["#f3e9d4", "#8b2e1f", "#b8892b"],
  },
  {
    id: "lantern", solid: "#101b30", ar: "فانوس", en: "Lantern Night", light: false, deco: "arch", wheel: "gold",
    swatch: ["#101b30", "#f2b84b", "#c0662a"],
  },
  {
    id: "iznik", solid: "#f7f5ef", ar: "إزنيق", en: "Iznik Tile", light: true, deco: "iznik", wheel: "porcelain",
    swatch: ["#f7f5ef", "#1d3f8f", "#c8312b"],
  },
  {
    id: "mashrabiya", solid: "#2a1a0f", ar: "مشربية", en: "Mashrabiya", light: false, deco: "lattice", wheel: "copper",
    swatch: ["#24170e", "#e0a458", "#5a3a22"],
  },
  {
    id: "isfahan", solid: "#13296e", ar: "أصفهان", en: "Isfahan Lapis", light: false, deco: "muqarnas", wheel: "lapis",
    swatch: ["#13296e", "#3fc1c9", "#f2c14e"],
  },
  {
    id: "fajr", solid: "#dcdff2", ar: "فجر", en: "Fajr", light: true, deco: "horizon", wheel: "pearl",
    swatch: ["#dcdff2", "#5a54a6", "#f2a98a"],
  },
  {
    id: "marrakech", solid: "#b24a2f", ar: "مراكش", en: "Marrakech Red", light: false, deco: "merlons", wheel: "copper",
    swatch: ["#b24a2f", "#f3c27a", "#7d2c1b"],
  },
];

export const DEFAULT_THEME = "graphite";

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

function star(cx: number, cy: number, R: number, r: number, n = 8): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const d = i % 2 ? r : R;
    pts.push(`${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** 8-point khatam zellige tile as a CSS url(). */
export function tileUrl(c: TileColors): string {
  const corners = [[0, 0], [40, 0], [0, 40], [40, 40]]
    .map(([x, y]) => `<polygon points='${star(x, y, 9, 4.6)}' fill='${c.corner}'/>`)
    .join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>
    <rect width='40' height='40' fill='${c.bg}'/><polygon points='${star(20, 20, 15, 8)}' fill='${c.star}'/>
    <polygon points='${star(20, 20, 10, 5.4)}' fill='${c.inner}'/><circle cx='20' cy='20' r='2.6' fill='${c.dot}'/>
    ${corners}
    <path d='M20 0 L23 4 L20 8 L17 4Z M20 32 L23 36 L20 40 L17 36Z M0 20 L4 17 L8 20 L4 23Z M32 20 L36 17 L40 20 L36 23Z' fill='${c.dot}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Small 8-point star badge used in the collapsed pill. */
export function starPoints(R: number, r: number): string {
  return star(20, 20, R, r);
}
