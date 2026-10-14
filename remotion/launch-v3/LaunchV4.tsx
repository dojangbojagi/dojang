import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  Easing,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, FONT, W, H, FPS } from "../lib/theme";
import { Grain } from "../lib/Brand";

// ─── Palette ─────────────────────────────────────────────────────────────────
const P = {
  bg:      "#F8F8F6",   // warm white canvas
  bgCard:  "#FFFFFF",   // pure white surface
  ink:     "#171717",   // near-black text
  inkMid:  "#555555",   // mid gray
  inkDim:  "#999999",   // dim label
  line:    "rgba(0,0,0,0.08)",
  burg:    "#760F2B",   // brand burgundy
  burgLo:  "rgba(118,15,43,0.12)",
  burgMid: "rgba(118,15,43,0.5)",
  green:   "#1A7A3C",
  greenBg: "rgba(26,122,60,0.08)",
};

// ─── Motion helpers ───────────────────────────────────────────────────────────
const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

function c(t: number, a: number, b: number, e = ease) {
  return interpolate(t, [a, b], [0, 1], { ...cl, easing: e });
}
function fadeIn(t: number, at: number, dur = 0.55) { return c(t, at, at + dur); }
function fadeOut(t: number, at: number, dur = 0.35) { return 1 - c(t, at, at + dur, easeInOut); }
function win(t: number, inAt: number, inDur: number, outAt: number, outDur = 0.35) {
  return fadeIn(t, inAt, inDur) * fadeOut(t, outAt, outDur);
}
function spr(frame: number, fps: number, delay = 0, stiff = 180, damp = 22) {
  return spring({ frame: Math.max(0, frame - delay), fps, config: { stiffness: stiff, damping: damp } });
}

// ─── Shared UI components ─────────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = P.inkDim }) => (
  <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color }}>
    {children}
  </div>
);

const Divider: React.FC<{ progress?: number; color?: string }> = ({ progress = 1, color = P.line }) => (
  <div style={{ width: `${progress * 100}%`, height: 1, background: color, transition: "none" }} />
);

const Tag: React.FC<{ children: React.ReactNode; variant?: "burg" | "green" | "ghost" }> = ({
  children, variant = "ghost",
}) => {
  const styles: Record<string, React.CSSProperties> = {
    burg:  { background: P.burg,    color: "#fff",    border: "none" },
    green: { background: P.greenBg, color: P.green,   border: `1px solid rgba(26,122,60,0.3)` },
    ghost: { background: "transparent", color: P.inkDim, border: `1px solid ${P.line}` },
  };
  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      padding: "5px 14px", borderRadius: 100,
      fontFamily: FONT.mono, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.16em", textTransform: "uppercase",
      ...styles[variant],
    }}>
      {children}
    </div>
  );
};

// Verification symbol — the film's central visual signature
const VerifyMark: React.FC<{
  size: number;
  progress: number;    // 0→1 draws the ring + check
  glowP?: number;
  color?: string;
}> = ({ size, progress, glowP = 0, color = P.burg }) => {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, progress * 1.4);
  const checkP = Math.max(0, progress * 2 - 0.8);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      {glowP > 0 && (
        <circle cx={size/2} cy={size/2} r={r + 8}
          fill="none" stroke={color} strokeWidth={16}
          opacity={glowP * 0.12}
        />
      )}
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke={`rgba(118,15,43,0.12)`} strokeWidth={2}
      />
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      {checkP > 0 && (
        <polyline
          points={`${size*0.31},${size*0.52} ${size*0.45},${size*0.66} ${size*0.69},${size*0.38}`}
          fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          opacity={checkP}
          strokeDasharray={`${checkP * 48} 48`}
        />
      )}
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 1 — THE HOOK  0–3s
// "PROVE MORE. REVEAL LESS." on bright white
// ═════════════════════════════════════════════════════════════════════════════
const SceneHook: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const op = win(t, 0, 0.4, 2.7, 0.5);

  const line1P = spr(frame, FPS, 0,  200, 24);
  const line2P = spr(frame, FPS, 8,  200, 24);
  const subP   = spr(frame, FPS, 22, 180, 26);
  const markP  = spr(frame, FPS, 4,  140, 20);
  const ringP  = c(t, 0.1, 1.8);

  return (
    <AbsoluteFill style={{ opacity: op, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Central verify mark — the film's signature */}
      <div style={{ marginBottom: 52, opacity: markP, transform: `scale(${0.7 + markP * 0.3})` }}>
        <VerifyMark size={96} progress={ringP} glowP={ringP} />
      </div>

      {/* PROVE MORE */}
      <div style={{
        fontFamily: FONT.display, fontWeight: 700, fontSize: 112,
        color: P.ink, lineHeight: 1, letterSpacing: "-0.03em",
        opacity: line1P, transform: `translateY(${(1 - line1P) * 32}px)`,
      }}>
        PROVE MORE.
      </div>

      {/* REVEAL LESS */}
      <div style={{
        fontFamily: FONT.display, fontWeight: 700, fontSize: 112,
        color: P.burg, lineHeight: 1, letterSpacing: "-0.03em",
        opacity: line2P, transform: `translateY(${(1 - line2P) * 32}px)`,
        marginBottom: 48,
      }}>
        REVEAL LESS.
      </div>

      {/* Subtitle */}
      <div style={{
        fontFamily: FONT.display, fontStyle: "italic", fontSize: 24,
        color: P.inkMid, opacity: subP,
      }}>
        Private eligibility. On-chain authorization.
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 2 — DOJANG CREDENTIAL  3–8s
// ═════════════════════════════════════════════════════════════════════════════
const SceneDojang: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const op = win(t, 3.0, 0.5, 7.6, 0.5);
  const tL = t - 3.0;
  const fL = frame - 3 * FPS;

  const headP   = spr(fL, FPS, 0,  200, 26);
  const cardP   = spr(fL, FPS, 6,  160, 22);
  const typeP   = spr(fL, FPS, 12, 180, 24);
  const holderP = spr(fL, FPS, 20, 180, 24);
  const issuerP = spr(fL, FPS, 26, 180, 24);
  const scopeP  = spr(fL, FPS, 32, 180, 24);
  const proofP  = spr(fL, FPS, 38, 180, 24);
  const sealP   = spr(fL, FPS, 48, 160, 18);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Left: Label + heading */}
      <div style={{ position: "absolute", left: 120, top: H / 2 - 220 }}>
        <div style={{ opacity: headP, transform: `translateY(${(1 - headP) * 20}px)` }}>
          <Label color={P.burg}>Credential</Label>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 72, color: P.ink, lineHeight: 1, letterSpacing: "-0.02em" }}>
              DOJANG
            </div>
            <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 20, color: P.inkMid, marginTop: 10, lineHeight: 1.6 }}>
              Project-issued credential.<br />
              One credential per holder.
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <VerifyMark size={48} progress={sealP} glowP={sealP * 0.6} />
          </div>
        </div>
      </div>

      {/* Right: Credential card */}
      <div style={{
        position: "absolute", right: 100, top: H / 2 - 300,
        width: 720,
        opacity: cardP, transform: `translateY(${(1 - cardP) * 40}px)`,
      }}>
        <div style={{
          background: P.bgCard, borderRadius: 16,
          border: `1px solid rgba(0,0,0,0.1)`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}>
          {/* Card header */}
          <div style={{
            padding: "18px 28px", display: "flex",
            justifyContent: "space-between", alignItems: "center",
            borderBottom: `1px solid ${P.line}`,
            background: "rgba(248,248,246,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: P.burg }} />
              <Label color={P.ink}>GYEVO · DOJANG</Label>
            </div>
            <Tag variant="burg">Issued</Tag>
          </div>

          {/* Card body */}
          <div style={{ padding: "0 28px 24px" }}>
            {[
              { label: "Type",         val: "DOJANG",                   delay: typeP,   veil: false },
              { label: "Holder",       val: "0x3a8f…c204",              delay: holderP, veil: true  },
              { label: "Issued by",    val: "[PROJECT]",                 delay: issuerP, veil: false },
              { label: "Policy scope", val: "POLICY 04  ·  POLICY 03",  delay: scopeP,  veil: false },
              { label: "Proof method", val: "BOJAGI · Noir / Barretenberg", delay: proofP, veil: false },
            ].map(({ label, val, delay, veil }) => (
              <div key={label} style={{
                padding: "16px 0", borderBottom: `1px solid ${P.line}`,
                display: "flex", gap: 24, alignItems: "center",
                opacity: delay, transform: `translateX(${(1 - delay) * 12}px)`,
              }}>
                <div style={{ width: 120, fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.16em", color: P.inkDim, textTransform: "uppercase", flexShrink: 0 }}>
                  {label}
                </div>
                {veil ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 180, height: 14, borderRadius: 4,
                      background: `repeating-linear-gradient(90deg, ${P.burg} 0 8px, rgba(118,15,43,0.3) 8px 16px)`,
                    }} />
                    <Tag variant="ghost">Concealed</Tag>
                  </div>
                ) : (
                  <div style={{ fontFamily: FONT.display, fontSize: 20, color: P.ink }}>{val}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 3 — BOJAGI PROOF GENERATION  8–13s
// ═════════════════════════════════════════════════════════════════════════════
const SceneBojagi: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const op = win(t, 8.0, 0.5, 12.7, 0.5);
  const fL = frame - 8 * FPS;

  const headP    = spr(fL, FPS, 0,  200, 26);
  const inputP   = spr(fL, FPS, 6,  180, 24);
  const veilP    = c(t, 8.8, 10.2);          // 0→1 = value becomes hidden
  const riseP    = c(t, 9.5, 12.5);          // proof generation progress
  const proofP   = spr(fL, FPS, 50, 160, 22);
  const validP   = spr(fL, FPS, 68, 200, 20);
  const taglineP = spr(fL, FPS, 72, 160, 22);

  // Typing effect for private value
  const fullValue = "0x7f2e…9a4b";
  const typeLen = Math.floor(c(t, 8.2, 8.85) * fullValue.length);
  const typedValue = fullValue.slice(0, typeLen);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Left: Context */}
      <div style={{ position: "absolute", left: 120, top: H / 2 - 200 }}>
        <div style={{ opacity: headP, transform: `translateY(${(1 - headP) * 20}px)` }}>
          <Label color={P.burg}>Zero-Knowledge Proof</Label>
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 72, color: P.ink, lineHeight: 1, letterSpacing: "-0.02em", marginTop: 10 }}>
            BOJAGI
          </div>
          <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 20, color: P.inkMid, marginTop: 10 }}>
            Prove eligibility.<br />
            Keep the value private.
          </div>
        </div>

        {/* Tagline reveal */}
        <div style={{ marginTop: 48, opacity: taglineP }}>
          <div style={{
            fontFamily: FONT.display, fontStyle: "italic", fontSize: 28,
            color: P.ink, fontWeight: 600,
          }}>
            "The value never leaves."
          </div>
        </div>
      </div>

      {/* Right: Proof interaction */}
      <div style={{
        position: "absolute", right: 100, top: H / 2 - 280,
        width: 680,
        opacity: inputP, transform: `translateY(${(1 - inputP) * 40}px)`,
      }}>
        <div style={{
          background: P.bgCard, borderRadius: 16,
          border: `1px solid rgba(0,0,0,0.10)`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.07), 0 0 0 ${riseP * 3}px rgba(118,15,43,0.08)`,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "16px 24px", background: "rgba(248,248,246,0.6)", borderBottom: `1px solid ${P.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>BOJAGI · Proof Generation</Label>
            {validP > 0.1 && <Tag variant="green">✓ Valid</Tag>}
          </div>

          <div style={{ padding: "24px" }}>
            {/* Private value row */}
            <div style={{ marginBottom: 20 }}>
              <Label color={P.inkDim}>Private Input</Label>
              <div style={{ marginTop: 8, position: "relative", height: 48, display: "flex", alignItems: "center" }}>
                {/* Typed value, then veiled */}
                <div style={{
                  fontFamily: FONT.mono, fontSize: 28, color: P.ink,
                  opacity: 1 - veilP * 1.2,
                  position: "absolute", left: 0,
                }}>
                  {typedValue}
                  {typeLen < fullValue.length && (
                    <span style={{ borderRight: `2px solid ${P.ink}`, marginLeft: 2, animation: "none" }}>&nbsp;</span>
                  )}
                </div>
                {/* Veil overlay */}
                <div style={{
                  position: "absolute", left: 0, top: 4,
                  width: 300 * veilP, height: 36, borderRadius: 6,
                  background: `repeating-linear-gradient(90deg, ${P.burg} 0 10px, rgba(118,15,43,0.25) 10px 20px)`,
                  opacity: veilP,
                }} />
              </div>
            </div>

            <Divider />

            {/* ZK Stack */}
            <div style={{ margin: "18px 0" }}>
              <Label color={P.inkDim}>ZK Stack</Label>
              <div style={{ marginTop: 8, fontFamily: FONT.mono, fontSize: 15, color: P.ink, display: "flex", gap: 16 }}>
                {["Noir", "Barretenberg", "HonkVerifier"].map((s, i) => (
                  <div key={s} style={{
                    padding: "4px 12px", borderRadius: 6,
                    border: `1px solid ${P.line}`,
                    background: riseP > i * 0.3 ? "rgba(118,15,43,0.07)" : "transparent",
                    color: riseP > i * 0.3 ? P.burg : P.inkDim,
                    transition: "none",
                    opacity: riseP > i * 0.28 ? 1 : 0.4,
                  }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Progress ring + π */}
            <div style={{ margin: "20px 0", display: "flex", alignItems: "center", gap: 20 }}>
              <VerifyMark size={72} progress={riseP} glowP={riseP} />
              <div>
                <div style={{ fontFamily: FONT.mono, fontSize: 13, color: P.inkDim, marginBottom: 4 }}>
                  {riseP < 0.95 ? `Generating… ${Math.floor(riseP * 100)}%` : "Proof ready"}
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 20, color: P.ink, opacity: proofP }}>
                  π = honk&#123;…&#125;
                </div>
              </div>
            </div>

            <Divider progress={riseP} color={P.burg} />

            {/* Statement */}
            <div style={{ marginTop: 16, opacity: proofP }}>
              <Label color={P.inkDim}>Statement</Label>
              <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 20, color: P.ink, marginTop: 6 }}>
                "Holder meets eligibility threshold"
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 4 — VERIFICATION  13–18s
// ═════════════════════════════════════════════════════════════════════════════
const SceneVerify: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const op = win(t, 13.0, 0.5, 17.7, 0.5);
  const fL = frame - 13 * FPS;

  const headP  = spr(fL, FPS, 0,  200, 26);
  const proofP = spr(fL, FPS, 6,  160, 22);
  const gateP  = c(t, 13.8, 14.8);
  const ringP  = c(t, 13.5, 16.0);
  const validP = spr(fL, FPS, 55, 240, 18);
  const pathP  = spr(fL, FPS, 62, 160, 22);

  return (
    <AbsoluteFill style={{ opacity: op, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 900, textAlign: "center" }}>
        {/* Headline */}
        <div style={{ opacity: headP, transform: `translateY(${(1 - headP) * 20}px)`, marginBottom: 48 }}>
          <Label color={P.burg}>Verification</Label>
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 64, color: P.ink, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 10 }}>
            Eligibility verified.
            <span style={{ color: P.burg }}> Access granted.</span>
          </div>
        </div>

        {/* Center verification panel */}
        <div style={{ opacity: proofP, transform: `scale(${0.9 + proofP * 0.1})` }}>
          <div style={{
            background: P.bgCard, borderRadius: 20,
            border: `1px solid rgba(0,0,0,0.09)`,
            boxShadow: `0 24px 80px rgba(0,0,0,0.07), 0 0 0 ${gateP * 4}px rgba(118,15,43,${0.06 * gateP})`,
            padding: "36px 48px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 28,
          }}>
            {/* Proof summary */}
            <div style={{ width: "100%", padding: "16px 20px", borderRadius: 10, background: P.bg, border: `1px solid ${P.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Label color={P.inkDim}>BOJAGI Proof</Label>
                  <div style={{ fontFamily: FONT.mono, fontSize: 18, color: P.ink, marginTop: 4 }}>
                    π = honk&#123;…&#125;
                  </div>
                  <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 16, color: P.inkMid, marginTop: 4 }}>
                    "Holder meets eligibility threshold"
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Label color={P.inkDim}>Private Input</Label>
                  <div style={{
                    marginTop: 6, width: 120, height: 14, borderRadius: 4,
                    background: `repeating-linear-gradient(90deg, ${P.burg} 0 8px, rgba(118,15,43,0.25) 8px 16px)`,
                  }} />
                </div>
              </div>
            </div>

            {/* Central verify animation */}
            <div style={{ transform: `scale(${0.85 + gateP * 0.15})` }}>
              <VerifyMark
                size={120}
                progress={ringP}
                glowP={validP}
                color={validP > 0.5 ? P.green : P.burg}
              />
            </div>

            {/* Access granted badge */}
            <div style={{ opacity: validP, transform: `scale(${0.8 + validP * 0.2})` }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "12px 28px", borderRadius: 100,
                background: P.greenBg, border: `1px solid rgba(26,122,60,0.25)`,
                fontFamily: FONT.display, fontWeight: 600, fontSize: 22, color: P.green,
              }}>
                <svg width={20} height={20} viewBox="0 0 20 20">
                  <path d="M 4,10 L 8,14 L 16,6" stroke={P.green} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Authorization unlocked
              </div>
            </div>

            {/* Two paths teaser */}
            <div style={{ opacity: pathP, width: "100%", display: "flex", gap: 12 }}>
              <div style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.bg }}>
                <Label color={P.burg}>POLICY 04</Label>
                <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 18, color: P.ink, marginTop: 4 }}>Governance →</div>
              </div>
              <div style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.bg }}>
                <Label color={P.burg}>POLICY 03</Label>
                <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 18, color: P.ink, marginTop: 4 }}>Lending →</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 5 — TWO AUTHORIZATION PATHS  18–23s
// ═════════════════════════════════════════════════════════════════════════════
const ScenePaths: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const op = win(t, 18.0, 0.5, 22.7, 0.5);
  const fL = frame - 18 * FPS;

  const headP  = spr(fL, FPS, 0,  200, 26);
  const govP   = spr(fL, FPS, 8,  160, 22);
  const lendP  = spr(fL, FPS, 16, 160, 22);
  const tallyP = spr(fL, FPS, 30, 160, 22);
  const lendR  = spr(fL, FPS, 36, 160, 22);

  const tallyFill = c(t, 18.9, 20.2);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Headline */}
      <div style={{ position: "absolute", left: 120, top: 90, opacity: headP, transform: `translateY(${(1 - headP) * 16}px)` }}>
        <Label color={P.burg}>Authorization Paths</Label>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 52, color: P.ink, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 8 }}>
          Two ways in.<br />
          <span style={{ color: P.burg }}>Both authorized.</span>
        </div>
      </div>

      {/* Left: Governance */}
      <div style={{
        position: "absolute", left: 120, top: 280, width: 780,
        opacity: govP, transform: `translateY(${(1 - govP) * 32}px)`,
      }}>
        <div style={{
          background: P.bgCard, borderRadius: 16,
          border: `1px solid rgba(0,0,0,0.09)`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${P.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Label color={P.burg}>POLICY 04 — DAO Governance</Label>
              <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 32, color: P.ink, marginTop: 6 }}>Governance</div>
            </div>
            <Tag variant="green">✓ Authorized</Tag>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ padding: "14px 0", borderBottom: `1px solid ${P.line}`, display: "flex", justifyContent: "space-between" }}>
              <Label>Voter Identity</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 18, color: P.inkDim, letterSpacing: "0.08em" }}>●●●●●●●●●●●●</div>
                <Tag variant="ghost">Concealed</Tag>
              </div>
            </div>
            <div style={{ padding: "14px 0", borderBottom: `1px solid ${P.line}` }}>
              <Label>Proposal #1</Label>
              <div style={{ fontFamily: FONT.display, fontSize: 20, color: P.ink, marginTop: 4 }}>
                Activate BOJAGI-protected lending on Policy 03 collateral pools.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, color: P.inkDim, marginTop: 6, letterSpacing: "0.14em" }}>
                CHAIN 46630 · Quorum threshold met
              </div>
            </div>
            <div style={{ padding: "14px 0 0", opacity: tallyP }}>
              <Label>Final Tally · Executed</Label>
              <div style={{ margin: "10px 0 8px", height: 8, borderRadius: 4, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${tallyFill * 100}%`, background: P.burg, borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: FONT.mono, fontSize: 13, color: P.burg, letterSpacing: "0.1em" }}>2 FOR</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 13, color: P.inkDim, letterSpacing: "0.1em" }}>0 AGAINST</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 13, color: P.green, letterSpacing: "0.1em" }}>✓ EXECUTED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Lending */}
      <div style={{
        position: "absolute", right: 100, top: 280, width: 680,
        opacity: lendP, transform: `translateY(${(1 - lendP) * 32}px)`,
      }}>
        <div style={{
          background: P.bgCard, borderRadius: 16,
          border: `1px solid rgba(0,0,0,0.09)`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${P.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Label color={P.burg}>POLICY 03 + BOJAGI</Label>
              <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 32, color: P.ink, marginTop: 6 }}>Lending</div>
            </div>
            <Tag variant="green">✓ Authorized</Tag>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ padding: "12px 0", borderBottom: `1px solid ${P.line}` }}>
              <Label>Authorization Method</Label>
              <div style={{ fontFamily: FONT.display, fontSize: 18, color: P.ink, marginTop: 4 }}>
                BOJAGI ZK proof
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, color: P.inkDim, marginTop: 4, letterSpacing: "0.12em" }}>
                Noir · Barretenberg · HonkVerifier
              </div>
            </div>
            <div style={{ padding: "12px 0", borderBottom: `1px solid ${P.line}` }}>
              <Label>Eligibility</Label>
              <div style={{ fontFamily: FONT.display, fontSize: 18, color: P.ink, marginTop: 4 }}>
                Protected · Private input concealed
              </div>
            </div>
            <div style={{ padding: "12px 0 0", opacity: lendR }}>
              <div style={{
                padding: "14px 20px", borderRadius: 10,
                background: P.greenBg, border: `1px solid rgba(26,122,60,0.2)`,
                fontFamily: FONT.display, fontWeight: 600, fontSize: 18, color: P.green,
                textAlign: "center",
              }}>
                ✓ Access Granted — Lending Enabled
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Testnet note */}
      <div style={{
        position: "absolute", bottom: 52, left: 120,
        fontFamily: FONT.mono, fontSize: 10, color: P.inkDim,
        letterSpacing: "0.16em", opacity: tallyP,
      }}>
        Robinhood Testnet · Chain 46630 · Test tokens only · Not audited
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 6 — FINAL IDENT  23–29s
// ═════════════════════════════════════════════════════════════════════════════
const SceneIdent: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const op = fadeIn(t, 23.0, 0.6);
  const fL = frame - 23 * FPS;

  const markP    = spr(fL, FPS, 0,  160, 20);
  const wordP    = spr(fL, FPS, 10, 220, 24);
  const tagP     = spr(fL, FPS, 24, 180, 26);
  const footerP  = spr(fL, FPS, 36, 160, 24);
  const ringFull = c(t, 23.1, 25.8);

  return (
    <AbsoluteFill style={{ opacity: op, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Mark */}
      <div style={{ marginBottom: 44, opacity: markP, transform: `scale(${0.6 + markP * 0.4}) rotate(${(1 - markP) * -15}deg)` }}>
        <VerifyMark size={100} progress={ringFull} glowP={c(t, 24, 26)} />
      </div>

      {/* GYEVO */}
      <div style={{
        fontFamily: FONT.display, fontWeight: 700, fontSize: 180,
        color: P.ink, lineHeight: 1, letterSpacing: "-0.03em",
        opacity: wordP, transform: `scale(${0.88 + wordP * 0.12})`,
      }}>
        GYEVO
      </div>

      {/* Rule */}
      <div style={{ width: 900 * tagP, height: 1, background: P.line, margin: "28px 0 24px" }} />

      {/* Tagline */}
      <div style={{
        fontFamily: FONT.display, fontStyle: "italic", fontSize: 30,
        color: P.inkMid, letterSpacing: "0.02em",
        opacity: tagP,
      }}>
        Private. &nbsp;Authorized. &nbsp;Onchain.
      </div>

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 52, left: 0, right: 0, textAlign: "center",
        fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.22em",
        color: P.inkDim, opacity: footerP,
      }}>
        DOJANG &nbsp;·&nbsp; BOJAGI &nbsp;·&nbsp; ON-CHAIN AUTHORIZATION
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Background — persistent warm white + very subtle grid
// ═════════════════════════════════════════════════════════════════════════════
const Background: React.FC = () => (
  <AbsoluteFill style={{ background: P.bg, overflow: "hidden" }}>
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.25 }}>
      {Array.from({ length: Math.ceil(W / 80) + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * 80} y1={0} x2={i * 80} y2={H} stroke="#000" strokeWidth={0.4} />
      ))}
      {Array.from({ length: Math.ceil(H / 80) + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 80} x2={W} y2={i * 80} stroke="#000" strokeWidth={0.4} />
      ))}
    </svg>
  </AbsoluteFill>
);

// ─── Persistent header ───────────────────────────────────────────────────────
const Header: React.FC<{ t: number }> = ({ t }) => (
  <div style={{
    position: "absolute", top: 0, left: 0, right: 0,
    padding: "22px 60px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    borderBottom: `1px solid ${P.line}`,
    opacity: fadeIn(t, 0.4, 0.5),
    background: "rgba(248,248,246,0.8)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: P.burg, transform: "rotate(45deg)" }} />
      <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 20, color: P.ink, letterSpacing: "-0.01em" }}>
        GYEVO
      </div>
    </div>
    <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color: P.inkDim }}>
      CHAIN 46630 &nbsp;·&nbsp; ROBINHOOD TESTNET
    </div>
  </div>
);

// ─── Disclosure footer ────────────────────────────────────────────────────────
const Disclosure: React.FC<{ t: number }> = ({ t }) => (
  <div style={{
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: "14px 60px",
    fontFamily: FONT.mono, fontSize: 9, letterSpacing: "0.14em", color: P.inkDim,
    opacity: t > 3 ? fadeIn(t, 3, 1) * 0.6 : 0,
    borderTop: `1px solid ${P.line}`,
    textAlign: "center",
  }}>
    Robinhood Testnet · Chain 46630 · Test tokens only · Not audited · Independent of GIWA and Upbit
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// ROOT COMPOSITION
// ═════════════════════════════════════════════════════════════════════════════
export const LaunchV4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill>
      <Background />

      <SceneHook       t={t} frame={frame} />
      <SceneDojang     t={t} frame={frame} />
      <SceneBojagi     t={t} frame={frame} />
      <SceneVerify     t={t} frame={frame} />
      <ScenePaths      t={t} frame={frame} />
      <SceneIdent      t={t} frame={frame} />

      <Header    t={t} />
      <Disclosure t={t} />

      {/* Original soundtrack */}
      <Audio
        src={staticFile("audio/gyevo-launch-v4.wav")}
        startFrom={0}
        volume={1.0}
      />

      {/* Very subtle grain for texture */}
      <Grain opacity={0.025} />
    </AbsoluteFill>
  );
};
