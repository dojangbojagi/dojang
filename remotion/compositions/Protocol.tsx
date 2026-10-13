import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { C, DISCLOSURE, FONT, H, W } from "../lib/theme";
import { Grain } from "../lib/Brand";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const raw = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], clamp);
const ease = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
const fade = (t: number, a: number, b: number, c: number, d: number) => ease(t, a, b) * (1 - raw(t, c, d));
const impact = (t: number, beats: number[]) => Math.max(0, ...beats.map((beat) => Math.exp(-Math.pow((t - beat) / .19, 2))));
const points = (r: number, inset = 0) => Array.from({ length: 8 }, (_, i) => {
  const a = Math.PI / 8 + i * Math.PI / 4;
  const rr = r - inset;
  return `${Math.cos(a) * rr},${Math.sin(a) * rr}`;
}).join(" ");

const Caption = ({ t, at, until, children }: { t: number; at: number; until: number; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: 108, bottom: 86, opacity: fade(t, at, at + .35, until - .3, until), color: "#D5C6CA", fontFamily: FONT.mono, fontSize: 21, fontWeight: 500, letterSpacing: ".22em", textTransform: "uppercase" }}>{children}</div>
);

function Sculpture({ t }: { t: number }) {
  const build = ease(t, .08, 2.6);
  const fold = ease(t, 5.4, 8.1);
  const seal = ease(t, 7.3, 9.2);
  const camera = 1.18 + .055 * Math.sin(t * .42) + .09 * ease(t, 10.1, 12.8) + .045 * impact(t, [12.44, 14.12, 14.83, 18.28, 19.31, 20.38, 21.87, 22.66, 23.54]);
  const yaw = -13 + Math.sin(t * .29) * 5 - 9 * ease(t, 5.7, 8.2);
  const pulse = .24 + .76 * impact(t, [12.44, 14.12, 14.83, 18.28, 19.31, 20.38, 21.87, 22.66, 23.54]);
  const face = fade(t, .1, .7, 6.0, 7.2);
  const shell = fade(t, 5.5, 6.7, 14.2, 15.0);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id="p-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FFF0F2"/><stop offset=".22" stopColor="#B88993"/><stop offset=".48" stopColor="#221116"/><stop offset=".72" stopColor="#8F1731"/><stop offset="1" stopColor="#F2CDD4"/></linearGradient>
        <linearGradient id="p-glass" x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#30151C"/><stop offset=".48" stopColor="#0A0709"/><stop offset="1" stopColor="#5E0B20"/></linearGradient>
        <linearGradient id="p-beam"><stop stopColor="#B81A34" stopOpacity="0"/><stop offset=".52" stopColor="#EA607A" stopOpacity=".65"/><stop offset="1" stopColor="#F5D3D8" stopOpacity="0"/></linearGradient>
        <filter id="p-blur"><feGaussianBlur stdDeviation="26"/></filter>
        <filter id="p-shadow"><feGaussianBlur stdDeviation="20"/></filter>
        <clipPath id="p-face"><polygon points={points(346)}/></clipPath>
      </defs>
      {/* Hard light columns give the object a stage and a sense of scale. */}
      <g opacity={.26 + .12 * pulse}>
        <path d={`M 250 0 L 610 0 L 1020 1080 L 800 1080 Z`} fill="url(#p-beam)" />
        <path d={`M 1110 0 L 1350 0 L 1770 1080 L 1610 1080 Z`} fill="url(#p-beam)" opacity=".55" />
      </g>
      <ellipse cx="876" cy="896" rx="520" ry="88" fill="#000" opacity=".85" filter="url(#p-shadow)" />
      <g transform={`translate(${875 + Math.sin(t * .31) * 45} ${535 + Math.cos(t * .27) * 17}) rotate(${yaw}) scale(${camera})`}>
        {/* Offset slabs assemble around the cryptographic core. */}
        <g opacity={.82}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = i * Math.PI / 3 + t * .08;
            const dist = (1 - build) * 510 + 115;
            return <polygon key={i} points={points(390 - i * 14)} fill={i % 2 ? "#190B10" : "url(#p-metal)"} fillOpacity={i % 2 ? .92 : .2} stroke={i % 2 ? "#7D3040" : "#E4BEC5"} strokeOpacity={.55} strokeWidth="2" transform={`translate(${Math.cos(a) * dist} ${Math.sin(a) * dist * .68}) rotate(${(i % 2 ? 1 : -1) * (1 - build) * 34})`} />;
          })}
        </g>
        <polygon points={points(402)} fill="#080608" stroke="#B4848E" strokeOpacity=".85" strokeWidth="3" transform="translate(24 30)" />
        <polygon points={points(383)} fill="url(#p-metal)" fillOpacity=".54" stroke="#F6E8EB" strokeOpacity=".75" strokeWidth="2" />
        <polygon points={points(354)} fill="url(#p-glass)" stroke="#7B2739" strokeWidth="3" />
        <polygon points={points(331)} fill="none" stroke="#D7AAB3" strokeOpacity=".46" strokeWidth="2" />
        <g clipPath="url(#p-face)" opacity={face}>
          <path d="M -390 -265 H 380 V -216 H -390 Z" fill="#B81A34" opacity=".9" />
          <text x="-185" y="-230" fill="#FFF7F8" fontFamily={FONT.mono} fontSize="16" letterSpacing="3">GYEVO / PRIVATE</text>
          <text x="-290" y="-48" fill="#FFF7F8" fontFamily={FONT.display} fontSize="93" fontWeight="700" letterSpacing="-5">ELIGIBILITY</text>
          <text x="-282" y="35" fill="#D8C5CA" fontFamily={FONT.mono} fontSize="27" letterSpacing="4">VALUE HELD PRIVATE</text>
          <path d="M -284 104 H 286" stroke="#F5DDE1" strokeOpacity=".35" strokeWidth="2" />
          <text x="-282" y="170" fill="#BCA8AE" fontFamily={FONT.mono} fontSize="21" letterSpacing="3">ISSUER SIGNATURE / VALID</text>
          <g transform="translate(237 4)">
            <circle r="85" fill="#320917" stroke="#E6B6C0" strokeWidth="3" />
            <circle r="68" fill="none" stroke="#B81A34" strokeWidth="8" strokeDasharray="12 8" />
            <path d="m-33 2 23 25 49-57" fill="none" stroke="#FFF0F2" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <path d="M -310 263 H 310" stroke="#E8C6CC" strokeOpacity=".3" />
          <text x="-190" y="273" fill="#A88B93" fontFamily={FONT.mono} fontSize="14" letterSpacing="3">SEALED FACT / PROOFABLE CLAIM</text>
        </g>
        {/* The entire front face becomes a closed, layered seal. */}
        <g opacity={shell} transform={`rotate(${fold * 11})`}>
          <polygon points={points(336)} fill="#10090C" stroke="#F1DDE1" strokeWidth="3" />
          <polygon points={points(301)} fill="#210B12" stroke="#B81A34" strokeWidth="4" />
          <polygon points={points(262)} fill="url(#p-metal)" fillOpacity=".23" stroke="#D8B1B9" strokeOpacity=".8" strokeWidth="2" />
          <polygon points={points(231)} fill="#080608" stroke="#68172B" strokeWidth="3" />
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M 0 0 L ${Math.cos(i * Math.PI / 3) * 325} ${Math.sin(i * Math.PI / 3) * 325}`} stroke="#E3C5CA" strokeOpacity=".38" strokeWidth="2" />)}
          <circle r={126 + pulse * 12} fill="#15090D" stroke="#F1DDE1" strokeWidth="4" />
          <circle r="93" fill="#5C061B" stroke="#D1425E" strokeWidth="3" />
          <circle r="70" fill="#090608" stroke="#F2C9D1" strokeWidth="2" />
          <path d="M -39 0 H 39 M 0 -39 V 39" stroke="#F5DCE0" strokeWidth="4" />
          <text y="182" textAnchor="middle" fill="#E8C6CC" fontFamily={FONT.mono} fontSize="20" letterSpacing="5">COMMITMENT SEALED</text>
        </g>
        <circle r="438" fill="none" stroke="#C9808E" strokeOpacity={.12 + pulse * .12} strokeWidth="2" strokeDasharray="2 18" transform={`rotate(${t * 15})`} />
      </g>
    </svg>
  );
}

function ProofTransmission({ t }: { t: number }) {
  const show = fade(t, 9.2, 10.2, 14.8, 15.5);
  const travel = ease(t, 10.3, 12.44);
  const px = 625 + travel * 780;
  const pulse = Math.sin(Math.max(0, Math.min(1, travel)) * Math.PI);
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, opacity: show }}>
    <defs><linearGradient id="proof-line"><stop stopColor="#B81A34" stopOpacity="0"/><stop offset=".48" stopColor="#EC627C"/><stop offset="1" stopColor="#FFF4F5"/></linearGradient><filter id="proof-glow"><feGaussianBlur stdDeviation="16"/></filter></defs>
    <path d="M 370 535 H 1500" stroke="#B81A34" strokeOpacity=".22" strokeWidth="26" filter="url(#proof-glow)" />
    <path d={`M 380 535 H ${px}`} stroke="url(#proof-line)" strokeWidth="8" />
    <path d={`M 380 535 H ${px}`} stroke="#FFF3F5" strokeOpacity=".8" strokeWidth="2" />
    <path d="M 1160 80 V 1000" stroke="#EBC9D0" strokeOpacity=".45" strokeWidth="2" />
    <path d="M 1138 80 H 1182 M 1138 1000 H 1182" stroke="#EBC9D0" strokeOpacity=".6" strokeWidth="3" />
    <circle cx={px} cy="535" r={20 + 45 * pulse} fill="none" stroke="#F3DCE0" strokeWidth="3" opacity={.8 - pulse * .3} />
    <polygon points={`${px},490 ${px + 42},535 ${px},580 ${px - 42},535`} fill="#B81A34" stroke="#FFF1F3" strokeWidth="3" transform={`rotate(${travel * 210} ${px} 535)`} />
    <text x="1210" y="194" fill="#F0DCE0" fontFamily={FONT.mono} fontSize="23" letterSpacing="5">PUBLIC CHAIN</text>
    <text x="1210" y="240" fill="#BCA9AE" fontFamily={FONT.mono} fontSize="18" letterSpacing="3">PROOF ONLY / VALUE HIDDEN</text>
    <text x="305" y="793" fill="#BCA9AE" fontFamily={FONT.mono} fontSize="20" letterSpacing="4">SECRET REMAINS SEALED</text>
    <text x="1230" y="598" fill="#F7EBED" fontFamily={FONT.display} fontSize="76" fontWeight="700">VERIFIED</text>
  </svg>;
}

function Outcomes({ t }: { t: number }) {
  const show = fade(t, 14.6, 15.4, 20.2, 20.8);
  const draw = ease(t, 15.1, 17.2);
  const settle = ease(t, 17.0, 18.6);
  return <AbsoluteFill style={{ opacity: show }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,rgba(5,4,6,.2),rgba(5,4,6,.9) 78%)" }} />
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="branch-a"><stop stopColor="#F0D4DA"/><stop offset="1" stopColor="#B81A34"/></linearGradient></defs>
      <path d={`M 530 540 C 760 540 750 ${420 - settle * 40} 990 ${420 - settle * 40} H 1570`} fill="none" stroke="url(#branch-a)" strokeWidth="5" strokeDasharray="1050" strokeDashoffset={1050 * (1 - draw)} />
      <path d={`M 530 540 C 760 540 750 ${700 + settle * 40} 990 ${700 + settle * 40} H 1570`} fill="none" stroke="#B81A34" strokeWidth="6" strokeDasharray="1050" strokeDashoffset={1050 * (1 - draw)} />
      <circle cx="980" cy={420 - settle * 40} r="14" fill="#FFF1F3" /><circle cx="980" cy={700 + settle * 40} r="16" fill="#EA536F" />
      <circle cx="530" cy="540" r="116" fill="#14090D" stroke="#E5C1C8" strokeWidth="3" />
      <circle cx="530" cy="540" r="86" fill="none" stroke="#B81A34" strokeWidth="6" strokeDasharray="9 11" transform={`rotate(${t * 28})`} />
      <path d="M 490 540 H 570 M 530 500 V 580" stroke="#FFF0F2" strokeWidth="4" />
    </svg>
    <div style={{ position: "absolute", left: 112, top: 142, fontFamily: FONT.mono, fontSize: 21, letterSpacing: ".24em", color: "#C7B2B8" }}>ONE TRUST LAYER / TWO POLICY PATHS</div>
    <div style={{ position: "absolute", left: 1080, top: 265, transform: `translateX(${(1 - draw) * 90}px)`, opacity: draw }}>
      <div style={{ fontFamily: FONT.mono, color: "#E7D5D9", letterSpacing: ".22em", fontSize: 20 }}>POLICY 04 / DIRECT</div>
      <div style={{ fontFamily: FONT.display, fontSize: 112, fontWeight: 700, color: "#FFF8F9", lineHeight: 1 }}>DAO</div>
      <div style={{ marginTop: 12, fontFamily: FONT.mono, color: "#C7B2B8", fontSize: 22, letterSpacing: ".12em" }}>PUBLIC GOVERNANCE</div>
    </div>
    <div style={{ position: "absolute", left: 1080, top: 635, transform: `translateX(${(1 - draw) * 90}px)`, opacity: draw }}>
      <div style={{ fontFamily: FONT.mono, color: "#E2778A", letterSpacing: ".22em", fontSize: 20 }}>POLICY 03 / PRIVATE ELIGIBILITY</div>
      <div style={{ fontFamily: FONT.display, fontSize: 84, fontWeight: 700, color: "#FFF8F9", lineHeight: 1 }}>BOJAGI <span style={{ color: "#B81A34" }}>&rarr;</span> LENDING</div>
      <div style={{ marginTop: 12, fontFamily: FONT.mono, color: "#C7B2B8", fontSize: 22, letterSpacing: ".12em" }}>PROOF GATES THE ACTION</div>
    </div>
  </AbsoluteFill>;
}

export const Protocol: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const end = ease(t, 20.3, 21.3);
  const out = raw(t, 23.55, 24);
  const volume = (f: number) => Math.min(raw(f / fps, 0, .7), 1 - raw(f / fps, 23.1, 24)) * .68;
  return <AbsoluteFill style={{ background: "#050406", color: C.text, overflow: "hidden", fontFamily: FONT.display }}>
    <Audio src={staticFile("audio/mixkit-echoes-andrew-ev.mp3")} volume={volume} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 45% 50%, rgba(94,5,27,.58), transparent 38%), radial-gradient(ellipse at 60% 100%, rgba(63,8,25,.7), transparent 55%), #050406" }} />
    <AbsoluteFill style={{ opacity: .25, backgroundImage: "linear-gradient(90deg,transparent 49.8%,rgba(255,255,255,.12) 50%,transparent 50.2%),linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px)", backgroundSize: "100% 100%,100% 180px", transform: `translateY(${((t * 19) % 180) - 90}px)` }} />
    <Sculpture t={t} />
    <ProofTransmission t={t} />
    <Outcomes t={t} />
    <div style={{ position: "absolute", left: 108, top: 82, fontFamily: FONT.mono, fontSize: 19, letterSpacing: ".25em", color: "#C3AAB0", opacity: 1 - end }}>GYEVO / PROTOCOL FILM</div>
    <div style={{ position: "absolute", right: 110, top: 82, fontFamily: FONT.mono, fontSize: 17, letterSpacing: ".2em", color: "#9D858B", opacity: 1 - end }}>01 / PRIVATE PROOF</div>
    <Caption t={t} at={.2} until={5.9}>A PRIVATE FACT TAKES FORM</Caption>
    <Caption t={t} at={5.6} until={9.7}>VALUE SEALED INSIDE THE COMMITMENT</Caption>
    <Caption t={t} at={9.5} until={14.8}>ONLY THE PROOF CROSSES THE BOUNDARY</Caption>
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: end * (1 - out), transform: `scale(${.97 + end * .03})` }}>
      <Img src={staticFile("logo.svg")} style={{ width: 130, height: 130, marginBottom: 26 }} />
      <div style={{ fontSize: 75, fontWeight: 700, letterSpacing: "-.05em", textAlign: "center" }}>Verify the fact.<br/>Prove it privately.</div>
      <div style={{ marginTop: 24, fontFamily: FONT.mono, fontSize: 25, letterSpacing: ".26em", color: "#E5CAD0" }}>GYEVO.TECH</div>
      <div style={{ position: "absolute", bottom: 72, width: 1460, textAlign: "center", fontFamily: FONT.mono, fontSize: 16, lineHeight: 1.8, letterSpacing: ".08em", color: "rgba(230,215,219,.66)" }}>{DISCLOSURE}</div>
    </div>
    <Grain opacity={.09} />
  </AbsoluteFill>;
};
