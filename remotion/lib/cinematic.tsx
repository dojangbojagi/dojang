import React from "react";
import { AbsoluteFill, interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, W, H } from "./theme";

export const easeSmooth = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOutCubic = Easing.bezier(0.65, 0, 0.35, 1);
export const easePower = Easing.bezier(0.25, 0.1, 0.25, 1);

export const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const lin = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], clamp);

export const curve = (t: number, a: number, b: number, easing = easeSmooth) =>
  interpolate(t, [a, b], [0, 1], { ...clamp, easing });

export const windowSpan = (t: number, a: number, b: number, c: number, d: number) =>
  curve(t, a, b) * (1 - lin(t, c, d));

export const pulseHit = (t: number, beats: number[], decay = 0.22) =>
  Math.max(0, ...beats.map((b) => Math.exp(-Math.pow((t - b) / decay, 2))));

/**
 * 3D Camera Rig: wraps children in a 3D perspective transform with camera coordinates.
 */
export const CameraRig: React.FC<{
  x?: number;
  y?: number;
  z?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  perspective?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({
  x = 0,
  y = 0,
  z = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  perspective = 1400,
  children,
  style,
}) => {
  return (
    <AbsoluteFill
      style={{
        perspective: `${perspective}px`,
        perspectiveOrigin: "50% 50%",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `translate3d(${-x}px, ${-y}px, ${z}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Deep atmospheric environment with 3D perspective floor grid, volumetric glow, and scanlines.
 */
export const CinematicAtmosphere: React.FC<{
  t: number;
  glowColor?: string;
  glowIntensity?: number;
  gridSpeed?: number;
  accentX?: number;
  accentY?: number;
}> = ({
  t,
  glowColor = C.burgundy,
  glowIntensity = 0.55,
  gridSpeed = 15,
  accentX = 50,
  accentY = 50,
}) => {
  const gridOffset = (t * gridSpeed) % 80;

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden", pointerEvents: "none" }}>
      {/* Dynamic ambient radial glows */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle 900px at ${accentX}% ${accentY}%, ${glowColor} ${Math.round(glowIntensity * 50)}%, transparent 70%)`,
          opacity: 0.85,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle 600px at 15% 85%, rgba(184, 26, 52, 0.25) 0%, transparent 60%), radial-gradient(circle 500px at 85% 15%, rgba(109, 0, 26, 0.3) 0%, transparent 60%)`,
        }}
      />

      {/* 3D Floor Grid Plane */}
      <div
        style={{
          position: "absolute",
          left: "-25%",
          bottom: "-30%",
          width: "150%",
          height: "80%",
          perspective: "600px",
          transformStyle: "preserve-3d",
          opacity: 0.28,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: "rotateX(72deg)",
            transformOrigin: "bottom center",
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
            backgroundPosition: `0px ${gridOffset}px`,
            maskImage: "linear-gradient(to top, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 80%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 80%)",
          }}
        />
      </div>

      {/* Fine telemetry coordinate lines */}
      <div
        style={{
          position: "absolute",
          inset: "40px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "absolute", top: -1, left: 10, width: 20, height: 2, background: C.wine }} />
        <div style={{ position: "absolute", bottom: -1, right: 10, width: 20, height: 2, background: C.wine }} />
        <div style={{ position: "absolute", top: 10, left: -1, width: 2, height: 20, background: C.wine }} />
        <div style={{ position: "absolute", bottom: 10, right: -1, width: 2, height: 20, background: C.wine }} />
      </div>

      {/* Subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(3, 2, 3, 0.82) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Kinetic typography reveal with smooth mask sliding and weight contrast.
 */
export const KineticTitle: React.FC<{
  lines: Array<{
    text: string;
    color?: string;
    accent?: boolean;
    size?: number;
    delay?: number;
  }>;
  t: number;
  baseDelay?: number;
  style?: React.CSSProperties;
}> = ({ lines, t, baseDelay = 0, style }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", ...style }}>
      {lines.map((line, idx) => {
        const delay = baseDelay + (line.delay ?? idx * 0.12);
        const p = curve(t, delay, delay + 0.6);
        const color = line.color ?? (line.accent ? C.wine : C.white);
        const fontSize = line.size ?? 88;

        return (
          <div
            key={idx}
            style={{
              overflow: "hidden",
              paddingBottom: "8px",
            }}
          >
            <div
              style={{
                fontFamily: FONT.display,
                fontSize,
                fontWeight: line.accent ? 800 : 700,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                color,
                transform: `translateY(${(1 - p) * 115}%)`,
                opacity: p > 0.01 ? 1 : 0,
                textShadow: line.accent ? "0 0 45px rgba(184, 26, 52, 0.6)" : "none",
              }}
            >
              {line.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Telemetry badge pill with real on-chain metadata styling.
 */
export const TelemetryBadge: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
  status?: "active" | "verified" | "pending" | "locked";
  style?: React.CSSProperties;
}> = ({ label, value, highlight = false, status = "active", style }) => {
  const dotColor =
    status === "verified"
      ? "#10B981"
      : status === "locked"
      ? "#E7A552"
      : highlight
      ? C.wine
      : "#9CA3AF";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "7px 16px",
        background: "rgba(21, 15, 18, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "999px",
        border: `1px solid ${highlight ? "rgba(184, 26, 52, 0.5)" : "rgba(255, 255, 255, 0.12)"}`,
        boxShadow: highlight ? "0 0 20px rgba(184, 26, 52, 0.25)" : "none",
        ...style,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: `0 0 8px ${dotColor}`,
        }}
      />
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(247, 243, 244, 0.6)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: C.white,
        }}
      >
        {value}
      </span>
    </div>
  );
};

/**
 * Animated cryptographic block header watermark.
 */
export const NetworkHeader: React.FC<{
  stage: string;
  action: string;
  block?: number;
  txHash?: string;
  t: number;
}> = ({ stage, action, block, txHash, t }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 80,
        right: 80,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            width: 10,
            height: 10,
            background: C.wine,
            boxShadow: "0 0 12px #B81A34",
            transform: `rotate(${t * 45}deg)`,
          }}
        />
        <div style={{ fontFamily: FONT.mono, fontSize: 15, letterSpacing: "0.22em", color: C.text, textTransform: "uppercase" }}>
          GYEVO <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span> {stage}
        </div>
        <div
          style={{
            padding: "3px 10px",
            background: "rgba(109, 0, 26, 0.35)",
            border: "1px solid rgba(184, 26, 52, 0.4)",
            borderRadius: "4px",
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: "0.1em",
            color: "#FFAAB8",
          }}
        >
          {action}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {block ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: "0.14em", color: "rgba(247, 243, 244, 0.5)" }}>
            BLK <span style={{ color: C.white, fontWeight: 700 }}>#{block}</span>
          </div>
        ) : null}
        {txHash ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.08em", color: "rgba(247, 243, 244, 0.45)" }}>
            TX {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: "0.15em",
            color: "rgba(255, 255, 255, 0.7)",
            padding: "4px 10px",
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: "12px",
          }}
        >
          CHAIN 46630
        </div>
      </div>
    </div>
  );
};
