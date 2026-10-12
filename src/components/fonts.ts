import localFont from "next/font/local";

/* Self-hosted, same approach as the prototype (no network at build or run time).
   Pretendard (SIL OFL 1.1, see app/fonts/PRETENDARD-OFL.txt) is the one family for headings and text:
   the same face the reference site uses for its UI. It is loaded as five static weights rather than the
   variable font on purpose: static outlines have no overlapping contours, so the outlined footer wordmark
   (-webkit-text-stroke) stays clean. Both tokens below point at the same files, so the browser fetches
   each weight once (next/font needs the options written out literally, hence the repeated list).
   JetBrains Mono stays for labels, numbers, addresses and the glyph field. */
export const pretendardUi = localFont({
  src: [
    { path: "../app/fonts/pretendard-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/pretendard-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/pretendard-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../app/fonts/pretendard-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../app/fonts/pretendard-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--lp-font-ui",
  display: "swap",
});

export const pretendardDisplay = localFont({
  src: [
    { path: "../app/fonts/pretendard-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/pretendard-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/pretendard-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../app/fonts/pretendard-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../app/fonts/pretendard-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--lp-font-display",
  display: "swap",
  preload: false, // same files as pretendardUi, which already preloads them
});

export const jetbrainsMono = localFont({
  src: [
    { path: "../app/fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../app/fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--lp-font-mono",
  display: "swap",
});
