import localFont from "next/font/local";

/* Self-hosted, same approach as the prototype (no network at build or run time).
   Quicksand (SIL OFL 1.1, see app/fonts/QUICKSAND-OFL.txt) is the one family for headings and text: a
   geometric sans with fully round stroke ends and circular bowls, which is the character the reference
   headline has. It tops out at weight 700, so a declared 800 resolves to Bold. It is loaded as static
   weights with the overlapping contours merged (see the note in QUICKSAND-OFL.txt, which also explains
   the rename) so the outlined footer wordmark (-webkit-text-stroke) stays clean. Both tokens below point at the same files, so
   the browser fetches each weight once (next/font needs the options written out literally, hence the
   repeated list). JetBrains Mono stays for labels, numbers, addresses and the glyph field. */
export const quicksandUi = localFont({
  src: [
    { path: "../app/fonts/quicksand-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/quicksand-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/quicksand-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../app/fonts/quicksand-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--lp-font-ui",
  display: "swap",
});

export const quicksandDisplay = localFont({
  src: [
    { path: "../app/fonts/quicksand-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/quicksand-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/quicksand-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../app/fonts/quicksand-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--lp-font-display",
  display: "swap",
  preload: false, // same files as quicksandUi, which already preloads them
});

export const jetbrainsMono = localFont({
  src: [
    { path: "../app/fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../app/fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--lp-font-mono",
  display: "swap",
});
