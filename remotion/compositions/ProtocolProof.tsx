import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Grain } from "../lib/Brand";
import { C, FONT } from "../lib/theme";

type Point3 = { x: number; y: number; z: number };
type Point2 = { x: number; y: number; z: number };
type Panel = { id: string; points: Point2[]; depth: number; fill: string; edge: string };

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const smooth = (p: number) => p * p * (3 - 2 * p);

const rotateX = (p: Point3, hingeY: number, angle: number): Point3 => {
  const y = p.y - hingeY;
  return { x: p.x, y: hingeY + y * Math.cos(angle) - p.z * Math.sin(angle), z: y * Math.sin(angle) + p.z * Math.cos(angle) };
};

const rotateY = (p: Point3, hingeX: number, angle: number): Point3 => {
  const x = p.x - hingeX;
  return { x: hingeX + x * Math.cos(angle) + p.z * Math.sin(angle), y: p.y, z: -x * Math.sin(angle) + p.z * Math.cos(angle) };
};

const project = (point: Point3, camera: { yaw: number; pitch: number; scale: number; cx: number; cy: number }): Point2 => {
  const x = point.x * camera.scale;
  const y = point.y * camera.scale;
  const z = point.z * camera.scale;
  const yawX = x * Math.cos(camera.yaw) + z * Math.sin(camera.yaw);
  const yawZ = -x * Math.sin(camera.yaw) + z * Math.cos(camera.yaw);
  const pitchY = y * Math.cos(camera.pitch) - yawZ * Math.sin(camera.pitch);
  const pitchZ = y * Math.sin(camera.pitch) + yawZ * Math.cos(camera.pitch);
  const perspective = 1420 / (1420 - pitchZ);
  return { x: camera.cx + yawX * perspective, y: camera.cy + pitchY * perspective, z: pitchZ };
};

const pointsAttr = (points: Point2[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

const foldPanel = (id: string, progress: number, delay: number, camera: Parameters<typeof project>[1], fill: string, edge: string): Panel => {
  const p = smooth(Math.max(0, Math.min(1, (progress - delay) / (1 - delay))));
  let vertices: Point3[];
  if (id === "north") {
    const angle = -Math.PI * p;
    vertices = [
      { x: -260, y: -180, z: 0 },
      { x: 260, y: -180, z: 0 },
      rotateX({ x: 0, y: -520, z: 0 }, -180, angle),
    ];
  } else if (id === "south") {
    const angle = Math.PI * p;
    vertices = [
      { x: -260, y: 180, z: 0 },
      { x: 260, y: 180, z: 0 },
      rotateX({ x: 0, y: 520, z: 0 }, 180, angle),
    ];
  } else if (id === "west") {
    const angle = Math.PI * p;
    vertices = [
      { x: -260, y: -180, z: 0 },
      { x: -260, y: 180, z: 0 },
      rotateY({ x: -520, y: 0, z: 0 }, -260, angle),
    ];
  } else {
    const angle = -Math.PI * p;
    vertices = [
      { x: 260, y: -180, z: 0 },
      { x: 260, y: 180, z: 0 },
      rotateY({ x: 520, y: 0, z: 0 }, 260, angle),
    ];
  }
  const projected = vertices.map((point) => project(point, camera));
  return { id, points: projected, depth: projected.reduce((sum, point) => sum + point.z, 0) / projected.length, fill, edge };
};

const BrandImpact: React.FC<{ frame: number }> = ({ frame }) => {
  const inA = spring({ frame: frame - 4, fps: 30, config: { damping: 16, stiffness: 112, mass: 0.86 } });
  const inB = spring({ frame: frame - 13, fps: 30, config: { damping: 16, stiffness: 104, mass: 0.9 } });
  const exit = interpolate(frame, [40, 61], [0, 1], { ...clamp, easing: ease });
  const introOpacity = 1 - exit;
  const stripe = interpolate(frame, [11, 40, 60], [0, 1, 0], { ...clamp, easing: ease });
  const titleScale = lerp(1, 0.83, exit);
  const titleY = lerp(0, -150, exit);

  return (
    <AbsoluteFill style={{ opacity: introOpacity, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 90, left: 128, display: "flex", alignItems: "center", gap: 20, opacity: 0.98 }}>
        <Img src={staticFile("logo.svg")} style={{ width: 55, height: 55 }} />
        <div style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 700, letterSpacing: "0.15em", color: C.white }}>GYEVO</div>
        <div style={{ width: 1, height: 34, background: "rgba(255,255,255,.28)", margin: "0 8px" }} />
        <div style={{ fontFamily: FONT.mono, fontSize: 20, letterSpacing: "0.16em", color: "rgba(255,255,255,.58)" }}>PRIVATE AUTHORIZATION</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 108,
          top: 322,
          transform: `translate3d(${lerp(105, 0, inA)}px, ${titleY}px, 0) scale(${titleScale})`,
          transformOrigin: "left center",
          whiteSpace: "nowrap",
          fontFamily: FONT.display,
          fontSize: 164,
          fontWeight: 700,
          letterSpacing: "-0.065em",
          lineHeight: 0.95,
          color: C.white,
          clipPath: `inset(0 ${100 - inA * 100}% 0 0)`,
          textShadow: "0 12px 50px rgba(0,0,0,.36)",
        }}
      >
        PROVE MORE.
      </div>

      <div
        style={{
          position: "absolute",
          left: 108,
          top: 510,
          transform: `translate3d(${lerp(-90, 0, inB)}px, ${titleY}px, 0) scale(${titleScale})`,
          transformOrigin: "left center",
          whiteSpace: "nowrap",
          fontFamily: FONT.display,
          fontSize: 164,
          fontWeight: 700,
          letterSpacing: "-0.065em",
          lineHeight: 0.95,
          clipPath: `inset(0 ${100 - inB * 100}% 0 0)`,
          textShadow: "0 12px 50px rgba(0,0,0,.36)",
        }}
      >
        <span style={{ color: C.white }}>REVEAL </span><span style={{ color: C.wine }}>LESS.</span>
      </div>

      <div style={{ position: "absolute", left: 114, top: 730, width: `${stripe * 1160}px`, height: 2, background: "linear-gradient(90deg, transparent, #B81A34 18%, #F7F3F4 74%, transparent)", boxShadow: "0 0 26px rgba(184,26,52,.65)" }} />
      <div style={{ position: "absolute", right: 136, top: 723, fontFamily: FONT.mono, fontSize: 18, letterSpacing: ".18em", color: "rgba(247,243,244,.62)", opacity: stripe }}>
        PRIVATE ELIGIBILITY / PUBLIC AUTHORIZATION
      </div>
    </AbsoluteFill>
  );
};

const ProofField: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - 40, fps, config: { damping: 24, stiffness: 74, mass: 1.05 } });
  const foldP = interpolate(frame, [67, 139], [0, 1], { ...clamp, easing: ease });
  const tokenP = interpolate(frame, [124, 151], [0, 1], { ...clamp, easing: ease });
  const outroP = interpolate(frame, [143, 164], [0, 1], { ...clamp, easing: ease });
  const cx = lerp(1165, 1395, outroP);
  const cy = 536 + Math.sin(frame * 0.045) * 7;
  const camera = {
    yaw: -0.17 + Math.sin(frame * 0.024) * 0.055 + outroP * 0.14,
    pitch: -0.16 + Math.sin(frame * 0.032) * 0.025,
    scale: lerp(0.23, 0.9, reveal) * lerp(1, 0.82, outroP),
    cx,
    cy,
  };

  const square = [
    project({ x: -260, y: -180, z: -5 }, camera),
    project({ x: 260, y: -180, z: -5 }, camera),
    project({ x: 260, y: 180, z: -5 }, camera),
    project({ x: -260, y: 180, z: -5 }, camera),
  ];
  const rawPanels = [
    foldPanel("north", foldP, 0.00, camera, "url(#paperTop)", "#F7EBEC"),
    foldPanel("west", foldP, 0.07, camera, "url(#paperWest)", "#9B7883"),
    foldPanel("east", foldP, 0.14, camera, "url(#paperEast)", "#DBBFC7"),
    foldPanel("south", foldP, 0.20, camera, "url(#paperSouth)", "#F5E8EA"),
  ].sort((a, b) => a.depth - b.depth);
  const abstractGlyphs = [
    { x: -104, y: -30, w: 84, h: 12 }, { x: 10, y: -30, w: 145, h: 12 },
    { x: -104, y: 3, w: 142, h: 12 }, { x: 58, y: 3, w: 70, h: 12 },
    { x: -104, y: 36, w: 60, h: 12 }, { x: -18, y: 36, w: 172, h: 12 },
  ];
  const witnessOpacity = 1 - smooth(interpolate(frame, [97, 129], [0, 1], clamp));
  const accentX = interpolate(frame, [105, 151], [cx - 280, 1695], { ...clamp, easing: ease });
  const ringRotation = frame * 0.6;
  const orbitAlpha = interpolate(frame, [86, 118, 170], [0, 0.8, 0.55], { ...clamp, easing: ease });
  const closeOpacity = tokenP * reveal;

  const tokenCorners = [
    { x: -232, y: 0, z: 53 },
    { x: 0, y: -135, z: 53 },
    { x: 232, y: 0, z: 53 },
    { x: 0, y: 135, z: 53 },
  ].map((point) => {
    const rotation = Math.max(0, frame - 143) * 0.015;
    return project({ x: point.x * Math.cos(rotation) + point.z * Math.sin(rotation), y: point.y, z: -point.x * Math.sin(rotation) + point.z * Math.cos(rotation) }, camera);
  });

  return (
    <AbsoluteFill style={{ opacity: reveal, pointerEvents: "none" }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id="paperTop" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FFF9F9" /><stop offset=".55" stopColor="#D7C7CB" /><stop offset="1" stopColor="#806F75" /></linearGradient>
          <linearGradient id="paperSouth" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F7EEEE" /><stop offset=".45" stopColor="#C7B5BA" /><stop offset="1" stopColor="#75666B" /></linearGradient>
          <linearGradient id="paperWest" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9A6B79" /><stop offset=".48" stopColor="#4E1023" /><stop offset="1" stopColor="#260811" /></linearGradient>
          <linearGradient id="paperEast" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#E7DADD" /><stop offset=".38" stopColor="#AD8C96" /><stop offset="1" stopColor="#65424E" /></linearGradient>
          <linearGradient id="seal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#B81A34" /><stop offset=".46" stopColor="#6D001A" /><stop offset="1" stopColor="#26000A" /></linearGradient>
          <radialGradient id="paperLight"><stop stopColor="#F3DDE2" stopOpacity=".9" /><stop offset="1" stopColor="#6D001A" stopOpacity="0" /></radialGradient>
          <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="16" /></filter>
          <filter id="sealShadow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22" /></filter>
        </defs>

        <ellipse cx={cx} cy={cy + 240} rx={450 * camera.scale} ry={73 * camera.scale} fill="#080307" opacity=".9" filter="url(#sealShadow)" />

        <polygon points={pointsAttr(square)} fill="url(#paperLight)" opacity={0.42 * (1 - tokenP)} />
        <polygon points={pointsAttr(square)} fill="#DDD1D3" stroke="rgba(255,255,255,.65)" strokeWidth="2" />
        <g opacity={witnessOpacity}>
          <g transform={`translate(${cx},${cy})`}>
            <path d="M -168 -75 H 168 M -168 75 H 168" stroke="#4D3B41" strokeWidth="1.5" opacity=".45" />
            <text x="0" y="-93" textAnchor="middle" fontFamily={FONT.mono} fontSize="19" letterSpacing="5" fill="#6D001A">PRIVATE WITNESS · ABSTRACT</text>
            {abstractGlyphs.map((g, i) => <rect key={i} x={g.x} y={g.y} width={g.w} height={g.h} rx="6" fill={i % 2 ? "#34272B" : "#7E6A70"} opacity=".92" />)}
            <circle cx="-135" cy="115" r="5" fill="#6D001A" />
            <text x="-118" y="122" fontFamily={FONT.mono} fontSize="16" letterSpacing="2.6" fill="#66565B">LOCAL INPUT · CONCEALED</text>
          </g>
        </g>

        {rawPanels.map((panel) => (
          <g key={panel.id}>
            <polygon points={pointsAttr(panel.points)} fill="#150A0E" opacity=".44" transform="translate(0 12)" />
            <polygon points={pointsAttr(panel.points)} fill={panel.fill} stroke={panel.edge} strokeWidth="2.2" strokeLinejoin="round" />
            <polyline points={pointsAttr(panel.points.slice(0, 2))} fill="none" stroke="rgba(255,255,255,.66)" strokeWidth="1.4" opacity=".76" />
          </g>
        ))}

        <g opacity={orbitAlpha} transform={`rotate(${ringRotation} ${cx} ${cy})`}>
          <ellipse cx={cx} cy={cy} rx={374 * camera.scale} ry={209 * camera.scale} fill="none" stroke="#B81A34" strokeWidth="1.4" strokeDasharray="2 16" opacity=".78" />
          <path d={`M ${cx - 448 * camera.scale} ${cy + 2} Q ${cx} ${cy - 378 * camera.scale} ${cx + 408 * camera.scale} ${cy - 16}`} fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1" />
          <circle cx={cx + 365 * camera.scale} cy={cy - 37 * camera.scale} r="5" fill="#E7BFC7" />
        </g>

        <polygon points={pointsAttr(tokenCorners)} fill="#30000D" opacity={closeOpacity * 0.78} filter="url(#softGlow)" />
        <polygon points={pointsAttr(tokenCorners)} fill="url(#seal)" stroke="#F3D8DE" strokeWidth="2.6" opacity={closeOpacity} />
        <polygon points={pointsAttr(tokenCorners.map((point, i) => ({ x: lerp(point.x, cx + (point.x - cx) * 0.82, 0.5), y: lerp(point.y, cy + (point.y - cy) * 0.82, 0.5), z: point.z })))} fill="none" stroke="rgba(255,244,246,.54)" strokeWidth="1.2" opacity={closeOpacity} />
        <g opacity={closeOpacity} transform={`translate(${cx},${cy})`}>
          <text x="0" y="17" textAnchor="middle" fontFamily={FONT.display} fontWeight="600" fontSize="96" fill="#FFF8F9" style={{ filter: "drop-shadow(0 0 22px rgba(255,255,255,.36))" }}>π</text>
          <text x="0" y="81" textAnchor="middle" fontFamily={FONT.mono} fontSize="16" letterSpacing="5" fill="#F2CCD4">ZK PROOF FORM</text>
        </g>
        <circle cx={accentX} cy={cy} r="6" fill="#FFF5F7" opacity={tokenP} filter="url(#softGlow)" />
        <path d={`M ${cx - 230} ${cy} C ${cx - 140} ${cy - 6}, ${cx + 110} ${cy + 10}, ${accentX} ${cy}`} fill="none" stroke="#B81A34" strokeWidth="2" opacity={tokenP * 0.76} />
      </svg>

      <div style={{ position: "absolute", top: 92, left: 124, display: "flex", gap: 16, alignItems: "center", opacity: interpolate(frame, [55, 76], [0, 1], { ...clamp, easing: ease }) }}>
        <div style={{ height: 3, width: 40, background: C.wine, boxShadow: "0 0 18px rgba(184,26,52,.75)" }} />
        <div style={{ fontFamily: FONT.mono, fontSize: 22, letterSpacing: ".2em", color: "rgba(247,243,244,.76)" }}>POLICY 03 + BOJAGI</div>
      </div>

      <div style={{ position: "absolute", left: 132, top: 383, width: 520, opacity: interpolate(frame, [65, 83, 127, 148], [0, 1, 1, 0], { ...clamp, easing: ease }), transform: `translateX(${interpolate(frame, [65, 83], [-42, 0], { ...clamp, easing: ease })}px)` }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: ".24em", color: "rgba(247,243,244,.62)", marginBottom: 12 }}>PUBLIC RULE</div>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 88, lineHeight: 1, letterSpacing: "-.06em", color: C.white }}>≥ 1,000</div>
        <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: 21, lineHeight: 1.55, letterSpacing: ".045em", color: "#CFB9C0" }}>SYNTHETIC TEST UNITS<br />NOT USD</div>
        <div style={{ marginTop: 25, width: 400, height: 1, background: "linear-gradient(90deg, rgba(184,26,52,.95), rgba(255,255,255,.28), transparent)" }} />
        <div style={{ marginTop: 15, fontFamily: FONT.mono, fontSize: 17, letterSpacing: ".13em", color: "rgba(247,243,244,.49)" }}>THE VALUE REMAINS CONCEALED</div>
      </div>

      <div style={{ position: "absolute", left: 132, top: 380, opacity: outroP, transform: `translateY(${(1 - outroP) * 28}px)` }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".2em", color: "rgba(247,243,244,.64)", marginBottom: 24 }}>PRIVATE ELIGIBILITY</div>
        <div style={{ fontFamily: FONT.display, fontSize: 78, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-.065em", color: C.white }}>PRIVATE<br /><span style={{ color: C.wine }}>PROVABLE.</span></div>
        <div style={{ width: 362, height: 2, marginTop: 26, background: "linear-gradient(90deg, #B81A34, rgba(255,255,255,.22), transparent)" }} />
        <div style={{ marginTop: 18, fontFamily: FONT.mono, fontSize: 18, lineHeight: 1.6, letterSpacing: ".11em", color: "rgba(247,243,244,.62)" }}>A RULE CAN BE SHARED.<br />A WITNESS NEED NOT BE.</div>
      </div>

      <div style={{ position: "absolute", left: 124, right: 124, bottom: 54, display: "flex", justifyContent: "space-between", alignItems: "flex-end", opacity: interpolate(frame, [58, 76, 168, 178], [0, 1, 1, 0.72], { ...clamp, easing: ease }) }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".09em", lineHeight: 1.42, color: "rgba(247,243,244,.55)" }}>CONCEPTUAL VISUALIZATION<br />NO LIVE PROOF OR TRANSACTION</div>
        <div style={{ fontFamily: FONT.mono, fontSize: 16, letterSpacing: ".16em", color: "rgba(247,243,244,.42)" }}>GYEVO · 01</div>
      </div>
    </AbsoluteFill>
  );
};

export const ProtocolProof: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const musicVolume = (f: number) => {
    const start = interpolate(f, [0, 16], [0, 0.58], clamp);
    const tail = interpolate(f, [durationInFrames - 20, durationInFrames - 1], [1, 0.36], clamp);
    return start * tail;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, color: C.white, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(65% 56% at 64% 55%, rgba(109,0,26,.21), transparent 73%), radial-gradient(46% 42% at 12% 90%, rgba(77,8,28,.15), transparent 72%), linear-gradient(120deg, #060405, #10080C 54%, #060405)" }} />

      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, opacity: 0.27 }}>
        <path d="M-90 854 C 218 772 364 761 526 701 S 819 552 986 414" fill="none" stroke="#6D001A" strokeWidth="1.4" />
        <path d="M-90 873 C 215 790 374 777 535 718 S 824 574 1000 439" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1" />
        <path d="M-90 892 C 214 810 383 797 546 737 S 838 599 1012 461" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const drift = (frame * (1.25 + i * 0.11)) % 1920;
          return <line key={i} x1={drift - 190} y1={150 + i * 118} x2={drift + 40} y2={150 + i * 118} stroke={i % 3 === 0 ? "#B81A34" : "rgba(255,255,255,.32)"} strokeWidth={i % 3 === 0 ? 1.8 : 1} opacity={0.12 + ((i + frame) % 17) / 120} />;
        })}
      </svg>

      <BrandImpact frame={frame} />
      <ProofField frame={frame} />
      <Grain opacity={0.055} />
      <Audio src={staticFile("audio/mixkit-echoes-andrew-ev.mp3")} startFrom={71 * fps} volume={musicVolume} />
      <Sequence from={4} durationInFrames={22} name="Brand impact">
        <Audio src={staticFile("audio/proof-impact-v1.wav")} volume={0.62} />
      </Sequence>
      <Sequence from={76} durationInFrames={49} name="Paper fold">
        <Audio src={staticFile("audio/proof-fold-v1.wav")} volume={0.62} />
      </Sequence>
      <Sequence from={127} durationInFrames={24} name="Proof seal">
        <Audio src={staticFile("audio/proof-seal-v1.wav")} volume={0.62} />
      </Sequence>
    </AbsoluteFill>
  );
};
