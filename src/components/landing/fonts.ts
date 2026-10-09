import localFont from "next/font/local";

/* Self-hosted, same approach as the prototype (no network at build or run time).
   Sora is the wide geometric display face; Hanken Grotesk is body text;
   JetBrains Mono is every label, number and the glyph field. */
export const sora = localFont({
  src: "../../app/fonts/sora-latin-wght-normal.woff2",
  weight: "100 800",
  variable: "--lp-font-display",
  display: "swap",
});

export const hankenGrotesk = localFont({
  src: "../../app/fonts/hanken-grotesk-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--lp-font-ui",
  display: "swap",
});

export const jetbrainsMono = localFont({
  src: [
    { path: "../../app/fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../app/fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--lp-font-mono",
  display: "swap",
});
