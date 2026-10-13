/* The site's own palette and type (src/app/theme.css, components/landing/landing.css). Values are not new. */
export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const C = {
  ink: "#060405",
  ink2: "#0E0A0C",
  surface: "#150F12",
  burgundy: "#6D001A",
  burgundyHi: "#8F1332",
  burgundyLo: "#4A0011",
  wine: "#B81A34",
  white: "#FFFFFF",
  text: "#F7F3F4",
  muted: "#A89DA1",
  dim: "#857A7E",
  line: "rgba(255,255,255,0.12)",
  line2: "rgba(255,255,255,0.2)",
  paper: "#F7F3F4",
  paperInk: "#0A0708",
  paperSoft: "#5A4F53",
} as const;

export const FONT = {
  display: '"Quicksand", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const SITE = "gyevo.tech";
export const DISCLOSURE = "Robinhood Testnet · Chain 46630 · Test tokens only · Not audited · Independent of GIWA and Upbit";

export type Cues = {
  duration: number;
  bpm: number;
  scenes: number[];
  hits: number[];
  accents: number[];
  risers: number[][];
  clicks: number[];
};
