import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C, DISCLOSURE, FONT, FPS, H, W } from "./theme";
import { easeOut, prog } from "./motion";

/* The official mark, used exactly as the file is (remotion/public/logo.svg is a byte copy of public/logo.svg). */
export function Logo({ size, style }: { size: number; style?: CSSProperties }) {
  return <Img src={staticFile("logo.svg")} style={{ width: size, height: size, display: "block", ...style }} />;
}

/* The mark in the same dark tile the site uses where it sits on a light ground. */
export function LogoTile({ size, style }: { size: number; style?: CSSProperties }) {
  const pad = Math.round(size * 0.09);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: "#0A0708",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)",
        display: "grid",
        placeItems: "center",
        ...style,
      }}
    >
      <Logo size={size - pad * 2} />
    </div>
  );
}

/* Film grain: one small tile, stepped every frame, so the picture breathes without a single extra asset. */
export function Grain({ opacity = 0.09 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("grain.png")})`,
        backgroundSize: "256px 256px",
        backgroundPosition: `${(frame * 53) % 256}px ${(frame * 97) % 256}px`,
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

export function Vignette({ strength = 0.7 }: { strength?: number }) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,${strength}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}

/* faint architectural ground: a hairline grid and a low crimson glow */
export function Ground({ tone = "dark", t = 0, glow = 1 }: { tone?: "dark" | "paper"; t?: number; glow?: number }) {
  const line = tone === "dark" ? "rgba(255,255,255,0.035)" : "rgba(10,7,8,0.055)";
  const drift = (t * 6) % 120;
  return (
    <AbsoluteFill style={{ background: tone === "dark" ? C.ink : C.paper }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          backgroundPosition: `${-drift}px 0px`,
        }}
      />
      {tone === "dark" ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(70% 38% at 50% 118%, rgba(109,0,26,${0.62 * glow}), transparent 70%), radial-gradient(40% 30% at 12% 8%, rgba(109,0,26,${0.22 * glow}), transparent 70%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}

/* One line of display type that rises out of its own mask, the way the site's headline does. */
export function MaskLine({
  children,
  t,
  at,
  dur = 0.85,
  out,
  size,
  color = C.text,
  weight = 700,
  tracking = "-0.03em",
  upper = true,
  style,
  align = "left",
}: {
  children: ReactNode;
  t: number;
  at: number;
  dur?: number;
  out?: number;
  size: number;
  color?: string;
  weight?: number;
  tracking?: string;
  upper?: boolean;
  style?: CSSProperties;
  align?: "left" | "center" | "right";
}) {
  const p = prog(t, at, at + dur, easeOut);
  const q = out === undefined ? 0 : prog(t, out, out + 0.5, easeOut);
  return (
    <div
      style={{
        overflow: "hidden",
        padding: `${size * 0.1}px ${size * 0.04}px`,
        margin: `${-size * 0.1}px ${-size * 0.04}px`,
        textAlign: align,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: weight,
          fontSize: size,
          lineHeight: 1.04,
          letterSpacing: tracking,
          textTransform: upper ? "uppercase" : "none",
          color,
          whiteSpace: "nowrap",
          transform: `translateY(${(1 - p) * 118 - q * 118}%)`,
          opacity: p > 0 ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* small mono label, the site's eyebrow style */
export function Mono({
  children,
  size = 22,
  color = C.muted,
  tracking = "0.18em",
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  tracking?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: size, letterSpacing: tracking, textTransform: "uppercase", color, ...style }}>
      {children}
    </div>
  );
}

/* the testnet disclosure, always readable and never louder than the picture */
export function Disclosure({ opacity = 1, tone = "dark", bottom = 34 }: { opacity?: number; tone?: "dark" | "paper"; bottom?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        textAlign: "center",
        fontFamily: FONT.mono,
        fontWeight: 500,
        fontSize: 19,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: tone === "dark" ? "rgba(247,243,244,0.62)" : "rgba(10,7,8,0.58)",
        opacity,
      }}
    >
      {DISCLOSURE}
    </div>
  );
}

/* the site address as the mark of an ending */
export function SitePill({ size = 40, color = C.text, ring = C.wine }: { size?: number; color?: string; ring?: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.4,
        padding: `${size * 0.32}px ${size * 0.8}px`,
        borderRadius: 999,
        border: `2px solid ${ring}`,
        background: "rgba(109,0,26,0.28)",
        fontFamily: FONT.mono,
        fontWeight: 500,
        fontSize: size,
        letterSpacing: "0.04em",
        color,
      }}
    >
      gyevo.tech
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </div>
  );
}

/* Chapter cuts. Vertical slats rise from the bottom, in the colour given, staggered across the width, hold,
   then leave upward: the same cipher-plate language as the site's opening, used here as the cut. */
export function Slats({ t, a, b, colors, count = 9 }: { t: number; a: number; b: number; colors: string[]; count?: number }) {
  if (t < a - 0.01 || t > b + 0.9) return null;
  const w = W / count;
  const dur = (b - a) * 0.6;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) =>
        colors.map((color, layer) => {
          const stagger = (i / count) * 0.28 + layer * 0.12;
          const inP = prog(t, a + stagger, a + stagger + dur, easeOut);
          const outP = prog(t, b + 0.12 + stagger, b + 0.12 + stagger + dur, easeOut);
          return (
            <div
              key={`${i}-${layer}`}
              style={{
                position: "absolute",
                left: i * w - 0.5,
                top: 0,
                width: w + 1,
                height: H,
                background: color,
                transform: `translateY(${(1 - inP) * 100 - outP * 100}%)`,
              }}
            />
          );
        }),
      )}
    </AbsoluteFill>
  );
}

export const fadeOutAt = (t: number, start: number, end: number) => 1 - prog(t, start, end, (x) => x);
export const SEC = FPS;
