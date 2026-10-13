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
 * Monumental 3D Client Witness Enclave (Act 1)
 * A massive, physical cryptographic vault chamber holding the Dojang credential and private witness.
 */
const WitnessEnclaveVault: React.FC<{
  t: number;
  fold: number;
}> = ({ t, fold }) => {
  const contentOpacity = Math.max(0, 1 - fold * 1.5);
  const pulse = pulseHit(t, [4.0, 5.5, 7.0]);

  return (
    <div
      style={{
        position: "relative",
        width: 620,
        height: 600,
        transformStyle: "preserve-3d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Outer 3D Holographic Diagnostic Ring */}
      <div
        style={{
          position: "absolute",
          inset: -30,
          borderRadius: "44px",
          border: "1px dashed rgba(184, 26, 52, 0.4)",
          transform: `rotate(${t * 6}deg)`,
          pointerEvents: "none",
        }}
      />

      {/* Monumental Carbon & Glass Vault Monolith */}
      <div
        style={{
          position: "relative",
          width: 560,
          height: 540,
          borderRadius: "32px",
          background: "linear-gradient(155deg, rgba(32, 16, 24, 0.96) 0%, rgba(12, 7, 10, 0.98) 100%)",
          border: "2px solid rgba(184, 26, 52, 0.65)",
          boxShadow: `0 40px 100px rgba(0, 0, 0, 0.95), 0 0 ${40 + pulse * 30}px rgba(184, 26, 52, 0.4), inset 0 0 60px rgba(109, 0, 26, 0.35)`,
          padding: "36px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          opacity: contentOpacity,
          transform: `scale(${1 - fold * 0.2})`,
        }}
      >
        {/* Monolith Header Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#10B981",
                boxShadow: "0 0 12px #10B981",
              }}
            />
            <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: "0.22em", color: C.white, fontWeight: 700 }}>
              CLIENT ENCLAVE · ISOLATED
            </span>
          </div>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: "6px",
              background: "rgba(184, 26, 52, 0.25)",
              border: "1px solid rgba(184, 26, 52, 0.55)",
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "#FFAAB8",
            }}
          >
            OFF-CHAIN ENVIRONMENT
          </div>
        </div>

        {/* Credential Seal & Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, margin: "14px 0" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "18px",
              background: "linear-gradient(135deg, #2A151C 0%, #0E0A0C 100%)",
              border: "2px solid rgba(184, 26, 52, 0.7)",
              boxShadow: "0 0 25px rgba(184, 26, 52, 0.4)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.18em", color: "#FFAAB8", fontWeight: 700 }}>DOJANG</span>
            <span style={{ fontFamily: FONT.display, fontSize: 26, fontWeight: 900, color: C.white }}>03</span>
            <span style={{ fontFamily: FONT.mono, fontSize: 8, color: "#10B981", letterSpacing: "0.1em" }}>ACTIVE</span>
          </div>

          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.16em", color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase" }}>
              AUTHENTICATED PROJECT CREDENTIAL
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 800, color: C.white, marginTop: 2 }}>
              Dojang Issuer Credential
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255, 255, 255, 0.6)", marginTop: 4 }}>
              CHAIN 46630 · POLICY 03 · ED25519 SIGNATURE VALID
            </div>
          </div>
        </div>

        {/* Two Structured Cryptographic Parameter Matrices */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Public Verification Criterion */}
          <div
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              borderRadius: "14px",
              padding: "16px 18px",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.18em", color: "#34D399", textTransform: "uppercase" }}>
                PUBLIC CRITERION (POLICY 03)
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: C.white, marginTop: 4 }}>
                THRESHOLD ≥ $1,000 USD
              </div>
            </div>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.2)",
                fontFamily: FONT.mono,
                fontSize: 11,
                fontWeight: 700,
                color: "#10B981",
                letterSpacing: "0.1em",
              }}
            >
              CRITERION MET
            </div>
          </div>

          {/* Sensitive Private Witness Fields */}
          <div
            style={{
              background: "rgba(184, 26, 52, 0.14)",
              borderRadius: "14px",
              padding: "16px 18px",
              border: "1px solid rgba(184, 26, 52, 0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.18em", color: "#FFAAB8", textTransform: "uppercase" }}>
                PRIVATE WITNESS (SECRET MEMORY)
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: "#FF738B", fontWeight: 700 }}>
                NEVER LEAKS TO PUBLIC
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.06em" }}>
                BALANCE: [CONCEALED / PRIVATE]
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                SALT: 0x9f8c47b2...e241
              </span>
            </div>
          </div>
        </div>

        {/* Footer Audit Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 14 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }}>
            WITNESS STATUS: <span style={{ color: "#10B981", fontWeight: 600 }}>LOCALLY BOUND</span>
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }}>
            PROVER ENGINE: <span style={{ color: C.white, fontWeight: 600 }}>ULTRAHONK READY</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Monumental 3D Bojagi Cryptographic Folding Mechanism (Act 2)
 * A dramatic 3D geometric origami structure with multi-faceted metallic plates that physically
 * fold in 3D perspective around the secret witness, transforming it into an opaque commitment polyhedron.
 */
const BojagiOrigamiMonument: React.FC<{
  t: number;
  fold: number; // 0 (open/blooming) to 1 (tightly sealed)
}> = ({ t, fold }) => {
  const foldAngle = fold * 82; // degrees folding inward
  const foldDistance = (1 - fold) * 120; // facet separation distance
  const pulse = pulseHit(t, [9.0, 10.4, 11.5]);

  return (
    <div
      style={{
        position: "relative",
        width: 640,
        height: 640,
        transformStyle: "preserve-3d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Dynamic 3D Gyroscope Gimbal Rings */}
      <div
        style={{
          position: "absolute",
          inset: 40,
          borderRadius: "50%",
          border: `2px solid ${fold > 0.8 ? "#FF3E65" : "rgba(184, 26, 52, 0.35)"}`,
          boxShadow: fold > 0.8 ? "0 0 50px rgba(184, 26, 52, 0.6)" : "none",
          transform: `rotate(${t * 18}deg)`,
          transition: "border 0.3s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 70,
          borderRadius: "50%",
          border: "1px dashed rgba(255, 255, 255, 0.2)",
          transform: `rotate(${-t * 24}deg)`,
        }}
      />

      {/* Central Cryptographic Commitment Core Sphere */}
      <div
        style={{
          position: "relative",
          width: 300,
          height: 300,
          borderRadius: fold > 0.7 ? "50%" : "36px",
          background: fold > 0.7
            ? "radial-gradient(circle at 35% 35%, #6D001A 0%, #1A080E 65%, #050304 100%)"
            : "linear-gradient(135deg, #241117 0%, #0C0608 100%)",
          border: `2px solid ${fold > 0.7 ? "#FF3E65" : "rgba(184, 26, 52, 0.7)"}`,
          boxShadow: fold > 0.7
            ? `0 0 ${70 + pulse * 50}px rgba(184, 26, 52, 0.9), inset 0 0 50px rgba(184, 26, 52, 0.6)`
            : "0 25px 60px rgba(0, 0, 0, 0.85)",
          transformStyle: "preserve-3d",
          transform: `scale(${0.9 + fold * 0.2}) rotate(${t * 8}deg)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: "absolute", inset: 30 }}>
          <circle cx="120" cy="120" r="100" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="6 6" />
          <circle cx="120" cy="120" r="68" fill="none" stroke={C.wine} strokeWidth="2" strokeDasharray="14 10" />
          <polygon
            points="120,25 202,72 202,168 120,215 38,168 38,72"
            fill="none"
            stroke={fold > 0.7 ? "#FF738B" : "rgba(255, 255, 255, 0.25)"}
            strokeWidth="1.5"
          />
        </svg>

        {fold > 0.6 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              zIndex: 20,
              transform: `rotate(${-t * 8}deg)`, // counter-rotate text
            }}
          >
            <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.24em", color: "#FFAAB8", fontWeight: 700 }}>
              BOJAGI
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 36, fontWeight: 900, color: C.white, lineHeight: 1.1 }}>
              SEALED
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.14em", color: "#10B981", marginTop: 4 }}>
              COMMITMENT C_cm
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              Hash(witness, salt)
            </div>
          </div>
        )}
      </div>

      {/* 3D Folding Origami Facet Plates (North, South, East, West + Diagonals) */}
      {/* North Plate */}
      <div
        style={{
          position: "absolute",
          top: 30 - foldDistance * 0.8,
          width: 260,
          height: 150,
          background: "linear-gradient(180deg, rgba(46, 20, 28, 0.96) 0%, rgba(18, 10, 14, 0.96) 100%)",
          border: "2px solid rgba(255, 255, 255, 0.25)",
          borderRadius: "20px 20px 0 0",
          transformOrigin: "bottom center",
          transform: `perspective(800px) rotateX(${foldAngle}deg)`,
          transformStyle: "preserve-3d",
          boxShadow: "0 -15px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 15,
        }}
      >
        <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FFAAB8", fontWeight: 600 }}>
          ORIGAMI FACET · N
        </span>
      </div>

      {/* South Plate */}
      <div
        style={{
          position: "absolute",
          bottom: 30 - foldDistance * 0.8,
          width: 260,
          height: 150,
          background: "linear-gradient(0deg, rgba(46, 20, 28, 0.96) 0%, rgba(18, 10, 14, 0.96) 100%)",
          border: "2px solid rgba(255, 255, 255, 0.25)",
          borderRadius: "0 0 20px 20px",
          transformOrigin: "top center",
          transform: `perspective(800px) rotateX(${-foldAngle}deg)`,
          transformStyle: "preserve-3d",
          boxShadow: "0 15px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 15,
        }}
      >
        <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FFAAB8", fontWeight: 600 }}>
          ORIGAMI FACET · S
        </span>
      </div>

      {/* West Plate */}
      <div
        style={{
          position: "absolute",
          left: 30 - foldDistance * 0.8,
          width: 150,
          height: 260,
          background: "linear-gradient(90deg, rgba(46, 20, 28, 0.96) 0%, rgba(18, 10, 14, 0.96) 100%)",
          border: "2px solid rgba(255, 255, 255, 0.25)",
          borderRadius: "20px 0 0 20px",
          transformOrigin: "right center",
          transform: `perspective(800px) rotateY(${-foldAngle}deg)`,
          transformStyle: "preserve-3d",
          boxShadow: "-15px 0 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 15,
        }}
      >
        <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FFAAB8", fontWeight: 600, transform: "rotate(-90deg)" }}>
          FACET · W
        </span>
      </div>

      {/* East Plate */}
      <div
        style={{
          position: "absolute",
          right: 30 - foldDistance * 0.8,
          width: 150,
          height: 260,
          background: "linear-gradient(270deg, rgba(46, 20, 28, 0.96) 0%, rgba(18, 10, 14, 0.96) 100%)",
          border: "2px solid rgba(255, 255, 255, 0.25)",
          borderRadius: "0 20px 20px 0",
          transformOrigin: "left center",
          transform: `perspective(800px) rotateY(${foldAngle}deg)`,
          transformStyle: "preserve-3d",
          boxShadow: "15px 0 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 15,
        }}
      >
        <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FFAAB8", fontWeight: 600, transform: "rotate(90deg)" }}>
          FACET · E
        </span>
      </div>
    </div>
  );
};

/**
 * Monumental 3D On-Chain Verifier Prism (Act 3)
 * Represents the public EligibilityVerifierAdapter contract on Robinhood Chain 46630.
 */
const OnChainVerifierPrism: React.FC<{
  t: number;
  verified: boolean;
}> = ({ t, verified }) => {
  const verifyPulse = verified ? pulseHit(t, [14.4, 15.0, 15.8]) : 0;

  return (
    <div
      style={{
        position: "relative",
        width: 480,
        height: 520,
        transformStyle: "preserve-3d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 3D Verifier Monolith Container */}
      <div
        style={{
          position: "relative",
          width: 450,
          height: 480,
          borderRadius: "28px",
          background: "linear-gradient(155deg, rgba(20, 16, 26, 0.96) 0%, rgba(8, 6, 12, 0.98) 100%)",
          border: `2px solid ${verified ? "#10B981" : "rgba(255, 255, 255, 0.2)"}`,
          boxShadow: verified
            ? `0 0 ${90 + verifyPulse * 60}px rgba(16, 185, 129, 0.7), inset 0 0 50px rgba(16, 185, 129, 0.3)`
            : "0 40px 100px rgba(0, 0, 0, 0.95)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        {/* Monolith Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "2px",
                background: verified ? "#10B981" : C.wine,
                boxShadow: `0 0 12px ${verified ? "#10B981" : C.wine}`,
              }}
            />
            <span style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.22em", color: C.white, fontWeight: 700 }}>
              ON-CHAIN VERIFIER
            </span>
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: verified ? "rgba(16, 185, 129, 0.25)" : "rgba(255, 255, 255, 0.08)",
              border: `1px solid ${verified ? "#10B981" : "rgba(255, 255, 255, 0.2)"}`,
              fontFamily: FONT.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: verified ? "#34D399" : "rgba(255, 255, 255, 0.7)",
            }}
          >
            {verified ? "PROOF ACCEPTED" : "AWAITING PROOF π_zk"}
          </div>
        </div>

        {/* Contract Title & Metadata */}
        <div style={{ margin: "14px 0" }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.18em", color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase" }}>
            ROBINHOOD TESTNET CONTRACT
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: C.white, marginTop: 4 }}>
            EligibilityVerifierAdapter
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255, 255, 255, 0.6)", marginTop: 4 }}>
            CHAIN ID: <span style={{ color: "#FFAAB8", fontWeight: 700 }}>46630</span> · ULTRAHONK ZK-SNARK
          </div>
        </div>

        {/* Verification Check Feed */}
        <div style={{ background: "rgba(0, 0, 0, 0.55)", borderRadius: "14px", padding: "16px 18px", border: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              KZG/HONK PAIRING CHECK:
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: verified ? "#10B981" : "rgba(255,255,255,0.4)" }}>
              {verified ? "e(A,B) == e(C,D) · VALID" : "STANDBY"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              PUBLIC INPUT VERIFICATION:
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: verified ? "#10B981" : "rgba(255,255,255,0.4)" }}>
              {verified ? "THRESHOLD MATCH · OK" : "PENDING"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              PRIVATE DATA EXPOSURE:
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: "#10B981" }}>
              0 BYTES LEAKED
            </span>
          </div>
        </div>

        {/* Monolith Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 12 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255, 255, 255, 0.5)" }}>
            STATUS: <span style={{ color: verified ? "#10B981" : C.white, fontWeight: 700 }}>{verified ? "AUTHENTICATED" : "READY"}</span>
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255, 255, 255, 0.5)" }}>
            GAS CONSUMED: <span style={{ color: C.white, fontWeight: 600 }}>284,119 GAS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Monumental 3D Architectural Route Bifurcation (Act 4)
 * Wide isometric perspective showing both protocol routes:
 * Upper Route: Policy 04 -> Direct DAO Governance (no ZK proof required in Phase 1)
 * Lower Route: Policy 03 -> Bojagi ZK Proof -> Lending V2 Pool
 */
const RouteBifurcationChamber: React.FC<{
  t: number;
}> = ({ t }) => {
  const draw = curve(t, 16.8, 18.2);
  const pulseA = pulseHit(t, [18.2, 19.5, 20.4]);
  const pulseB = pulseHit(t, [18.6, 19.9, 20.8]);

  return (
    <div
      style={{
        position: "relative",
        width: 1260,
        height: 580,
        transformStyle: "preserve-3d",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Central Origin Node: One Trust Foundation */}
      <div
        style={{
          width: 340,
          background: "linear-gradient(135deg, rgba(32, 18, 24, 0.96) 0%, rgba(14, 10, 12, 0.98) 100%)",
          border: "2px solid rgba(184, 26, 52, 0.65)",
          borderRadius: "26px",
          padding: "28px",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.9), inset 0 0 40px rgba(109, 0, 26, 0.35)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.wine, boxShadow: "0 0 10px #B81A34" }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.22em", color: "#FFAAB8", fontWeight: 700 }}>
            ONE TRUST LAYER
          </span>
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 36, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
          GYEVO CORE
        </div>
        <div style={{ fontFamily: FONT.mono, fontSize: 12, color: "rgba(255, 255, 255, 0.65)", letterSpacing: "0.06em", lineHeight: 1.5 }}>
          Project Credentials & Cryptographic Verification Enforced On-Chain
        </div>
        <div
          style={{
            marginTop: 6,
            padding: "8px 12px",
            background: "rgba(0,0,0,0.6)",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.12)",
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          TWO POLICY ARCHITECTURES
        </div>
      </div>

      {/* SVG Connecting Conduits with animated branching and pulse packets */}
      <svg
        width="340"
        height="500"
        viewBox="0 0 340 500"
        style={{
          position: "absolute",
          left: 330,
          top: 40,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <defs>
          <linearGradient id="conduit-upper" x1="0" y1="250" x2="330" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFAAB8" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <linearGradient id="conduit-lower" x1="0" y1="250" x2="330" y2="380" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFAAB8" />
            <stop offset="100%" stopColor="#B81A34" />
          </linearGradient>
        </defs>
        {/* Upper branch line */}
        <path
          d="M 10 250 C 140 250, 180 120, 330 120"
          fill="none"
          stroke="url(#conduit-upper)"
          strokeWidth="6"
          strokeDasharray="450"
          strokeDashoffset={450 * (1 - draw)}
        />
        {/* Lower branch line */}
        <path
          d="M 10 250 C 140 250, 180 380, 330 380"
          fill="none"
          stroke="url(#conduit-lower)"
          strokeWidth="6"
          strokeDasharray="450"
          strokeDashoffset={450 * (1 - draw)}
        />
      </svg>

      {/* Two Terminal Destinations */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 640 }}>
        {/* Route A: POLICY 04 -> DIRECT DAO GOVERNANCE */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(28, 16, 24, 0.96) 0%, rgba(12, 8, 12, 0.98) 100%)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "22px",
            padding: "24px 28px",
            boxShadow: `0 20px 50px rgba(0, 0, 0, 0.85), 0 0 ${pulseA * 30}px rgba(255, 255, 255, 0.4)`,
            opacity: draw,
            transform: `translateX(${(1 - draw) * 50}px)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FFAAB8", fontWeight: 700 }}>
              POLICY 04 · DIRECT ACCESS
            </span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: "#10B981",
                padding: "3px 8px",
                borderRadius: "6px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                fontWeight: 700,
              }}
            >
              NO ZK PROOF NEEDED (PHASE 1)
            </span>
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: 32, fontWeight: 800, color: C.white, marginTop: 6 }}>
            DIRECT DAO GOVERNANCE
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, color: "rgba(255, 255, 255, 0.7)", marginTop: 4, lineHeight: 1.45 }}>
            Project credential directly authenticates voting power & proposal execution on-chain.
          </div>
        </div>

        {/* Route B: POLICY 03 -> BOJAGI ZK PROOF -> LENDING POOL V2 */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(40, 14, 24, 0.96) 0%, rgba(16, 6, 10, 0.98) 100%)",
            border: "2px solid rgba(184, 26, 52, 0.8)",
            borderRadius: "22px",
            padding: "24px 28px",
            boxShadow: `0 20px 60px rgba(184, 26, 52, 0.4), 0 0 ${pulseB * 35}px rgba(184, 26, 52, 0.6)`,
            opacity: draw,
            transform: `translateX(${(1 - draw) * 50}px)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FF738B", fontWeight: 700 }}>
              POLICY 03 · PRIVACY-PRESERVING
            </span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: "#FF3E65",
                padding: "3px 8px",
                borderRadius: "6px",
                background: "rgba(255, 62, 101, 0.2)",
                border: "1px solid rgba(255, 62, 101, 0.5)",
                fontWeight: 700,
              }}
            >
              ULTRAHONK PROOF REQUIRED
            </span>
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: 32, fontWeight: 800, color: C.white, marginTop: 6 }}>
            BOJAGI ZK → LENDING POOL V2
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, color: "rgba(255, 255, 255, 0.7)", marginTop: 4, lineHeight: 1.45 }}>
            Collateral enabling & borrowing are strictly proof-gated. Sensitive balance witness stays private.
          </div>
        </div>
      </div>
    </div>
  );
};

export const Protocol: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Sound sync volume
  const volume = (f: number) => Math.min(lin(f / fps, 0, 0.6), 1 - lin(f / fps, 23.2, 24)) * 0.72;

  // CAMERA CHOREOGRAPHY
  // 0.0 - 3.2s: Monumental Editorial Hook (Wide & Push)
  // 3.2 - 7.8s: Centered Focus on Client Witness Enclave Monolith
  // 7.8 - 12.8s: Centered Focus on Bojagi 3D Origami Folding Monument
  // 12.8 - 16.8s: Spatial Camera Track from Client Enclave across Boundary Wall to Verifier Prism
  // 16.8 - 21.0s: Dramatic Isometric Pullback for Route Bifurcation
  // 21.0 - 24.0s: Brand resolution
  const camX = interpolate(
    t,
    [0, 3.2, 5.5, 7.8, 10.5, 12.8, 14.8, 16.8, 18.5, 21.0, 24.0],
    [0, 0, 0, 0, 0, -220, 240, 0, 0, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camY = interpolate(
    t,
    [0, 3.2, 5.5, 7.8, 10.5, 12.8, 14.8, 16.8, 18.5, 21.0, 24.0],
    [-40, 0, 0, 0, 0, 0, 0, -20, -20, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camZ = interpolate(
    t,
    [0, 3.2, 5.5, 7.8, 10.5, 12.8, 14.8, 16.8, 18.5, 21.0, 24.0],
    [-120, 40, 40, 80, 100, 40, 60, -140, -140, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camRotY = interpolate(
    t,
    [0, 3.2, 5.5, 7.8, 10.5, 12.8, 14.8, 16.8, 18.5, 21.0, 24.0],
    [0, 0, 0, 2, 0, 8, -6, 0, 0, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camRotX = interpolate(
    t,
    [0, 3.2, 5.5, 7.8, 10.5, 12.8, 14.8, 16.8, 18.5, 21.0, 24.0],
    [6, 0, 0, 0, 0, 0, 0, 6, 6, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // States across time
  const fold = curve(t, 7.8, 10.6);
  const verified = t >= 14.2;

  // Proof transmission beam progress (from Bojagi fold apex to verifier prism)
  const proofTravel = curve(t, 12.4, 14.2);

  let currentStageName = "CRYPTOGRAPHIC PROTOCOL ENGINE";
  let currentAction = "PRIVATE ELIGIBILITY · PUBLIC EXECUTION";
  let currentBlock: number | undefined = undefined;
  let currentTx: string | undefined = undefined;

  if (t >= 3.2 && t < 7.8) {
    currentStageName = "01 / CLIENT WITNESS ENCLAVE";
    currentAction = "PROJECT CREDENTIAL LOADED";
    currentBlock = 134177300;
  } else if (t >= 7.8 && t < 12.8) {
    currentStageName = "02 / BOJAGI ORIGAMI FOLDING";
    currentAction = "WITNESS CONCEALED · PROOF GENERATION";
  } else if (t >= 12.8 && t < 16.8) {
    currentStageName = "03 / PUBLIC BOUNDARY CROSSING";
    currentAction = "PROOF VERIFIED ON-CHAIN (CHAIN 46630)";
    currentBlock = 134177400;
    currentTx = "0x5d92a18f40b45ef6d775119844046c81d8a89dc1e0509c39613febb81cb86a91";
  } else if (t >= 16.8 && t < 21.0) {
    currentStageName = "04 / ROUTE BIFURCATION";
    currentAction = "POLICY 04 (DAO) vs POLICY 03 (LENDING)";
  }

  const endCardOpacity = curve(t, 20.8, 21.6) * (1 - lin(t, 23.6, 24));

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden", fontFamily: FONT.display }}>
      <Audio src={staticFile("audio/mixkit-echoes-andrew-ev.mp3")} volume={volume} />

      <CinematicAtmosphere t={t} glowColor="#6D001A" glowIntensity={0.65} gridSpeed={14} accentX={45} />

      {t < 20.8 && (
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
        {/* ACT 0: EDITORIAL HOOK (0.0s - 3.2s) */}
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
              <TelemetryBadge label="CRYPTOGRAPHIC PREREQUISITE" value="ROBINHOOD TESTNET 46630" highlight />
            </div>
            <KineticTitle
              lines={[
                { text: "PRIVATE ELIGIBILITY.", color: C.white, size: 108 },
                { text: "PUBLIC EXECUTION.", color: C.wine, accent: true, size: 110 },
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
              AUTHENTICATE CREDENTIALS PRIVATELY · EXECUTE ACTIONS ON-CHAIN
            </div>
          </div>
        )}

        {/* ACT 1: CLIENT WITNESS ENCLAVE (3.2s - 7.8s) */}
        {t >= 2.8 && t < 7.8 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              opacity: curve(t, 2.8, 3.6),
            }}
          >
            <WitnessEnclaveVault t={t} fold={0} />
          </div>
        )}

        {/* ACT 2: BOJAGI 3D ORIGAMI FOLDING (7.8s - 12.8s) */}
        {t >= 7.6 && t < 12.8 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              opacity: curve(t, 7.6, 8.2),
            }}
          >
            <BojagiOrigamiMonument t={t} fold={fold} />
          </div>
        )}

        {/* ACT 3: PUBLIC BOUNDARY CROSSING & ON-CHAIN VERIFICATION (12.4s - 16.8s) */}
        {t >= 12.4 && t < 16.8 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 1260,
              height: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transformStyle: "preserve-3d",
              opacity: curve(t, 12.4, 13.0),
            }}
          >
            {/* Left: Sealed Bojagi Commitment (Off-Chain Client) */}
            <div style={{ transform: "scale(0.8)" }}>
              <BojagiOrigamiMonument t={t} fold={1} />
            </div>

            {/* Monumental Boundary Energy Partition */}
            <div
              style={{
                position: "relative",
                width: 8,
                height: 520,
                background: "linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.3) 20%, rgba(184, 26, 52, 0.9) 50%, rgba(255, 255, 255, 0.3) 80%, transparent)",
                boxShadow: "0 0 35px rgba(184, 26, 52, 0.7)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -130,
                  top: 15,
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                }}
              >
                OFF-CHAIN (CLIENT)
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 20,
                  top: 15,
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "#FFAAB8",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                PUBLIC CHAIN (46630)
              </div>
            </div>

            {/* Right: On-Chain Verifier Prism */}
            <div>
              <OnChainVerifierPrism t={t} verified={verified} />
            </div>

            {/* High-Energy Proof Capsule Laser Flight across Boundary */}
            {t >= 12.5 && t < 14.8 && (
              <svg
                width="1260"
                height="100"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 250,
                  overflow: "visible",
                  pointerEvents: "none",
                  zIndex: 50,
                }}
              >
                <line
                  x1="220"
                  y1="50"
                  x2={220 + proofTravel * 640}
                  y2="50"
                  stroke="#FF3E65"
                  strokeWidth="8"
                  filter="drop-shadow(0 0 12px #FF3E65)"
                />
                <line
                  x1="220"
                  y1="50"
                  x2={220 + proofTravel * 640}
                  y2="50"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                />
                <circle
                  cx={220 + proofTravel * 640}
                  cy="50"
                  r="15"
                  fill="#FFFFFF"
                  filter="drop-shadow(0 0 25px #FF3E65)"
                />
                <text
                  x={220 + proofTravel * 640}
                  y="26"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontFamily={FONT.mono}
                  fontSize="12"
                  fontWeight="700"
                  letterSpacing="2"
                >
                  π_zk PROOF
                </text>
              </svg>
            )}
          </div>
        )}

        {/* ACT 4: ARCHITECTURAL ROUTE BIFURCATION (16.8s - 21.0s) */}
        {t >= 16.5 && t < 21.2 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              opacity: curve(t, 16.5, 17.2) * (1 - curve(t, 20.6, 21.2)),
            }}
          >
            <RouteBifurcationChamber t={t} />
          </div>
        )}
      </CameraRig>

      {/* FIXED SCREEN-SPACE EDITORIAL SUBTITLES */}
      {t >= 2.8 && t < 20.8 && (
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
          {t >= 2.8 && t < 7.8 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                A Private Fact Takes Form in Enclave.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Project-issued Dojang credential stores sensitive balance witness securely on the client
              </div>
            </div>
          )}

          {t >= 7.8 && t < 12.8 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Bojagi Folds Secret Into Cryptographic Proof.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Multi-faceted origami plates seal the commitment · UltraHonk ZK prover compiles compact proof π_zk
              </div>
            </div>
          )}

          {t >= 12.8 && t < 16.8 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Only The Proof Crosses The Boundary.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Robinhood Chain 46630 verifies cryptographic validity · Sensitive balance and salt never leave enclave
              </div>
            </div>
          )}

          {t >= 16.8 && t < 20.8 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Two Distinct Execution Architectures.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Policy 04 enables direct public DAO governance · Policy 03 gates private lending pool access via ZK proof
              </div>
            </div>
          )}
        </div>
      )}

      {/* FIXED SCREEN-SPACE CRYPTOGRAPHIC TELEMETRY HUD */}
      {t >= 3.2 && t < 20.8 && (
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
              PROOF TELEMETRY
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              CHAIN: 46630
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>PROVER:</span>
              <span style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 800, color: C.white }}>ULTRAHONK ZK</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>WITNESS PRIVACY:</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: "#10B981" }}>0 BYTES LEAKED</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>ON-CHAIN STATUS:</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: verified ? "#10B981" : fold > 0.8 ? "#FF3E65" : "rgba(255,255,255,0.4)" }}>
                {verified ? "VERIFIED VALID" : fold > 0.8 ? "PROOF READY" : "ENCLAVE ACTIVE"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CINEMATIC CONCLUSION (20.8s - 24.0s) */}
      {t >= 20.8 && (
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
              transform: `scale(${0.92 + curve(t, 20.8, 22.2) * 0.08})`,
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
              Verify the fact.
              <br />
              <span style={{ color: C.wine }}>Prove it privately.</span>
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
