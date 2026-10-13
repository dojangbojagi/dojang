import type { CSSProperties } from "react";
import { C, FONT } from "./theme";
import { easeOut, lerp, prog, rand } from "./motion";

/* Shared credential + proof motifs, drawn once and reused across all three films so the identity reads as
   one system: a card for DOJANG, a block of blocks for a BOJAGI proof in flight, a verifier stamp. */

export type Field = { k: string; v: string; veil?: boolean };

export function CredentialCard({
  t,
  x,
  y,
  w = 620,
  h = 400,
  tone = "dark",
  fields,
  fieldsAt = 0,
  seal = 0,
  opacity = 1,
  rot = -10,
  title = "Project credential",
}: {
  t: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  tone?: "dark" | "paper";
  fields: Field[];
  fieldsAt?: number;
  /** 0..1: the card's edges tighten and glow, as if a seal just landed on it */
  seal?: number;
  opacity?: number;
  rot?: number;
  title?: string;
}) {
  const dark = tone === "dark";
  const text = dark ? C.text : C.paperInk;
  const dim = dark ? C.dim : C.paperSoft;
  const line = dark ? "rgba(255,255,255,0.09)" : "rgba(10,7,8,0.12)";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, perspective: 2200, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: 24,
          background: dark ? `linear-gradient(160deg, ${C.surface}, ${C.ink} 72%)` : C.paper,
          border: dark ? `1px solid rgba(255,255,255,${0.1 + seal * 0.12})` : `2px solid ${C.paperInk}`,
          boxShadow: dark
            ? `0 50px 90px -30px rgba(10,7,8,0.6), 0 0 ${40 + seal * 60}px -10px rgba(184,26,52,${0.25 + seal * 0.5})`
            : "none",
          transform: `rotateY(${rot}deg) rotateX(4deg) scale(${1 + seal * 0.015})`,
          opacity,
          padding: "30px 36px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 18, borderBottom: `1px dashed ${line}` }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: C.wine }} />
          <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase", color: text }}>{title}</div>
        </div>
        {fields.map((f, i) => {
          const p = prog(t, fieldsAt + i * 0.34, fieldsAt + 0.5 + i * 0.34, easeOut);
          return (
            <div key={f.k} style={{ display: "flex", alignItems: "center", gap: 20, padding: "11px 0", borderBottom: `1px solid ${line}`, opacity: p, transform: `translateX(${(1 - p) * 16}px)` }}>
              <div style={{ width: 128, fontFamily: FONT.mono, fontWeight: 500, fontSize: 15, letterSpacing: "0.16em", textTransform: "uppercase", color: dim }}>{f.k}</div>
              {f.veil ? (
                <div
                  style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 5,
                    background: `repeating-linear-gradient(90deg, ${C.burgundy} 0 10px, ${C.burgundyLo} 10px 20px)`,
                    boxShadow: `inset 0 0 0 1px ${C.wine}`,
                    opacity: 1 - seal * 0.15,
                  }}
                />
              ) : (
                <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 21, color: text }}>{f.v}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* A proof token: a cluster of small blocks that assembles itself, then slides from `from` to `to` along a
   gentle arc. The same shape and timing language is used wherever a proof "leaves" a device. */
export function ProofToken({
  t,
  buildAt,
  travel,
  from,
  to,
  color = C.wine,
  alt = C.burgundy,
}: {
  t: number;
  buildAt: number;
  travel: number; // 0..1, already eased by the caller
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  alt?: string;
}) {
  const build = prog(t, buildAt, buildAt + 0.5, easeOut);
  const x = lerp(from.x, to.x, travel);
  const y = lerp(from.y, to.y, travel) - Math.sin(travel * Math.PI) * 46;
  const blocks = Array.from({ length: 6 }, (_, i) => {
    const p = prog(t, buildAt + i * 0.06, buildAt + 0.4 + i * 0.06, easeOut);
    return { p, x: (i % 3) * 30 - 30, y: Math.floor(i / 3) * 24 - 12, fx: -90 + rand(i) * 70, fy: -60 + rand(i + 7) * 120 };
  });
  if (build <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x - 45, top: y - 24, width: 90, height: 48, opacity: build }}>
      {blocks.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x + (1 - b.p) * b.fx,
            top: b.y + (1 - b.p) * b.fy,
            width: 26,
            height: 20,
            borderRadius: 5,
            background: i % 2 ? alt : color,
            opacity: b.p,
            boxShadow: `0 6px 14px -6px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

export function VerifierBadge({ p, label = "VALID · EXAMPLE", style }: { p: number; label?: string; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: p, transform: `scale(${0.9 + p * 0.1})`, ...style }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.2 4.2L19 7" />
      </svg>
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 24, color: "#fff", letterSpacing: "0.03em" }}>{label}</span>
    </div>
  );
}
