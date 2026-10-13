import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DISCLOSURE, FONT, H, W } from "../lib/theme";
import { Grain } from "../lib/Brand";
import {
  CameraRig,
  CinematicAtmosphere,
  KineticTitle,
  NetworkHeader,
  TelemetryBadge,
  curve,
  lin,
  pulseHit,
} from "../lib/cinematic";

/**
 * Monumental 3D Governance Monolith (Proposal #1 Legislative Chamber)
 */
const GovernanceMonolith: React.FC<{
  t: number;
  votesFor: number;
  quorum: number;
  executed: boolean;
  finalized: boolean;
  scale?: number;
}> = ({ t, votesFor, quorum, executed, finalized, scale = 1 }) => {
  const quorumPercent = Math.min(100, (votesFor / quorum) * 100);
  const execPulse = executed ? pulseHit(t, [16.8, 17.2, 17.8]) : 0;

  return (
    <div
      style={{
        position: "relative",
        width: 580,
        height: 620,
        transform: `scale(${scale})`,
        transformStyle: "preserve-3d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 3D Legislative Slab Monolith */}
      <div
        style={{
          position: "relative",
          width: 520,
          height: 520,
          borderRadius: "28px",
          background: "linear-gradient(155deg, rgba(28, 16, 22, 0.95) 0%, rgba(10, 6, 8, 0.98) 100%)",
          border: `2px solid ${executed ? "#FF3E65" : finalized ? "#E7A552" : "rgba(255, 255, 255, 0.18)"}`,
          boxShadow: executed
            ? "0 0 120px rgba(184, 26, 52, 0.65), inset 0 0 60px rgba(109, 0, 26, 0.5)"
            : "0 40px 100px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          overflow: "hidden",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          padding: "36px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Monolith Header Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 12,
                height: 12,
                background: executed ? "#FF3E65" : "#E7A552",
                boxShadow: `0 0 12px ${executed ? "#FF3E65" : "#E7A552"}`,
                borderRadius: "2px",
              }}
            />
            <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: "0.22em", color: C.white, fontWeight: 700 }}>
              DAO PROPOSAL #1
            </span>
          </div>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: "6px",
              background: executed
                ? "rgba(255, 62, 101, 0.25)"
                : finalized
                ? "rgba(231, 165, 82, 0.25)"
                : "rgba(255, 255, 255, 0.08)",
              border: `1px solid ${executed ? "#FF3E65" : finalized ? "#E7A552" : "rgba(255, 255, 255, 0.2)"}`,
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: executed ? "#FF738B" : finalized ? "#F2BC72" : "rgba(255, 255, 255, 0.7)",
            }}
          >
            {executed ? "EXECUTED ON-CHAIN" : finalized ? "FINALIZED · READY TO EXECUTE" : "VOTING ACTIVE"}
          </div>
        </div>

        {/* Proposal Legislative Parameter Target */}
        <div style={{ margin: "20px 0" }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase" }}>
            ON-CHAIN PARAMETER MODIFICATION
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: 32, fontWeight: 800, color: C.white, marginTop: 4, lineHeight: 1.15 }}>
            minimumRemainingValidity
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 14, color: "rgba(255, 255, 255, 0.4)", textDecoration: "line-through" }}>
              0s
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 18, color: C.wine }}>→</span>
            <span style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: executed ? "#10B981" : C.white }}>
              3600 <span style={{ fontSize: 20, fontFamily: FONT.mono, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>SECONDS</span>
            </span>
          </div>
        </div>

        {/* Quorum Progress Bar & Metric HUD */}
        <div style={{ background: "rgba(0, 0, 0, 0.5)", borderRadius: "14px", padding: "18px 20px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.16em", color: "rgba(255, 255, 255, 0.7)" }}>
              CONSENSUS QUORUM
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 700, color: quorumPercent >= 100 ? "#10B981" : C.white }}>
              {votesFor} / {quorum} VOTES ({quorumPercent.toFixed(0)}%)
            </span>
          </div>
          {/* Progress track */}
          <div style={{ width: "100%", height: 10, background: "rgba(255, 255, 255, 0.1)", borderRadius: "5px", overflow: "hidden" }}>
            <div
              style={{
                width: `${quorumPercent}%`,
                height: "100%",
                background: quorumPercent >= 100 ? "linear-gradient(90deg, #B81A34, #10B981)" : "linear-gradient(90deg, #6D001A, #B81A34)",
                boxShadow: "0 0 15px rgba(184, 26, 52, 0.8)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Monolith Footer Details */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 14 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }}>
            POLICY: <span style={{ color: C.white, fontWeight: 600 }}>04 (PROJECT CREDENTIAL)</span>
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }}>
            CHAIN: <span style={{ color: C.white, fontWeight: 600 }}>ROBINHOOD 46630</span>
          </div>
        </div>

        {/* MEMORABLE "EXECUTED" OVERLAY STAMP */}
        {executed && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 50% 50%, rgba(109, 0, 26, 0.85) 0%, rgba(14, 10, 12, 0.95) 80%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 30,
              animation: "none",
            }}
          >
            <div
              style={{
                padding: "16px 42px",
                borderRadius: "16px",
                border: "3px solid #10B981",
                background: "rgba(16, 185, 129, 0.2)",
                boxShadow: "0 0 50px rgba(16, 185, 129, 0.6), inset 0 0 30px rgba(16, 185, 129, 0.2)",
                transform: `rotate(-4deg) scale(${1 + execPulse * 0.1})`,
                textAlign: "center",
              }}
            >
              <div style={{ fontFamily: FONT.display, fontSize: 48, fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.08em" }}>
                EXECUTED
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: "#34D399", letterSpacing: "0.2em", marginTop: 4 }}>
                PROTOCOL STATE COMMITTED
              </div>
            </div>
            <div style={{ marginTop: 20, fontFamily: FONT.mono, fontSize: 13, color: "rgba(255,255,255,0.8)", letterSpacing: "0.14em" }}>
              minimumRemainingValidity = 3600s
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: FONT.mono,
          fontSize: 13,
          letterSpacing: "0.22em",
          color: "rgba(255, 255, 255, 0.8)",
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: executed ? "#10B981" : C.wine, boxShadow: "0 0 10px #FF3E65" }} />
        ROBINHOOD GOVERNANCE PHASE 1
      </div>
    </div>
  );
};

/**
 * 3D Dojang Credential Stamp (Policy 04 Governance Key)
 */
const Policy04CredentialKey: React.FC<{
  t: number;
  active: boolean;
}> = ({ t, active }) => {
  return (
    <div
      style={{
        position: "relative",
        width: 320,
        height: 380,
        transformStyle: "preserve-3d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 3D Dojang Geometric Seal */}
      <div
        style={{
          position: "relative",
          width: 250,
          height: 250,
          borderRadius: "28px",
          background: "linear-gradient(135deg, #2A151C 0%, #0E0A0C 80%)",
          border: "2px solid rgba(184, 26, 52, 0.7)",
          boxShadow: "0 0 60px rgba(184, 26, 52, 0.4), inset 0 0 30px rgba(184, 26, 52, 0.2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `rotate(${Math.sin(t * 2) * 5}deg)`,
        }}
      >
        <svg width="210" height="210" viewBox="0 0 210 210" style={{ position: "absolute", inset: 20 }}>
          <polygon
            points="105,10 190,55 190,155 105,200 20,155 20,55"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
          />
          <circle cx="105" cy="105" r="75" fill="none" stroke={C.wine} strokeWidth="2" strokeDasharray="8 8" />
        </svg>

        <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: "0.24em", color: "#FFAAB8", fontWeight: 700 }}>
          DOJANG
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 48, fontWeight: 900, color: C.white, lineHeight: 1 }}>
          04
        </div>
        <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.14em", color: "#10B981", marginTop: 4 }}>
          PROJECT CREDENTIAL
        </div>
        <div
          style={{
            marginTop: 10,
            padding: "3px 8px",
            background: "rgba(0,0,0,0.6)",
            borderRadius: "4px",
            border: "1px solid rgba(255,255,255,0.15)",
            fontFamily: FONT.mono,
            fontSize: 9,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          DIRECT DAO ACCESS
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: "0.2em",
          color: "rgba(255, 255, 255, 0.7)",
          textTransform: "uppercase",
        }}
      >
        AUTHENTICATED VOTER
      </div>
    </div>
  );
};

export const Governance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Sound sync volume
  const volume = (f: number) => Math.min(lin(f / fps, 0, 0.6), 1 - lin(f / fps, 25.2, 26)) * 0.72;

  // CAMERA CHOREOGRAPHY
  // 0.0 - 3.2s: Editorial hook
  // 3.2 - 7.5s: Proposal #1 creation
  // 7.5 - 13.5s: Two public votes cast (Voter A @ 8.8s, Voter B @ 11.2s)
  // 13.5 - 18.5s: Finalization & Execution moment
  // 18.5 - 22.5s: Full governance causality overview
  // 22.5 - 26.0s: Brand outro
  const camX = interpolate(
    t,
    [0, 3.2, 7.5, 9.5, 12.0, 14.5, 17.0, 19.5, 22.5, 26],
    [0, -140, 100, 0, 0, 0, 0, 0, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camY = interpolate(
    t,
    [0, 3.2, 7.5, 9.5, 12.0, 14.5, 17.0, 19.5, 22.5, 26],
    [-60, -10, 0, -10, 0, -10, 10, -30, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camZ = interpolate(
    t,
    [0, 3.2, 7.5, 9.5, 12.0, 14.5, 17.0, 19.5, 22.5, 26],
    [-140, 40, 80, 20, 40, 100, 140, -100, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camRotY = interpolate(
    t,
    [0, 3.2, 7.5, 9.5, 12.0, 14.5, 17.0, 19.5, 22.5, 26],
    [0, 8, -6, 0, 0, -4, 0, 0, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camRotX = interpolate(
    t,
    [0, 3.2, 7.5, 9.5, 12.0, 14.5, 17.0, 19.5, 22.5, 26],
    [8, 2, 0, 0, 0, -2, 4, 6, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Genuine testnet facts state progression
  // Vote 1 (Wallet A) cast at 8.8s (Block 134177434)
  // Vote 2 (Wallet B) cast at 11.2s (Block 134177554)
  // Finalized at 14.5s (Block 134201149)
  // Executed at 16.8s (Block 134201316)
  const votesFor = t < 8.8 ? 0 : t < 11.2 ? 1 : 2;
  const finalized = t >= 14.5;
  const executed = t >= 16.8;

  let currentStageName = "PUBLIC GOVERNANCE ENGINE";
  let currentAction = "POLICY 04 AUTHENTICATED";
  let currentBlock: number | undefined = undefined;
  let currentTx: string | undefined = undefined;

  if (t >= 3.2 && t < 7.5) {
    currentStageName = "01 / PROPOSAL CREATION";
    currentAction = "PROPOSAL #1 CREATED";
    currentBlock = 134163042;
    currentTx = "0x3bf437acbc75e6d8ff3363023ef571902263b47acae6342002c91e35aec4de09";
  } else if (t >= 7.5 && t < 10.0) {
    currentStageName = "02 / FIRST PUBLIC VOTE";
    currentAction = "WALLET A VOTED FOR";
    currentBlock = 134177434;
    currentTx = "0x9274914c40b45ef6d775119844046c81d8a89dc1e0509c39613febb81cb86a91";
  } else if (t >= 10.0 && t < 13.5) {
    currentStageName = "03 / SECOND PUBLIC VOTE";
    currentAction = "WALLET B VOTED FOR (QUORUM 2/2)";
    currentBlock = 134177554;
    currentTx = "0xa0cf87e60b0afdf3ec5439ce5855401b95a8179b8572fa3dfc639c8f73a328c5";
  } else if (t >= 13.5 && t < 16.8) {
    currentStageName = "04 / FINALIZATION";
    currentAction = "PROPOSAL FINALIZED (2 FOR / 0 AGAINST)";
    currentBlock = 134201149;
    currentTx = "0xd19e13a0c3e64cd3f3a62d8f2a57d6ebed54edbeb81e0a6ef23ef34e9426719d";
  } else if (t >= 16.8 && t < 22.5) {
    currentStageName = "05 / EXECUTION & RULE CHANGE";
    currentAction = "EXECUTED: 3600s VALIDITY LAW";
    currentBlock = 134201316;
    currentTx = "0x7e41f98e2357d342186dbcd384435b9141ffdcf67c867fa0f5a16eb9aa18cdc4";
  }

  const endCardOpacity = curve(t, 22.3, 23.2) * (1 - lin(t, 25.6, 26));

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden", fontFamily: FONT.display }}>
      <Audio src={staticFile("audio/mixkit-close-up-michael-ramir-c.mp3")} volume={volume} />

      <CinematicAtmosphere t={t} glowColor="#8F1332" glowIntensity={0.7} gridSpeed={12} accentX={50} />

      {t < 22.3 && (
        <NetworkHeader
          stage={currentStageName}
          action={currentAction}
          block={currentBlock}
          txHash={currentTx}
          t={t}
        />
      )}

      <CameraRig
        x={camX}
        y={camY}
        z={camZ}
        rotateX={camRotX}
        rotateY={camRotY}
        perspective={1200}
      >
        {/* ACT 0: HOOK (0.0s - 3.2s) */}
        {t < 3.5 && (
          <div
            style={{
              position: "absolute",
              left: 100,
              top: 240,
              zIndex: 30,
              opacity: 1 - lin(t, 2.7, 3.2),
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <TelemetryBadge label="GOVERNANCE DOCTRINE" value="PUBLIC ON-CHAIN ACTION" highlight />
            </div>
            <KineticTitle
              lines={[
                { text: "TRUST IS ENFORCED", color: C.white, size: 110 },
                { text: "THROUGH PUBLIC ACTION.", color: C.wine, accent: true, size: 112 },
              ]}
              t={t}
              baseDelay={0.08}
            />
            <div
              style={{
                marginTop: 26,
                fontFamily: FONT.mono,
                fontSize: 21,
                letterSpacing: "0.2em",
                color: "rgba(247, 243, 244, 0.75)",
                textTransform: "uppercase",
                opacity: curve(t, 0.5, 1.1),
              }}
            >
              PROJECT CREDENTIALS · PUBLIC VOTING · ON-CHAIN EXECUTION
            </div>
          </div>
        )}

        {/* 3D GOVERNANCE MACHINERY STAGE */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 1400,
            height: 640,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 60,
            transformStyle: "preserve-3d",
            opacity: curve(t, 2.6, 3.4) * (1 - curve(t, 22.0, 22.8)),
          }}
        >
          {/* Left: Policy 04 Credential Key or Voter A Ballot */}
          {t < 13.5 && (
            <div
              style={{
                transform: "translate3d(-20px, 0, 20px)",
                opacity: curve(t, 2.8, 3.8) * (1 - curve(t, 12.8, 13.5)),
              }}
            >
              {t < 7.5 ? (
                <Policy04CredentialKey t={t} active={true} />
              ) : (
                <div
                  style={{
                    width: 280,
                    background: "rgba(14, 10, 12, 0.95)",
                    border: "1px solid rgba(255, 62, 101, 0.6)",
                    borderRadius: "16px",
                    padding: "20px",
                    boxShadow: "0 0 40px rgba(184, 26, 52, 0.4)",
                  }}
                >
                  <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em" }}>
                    VOTER 1 · WALLET A
                  </div>
                  <div style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: "#10B981", marginTop: 4 }}>
                    VOTE: FOR
                  </div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
                    BLK #134177434 · POLICY 04
                  </div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 9, color: C.wine, marginTop: 4 }}>
                    TX: 0x9274914c...cb86a91
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Center: Monumental Governance Monolith */}
          <div style={{ transform: "translate3d(0, 0, 40px)" }}>
            <GovernanceMonolith
              t={t}
              votesFor={votesFor}
              quorum={2}
              executed={executed}
              finalized={finalized}
              scale={1}
            />
          </div>

          {/* Right: Voter B Ballot */}
          {t >= 9.5 && t < 13.5 && (
            <div
              style={{
                transform: "translate3d(20px, 0, 20px)",
                opacity: curve(t, 9.5, 10.4),
              }}
            >
              <div
                style={{
                  width: 280,
                  background: "rgba(14, 10, 12, 0.95)",
                  border: "1px solid rgba(16, 185, 129, 0.6)",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 0 40px rgba(16, 185, 129, 0.35)",
                }}
              >
                <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em" }}>
                  VOTER 2 · WALLET B
                </div>
                <div style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: "#10B981", marginTop: 4 }}>
                  VOTE: FOR
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
                  BLK #134177554 · POLICY 04
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 9, color: "#34D399", marginTop: 4 }}>
                  TX: 0xa0cf87e6...73a328c5
                </div>
              </div>
            </div>
          )}

          {/* Incoming Public Vote Vector Laser Beams */}
          {t >= 8.6 && t < 10.0 && (
            <svg
              width="600"
              height="100"
              style={{
                position: "absolute",
                left: 150,
                top: 280,
                overflow: "visible",
                pointerEvents: "none",
              }}
            >
              <line
                x1="0"
                y1="50"
                x2="350"
                y2="50"
                stroke="#FF3E65"
                strokeWidth="8"
                strokeDasharray="400"
                strokeDashoffset={400 * (1 - curve(t, 8.6, 9.2))}
              />
              <circle cx="350" cy="50" r="10" fill="#FFFFFF" />
            </svg>
          )}

          {t >= 11.0 && t < 12.4 && (
            <svg
              width="600"
              height="100"
              style={{
                position: "absolute",
                right: 150,
                top: 280,
                overflow: "visible",
                pointerEvents: "none",
              }}
            >
              <line
                x1="350"
                y1="50"
                x2="0"
                y2="50"
                stroke="#10B981"
                strokeWidth="8"
                strokeDasharray="400"
                strokeDashoffset={400 * (1 - curve(t, 11.0, 11.6))}
              />
              <circle cx="0" cy="50" r="10" fill="#FFFFFF" />
            </svg>
          )}
        </div>
      </CameraRig>

      {/* FIXED SCREEN-SPACE EDITORIAL SUBTITLES */}
      {t >= 2.8 && t < 22.0 && (
        <div
          style={{
            position: "absolute",
            left: 80,
            bottom: 75,
            zIndex: 45,
            maxWidth: 860,
            pointerEvents: "none",
          }}
        >
          {t >= 2.8 && t < 7.5 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Proposal #1 Created On-Chain.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Targeting minimumRemainingValidity = 3600s · Initiated by authorized Policy 04 credential holder
              </div>
            </div>
          )}

          {t >= 7.5 && t < 13.5 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Two Public Votes Reach Full Quorum.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Wallet A (Block 134177434) and Wallet B (Block 134177554) vote For · 2/2 Quorum achieved on-chain
              </div>
            </div>
          )}

          {t >= 13.5 && t < 16.8 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Voting Concluded & Finalized.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Proposal finalized at Block 134201149 with 2 For / 0 Against · Awaiting execution trigger
              </div>
            </div>
          )}

          {t >= 16.8 && t < 22.0 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Proposal Executed: 3600s Rule Active.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Block 134201316 permanently commits protocol rule · Credentials now require 3600s minimum validity
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCREEN-SPACE GOVERNANCE HUD */}
      {t >= 3.2 && t < 22.0 && (
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 125,
            width: 360,
            background: "rgba(14, 10, 12, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "18px",
            padding: "20px",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FFAAB8", fontWeight: 700 }}>
              DAO TALLY FEED
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              QUORUM: 2
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>VOTES FOR:</span>
              <span style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 800, color: "#10B981" }}>{votesFor}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>VOTES AGAINST:</span>
              <span style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>0</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>STATUS:</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: executed ? "#10B981" : finalized ? "#F2BC72" : C.white }}>
                {executed ? "EXECUTED" : finalized ? "FINALIZED" : "ACTIVE"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CINEMATIC CONCLUSION (22.2s - 26.0s) */}
      {t >= 22.0 && (
        <AbsoluteFill
          style={{
            opacity: endCardOpacity,
            background: "radial-gradient(circle at 50% 45%, #1C0C14 0%, #060405 75%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              transform: `scale(${0.92 + curve(t, 22.2, 23.5) * 0.08})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div style={{ position: "relative", marginBottom: 32 }}>
              <div
                style={{
                  position: "absolute",
                  inset: -28,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(184, 26, 52, 0.5) 0%, transparent 70%)",
                  filter: "blur(16px)",
                }}
              />
              <Img src={staticFile("logo.svg")} style={{ width: 130, height: 130, position: "relative" }} />
            </div>

            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 84,
                fontWeight: 800,
                color: C.white,
                letterSpacing: "-0.04em",
                lineHeight: 1.05,
              }}
            >
              Rules define the path.
              <br />
              <span style={{ color: C.wine }}>People shape what follows.</span>
            </div>

            <div
              style={{
                marginTop: 30,
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 32px",
                borderRadius: "999px",
                border: "1px solid rgba(184, 26, 52, 0.55)",
                background: "rgba(109, 0, 26, 0.4)",
                fontFamily: FONT.mono,
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: "0.22em",
                color: C.white,
                boxShadow: "0 0 30px rgba(184, 26, 52, 0.3)",
              }}
            >
              GYEVO.TECH
            </div>

            <div
              style={{
                position: "absolute",
                bottom: -115,
                fontFamily: FONT.mono,
                fontSize: 13,
                letterSpacing: "0.14em",
                color: "rgba(247, 243, 244, 0.5)",
                textTransform: "uppercase",
                maxWidth: 920,
                lineHeight: 1.6,
              }}
            >
              {DISCLOSURE}
            </div>
          </div>
        </AbsoluteFill>
      )}

      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};
