import React from "react";
import { AbsoluteFill, interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DISCLOSURE, FONT, FPS, W, H } from "../lib/theme";
import { Grain, Ground, Logo, MaskLine, Vignette } from "../lib/Brand";
import { CinematicAtmosphere, NetworkHeader, curve, lin, pulseHit, windowSpan } from "../lib/cinematic";
import { easeOut, prog } from "../lib/motion";
import { CredentialCard } from "../lib/ProofObjects";

// ─── timing helpers ──────────────────────────────────────────────────────────
const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const c = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], { ...cl, easing: Easing.bezier(0.16, 1, 0.3, 1) });
const fadeIn  = (t: number, at: number, dur = 0.6) => c(t, at, at + dur);
const fadeOut = (t: number, at: number, dur = 0.4) => 1 - c(t, at, at + dur);
const window  = (t: number, inAt: number, inDur: number, outAt: number, outDur = 0.4) =>
  fadeIn(t, inAt, inDur) * fadeOut(t, outAt, outDur);

// Scene boundaries (seconds)
const S = [0, 4, 9, 14, 19, 23, 28] as const;

// ─── Background: persistent dark with grid ───────────────────────────────────
const DarkGround: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
    {/* fine grid */}
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.07 }}>
      {Array.from({ length: Math.ceil(W / 64) + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * 64} y1={0} x2={i * 64} y2={H} stroke="#fff" strokeWidth={0.5} />
      ))}
      {Array.from({ length: Math.ceil(H / 64) + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 64} x2={W} y2={i * 64} stroke="#fff" strokeWidth={0.5} />
      ))}
    </svg>
    {/* low ambient radial glow, shifts per scene */}
    <div style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(ellipse 1200px 600px at ${W * 0.5}px ${H * 0.5}px, rgba(109,0,26,0.22) 0%, transparent 70%)`,
    }} />
  </AbsoluteFill>
);

// ─── Scene 1: GYEVO Identity (0–4 s) ─────────────────────────────────────────
const SceneIdentity: React.FC<{ t: number }> = ({ t }) => {
  const op = window(t, S[0], 0.6, S[1] - 0.4);

  // Letters stagger in from left
  const LETTERS = ["G", "Y", "E", "V", "O"];
  const letterW = 228;

  // ZK circuit nodes
  const cx = 1420, cy = 500;
  const nodes = [
    [cx,      cy - 200],
    [cx + 170, cy - 75],
    [cx + 210, cy + 105],
    [cx,      cy + 210],
    [cx - 210, cy + 105],
    [cx - 170, cy - 75],
    [cx,      cy],
  ];
  const edges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6]];

  const circuitP = c(t, 0.6, 2.2);
  const ruleP   = c(t, 0.9, 1.5);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Wordmark */}
      <div style={{ position: "absolute", left: 80, top: H / 2 - 165, display: "flex", gap: 4 }}>
        {LETTERS.map((ch, i) => {
          const p = c(t, i * 0.08, 0.5 + i * 0.08);
          return (
            <div key={ch} style={{
              fontFamily: FONT.display,
              fontWeight: 700,
              fontSize: 268,
              lineHeight: 1,
              color: C.text,
              opacity: p,
              transform: `translateX(${(1 - p) * -40}px)`,
            }}>
              {ch}
            </div>
          );
        })}
      </div>

      {/* Burgundy rule */}
      <div style={{
        position: "absolute", left: 80, top: H / 2 + 122,
        width: 820 * ruleP, height: 2, background: C.burgundy,
      }} />

      {/* Descriptor */}
      <div style={{
        position: "absolute", left: 80, top: H / 2 + 140,
        fontFamily: FONT.mono, fontSize: 13, letterSpacing: "0.32em",
        color: C.dim, textTransform: "uppercase",
        opacity: c(t, 1.2, 1.8),
      }}>
        Private &nbsp;·&nbsp; Eligibility &nbsp;·&nbsp; Protocol
      </div>

      {/* ZK Circuit constellation */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: circuitP }}>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={240} fill="none" stroke={C.muted} strokeWidth={0.7} opacity={0.4} />
        {/* Edges */}
        {edges.map(([a, b], i) => (
          <line key={i}
            x1={nodes[a][0]} y1={nodes[a][1]}
            x2={nodes[b][0]} y2={nodes[b][1]}
            stroke={C.burgundyLo} strokeWidth={1} opacity={0.7}
          />
        ))}
        {/* Nodes */}
        {nodes.map(([nx, ny], i) => {
          const np = c(t, 0.6 + i * 0.12, 1.2 + i * 0.12);
          return (
            <circle key={i} cx={nx} cy={ny} r={i === 6 ? 12 : 7}
              fill={i === 6 ? C.burgundy : C.muted}
              opacity={np}
            />
          );
        })}
      </svg>

      {/* ZK label */}
      <div style={{
        position: "absolute", left: cx - 160, top: cy + 264,
        fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.28em",
        color: C.dim, textTransform: "uppercase", opacity: circuitP,
      }}>
        ZK &nbsp;ELIGIBILITY &nbsp;CIRCUIT
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 52, left: 80, right: 80,
        borderTop: `1px solid ${C.line}`,
        paddingTop: 14,
        display: "flex", gap: 32,
        fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.22em",
        textTransform: "uppercase",
        opacity: c(t, 1.4, 2.0),
      }}>
        <span style={{ color: C.wine }}>DOJANG</span>
        <span style={{ color: C.dim }}>· &nbsp;BOJAGI</span>
        <span style={{ color: C.dim }}>· &nbsp;POLICY 04</span>
        <span style={{ color: C.dim }}>· &nbsp;POLICY 03</span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: DOJANG Credential (4–9 s) ──────────────────────────────────────
const SceneDojang: React.FC<{ t: number }> = ({ t }) => {
  const op = window(t, S[1], 0.5, S[2] - 0.4);
  const tLocal = t - S[1]; // 0..5

  const cardSlide = c(tLocal, 0, 0.7);
  const seal = c(tLocal, 2.8, 3.8);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Left column */}
      <div style={{ position: "absolute", left: 80, top: 160 }}>
        <div style={{
          fontFamily: FONT.display, fontWeight: 700, fontSize: 80,
          color: C.burgundy, opacity: c(tLocal, 0, 0.5),
          transform: `translateY(${(1 - c(tLocal, 0, 0.5)) * 30}px)`,
        }}>
          DOJANG
        </div>
        <div style={{
          width: 320, height: 2, background: C.burgundy,
          marginTop: 8, marginBottom: 16,
          opacity: c(tLocal, 0.2, 0.6),
          transform: `scaleX(${c(tLocal, 0.2, 0.6)})`,
          transformOrigin: "left",
        }} />
        <div style={{
          fontFamily: FONT.display, fontStyle: "italic", fontSize: 22,
          color: C.muted, lineHeight: 1.6,
          opacity: c(tLocal, 0.4, 0.9),
        }}>
          Project-issued credential.<br />
          One credential per holder.
        </div>

        {/* Decorative numeral */}
        <div style={{
          fontFamily: FONT.display, fontWeight: 700, fontSize: 220,
          color: C.burgundyLo, opacity: 0.35, lineHeight: 1,
          marginTop: 20,
          transform: `translateY(${(1 - c(tLocal, 0.1, 0.7)) * 50}px)`,
        }}>
          01
        </div>
      </div>

      {/* Credential card */}
      <div style={{
        position: "absolute",
        left: 640,
        top: 120 + (1 - cardSlide) * 80,
        opacity: cardSlide,
      }}>
        <CredentialCard
          t={tLocal}
          x={0} y={0}
          w={860} h={660}
          tone="dark"
          rot={-6}
          title="GYEVO  ·  DOJANG"
          fieldsAt={0.6}
          seal={seal}
          fields={[
            { k: "Type",         v: "DOJANG" },
            { k: "Holder",       v: "0x3a8f … c204", veil: true },
            { k: "Issued by",    v: "[PROJECT]" },
            { k: "Policy scope", v: "POLICY 04  ·  POLICY 03" },
            { k: "Proof method", v: "BOJAGI  ·  Noir / Barretenberg" },
          ]}
        />
      </div>

      {/* Testnet footer */}
      <div style={{
        position: "absolute", bottom: 52, left: 80,
        fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em",
        color: C.dim, opacity: c(tLocal, 1.5, 2.2),
      }}>
        Robinhood Testnet &nbsp;·&nbsp; Chain 46630
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: BOJAGI Concealment (9–14 s) ────────────────────────────────────
const SceneBojagi: React.FC<{ t: number }> = ({ t }) => {
  const op = window(t, S[2], 0.5, S[3] - 0.4);
  const tLocal = t - S[2]; // 0..5

  const valueEnter  = c(tLocal, 0,   0.5);
  const valueDescend = c(tLocal, 0.6, 1.6); // 0→1 = descends into fold
  const foldFlash   = c(tLocal, 1.5, 2.0);
  const proofEnter  = c(tLocal, 1.8, 2.6);
  const statementP  = c(tLocal, 2.8, 3.4);

  // Value dissolves as it enters fold
  const valueOpacity = valueEnter * (1 - foldFlash);
  const valueY = 240 + valueDescend * 190;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Vertical separator */}
      <div style={{
        position: "absolute",
        left: W / 2, top: 100, bottom: 100,
        width: 1, background: C.line,
        opacity: c(tLocal, 0.2, 0.6),
      }} />

      {/* LEFT: Private value heading */}
      <div style={{
        position: "absolute", left: 80, top: 80,
        fontFamily: FONT.display, fontWeight: 700, fontSize: 88,
        color: C.text, opacity: c(tLocal, 0, 0.4),
      }}>
        BOJAGI
      </div>
      <div style={{
        position: "absolute", left: 80, top: 188,
        fontFamily: FONT.display, fontStyle: "italic", fontSize: 22,
        color: C.muted, opacity: c(tLocal, 0.2, 0.6),
      }}>
        Zero-knowledge eligibility.
      </div>

      {/* Private value — animates down into fold */}
      <div style={{
        position: "absolute", left: 140, top: valueY,
        opacity: valueOpacity,
        transform: `scale(${1 - valueDescend * 0.1})`,
      }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.22em", color: C.dim, marginBottom: 8 }}>
          PRIVATE VALUE
        </div>
        <div style={{
          fontFamily: FONT.display, fontWeight: 700, fontSize: 54,
          color: C.text, lineHeight: 1.15,
        }}>
          0x7f2e…<br />9a4b
        </div>
      </div>

      {/* Descent arrow */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <line
          x1={240} y1={valueY + 140}
          x2={240} y2={430 - 20}
          stroke={C.dim} strokeWidth={1.5}
          opacity={valueDescend * (1 - foldFlash) * 0.7}
          strokeDasharray="4 4"
        />
        <polygon
          points={`232,420 248,420 240,440`}
          fill={C.dim}
          opacity={valueDescend * (1 - foldFlash) * 0.7}
        />
      </svg>

      {/* The ZK Fold (diamond) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <svg width={W} height={H}>
          <polygon
            points={`240,330 480,460 240,590 0,460`}
            fill={C.ink2}
            stroke={C.burgundy}
            strokeWidth={2}
            opacity={c(tLocal, 0.3, 0.8)}
          />
          {/* Interior crease lines */}
          <line x1={240} y1={330} x2={240} y2={590} stroke={C.burgundyLo} strokeWidth={1} opacity={c(tLocal, 0.3, 0.8) * 0.6} />
          <line x1={0}   y1={460} x2={480} y2={460} stroke={C.burgundyLo} strokeWidth={1} opacity={c(tLocal, 0.3, 0.8) * 0.6} />
          {/* Circuit flash on value entering */}
          <polygon
            points={`240,330 480,460 240,590 0,460`}
            fill={C.burgundy}
            opacity={foldFlash * 0.35}
          />
        </svg>
        {/* BOJAGI label inside fold */}
        <div style={{
          position: "absolute", left: 140, top: 432,
          fontFamily: FONT.mono, fontWeight: 600, fontSize: 13,
          letterSpacing: "0.22em", textTransform: "uppercase",
          color: C.burgundy, opacity: c(tLocal, 0.3, 0.8),
          textAlign: "center", width: 200,
        }}>
          BOJAGI<br />
          <span style={{ color: C.burgundyLo, fontSize: 11 }}>CIRCUIT</span>
        </div>
        {/* Dissolving fragments below fold */}
        {["0x7", "f2", "e…", "9a"].map((frag, i) => (
          <div key={frag} style={{
            position: "absolute",
            left: 148 + i * 34,
            top: 600 + i * 12,
            fontFamily: FONT.display, fontWeight: 700, fontSize: 18,
            color: C.muted,
            opacity: foldFlash * Math.max(0, 0.8 - i * 0.22),
          }}>
            {frag}
          </div>
        ))}
      </div>

      {/* RIGHT: PROOF heading */}
      <div style={{
        position: "absolute", left: W / 2 + 80, top: 80,
        fontFamily: FONT.display, fontWeight: 700, fontSize: 88,
        color: C.burgundy, opacity: c(tLocal, 1.4, 2.0),
      }}>
        PROOF
      </div>
      <div style={{
        position: "absolute", left: W / 2 + 80, top: 188,
        fontFamily: FONT.display, fontStyle: "italic", fontSize: 22,
        color: C.dim, opacity: c(tLocal, 1.6, 2.2),
      }}>
        Eligibility. No value exposed.
      </div>

      {/* Proof card */}
      <div style={{
        position: "absolute",
        left: W / 2 + 80,
        top: 270 + (1 - proofEnter) * 60,
        opacity: proofEnter,
        width: 700,
      }}>
        <div style={{
          borderRadius: 12,
          background: `linear-gradient(160deg, ${C.surface}, ${C.ink2})`,
          border: `1px solid rgba(184,26,52,0.5)`,
          boxShadow: `0 0 60px -20px rgba(184,26,52,0.4)`,
          padding: "28px 32px",
        }}>
          {/* Card header */}
          <div style={{
            fontFamily: FONT.mono, fontWeight: 600, fontSize: 13,
            letterSpacing: "0.22em", color: C.wine, textTransform: "uppercase",
            paddingBottom: 18, borderBottom: `1px solid ${C.line}`,
          }}>
            BOJAGI PROOF
          </div>

          {/* π value */}
          <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 16, alignItems: "baseline" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 16, color: C.dim }}>π =</span>
            <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 22, color: C.text }}>
              honk&#123;…&#125;
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.dim, letterSpacing: "0.14em" }}>
              Noir · Barretenberg · HonkVerifier
            </span>
          </div>

          {/* Statement */}
          <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.18em", color: C.dim, marginBottom: 6 }}>
              STATEMENT
            </div>
            <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 22, color: C.muted }}>
              "Holder meets eligibility threshold"
            </div>
          </div>

          {/* Private input — concealed */}
          <div style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.18em", color: C.dim, marginBottom: 6 }}>
                PRIVATE INPUT
              </div>
              <div style={{
                height: 16, width: 240,
                borderRadius: 5,
                background: `repeating-linear-gradient(90deg, ${C.burgundy} 0 10px, ${C.burgundyLo} 10px 20px)`,
              }} />
            </div>
            {/* Valid badge */}
            <div style={{
              padding: "8px 20px",
              borderRadius: 24, border: `1px solid rgba(40,120,60,0.6)`,
              background: "rgba(14,38,18,0.8)",
              fontFamily: FONT.mono, fontWeight: 600, fontSize: 12,
              letterSpacing: "0.14em", color: "#5ACB7A",
              opacity: c(tLocal, 2.6, 3.2),
            }}>
              ✓ &nbsp;VALID
            </div>
          </div>
        </div>
      </div>

      {/* Footer statement */}
      <div style={{
        position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center",
        fontFamily: FONT.display, fontStyle: "italic", fontSize: 28,
        color: C.muted, opacity: statementP,
      }}>
        The value never leaves.
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Verification Boundary (14–19 s) ────────────────────────────────
const SceneBoundary: React.FC<{ t: number }> = ({ t }) => {
  const op = window(t, S[3], 0.5, S[4] - 0.4);
  const tLocal = t - S[3]; // 0..5

  const headlineP = c(tLocal, 0,   0.6);
  const proofP    = c(tLocal, 0.3, 1.0);
  const gateLineP = c(tLocal, 1.0, 1.8);
  const arrowP    = c(tLocal, 1.6, 2.0);
  const govP      = c(tLocal, 2.2, 2.9);
  const lendP     = c(tLocal, 2.5, 3.2);

  const GATE_Y = 452;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Headline */}
      <div style={{ position: "absolute", left: 80, top: 80 }}>
        <div style={{
          fontFamily: FONT.display, fontWeight: 700, fontSize: 58,
          color: C.text, opacity: headlineP,
          transform: `translateX(${(1 - headlineP) * -30}px)`,
        }}>
          Eligibility verified.
        </div>
        <div style={{
          fontFamily: FONT.display, fontWeight: 700, fontSize: 58,
          color: C.burgundy, opacity: headlineP,
          transform: `translateX(${(1 - headlineP) * -30}px)`,
        }}>
          Access granted.
        </div>
      </div>

      {/* BOJAGI proof card descending */}
      <div style={{
        position: "absolute",
        left: W / 2 - 340,
        top: 160 + (1 - proofP) * -60,
        width: 680, opacity: proofP,
      }}>
        <div style={{
          borderRadius: 10,
          background: `linear-gradient(160deg, ${C.surface}, ${C.ink2})`,
          border: `1px solid rgba(184,26,52,0.45)`,
          padding: "22px 28px",
        }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.2em", color: C.wine, marginBottom: 10 }}>
            BOJAGI PROOF
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 20, color: C.text, marginBottom: 8 }}>
            π = honk&#123;…&#125;
          </div>
          <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 18, color: C.dim, marginBottom: 8 }}>
            "Holder meets eligibility threshold"
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, color: C.dim, letterSpacing: "0.14em" }}>
            VALUE: <span style={{
              display: "inline-block", width: 160, height: 12, verticalAlign: "middle",
              background: `repeating-linear-gradient(90deg, ${C.burgundy} 0 8px, ${C.burgundyLo} 8px 16px)`,
              borderRadius: 3,
            }} />
          </div>
        </div>
      </div>

      {/* Arrow + Gate */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Arrow from proof to gate */}
        <line
          x1={W / 2} y1={360}
          x2={W / 2} y2={GATE_Y - 22}
          stroke={C.burgundy} strokeWidth={2}
          opacity={arrowP}
        />
        <polygon
          points={`${W / 2 - 8},${GATE_Y - 24} ${W / 2 + 8},${GATE_Y - 24} ${W / 2},${GATE_Y - 8}`}
          fill={C.burgundy} opacity={arrowP}
        />
        {/* Gate line */}
        <line
          x1={120} y1={GATE_Y}
          x2={120 + (W - 240) * gateLineP} y2={GATE_Y}
          stroke={C.burgundy} strokeWidth={3}
        />
        {/* Branch lines from gate down */}
        <line x1={W / 2} y1={GATE_Y} x2={W / 2} y2={GATE_Y + 60} stroke={C.burgundy} strokeWidth={2} opacity={govP} />
        <line x1={W / 2} y1={GATE_Y + 60} x2={W / 2 - 310} y2={GATE_Y + 60} stroke={C.burgundy} strokeWidth={2} opacity={govP} />
        <line x1={W / 2} y1={GATE_Y + 60} x2={W / 2 + 310} y2={GATE_Y + 60} stroke={C.burgundy} strokeWidth={2} opacity={lendP} />
        <line x1={W / 2 - 310} y1={GATE_Y + 60} x2={W / 2 - 310} y2={GATE_Y + 100} stroke={C.burgundy} strokeWidth={2} opacity={govP} />
        <line x1={W / 2 + 310} y1={GATE_Y + 60} x2={W / 2 + 310} y2={GATE_Y + 100} stroke={C.burgundy} strokeWidth={2} opacity={lendP} />
      </svg>

      {/* VERIFICATION BOUNDARY pill */}
      <div style={{
        position: "absolute",
        left: W / 2 - 188, top: GATE_Y - 22,
        width: 376, height: 44,
        borderRadius: 22, background: C.burgundy,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT.mono, fontWeight: 600, fontSize: 12,
        letterSpacing: "0.24em", color: C.text, textTransform: "uppercase",
        opacity: gateLineP,
      }}>
        VERIFICATION &nbsp;BOUNDARY
      </div>

      {/* GOVERNANCE card */}
      <div style={{
        position: "absolute",
        left: W / 2 - 560,
        top: GATE_Y + 100 + (1 - govP) * 30,
        width: 480, opacity: govP,
      }}>
        <BranchCard
          tag="POLICY 04"
          title="Governance"
          lines={["Direct DAO authorization.", "Vote on proposals."]}
          authorized
        />
      </div>

      {/* LENDING card */}
      <div style={{
        position: "absolute",
        left: W / 2 + 80,
        top: GATE_Y + 100 + (1 - lendP) * 30,
        width: 480, opacity: lendP,
      }}>
        <BranchCard
          tag="POLICY 03 + BOJAGI"
          title="Lending"
          lines={["Protected lending authorization.", "ZK proof required."]}
          authorized
        />
      </div>
    </AbsoluteFill>
  );
};

// Branch card sub-component
const BranchCard: React.FC<{
  tag: string; title: string; lines: string[]; authorized: boolean;
}> = ({ tag, title, lines, authorized }) => (
  <div style={{
    borderRadius: 12,
    background: `linear-gradient(160deg, rgba(26,18,18,0.96), ${C.ink2})`,
    border: `2px solid ${C.burgundy}`,
    padding: "22px 26px 20px",
  }}>
    <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.22em", color: C.burgundy, marginBottom: 10 }}>
      {tag}
    </div>
    <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 38, color: C.text, marginBottom: 10 }}>
      {title}
    </div>
    {lines.map((l, i) => (
      <div key={i} style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 18, color: C.dim, lineHeight: 1.5 }}>
        {l}
      </div>
    ))}
    {authorized && (
      <div style={{
        marginTop: 16,
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 16px", borderRadius: 20,
        border: "1px solid rgba(40,120,60,0.5)",
        background: "rgba(14,38,18,0.7)",
        fontFamily: FONT.mono, fontWeight: 600, fontSize: 11,
        letterSpacing: "0.14em", color: "#5ACB7A",
      }}>
        ✓ &nbsp;AUTHORIZED
      </div>
    )}
  </div>
);

// ─── Scene 5: Policy 04 — Governance (19–23 s) ───────────────────────────────
const SceneGovernance: React.FC<{ t: number }> = ({ t }) => {
  const op = window(t, S[4], 0.5, S[5] - 0.4);
  const tLocal = t - S[4]; // 0..4

  const numP     = c(tLocal, 0,   0.6);
  const panelP   = c(tLocal, 0.3, 0.9);
  const rowsP    = c(tLocal, 0.8, 1.6);
  const tallyP   = c(tLocal, 1.8, 2.6);
  const approveP = c(tLocal, 2.2, 2.8);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Left: Giant "04" */}
      <div style={{
        position: "absolute", left: 60, top: H / 2 - 260,
        fontFamily: FONT.display, fontWeight: 700, fontSize: 420,
        color: C.burgundyLo, lineHeight: 1,
        opacity: 0.38 * numP,
        transform: `scale(${0.85 + numP * 0.15})`,
      }}>
        04
      </div>

      {/* Left labels */}
      <div style={{ position: "absolute", left: 80, top: 120, opacity: numP }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: "0.26em", color: C.burgundy }}>
          POLICY
        </div>
        <div style={{ width: 300, height: 2, background: C.burgundy, margin: "10px 0 14px" }} />
        <div style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 22, color: C.muted }}>
          Direct DAO Governance
        </div>
      </div>

      {/* Right: Governance panel */}
      <div style={{
        position: "absolute",
        left: 620, top: 80,
        width: 1220,
        opacity: panelP,
        transform: `translateX(${(1 - panelP) * 40}px)`,
      }}>
        <div style={{
          borderRadius: 12,
          background: `linear-gradient(160deg, rgba(22,18,16,0.97), ${C.ink2})`,
          border: `1px solid rgba(80,50,46,0.5)`,
          overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{
            padding: "16px 28px",
            background: "rgba(30,24,20,0.9)",
            borderBottom: `1px solid rgba(80,50,46,0.4)`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 13, letterSpacing: "0.24em", color: C.muted }}>
              GYEVO &nbsp;·&nbsp; GOVERNANCE
            </div>
            <div style={{
              padding: "5px 16px", borderRadius: 20,
              border: "1px solid rgba(40,120,60,0.5)",
              background: "rgba(14,38,18,0.7)",
              fontFamily: FONT.mono, fontWeight: 600, fontSize: 11,
              letterSpacing: "0.14em", color: "#5ACB7A",
            }}>
              ✓ &nbsp;ELIGIBLE
            </div>
          </div>

          <div style={{ padding: "0 28px 28px" }}>
            {/* Voter identity — concealed */}
            <div style={{
              padding: "18px 0", borderBottom: `1px solid ${C.line}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              opacity: rowsP,
            }}>
              <div>
                <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color: C.dim, marginBottom: 8 }}>
                  VOTER IDENTITY
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 28, letterSpacing: "0.08em", color: C.dim }}>
                  ●●●●●●●●●●●●●●●●
                </div>
              </div>
              <div style={{
                padding: "5px 16px", borderRadius: 20,
                border: `1px solid ${C.burgundyLo}`,
                background: "rgba(26,18,18,0.8)",
                fontFamily: FONT.mono, fontSize: 11,
                letterSpacing: "0.14em", color: C.burgundy,
              }}>
                CONCEALED
              </div>
            </div>

            {/* Proposal */}
            <div style={{
              padding: "20px 0", borderBottom: `1px solid ${C.line}`,
              opacity: rowsP,
            }}>
              <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 14, letterSpacing: "0.2em", color: C.text, marginBottom: 10 }}>
                PROPOSAL #1
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: 24, color: C.text, lineHeight: 1.4, marginBottom: 10 }}>
                Activate BOJAGI-protected lending<br />
                on Policy 03 collateral pools.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 13, color: C.dim, letterSpacing: "0.1em" }}>
                Chain 46630 &nbsp;·&nbsp; Quorum threshold met
              </div>
            </div>

            {/* Vote buttons */}
            <div style={{
              padding: "20px 0", borderBottom: `1px solid ${C.line}`,
              display: "flex", gap: 16, alignItems: "center",
              opacity: rowsP,
            }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color: C.dim, width: 110 }}>
                CAST VOTE
              </div>
              {[["APPROVE", true], ["REJECT", false], ["ABSTAIN", false]].map(([label, active]) => (
                <div key={label as string} style={{
                  flex: 1, padding: "18px", borderRadius: 8, textAlign: "center",
                  background: active ? C.burgundy : "transparent",
                  border: active ? "none" : `1px solid rgba(80,50,46,0.5)`,
                  fontFamily: FONT.display, fontWeight: 700, fontSize: 22,
                  color: active ? C.text : C.dim,
                  opacity: active ? 1 : 0.7,
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Tally */}
            <div style={{ padding: "20px 0", opacity: tallyP }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color: C.dim, marginBottom: 14 }}>
                FINAL TALLY &nbsp;·&nbsp; PROPOSAL EXECUTED
              </div>
              {/* Bar */}
              <div style={{ height: 20, borderRadius: 4, background: "rgba(40,30,28,0.8)", overflow: "hidden", marginBottom: 10 }}>
                <div style={{
                  height: "100%",
                  width: `${tallyP * 100}%`,
                  background: C.burgundy,
                  borderRadius: 4,
                  maxWidth: "100%",
                }} />
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontFamily: FONT.mono, fontSize: 14, letterSpacing: "0.12em",
              }}>
                <span style={{ color: C.muted }}>2 FOR</span>
                <span style={{ color: C.dim }}>0 AGAINST</span>
                <span style={{ color: "#5ACB7A", opacity: approveP }}>✓ APPROVED &amp; EXECUTED</span>
              </div>
            </div>

            {/* Testnet footer */}
            <div style={{
              paddingTop: 16, borderTop: `1px solid ${C.line}`,
              fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.16em",
              color: C.dim, opacity: rowsP,
            }}>
              Robinhood Testnet &nbsp;·&nbsp; Chain 46630 &nbsp;·&nbsp; Test tokens only &nbsp;·&nbsp; Not audited
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6: Final Ident (23–28 s) ──────────────────────────────────────────
const SceneIdent: React.FC<{ t: number }> = ({ t }) => {
  const op = fadeIn(t, S[5], 0.6); // stays to end
  const tLocal = t - S[5]; // 0..5

  const sealP   = c(tLocal, 0,   0.8);
  const logP    = c(tLocal, 0.6, 1.4);
  const tagP    = c(tLocal, 1.2, 2.0);
  const footP   = c(tLocal, 1.8, 2.4);

  // Orbit rings
  const rings = [180, 280, 380, 480, 580, 680];

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Concentric orbit ellipses */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {rings.map((r, i) => {
          const ringP = c(tLocal, i * 0.08, 0.6 + i * 0.08);
          return (
            <ellipse key={i}
              cx={W / 2} cy={H / 2 - 40}
              rx={r} ry={r * 0.55}
              fill="none"
              stroke={C.burgundy}
              strokeWidth={0.8}
              opacity={ringP * (0.35 - i * 0.05)}
            />
          );
        })}
      </svg>

      {/* Seal mark */}
      <div style={{
        position: "absolute",
        left: W / 2 - 60, top: H / 2 - 330,
        width: 120, height: 120,
        opacity: sealP,
        transform: `rotate(${(1 - sealP) * 15}deg) scale(${0.6 + sealP * 0.4})`,
      }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={56} fill="none" stroke={C.burgundy} strokeWidth={2} />
          <circle cx={60} cy={60} r={44} fill="none" stroke={C.burgundyLo} strokeWidth={1} />
          {/* Arc segments suggesting motion */}
          <path d="M 60,20 A 40,40 0 0 1 100,60" fill="none" stroke={C.text} strokeWidth={2.5} strokeLinecap="round" />
          <path d="M 100,60 A 40,40 0 0 1 60,100" fill="none" stroke={C.burgundyLo} strokeWidth={2.5} strokeLinecap="round" />
          <path d="M 60,100 A 40,40 0 0 1 20,60" fill="none" stroke={C.text} strokeWidth={2.5} strokeLinecap="round" />
          <path d="M 20,60 A 40,40 0 0 1 60,20" fill="none" stroke={C.burgundyLo} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={60} cy={60} r={7} fill={C.burgundy} />
        </svg>
      </div>

      {/* GYEVO wordmark */}
      <div style={{
        position: "absolute",
        left: 0, top: H / 2 - 170, width: W, textAlign: "center",
        fontFamily: FONT.display, fontWeight: 700, fontSize: 240,
        color: C.text, lineHeight: 1,
        opacity: logP,
        transform: `scale(${0.92 + logP * 0.08})`,
      }}>
        GYEVO
      </div>

      {/* Tagline */}
      <div style={{
        position: "absolute",
        left: 0, top: H / 2 + 108, width: W, textAlign: "center",
        fontFamily: FONT.display, fontStyle: "italic", fontSize: 34,
        color: C.muted, letterSpacing: "0.06em",
        opacity: tagP,
      }}>
        Private. &nbsp;Authorized. &nbsp;Onchain.
      </div>

      {/* Rules around tagline */}
      {[84, 154].map((offset) => (
        <div key={offset} style={{
          position: "absolute",
          left: W / 2 - 480, top: H / 2 + offset,
          width: 960 * tagP, height: 1,
          background: `rgba(80,50,46,0.5)`,
        }} />
      ))}

      {/* Footer attribution */}
      <div style={{
        position: "absolute", bottom: 52, left: 0, right: 0, textAlign: "center",
        fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.28em",
        color: C.dim, textTransform: "uppercase", opacity: footP,
      }}>
        DOJANG &nbsp;·&nbsp; BOJAGI &nbsp;·&nbsp; ON-CHAIN AUTHORIZATION
      </div>
    </AbsoluteFill>
  );
};

// ─── Slat transition between scenes ──────────────────────────────────────────
const SceneSlat: React.FC<{ t: number; at: number; color?: string }> = ({
  t, at, color = C.burgundy,
}) => {
  const COUNT = 9;
  const inDur = 0.18, holdDur = 0.08, outDur = 0.18;
  const totalDur = inDur + holdDur + outDur;

  if (t < at - 0.05 || t > at + totalDur + 0.05) return null;

  const slats = Array.from({ length: COUNT }, (_, i) => {
    const delay = i * 0.012;
    const inP  = c(t, at + delay, at + delay + inDur);
    const outP = c(t, at + delay + inDur + holdDur, at + delay + inDur + holdDur + outDur);
    const h = Math.round(H / COUNT);
    return (
      <div key={i} style={{
        position: "absolute",
        left: 0, top: i * h, width: W, height: h + 1,
        background: color,
        transform: `scaleX(${inP * (1 - outP)})`,
        transformOrigin: i % 2 === 0 ? "left" : "right",
      }} />
    );
  });

  return <div style={{ position: "absolute", inset: 0, zIndex: 100 }}>{slats}</div>;
};

// ─── Master Composition ───────────────────────────────────────────────────────
export const LaunchV3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <DarkGround t={t} />

      <SceneIdentity   t={t} />
      <SceneDojang     t={t} />
      <SceneBojagi     t={t} />
      <SceneBoundary   t={t} />
      <SceneGovernance t={t} />
      <SceneIdent      t={t} />

      {/* Scene slat wipes at each boundary */}
      <SceneSlat t={t} at={S[1] - 0.22} />
      <SceneSlat t={t} at={S[2] - 0.22} />
      <SceneSlat t={t} at={S[3] - 0.22} />
      <SceneSlat t={t} at={S[4] - 0.22} />
      <SceneSlat t={t} at={S[5] - 0.22} />

      {/* Persistent header — chain indicator */}
      <NetworkHeader
        stage="LAUNCH"
        action="CHAIN 46630"
        t={t}
      />

      <Grain opacity={0.07} />
      <Vignette strength={0.55} />

      {/* Disclosure footer */}
      <div style={{
        position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center",
        fontFamily: FONT.mono, fontSize: 9, letterSpacing: "0.16em",
        color: "rgba(255,255,255,0.2)", opacity: t > 3 ? 1 : 0,
      }}>
        {DISCLOSURE}
      </div>
    </AbsoluteFill>
  );
};
