import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { C, DISCLOSURE, FONT, H, W } from "../lib/theme";
import { Grain } from "../lib/Brand";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const lin = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], clamp);
const pop = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(.16, 1, .3, 1) });
const band = (t: number, a: number, b: number, c: number, d: number) => pop(t, a, b) * (1 - lin(t, c, d));
const impact = (t: number, beats: number[]) => Math.max(0, ...beats.map((beat) => Math.exp(-Math.pow((t - beat) / .18, 2))));
const poly = (r: number, n = 8, shift = Math.PI / 8) => Array.from({ length: n }, (_, i) => `${Math.cos(shift + i * Math.PI * 2 / n) * r},${Math.sin(shift + i * Math.PI * 2 / n) * r}`).join(" ");

function CredentialSeal({ t, x, y, scale = 1, dark = false }: { t: number; x: number; y: number; scale?: number; dark?: boolean }) {
  const spin = t * 12;
  const c = dark ? "#F4EEE5" : "#151113";
  const red = "#C71635";
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <circle r="238" fill="none" stroke={red} strokeWidth="2" strokeDasharray="3 12" transform={`rotate(${spin})`} />
    <polygon points={poly(211)} fill={dark ? "#191316" : "#F3EEE6"} stroke={c} strokeWidth="4" transform={`rotate(${-spin * .55})`} />
    <polygon points={poly(186)} fill={red} stroke={c} strokeWidth="3" />
    <polygon points={poly(157)} fill={dark ? "#F3EEE6" : "#171315"} />
    <circle r="122" fill="none" stroke={red} strokeWidth="3" strokeDasharray="8 8" />
    <text x="0" y="-40" textAnchor="middle" fill={dark ? "#171315" : "#F3EEE6"} fontFamily={FONT.mono} fontSize="25" letterSpacing="5">GYEVO</text>
    <text x="0" y="34" textAnchor="middle" fill={dark ? "#171315" : "#F3EEE6"} fontFamily={FONT.display} fontSize="54" fontWeight="700">SEAL</text>
    <path d="M -66 77 H 66" stroke={red} strokeWidth="5" />
    <text x="0" y="115" textAnchor="middle" fill={dark ? "#50464A" : "#D6C8CA"} fontFamily={FONT.mono} fontSize="14" letterSpacing="3">PRIVATE VALUE</text>
  </g>;
}

function Opening({ t }: { t: number }) {
  const o = band(t, 0, .6, 4.8, 5.55);
  const reveal = pop(t, .05, 1.25);
  const rotate = -9 + 8 * pop(t, .4, 2.6);
  return <AbsoluteFill style={{ opacity: o, background: "#EFEAE1", color: "#121012" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(116deg,transparent 0 48%,#D4C8C5 48% 48.2%,transparent 48.2%),linear-gradient(90deg,rgba(16,12,13,.04) 1px,transparent 1px)", backgroundSize: "100% 100%,64px 100%" }} />
    <div style={{ position: "absolute", top: 72, left: 108, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".24em" }}>GYEVO / GOVERNANCE FILM</div>
    <div style={{ position: "absolute", top: 80, right: 112, fontFamily: FONT.mono, fontSize: 17, letterSpacing: ".18em", color: "#66585D" }}>THE RIGHT TO ACT</div>
    <div style={{ position: "absolute", left: 60, top: 222, fontFamily: FONT.display, fontSize: 315, lineHeight: .82, fontWeight: 700, letterSpacing: "-.09em", transform: `translateX(${(1 - reveal) * -220}px) rotate(${rotate}deg)`, transformOrigin: "left center" }}>TRUST</div>
    <div style={{ position: "absolute", left: 114, top: 555, fontFamily: FONT.display, fontSize: 125, lineHeight: .94, fontWeight: 700, letterSpacing: "-.06em", color: "#C71635", transform: `translateX(${(1 - reveal) * 180}px)` }}>IS A<br/>SYSTEM.</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(1390 580) rotate(${t * 20})`} opacity={reveal}>
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={-260 + i * 24} y={-260 + i * 24} width={520 - i * 48} height={520 - i * 48} fill={i % 2 ? "#F3EEE6" : "none"} stroke={i % 2 ? "#181416" : "#C71635"} strokeWidth={i === 0 ? 5 : 2} transform={`rotate(${i % 2 ? -i * 6 : i * 6})`} />)}
        <circle r="142" fill="#181416" stroke="#C71635" strokeWidth="12" />
        <text y="15" textAnchor="middle" fill="#F4EEE5" fontFamily={FONT.mono} fontSize="38" letterSpacing="6">CRED</text>
      </g>
      {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M ${800 + i * 55} ${880 - ((t * 60 + i * 93) % 1080)} l 0 280`} stroke={i % 3 ? "#151113" : "#C71635"} strokeWidth={i % 3 ? 2 : 7} opacity={.18 + reveal * .22} />)}
    </svg>
    <div style={{ position: "absolute", left: 110, bottom: 96, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".2em", color: "#54484C" }}>CREDENTIAL → POLICY → GOVERNANCE</div>
  </AbsoluteFill>;
}

function PublicVotes({ t }: { t: number }) {
  const o = band(t, 4.45, 5.2, 9.6, 10.35);
  const inP = pop(t, 4.6, 5.7);
  const hit = impact(t, [4.62, 6.4, 6.95, 8.05]);
  return <AbsoluteFill style={{ opacity: o, background: "#171416", color: "#F3EEE6" }}>
    <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,transparent 0 79px,rgba(255,255,255,.11) 80px),linear-gradient(115deg,#171416 0 55%,#261920 55% 100%)" }} />
    <div style={{ position: "absolute", left: 100, top: 85, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".24em", color: "#CFC0C4" }}>02 / THE PUBLIC RECORD</div>
    <div style={{ position: "absolute", left: 88, top: 243, fontFamily: FONT.display, fontSize: 225, fontWeight: 700, letterSpacing: "-.08em", lineHeight: .86, transform: `translateX(${(1 - inP) * -170}px)` }}>PUBLIC<br/><span style={{ color: "#C71635" }}>VOTES</span></div>
    <div style={{ position: "absolute", left: 108, top: 767, fontFamily: FONT.mono, fontSize: 22, letterSpacing: ".18em", color: "#D1C2C6" }}>ORDINARY DAO PARTICIPATION REMAINS VISIBLE</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="gov-sweep"><stop stopColor="#C71635" stopOpacity="0"/><stop offset=".5" stopColor="#C71635"/><stop offset="1" stopColor="#F3EEE6" stopOpacity="0"/></linearGradient></defs>
      <path d="M 730 0 L 1010 0 L 1480 1080 L 1195 1080 Z" fill="#C71635" opacity=".12" />
      {Array.from({ length: 6 }, (_, row) => <g key={row} transform={`translate(${100 + pop(t, 5 + row * .09, 6.15 + row * .09) * 40} ${270 + row * 101})`} opacity={inP}>
        <rect width="865" height="72" fill={row % 2 ? "#211B1E" : "#2A2225"} stroke="#74646A" strokeWidth="1" />
        <text x="26" y="47" fill="#C71635" fontFamily={FONT.mono} fontSize="20" letterSpacing="3">WALLET</text>
        <g transform={`translate(250 36)`}>{Array.from({ length: 15 }, (_, i) => <circle key={i} cx={i * 34} r={i % 3 ? 6 : 11} fill={i % 4 === row % 4 ? "#EEE2E3" : "#C71635"} opacity={i % 4 === row % 4 ? .9 : .65} />)}</g>
        <text x="760" y="45" fill="#B9A9AE" fontFamily={FONT.mono} fontSize="17" letterSpacing="2">ON-CHAIN</text>
      </g>)}
      <path d={`M ${990 + ((t * 190) % 960)} 0 L ${990 + ((t * 190) % 960)} 1080`} stroke="url(#gov-sweep)" strokeWidth="23" opacity=".8" />
      <g transform={`translate(1450 546) rotate(${t * -9}) scale(${1 + hit * .055})`}>
        <circle r="265" fill="#C71635" stroke="#F4EEE6" strokeWidth="8" />
        <circle r="229" fill="none" stroke="#F4EEE6" strokeWidth="2" strokeDasharray="3 12" />
        <text y="-18" textAnchor="middle" fill="#F4EEE6" fontFamily={FONT.display} fontSize="73" fontWeight="700">PUBLIC</text>
        <text y="68" textAnchor="middle" fill="#F4EEE6" fontFamily={FONT.mono} fontSize="26" letterSpacing="7">PROCESS</text>
        <path d="M -110 110 H 110" stroke="#F4EEE6" strokeWidth="4" />
      </g>
    </svg>
  </AbsoluteFill>;
}

function PolicyFour({ t }: { t: number }) {
  const o = band(t, 10.45, 10.9, 15.8, 16.3);
  const p = pop(t, 10.65, 11.45);
  return <AbsoluteFill style={{ opacity: o, background: "#C71635", color: "#F7F1E9" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#A90F2B 0 44%,#C71635 44% 100%)" }} />
    <div style={{ position: "absolute", left: -55, top: 43, fontFamily: FONT.display, fontSize: 720, lineHeight: .9, fontWeight: 700, letterSpacing: "-.12em", opacity: .2 }}>04</div>
    <div style={{ position: "absolute", left: 107, top: 105, fontFamily: FONT.mono, fontSize: 22, letterSpacing: ".22em" }}>POLICY 04 / DIRECT ROUTE</div>
    <div style={{ position: "absolute", left: 116, top: 267, fontFamily: FONT.display, fontSize: 143, lineHeight: .9, fontWeight: 700, letterSpacing: "-.06em", transform: `translateY(${(1 - p) * 130}px)` }}>CREDENTIAL<br/>TO GOVERNANCE</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <path d={`M 780 590 H ${1160 + p * 235}`} stroke="#F4EEE6" strokeWidth="5" strokeDasharray="22 14" />
      <path d={`M ${1185 + p * 145} 545 l 60 45 -60 45`} fill="none" stroke="#F4EEE6" strokeWidth="7" strokeLinejoin="round" />
      <g transform={`translate(1580 577) scale(${.75 + .25 * p})`}>
        <rect x="-230" y="-255" width="460" height="510" fill="#171416" />
        <rect x="-209" y="-233" width="418" height="466" fill="none" stroke="#F4EEE6" strokeWidth="2" />
        <text y="-92" textAnchor="middle" fill="#C71635" fontFamily={FONT.mono} fontSize="26" letterSpacing="6">PUBLIC</text>
        <text y="34" textAnchor="middle" fill="#F4EEE6" fontFamily={FONT.display} fontSize="145" fontWeight="700" letterSpacing="-8">DAO</text>
        <text y="123" textAnchor="middle" fill="#C8B7BC" fontFamily={FONT.mono} fontSize="19" letterSpacing="3">VOTES STAY PUBLIC</text>
      </g>
    </svg>
    <div style={{ position: "absolute", left: 115, bottom: 97, fontFamily: FONT.mono, fontSize: 21, letterSpacing: ".2em" }}>NO PRIVATE PROOF REQUIRED FOR ORDINARY DAO VOTES</div>
  </AbsoluteFill>;
}

function PolicyThree({ t }: { t: number }) {
  const o = band(t, 15.9, 16.45, 22.05, 22.65);
  const p = pop(t, 16.05, 16.95);
  return <AbsoluteFill style={{ opacity: o, background: "#ECE6DC", color: "#171416" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg,#ECE6DC 0 63%,#D9CDD0 63% 63.3%,#ECE6DC 63.3%)" }} />
    <div style={{ position: "absolute", right: -40, top: 15, fontFamily: FONT.display, fontSize: 700, lineHeight: 1, fontWeight: 700, letterSpacing: "-.12em", color: "rgba(199,22,53,.08)" }}>03</div>
    <div style={{ position: "absolute", left: 106, top: 96, fontFamily: FONT.mono, fontSize: 22, letterSpacing: ".22em", color: "#6F5B61" }}>POLICY 03 / PRIVATE ELIGIBILITY</div>
    <div style={{ position: "absolute", left: 108, top: 265, fontFamily: FONT.display, lineHeight: .94, fontWeight: 700, letterSpacing: "-.07em", transform: `translateX(${(1 - p) * -160}px)` }}>
      <div style={{ fontSize: 116 }}>PROVE</div><div style={{ fontSize: 74, color: "#C71635" }}>ELIGIBILITY.</div>
    </div>
    <div style={{ position: "absolute", left: 107, top: 730, fontFamily: FONT.mono, fontSize: 19, letterSpacing: ".13em", color: "#594C50" }}>THE EXACT VALUE STAYS PRIVATE</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <path d={`M 1120 572 H ${1146 + p * 46}`} stroke="#171416" strokeWidth="4" strokeDasharray="10 8" />
      <path d={`M 1182 529 l 58 43 -58 43`} fill="none" stroke="#C71635" strokeWidth="8" strokeLinejoin="round" />
      <g transform={`translate(870 578) rotate(${(1 - p) * 22}) scale(${.78 + .22 * p})`}>
        <polygon points={poly(244)} fill="#C71635" stroke="#171416" strokeWidth="6" />
        <polygon points={poly(206)} fill="#171416" />
        <polygon points={poly(176)} fill="#ECE6DC" stroke="#C71635" strokeWidth="5" />
        <circle r="126" fill="#ECE6DC" stroke="#171416" strokeWidth="3" />
        <text y="-12" textAnchor="middle" fill="#171416" fontFamily={FONT.display} fontSize="50" fontWeight="700">BOJAGI</text>
        <text y="42" textAnchor="middle" fill="#C71635" fontFamily={FONT.mono} fontSize="17" letterSpacing="4">PRIVATE PROOF</text>
        <path d="M -51 83 Q 0 126 51 83" fill="none" stroke="#171416" strokeWidth="3" />
      </g>
      <g transform={`translate(${1305 + p * 40} 578)`}>
        <rect x="-42" y="-240" width="510" height="480" fill="#171416" />
        <rect x="-15" y="-215" width="457" height="430" fill="none" stroke="#C71635" strokeWidth="3" />
        <text x="30" y="-100" fill="#C71635" fontFamily={FONT.mono} fontSize="24" letterSpacing="6">GATED ACTION</text>
        <text x="30" y="42" fill="#F4EEE6" fontFamily={FONT.display} fontSize="103" fontWeight="700" letterSpacing="-5">LENDING</text>
        <text x="30" y="122" fill="#C6B8BB" fontFamily={FONT.mono} fontSize="20" letterSpacing="3">ELIGIBILITY PROOF</text>
      </g>
    </svg>
  </AbsoluteFill>;
}

function Closing({ t }: { t: number }) {
  const o = pop(t, 21.95, 22.65) * (1 - lin(t, 25.5, 26));
  return <AbsoluteFill style={{ opacity: o, background: "#171416", color: "#F3EEE6", justifyContent: "center", alignItems: "center" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%,rgba(199,22,53,.28),transparent 48%)" }} />
    <Img src={staticFile("logo.svg")} style={{ width: 140, height: 140, marginBottom: 30 }} />
    <div style={{ fontFamily: FONT.display, fontSize: 83, fontWeight: 700, letterSpacing: "-.055em", textAlign: "center" }}>Rules define the path.<br/>People shape what follows.</div>
    <div style={{ marginTop: 26, fontFamily: FONT.mono, fontSize: 24, letterSpacing: ".26em", color: "#E8C6CC" }}>GYEVO.TECH</div>
    <div style={{ position: "absolute", left: 200, right: 200, bottom: 70, textAlign: "center", fontFamily: FONT.mono, fontSize: 15, lineHeight: 1.8, letterSpacing: ".08em", color: "rgba(230,215,219,.66)" }}>{DISCLOSURE}</div>
  </AbsoluteFill>;
}

export const Governance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const volume = (f: number) => Math.min(lin(f / fps, 0, .6), 1 - lin(f / fps, 25.2, 26)) * .62;
  return <AbsoluteFill style={{ background: C.paper, overflow: "hidden", fontFamily: FONT.display }}>
    <Audio src={staticFile("audio/mixkit-close-up-michael-ramir-c.mp3")} volume={volume} />
    <Opening t={t} />
    <PublicVotes t={t} />
    <PolicyFour t={t} />
    <PolicyThree t={t} />
    <Closing t={t} />
    <Grain opacity={.045} />
  </AbsoluteFill>;
};
