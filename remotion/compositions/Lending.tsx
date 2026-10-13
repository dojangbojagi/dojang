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
 * Monumental 3D Liquidity Cylinder (The Capital Reserve Core)
 */
const MonumentalLiquidityCore: React.FC<{
  level: number; // 0 to 100
  t: number;
  highlight: boolean;
  scale?: number;
}> = ({ level, t, highlight, scale = 1 }) => {
  const fillHeight = Math.max(16, (level / 100) * 350);
  const pulse = Math.sin(t * 5);

  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 520,
        transform: `scale(${scale})`,
        transformStyle: "preserve-3d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Outer Heavy Structural Chassis */}
      <div
        style={{
          position: "relative",
          width: 320,
          height: 450,
          borderRadius: "32px",
          background: "linear-gradient(165deg, rgba(32, 18, 24, 0.9) 0%, rgba(10, 6, 8, 0.98) 100%)",
          border: `2px solid ${highlight ? "rgba(255, 62, 101, 0.85)" : "rgba(255, 255, 255, 0.16)"}`,
          boxShadow: highlight
            ? "0 0 80px rgba(184, 26, 52, 0.5), inset 0 0 50px rgba(109, 0, 26, 0.6)"
            : "0 35px 80px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          overflow: "hidden",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Metric Rulers / Tick System */}
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 35,
            bottom: 35,
            width: 28,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            opacity: 0.6,
            zIndex: 10,
          }}
        >
          {[100, 80, 60, 40, 20, 0].map((v) => (
            <div key={v} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: v % 50 === 0 ? 12 : 7, height: 2, background: C.white }} />
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.white, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Luminous Liquid Volume Core */}
        <div
          style={{
            position: "absolute",
            left: 55,
            right: 32,
            bottom: 26,
            height: fillHeight,
            borderRadius: "18px",
            background: "linear-gradient(to top, #4A0011 0%, #8F1332 30%, #B81A34 70%, #FF3E65 100%)",
            boxShadow: "0 0 45px rgba(255, 62, 101, 0.7), inset 0 0 25px rgba(255, 255, 255, 0.3)",
            overflow: "hidden",
          }}
        >
          {/* Surface Meniscus Wave */}
          <div
            style={{
              position: "absolute",
              top: -5,
              left: "-30%",
              width: "160%",
              height: 18,
              background: "rgba(255, 255, 255, 0.8)",
              borderRadius: "50%",
              filter: "blur(3px)",
              transform: `translateX(${pulse * 20}px)`,
            }}
          />
          {/* Rising bubbles / capital energy particles */}
          {Array.from({ length: 5 }, (_, i) => {
            const by = (t * 70 + i * 55) % Math.max(25, fillHeight);
            const bx = 16 + ((i * 37) % 180);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  bottom: by,
                  left: bx,
                  width: 4 + (i % 3) * 2,
                  height: 4 + (i % 3) * 2,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.7)",
                  boxShadow: "0 0 8px #FFF",
                }}
              />
            );
          })}
        </div>

        {/* Top & Bottom Reactor Rings */}
        <svg width="320" height="450" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <ellipse cx="175" cy="40" rx="115" ry="20" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2" />
          <ellipse cx="175" cy="40" rx="75" ry="12" fill="none" stroke={C.wine} strokeWidth="2.5" strokeDasharray="8 8" />
          <ellipse cx="175" cy="415" rx="115" ry="20" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" />
        </svg>

        {/* Diagonal Sheen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, 0.08) 45%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Hero Numeric Level */}
        <div
          style={{
            position: "absolute",
            bottom: 35,
            left: 60,
            right: 35,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            zIndex: 20,
          }}
        >
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)" }}>
              AVAILABLE SUPPLY
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 54,
                fontWeight: 800,
                color: C.white,
                lineHeight: 0.95,
                textShadow: "0 0 25px rgba(0,0,0,0.9)",
              }}
            >
              {level.toFixed(0)}
              <span style={{ fontSize: 20, fontFamily: FONT.mono, color: "#FFAAB8", marginLeft: 6 }}>
                rUSD2
              </span>
            </div>
          </div>
          <div
            style={{
              padding: "3px 8px",
              background: "rgba(0, 0, 0, 0.6)",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontFamily: FONT.mono,
              fontSize: 10,
              color: "#10B981",
            }}
          >
            ACTIVE
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: "0.2em",
          color: "rgba(255, 255, 255, 0.8)",
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.wine, boxShadow: "0 0 8px #FF3E65" }} />
        LIQUIDITY RESERVE V2
      </div>
    </div>
  );
};

/**
 * Monumental 3D Collateral Vault Iris & Magnetic Clamps
 */
const MonumentalCollateralVault: React.FC<{
  amount: number; // 0 to 10 rCOL2
  locked: boolean;
  enabled: boolean;
  t: number;
  scale?: number;
}> = ({ amount, locked, enabled, t, scale = 1 }) => {
  const clampAngle = locked ? 0 : 38;
  const statusColor = enabled ? "#10B981" : locked ? "#E7A552" : "#9CA3AF";

  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 520,
        transform: `scale(${scale})`,
        transformStyle: "preserve-3d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Outer Mechanical Iris Ring */}
      <div
        style={{
          position: "relative",
          width: 330,
          height: 330,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #22151B 0%, #0A0709 75%)",
          border: `3px solid ${enabled ? "#10B981" : locked ? "#E7A552" : "rgba(255, 255, 255, 0.2)"}`,
          boxShadow: enabled
            ? "0 0 80px rgba(16, 185, 129, 0.4), inset 0 0 50px rgba(16, 185, 129, 0.2)"
            : locked
            ? "0 0 75px rgba(231, 165, 82, 0.4), inset 0 0 40px rgba(231, 165, 82, 0.2)"
            : "0 35px 80px rgba(0, 0, 0, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Kinetic Concentric Rings */}
        <svg
          width="300"
          height="300"
          viewBox="0 0 300 300"
          style={{
            position: "absolute",
            inset: 15,
            transform: `rotate(${t * 14}deg)`,
          }}
        >
          <circle cx="150" cy="150" r="138" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeDasharray="5 12" />
          <circle cx="150" cy="150" r="115" fill="none" stroke={statusColor} strokeWidth="2.5" strokeDasharray="25 18" opacity="0.85" />
          <polygon
            points="150,55 230,105 230,195 150,245 70,195 70,105"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1.5"
          />
        </svg>

        {/* Heavy Calipers */}
        <div
          style={{
            position: "absolute",
            left: -15,
            width: 42,
            height: 120,
            borderRadius: "8px",
            background: locked ? "linear-gradient(90deg, #E7A552, #8C481B)" : "#1C1418",
            border: "1.5px solid rgba(255, 255, 255, 0.3)",
            transform: `rotate(${-clampAngle}deg)`,
            transformOrigin: "bottom right",
            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: locked ? "0 0 25px rgba(231, 165, 82, 0.6)" : "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -15,
            width: 42,
            height: 120,
            borderRadius: "8px",
            background: locked ? "linear-gradient(270deg, #E7A552, #8C481B)" : "#1C1418",
            border: "1.5px solid rgba(255, 255, 255, 0.3)",
            transform: `rotate(${clampAngle}deg)`,
            transformOrigin: "bottom left",
            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: locked ? "0 0 25px rgba(231, 165, 82, 0.6)" : "none",
          }}
        />

        {/* Center Display */}
        <div style={{ textAlign: "center", zIndex: 10 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)" }}>
            COLLATERAL DEPOSIT
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: 58, fontWeight: 800, color: C.white, lineHeight: 0.95 }}>
            {amount}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 700, color: statusColor, marginTop: 4 }}>
            rCOL2
          </div>
          <div
            style={{
              marginTop: 10,
              padding: "3px 10px",
              borderRadius: "5px",
              background: "rgba(0, 0, 0, 0.7)",
              border: `1px solid ${statusColor}`,
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              color: statusColor,
            }}
          >
            {enabled ? "ENABLED (ZK-PASS)" : locked ? "LOCKED IN VAULT" : "ZERO COLLATERAL"}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: "0.2em",
          color: "rgba(255, 255, 255, 0.8)",
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
        COLLATERAL BOUND VAULT
      </div>
    </div>
  );
};

/**
 * Heroic 3D Bojagi Cryptographic Origami & Laser Verification Conduit
 */
const HeroicBojagiOrigami: React.FC<{
  t: number;
  stage: number;
}> = ({ t, stage }) => {
  const fold = curve(t, 7.8, 8.8);
  const beam = curve(t, 8.5, 9.4);
  const verified = curve(t, 9.3, 9.9);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "47%",
        transform: "translate(-50%, -50%)",
        width: 520,
        height: 420,
        transformStyle: "preserve-3d",
        zIndex: 60,
      }}
    >
      {/* High-Intensity Laser Proof Emission Beam */}
      {beam > 0.05 && (
        <svg
          width="900"
          height="120"
          style={{
            position: "absolute",
            left: 230,
            top: 150,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <defs>
            <linearGradient id="hero-beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#B81A34" stopOpacity="0.1" />
              <stop offset="60%" stopColor="#FF3E65" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
            </linearGradient>
            <filter id="beam-bloom">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>
          <path
            d={`M 0 60 H ${beam * 680}`}
            stroke="url(#hero-beam)"
            strokeWidth="14"
            filter="url(#beam-bloom)"
          />
          <path d={`M 0 60 H ${beam * 680}`} stroke="#FFFFFF" strokeWidth="3.5" />
          <circle cx={beam * 680} cy="60" r={8 + 12 * Math.sin(t * 18)} fill="#FFFFFF" />
        </svg>
      )}

      {/* The Monumental 3D Origami Enclosure */}
      <div
        style={{
          position: "relative",
          width: 440,
          height: 340,
          margin: "0 auto",
          background: "linear-gradient(145deg, rgba(28, 14, 22, 0.96) 0%, rgba(10, 5, 8, 0.98) 100%)",
          border: `2px solid ${verified > 0.5 ? "#10B981" : "rgba(255, 62, 101, 0.7)"}`,
          borderRadius: "22px",
          boxShadow: verified > 0.5
            ? "0 0 90px rgba(16, 185, 129, 0.5), inset 0 0 45px rgba(16, 185, 129, 0.2)"
            : "0 0 80px rgba(184, 26, 52, 0.6), inset 0 0 35px rgba(109, 0, 26, 0.5)",
          display: "flex",
          flexDirection: "column",
          padding: "26px",
          transform: `rotateY(${-15 + fold * 28}deg) rotateX(${8 - fold * 10}deg)`,
          transformStyle: "preserve-3d",
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.14)", paddingBottom: 12 }}>
          <div>
            <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: "0.2em", color: "#FF738B", fontWeight: 700 }}>
              POLICY 03 / BOJAGI
            </span>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              ZERO-KNOWLEDGE WITNESS PROVER
            </div>
          </div>
          <span
            style={{
              padding: "4px 10px",
              background: verified > 0.5 ? "rgba(16, 185, 129, 0.25)" : "rgba(184, 26, 52, 0.35)",
              border: `1px solid ${verified > 0.5 ? "#10B981" : C.wine}`,
              borderRadius: "5px",
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 700,
              color: verified > 0.5 ? "#10B981" : C.white,
            }}
          >
            {verified > 0.5 ? "HONK VERIFIED ON-CHAIN" : "SYNTHESIZING PROOF"}
          </span>
        </div>

        {/* Private Witness Container (Transforms into Sealed Bojagi Fold) */}
        <div style={{ margin: "18px 0", flex: 1, position: "relative" }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
            PRIVATE ELIGIBILITY WITNESS (KEPT OFF-CHAIN)
          </div>
          <div
            style={{
              background: "rgba(0, 0, 0, 0.75)",
              border: "1px dashed rgba(255, 255, 255, 0.25)",
              borderRadius: "10px",
              padding: "14px 18px",
              fontFamily: FONT.mono,
              fontSize: 13,
              lineHeight: 1.5,
              color: "#FFAAB8",
            }}
          >
            <div>policy_threshold: ≥ 1000</div>
            <div>credential_salt: 0x9f8c...3e1a (SEALED)</div>
            <div>private_witness_value: [CONFIDENTIAL FACT]</div>
          </div>

          {/* Holographic Origami Concealment Plate */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(109, 0, 26, 0.95) 0%, rgba(184, 26, 52, 0.98) 100%)",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: `scaleY(${fold})`,
              transformOrigin: "top",
              opacity: fold,
              boxShadow: "0 0 35px rgba(184, 26, 52, 0.6)",
            }}
          >
            <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: "0.06em" }}>
              WITNESS FULLY CONCEALED
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, letterSpacing: "0.14em" }}>
              ZERO DATA LEAKED · PROOF VECTOR RELEASED
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            ROBINHOOD TESTNET · CHAIN 46630
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.white, fontWeight: 700 }}>
            {verified > 0.5 ? "ADAPTER: ELIGIBILITY_CONFIRMED" : "CONSTRUCTING PLONK/HONK WITNESS..."}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Screen-Space On-Chain Position Ledger HUD (Fixed Screen Coordinates)
 */
const ScreenSpaceLedgerHUD: React.FC<{
  walletASupply: number;
  walletBCollateral: number;
  walletBDebt: number;
  activeTx?: string;
  block?: number;
  opacity?: number;
}> = ({ walletASupply, walletBCollateral, walletBDebt, activeTx, block, opacity = 1 }) => {
  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        top: 125,
        width: 390,
        background: "rgba(14, 10, 12, 0.92)",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        borderRadius: "18px",
        padding: "20px",
        boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        opacity,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", color: "#FFAAB8", textTransform: "uppercase", fontWeight: 700 }}>
          ON-CHAIN POSITION LEDGER
        </div>
        <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
          {block ? `BLOCK #${block}` : "LIVE HEAD"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Wallet A Supply Position */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>
              WALLET A (SUPPLIER)
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 800, color: C.white }}>
              {walletASupply.toFixed(2)} <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: FONT.mono }}>rUSD2</span>
            </div>
          </div>
          <div
            style={{
              padding: "3px 8px",
              borderRadius: "4px",
              background: walletASupply > 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.06)",
              fontFamily: FONT.mono,
              fontSize: 10,
              fontWeight: 600,
              color: walletASupply > 0 ? "#10B981" : "rgba(255,255,255,0.4)",
            }}
          >
            {walletASupply > 0 ? "ACTIVE YIELD" : "WITHDRAWN"}
          </div>
        </div>

        {/* Wallet B Collateral Position */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>
              WALLET B (COLLATERAL)
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 800, color: "#F2BC72" }}>
              {walletBCollateral.toFixed(2)} <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: FONT.mono }}>rCOL2</span>
            </div>
          </div>
          <div
            style={{
              padding: "3px 8px",
              borderRadius: "4px",
              background: walletBCollateral > 0 ? "rgba(231, 165, 82, 0.2)" : "rgba(255,255,255,0.06)",
              fontFamily: FONT.mono,
              fontSize: 10,
              fontWeight: 600,
              color: walletBCollateral > 0 ? "#E7A552" : "rgba(255,255,255,0.4)",
            }}
          >
            {walletBCollateral > 0 ? "LOCKED & BACKED" : "RELEASED"}
          </div>
        </div>

        {/* Wallet B Borrow / Debt Position */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>
              OUTSTANDING DEBT
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 800, color: walletBDebt > 0 ? "#FF5C5C" : "#10B981" }}>
              {walletBDebt.toFixed(6)} <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: FONT.mono }}>rUSD2</span>
            </div>
          </div>
          <div
            style={{
              padding: "3px 8px",
              borderRadius: "4px",
              background: walletBDebt > 0 ? "rgba(255, 92, 92, 0.2)" : "rgba(16, 185, 129, 0.2)",
              fontFamily: FONT.mono,
              fontSize: 10,
              fontWeight: 600,
              color: walletBDebt > 0 ? "#FF5C5C" : "#10B981",
            }}
          >
            {walletBDebt > 0 ? "ACCRUING" : "SETTLED · ZERO"}
          </div>
        </div>
      </div>

      {activeTx ? (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            fontFamily: FONT.mono,
            fontSize: 10,
            color: "rgba(255, 255, 255, 0.6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>CONFIRMED RECEIPT:</span>
          <span style={{ color: C.wine, fontWeight: 700 }}>{activeTx.slice(0, 10)}...{activeTx.slice(-6)}</span>
        </div>
      ) : null}
    </div>
  );
};

export const Lending: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Sound sync volume
  const volume = (f: number) => Math.min(lin(f / fps, 0, 0.6), 1 - lin(f / fps, 25.2, 26)) * 0.72;

  // DYNAMIC HERO CAMERA CHOREOGRAPHY
  // Smoothly guides viewer attention across the 3D machinery
  const camX = interpolate(
    t,
    [0, 2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 18.2, 21.0, 26],
    [0, -120, -220, -160, 140, 220, 0, 0, 100, 0, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camY = interpolate(
    t,
    [0, 2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 18.2, 21.0, 26],
    [-60, -10, 0, 0, -10, 0, -20, 0, 0, -30, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camZ = interpolate(
    t,
    [0, 2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 18.2, 21.0, 26],
    [-140, 20, 100, 40, 60, 100, 10, 20, 80, -90, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camRotY = interpolate(
    t,
    [0, 2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 18.2, 21.0, 26],
    [0, 6, 10, 4, -8, -10, 0, -4, -6, 0, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const camRotX = interpolate(
    t,
    [0, 2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 18.2, 21.0, 26],
    [8, 2, -2, 0, 2, -2, 1, 0, 2, 5, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Dynamic on-chain states driven by genuine testnet lifecycle
  // 1. Supply (2.8 - 6.5s): Pool level fills 0 -> 100 rUSD2
  const supplyProgress = curve(t, 3.2, 5.8);
  const poolLevel =
    t < 3.2
      ? 0
      : t < 11.2
      ? supplyProgress * 100
      : t < 15.2
      ? 100 - curve(t, 11.2, 12.8) * 3 // Borrow 3 leaves 97
      : t < 18.5
      ? 97 + curve(t, 15.2, 17.0) * 3.000003 // Repay brings it back
      : 100 - curve(t, 20.0, 21.8) * 100; // Wallet A withdraws 100 -> 0

  const walletASupply =
    t < 3.2
      ? 0
      : t < 20.0
      ? supplyProgress * 100
      : 100 * (1 - curve(t, 20.0, 21.8));

  // 2. Collateral (6.5 - 10.5s): 0 -> 10 rCOL2, enabled at 9.3s
  const collateralDeposit = curve(t, 6.6, 7.8);
  const collateralEnabled = t >= 9.3;
  const walletBCollateral =
    t < 6.6
      ? 0
      : t < 18.6
      ? collateralDeposit * 10
      : 10 * (1 - curve(t, 18.6, 20.0));

  // 3. Borrow (10.5 - 14.5s): 0 -> 3 rUSD2, interest accrued to 3.000003 at 14.5s
  const borrowProgress = curve(t, 11.0, 12.6);
  const repayProgress = curve(t, 15.2, 17.0);
  const walletBDebt =
    t < 11.0
      ? 0
      : t < 14.8
      ? borrowProgress * 3.0
      : t < 17.2
      ? 3.000003 * (1 - repayProgress)
      : 0;

  // Active transaction and block references from genuine Robinhood Testnet receipts
  let currentStageName = "PRIVATE ELIGIBILITY & CAPITAL FLOW";
  let currentAction = "PROTOCOL INITIALIZED";
  let currentBlock: number | undefined = undefined;
  let currentTx: string | undefined = undefined;

  if (t >= 2.8 && t < 6.5) {
    currentStageName = "01 / SUPPLY LIQUIDITY";
    currentAction = "SUPPLIED 100 rUSD2";
    currentBlock = 134206804;
    currentTx = "0xdd107fabe2db697818a8f501450ba81ecaddfdaf00ef9a705c02a957fc998fff";
  } else if (t >= 6.5 && t < 10.5) {
    currentStageName = "02 / COLLATERAL & ZK-PROOF";
    currentAction = t < 9.3 ? "DEPOSITED 10 rCOL2" : "POLICY 03 PROOF VERIFIED";
    currentBlock = t < 9.3 ? 134213772 : 134216117;
    currentTx = t < 9.3 ? "0x8330535f41c68095ffae99573b61504e3515ae30d5d862d6dea57071e01069e6" : "0xa585292c68f2951d5a1e37799e4e05bf7791e00c10b83496b7ae31610394a7ed";
  } else if (t >= 10.5 && t < 14.5) {
    currentStageName = "03 / BORROW CAPITAL";
    currentAction = "BORROWED 3 rUSD2";
    currentBlock = 134216753;
    currentTx = "0xc4752f4e368a88ccf00c9498c47990258fb85aa3fd69a3650eebed3fea4466cf";
  } else if (t >= 14.5 && t < 18.2) {
    currentStageName = "04 / FULL REPAYMENT";
    currentAction = "REPAID 3.000003 rUSD2 (DEBT = 0)";
    currentBlock = 134224625;
    currentTx = "0xd27bf0979f18fd5b4b1e98fd0af8138174499af78b32c510beb5fa17fbfee21e";
  } else if (t >= 18.2 && t < 22.2) {
    currentStageName = "05 / COMPLETE WITHDRAWAL";
    currentAction = t < 20.0 ? "WITHDREW 10 rCOL2" : "WITHDREW 100 rUSD2";
    currentBlock = t < 20.0 ? 134231058 : 134231542;
    currentTx = t < 20.0 ? "0xbf6d246e6f756307b00a5e5635b2eda2e17dbf36b219e4801b561de910b3839a" : "0x25ec05bed3b26110ec21aefa35a516342905b83c4c2973f42b3d9afd7b90b299";
  }

  // End card opacity
  const endCardOpacity = curve(t, 22.3, 23.2) * (1 - lin(t, 25.6, 26));

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden", fontFamily: FONT.display }}>
      {/* Audio Track */}
      <Audio src={staticFile("audio/mixkit-deep-urban-eugenio-mininni.mp3")} volume={volume} />

      {/* Atmospheric 3D Lighting & Grid Floor */}
      <CinematicAtmosphere t={t} glowColor={C.burgundy} glowIntensity={0.7} gridSpeed={14} accentX={camX > 0 ? 70 : 30} />

      {/* Persistent Technical Top Header (Fixed in Screen Space) */}
      {t < 22.2 && (
        <NetworkHeader
          stage={currentStageName}
          action={currentAction}
          block={currentBlock}
          txHash={currentTx}
          t={t}
        />
      )}

      {/* 3D Dynamic Camera World */}
      <CameraRig
        x={camX}
        y={camY}
        z={camZ}
        rotateX={camRotX}
        rotateY={camRotY}
        perspective={1200}
      >
        {/* ===================================================================
            ACT 0: OPENING HOOK (0.0s - 2.8s)
            "PROVE ELIGIBILITY. MOVE CAPITAL."
           =================================================================== */}
        {t < 3.2 && (
          <div
            style={{
              position: "absolute",
              left: 100,
              top: 240,
              zIndex: 30,
              opacity: 1 - lin(t, 2.5, 3.0),
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <TelemetryBadge label="ROBINHOOD TESTNET · CHAIN 46630" value="LENDING V2 LIFECYCLE" highlight />
            </div>
            <KineticTitle
              lines={[
                { text: "PROVE ELIGIBILITY.", color: C.white, size: 114 },
                { text: "MOVE CAPITAL.", color: C.wine, accent: true, size: 120 },
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
              ZERO-KNOWLEDGE PROOF GATES CAPITAL · TESTED ON-CHAIN
            </div>
          </div>
        )}

        {/* ===================================================================
            MAIN FINANCIAL MACHINERY STAGE (Hero 3D Environment)
            Left: Monumental Liquidity Core (Reserve)
            Center: High-Tech Fluid Pipe & Particle Stream
            Right: Monumental Collateral Vault
           =================================================================== */}
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
            justifyContent: "space-between",
            transformStyle: "preserve-3d",
            opacity: curve(t, 1.4, 2.5) * (1 - curve(t, 22.0, 22.8)),
          }}
        >
          {/* Left Wing: Monumental Liquidity Core */}
          <div
            style={{
              transform: `translate3d(0, 0, ${t >= 2.8 && t < 6.5 ? 100 : 0}px)`,
              transition: "transform 0.5s ease",
            }}
          >
            <MonumentalLiquidityCore
              level={poolLevel}
              t={t}
              highlight={t >= 2.8 && t < 6.5}
              scale={t >= 2.8 && t < 6.5 ? 1.05 : 0.95}
            />
          </div>

          {/* Central Conduit System (Fluid Liquidity Pipeline) */}
          <div
            style={{
              position: "relative",
              flex: 1,
              height: 220,
              margin: "0 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Live Holographic Action Badge floating over conduit */}
            {t >= 3.2 && t < 6.2 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "5px 14px",
                  borderRadius: "999px",
                  background: "rgba(184, 26, 52, 0.35)",
                  border: "1px solid rgba(255, 62, 101, 0.6)",
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#FFAAB8",
                  boxShadow: "0 0 20px rgba(184, 26, 52, 0.4)",
                }}
              >
                LIQUIDITY STREAM: +100 rUSD2
              </div>
            )}
            {t >= 10.8 && t < 14.2 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "6px 16px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.25)",
                  border: "1px solid rgba(16, 185, 129, 0.7)",
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#34D399",
                  boxShadow: "0 0 25px rgba(16, 185, 129, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>BORROW DISPATCH: 3.00 rUSD2</span>
                <span style={{ opacity: 0.6 }}>|</span>
                <span style={{ color: C.white }}>HEALTH FACTOR: 4.12</span>
              </div>
            )}
            {t >= 14.8 && t < 18.0 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "6px 16px",
                  borderRadius: "999px",
                  background: "rgba(255, 62, 101, 0.25)",
                  border: "1px solid rgba(255, 62, 101, 0.7)",
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#FFAAB8",
                  boxShadow: "0 0 25px rgba(184, 26, 52, 0.35)",
                }}
              >
                FULL SETTLEMENT: 3.000003 rUSD2 → DEBT 0
              </div>
            )}
            {t >= 18.2 && t < 22.0 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "6px 18px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.25)",
                  border: "1px solid rgba(16, 185, 129, 0.8)",
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#34D399",
                  boxShadow: "0 0 25px rgba(16, 185, 129, 0.35)",
                }}
              >
                ON-CHAIN POSITIONS SETTLED: DEBT 0 · COLLATERAL 0 · SUPPLY 0
              </div>
            )}

            <svg width="100%" height="120" viewBox="0 0 620 120" style={{ overflow: "visible" }}>
              <defs>
                <linearGradient id="pipe-glow-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#B81A34" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#FF3E65" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
                </linearGradient>
                <filter id="pipe-bloom">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>

              {/* Upper & Lower Structural Bracket Lines */}
              <line x1="20" y1="35" x2="600" y2="35" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="4 8" />
              <line x1="20" y1="85" x2="600" y2="85" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="4 8" />

              {/* Main structural pipeline rails */}
              <path d="M 0 60 H 620" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="26" strokeLinecap="round" />
              <path d="M 0 60 H 620" stroke="rgba(10, 6, 8, 0.95)" strokeWidth="16" strokeLinecap="round" />

              {/* Concentric Junction Nodes */}
              <circle cx="150" cy="60" r="18" fill="#180F14" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" />
              <circle cx="310" cy="60" r="22" fill="#22121A" stroke={C.wine} strokeWidth="2" />
              <circle cx="470" cy="60" r="18" fill="#180F14" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" />

              {/* Fluid particles: Supply flow (Wallet A -> Reserve) */}
              {t >= 3.2 && t < 6.2 && (
                <>
                  <path
                    d={`M 560 60 H ${560 - supplyProgress * 560}`}
                    stroke="url(#pipe-glow-grad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    filter="url(#pipe-bloom)"
                  />
                  {Array.from({ length: 6 }, (_, i) => {
                    const cx = ((t * 320 + i * 100) % 560);
                    return (
                      <circle
                        key={i}
                        cx={560 - cx}
                        cy="60"
                        r="8"
                        fill="#FF6B8B"
                        filter="drop-shadow(0 0 10px #FF3E65)"
                      />
                    );
                  })}
                </>
              )}

              {/* Fluid particles: Borrow flow (Reserve -> Wallet B) */}
              {t >= 11.0 && t < 13.5 && (
                <>
                  <path
                    d={`M 60 60 H ${60 + borrowProgress * 500}`}
                    stroke="#10B981"
                    strokeWidth="10"
                    strokeLinecap="round"
                    filter="url(#pipe-bloom)"
                  />
                  {Array.from({ length: 5 }, (_, i) => {
                    const cx = ((t * 360 + i * 110) % 500);
                    return (
                      <circle
                        key={i}
                        cx={60 + cx}
                        cy="60"
                        r="8"
                        fill="#34D399"
                        filter="drop-shadow(0 0 12px #10B981)"
                      />
                    );
                  })}
                </>
              )}

              {/* Fluid particles: Repay flow (Wallet B -> Reserve) */}
              {t >= 15.2 && t < 17.5 && (
                <>
                  <path
                    d={`M 560 60 H ${560 - repayProgress * 500}`}
                    stroke="#B81A34"
                    strokeWidth="10"
                    strokeLinecap="round"
                    filter="url(#pipe-bloom)"
                  />
                  {Array.from({ length: 5 }, (_, i) => {
                    const cx = ((t * 360 + i * 110) % 500);
                    return (
                      <circle
                        key={i}
                        cx={560 - cx}
                        cy="60"
                        r="8"
                        fill="#FF3E65"
                        filter="drop-shadow(0 0 12px #FF3E65)"
                      />
                    );
                  })}
                </>
              )}
            </svg>
          </div>

          {/* Right Wing: Monumental Collateral Vault */}
          <div
            style={{
              transform: `translate3d(0, 0, ${t >= 6.5 && t < 10.5 ? 100 : 0}px)`,
              transition: "transform 0.5s ease",
            }}
          >
            <MonumentalCollateralVault
              amount={walletBCollateral}
              locked={walletBCollateral > 0}
              enabled={collateralEnabled}
              t={t}
              scale={t >= 6.5 && t < 10.5 ? 1.05 : 0.95}
            />
          </div>
        </div>

        {/* Heroic Bojagi Cryptographic Origami (Acts 7.2s - 11.2s) */}
        {t >= 7.2 && t < 11.2 && (
          <HeroicBojagiOrigami
            t={t}
            stage={t >= 9.3 ? 3 : t >= 8.5 ? 2 : 1}
          />
        )}
      </CameraRig>

      {/* ===================================================================
          SCREEN-SPACE EDITORIAL HEADLINES & SUBTITLES (Stable Safe Margins)
         =================================================================== */}
      {t >= 2.8 && t < 22.0 && (
        <div
          style={{
            position: "absolute",
            left: 80,
            bottom: 75,
            zIndex: 45,
            maxWidth: 820,
            pointerEvents: "none",
          }}
        >
          {t >= 2.8 && t < 6.5 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Capital Enters the Reserve.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Wallet A supplies 100 rUSD2 into the lending pool · On-chain liquidity depth established
              </div>
            </div>
          )}

          {t >= 6.5 && t < 10.5 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Private Proof Unlocks Collateral.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Wallet B deposits 10 rCOL2 · Policy 03 BOJAGI verification passes on-chain without revealing private witness
              </div>
            </div>
          )}

          {t >= 10.5 && t < 14.5 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Protected Borrow Dispatched.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Wallet B borrows 3 rUSD2 within verified risk boundary · Solvency guaranteed by locked collateral
              </div>
            </div>
          )}

          {t >= 14.5 && t < 18.2 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                Debt Settled in Full.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Wallet B repays 3.000003 rUSD2 including accrued interest · Outstanding debt returns to zero
              </div>
            </div>
          )}

          {t >= 18.2 && t < 22.0 && (
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.05 }}>
                All Capital Released & Verified.
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8, letterSpacing: "0.08em" }}>
                Wallet B recovers 10 rCOL2 · Wallet A recovers 100 rUSD2 · Final protocol debt & open positions: 0
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screen-Space Real-Time Position Ledger HUD */}
      {t >= 2.8 && t < 22.2 && (
        <ScreenSpaceLedgerHUD
          walletASupply={walletASupply}
          walletBCollateral={walletBCollateral}
          walletBDebt={walletBDebt}
          activeTx={currentTx}
          block={currentBlock}
          opacity={curve(t, 2.8, 3.4) * (1 - curve(t, 21.8, 22.4))}
        />
      )}

      {/* ===================================================================
          STAGE 6: CINEMATIC CONCLUSION & BRAND STATEMENT (22.2s - 26.0s)
         =================================================================== */}
      {t >= 22.0 && (
        <AbsoluteFill
          style={{
            opacity: endCardOpacity,
            background: "radial-gradient(circle at 50% 45%, #180B10 0%, #060405 75%)",
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
            {/* Logo Mark with Crimson Corona */}
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
              Capital moves.
              <br />
              <span style={{ color: C.wine }}>Private facts stay private.</span>
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

      {/* Subtle Analog Film Grain for Organic Texture */}
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};
