import { AbsoluteFill } from "remotion";
import { C, FONT, W } from "./theme";
import { easeInOut, easeOut, lerp, prog } from "./motion";
import { Ground, Mono, Vignette } from "./Brand";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i - Math.PI / 6;
    return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  }).join(" ");

/** The secret stays at the left of the trust boundary while only a compact proof crosses it. */
export function PrivacyTransformation({ t }: { t: number }) {
  const enter = prog(t, 3.4, 4.25, easeOut);
  const focus = prog(t, 5.4, 6.45, easeInOut);
  const headline = prog(t, 5.42, 5.8, easeOut);
  const seal = prog(t, 5.8, 6.8, easeInOut);
  const travel = prog(t, 7.0, 8.15, easeInOut);
  const exit = prog(t, 8.55, 9.0, easeInOut);
  const data = ["a7", "3f", "9c", "52", "e1", "0b", "84", "6d", "f2", "7a", "c9", "11"];
  const secretX = lerp(1380, 620, focus);
  const secretY = lerp(550, 645, focus);
  const proofX = lerp(680, 1460, travel);
  return (
    <AbsoluteFill style={{ background: C.ink, opacity: 1 - exit }}>
      <Ground tone="dark" t={t} glow={0.8} />
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="privacy-beam" x1="0" x2="1">
            <stop stopColor={C.wine} stopOpacity="0" />
            <stop offset="1" stopColor={C.wine} stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="960" y1="150" x2="960" y2="900" stroke="white" strokeOpacity={0.1 + 0.23 * seal} strokeWidth="2" strokeDasharray="8 15" />
        <line x1="690" y1="645" x2={proofX} y2="645" stroke={C.wine} strokeWidth="3" opacity={travel} />
        <circle cx="960" cy="645" r={14 + 55 * Math.sin(travel * Math.PI)} fill="none" stroke={C.wine} strokeWidth="2" opacity={travel * (1 - travel)} />
        {[0, 1, 2].map((i) => <polygon key={i} points={hex(secretX, secretY, 170 + i * 42 - 42 * seal)} fill={i === 0 ? C.burgundy : "none"} fillOpacity={i === 0 ? seal * 0.72 : 0} stroke={i === 0 ? C.wine : C.text} strokeOpacity={(0.75 - i * 0.2) * enter} strokeWidth={i === 0 ? 4 : 1.5} transform={`rotate(${i % 2 ? -t * 7 : t * 5} ${secretX} ${secretY})`} />)}
        {data.map((glyph, i) => {
          const a = i * Math.PI * 2 / data.length + t * 0.38;
          const r = lerp(230, 62 + (i % 3) * 12, seal);
          return <text key={i} x={secretX + Math.cos(a) * r} y={secretY + Math.sin(a) * r} textAnchor="middle" fill={C.text} opacity={enter * (1 - seal * 0.85)} fontFamily="JetBrains Mono" fontSize="27">{glyph}</text>;
        })}
        <polygon points={hex(proofX, 645, 65)} fill={C.wine} stroke={C.text} strokeWidth="2" opacity={travel} transform={`rotate(${travel * 180} ${proofX} 645)`} />
        <path d="m1435 645 17 18 36-39" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity={prog(t, 8.1, 8.4, easeOut)} />
      </svg>
      <div style={{ position: "absolute", top: 84, left: 116, opacity: enter }}><Mono size={19} tracking="0.28em" color={C.muted}>GYEVO / THE PRINCIPLE</Mono></div>
      <div style={{ position: "absolute", top: 86, right: 116, opacity: enter }}><Mono size={19} tracking="0.22em" color={C.muted}>01 — PRIVATE BY DESIGN</Mono></div>
      <div style={{ position: "absolute", left: 110, top: 315, width: 1100, opacity: enter * (1 - prog(t, 5.12, 5.42, easeInOut)), transform: `translateY(${(1 - enter) * 90 - focus * 70}px)` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 125, fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.055em", color: C.text }}>Your private value</div>
        <div style={{ fontFamily: FONT.display, fontSize: 125, fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.055em", color: C.wine }}>stays private.</div>
      </div>
      <div style={{ position: "absolute", left: 115, top: 180, opacity: headline, transform: `translateY(${(1 - headline) * 60}px)` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 84, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>Seal the fact.</div>
        <div style={{ fontFamily: FONT.display, fontSize: 84, fontWeight: 700, color: C.wine, lineHeight: 1.1 }}>Send the proof.</div>
      </div>
      <div style={{ position: "absolute", left: 395, top: 860, opacity: seal }}><Mono size={22} tracking="0.18em" color={C.muted}>PRIVATE / ON YOUR DEVICE</Mono></div>
      <div style={{ position: "absolute", left: 1045, top: 860, opacity: travel }}><Mono size={22} tracking="0.18em" color={C.muted}>PUBLIC / VERIFIED ON-CHAIN</Mono></div>
      <div style={{ position: "absolute", left: 116, bottom: 85, width: W - 232, height: 2, background: C.line }}><div style={{ width: `${clamp((t - 3.4) / 5.6) * 100}%`, height: 2, background: C.wine }} /></div>
      <Vignette strength={0.42} />
    </AbsoluteFill>
  );
}

/** The recurring seal changes meaning through credential, private proof and governance. */
export function ProtocolSystems({ t }: { t: number }) {
  const stages = [
    { at: 17, end: 18.8, name: "DOJANG", number: "01", line: "A project credential", sub: "confirms eligibility", note: "PROJECT ISSUED / WALLET BOUND" },
    { at: 18.8, end: 20.6, name: "BOJAGI", number: "02", line: "A private proof", sub: "reveals no secret", note: "POLICY 3 / PRIVATE WITNESS" },
    { at: 20.6, end: 22.4, name: "DAO", number: "03", line: "A public decision", sub: "by eligible wallets", note: "POLICY 4 / NO PROOF REQUIRED" },
  ];
  return <AbsoluteFill style={{ background: C.ink }}>
    <Ground tone="dark" t={t} glow={0.7} />
    <div style={{ position: "absolute", left: 100, right: 100, top: 83, display: "flex", justifyContent: "space-between" }}>
      <Mono size={20} color={C.muted} tracking="0.25em">GYEVO / ONE TRUST LAYER</Mono>
      <Mono size={20} color={C.muted} tracking="0.25em">CREDENTIAL → PROOF → ACCESS</Mono>
    </div>
    {stages.map((s, i) => {
      const p = prog(t, s.at, s.at + 0.45, easeOut);
      const out = prog(t, s.end - 0.34, s.end, easeInOut);
      const k = p * (1 - out);
      const cx = 1380, cy = 535;
      return <div key={s.name} style={{ position: "absolute", inset: 0, opacity: k }}>
        <div style={{ position: "absolute", left: 100, top: 260 }}><Mono size={24} color={C.wine} tracking="0.32em">{s.number} / 03</Mono></div>
        <div style={{ position: "absolute", left: 92, top: 325, fontFamily: FONT.display, fontWeight: 700, fontSize: i === 2 ? 214 : 164, letterSpacing: "-0.055em", color: C.text, lineHeight: 1, transform: `translateX(${(1 - p) * -90 + out * 60}px)` }}>{s.name}</div>
        <div style={{ position: "absolute", left: 105, top: 570, fontFamily: FONT.display, fontWeight: 600, fontSize: 58, lineHeight: 1.18, color: C.text }}>{s.line}<br/><span style={{ color: C.wine }}>{s.sub}</span></div>
        <div style={{ position: "absolute", left: 108, top: 835 }}><Mono size={22} color={C.muted} tracking="0.2em">{s.note}</Mono></div>
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 6 }, (_, ring) => <polygon key={ring} points={hex(cx, cy, 105 + ring * 44)} fill={ring === 0 ? C.burgundy : "none"} fillOpacity={ring === 0 ? .75 : 0} stroke={ring % 2 ? C.text : C.wine} strokeOpacity={.9 - ring * .1} strokeWidth={ring === 0 ? 3 : 1.5} transform={`rotate(${t * (ring % 2 ? -12 : 10)} ${cx} ${cy})`}/>)}
          {i === 0 ? <text x={cx} y={cy + 14} textAnchor="middle" fill="white" fontFamily="JetBrains Mono" fontSize="35">P4 / P3</text> : null}
          {i === 1 ? <><line x1="1020" y1={cy} x2={cx + 250} y2={cy} stroke={C.wine} strokeWidth="3" strokeDasharray="20 14"/><circle cx={cx} cy={cy} r="38" fill="white"/></> : null}
          {i === 2 ? <path d={`m${cx - 38} ${cy} 27 28 56-68`} stroke="white" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round"/> : null}
        </svg>
      </div>;
    })}
    <Vignette strength={0.4}/>
  </AbsoluteFill>;
}

/** Two outcomes shown as authorization paths, not invented interface screens or vote results. */
export function ProtocolOutcomes({ t }: { t: number }) {
  const p = prog(t, 22.4, 23.15, easeOut);
  const line = prog(t, 23.0, 24.35, easeInOut);
  const end = prog(t, 26.4, 27, easeInOut);
  return <AbsoluteFill style={{ background: C.ink, opacity: 1 - end }}>
    <Ground tone="dark" t={t} glow={0.7}/>
    <div style={{ position: "absolute", left: 115, top: 105, opacity: p }}><Mono size={22} color={C.muted} tracking="0.3em">ONE CREDENTIAL LAYER. TWO PATHS.</Mono></div>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
      <circle cx="390" cy="570" r="170" fill={C.burgundy} fillOpacity={p * .7} stroke={C.wine} strokeWidth="3"/>
      <polygon points={hex(390,570,185)} fill="none" stroke="white" strokeOpacity={p * .6} strokeWidth="2" transform={`rotate(${t * 9} 390 570)`}/>
      <path d="M570 520 H810 Q900 520 920 390 H1260" fill="none" stroke={C.text} strokeWidth="4" strokeDasharray="900" strokeDashoffset={900 * (1 - line)} />
      <path d="M570 620 H810 Q900 620 920 755 H1260" fill="none" stroke={C.wine} strokeWidth="4" strokeDasharray="900" strokeDashoffset={900 * (1 - line)} />
      <circle cx="1260" cy="390" r={10 + line * 20} fill={C.text}/><circle cx="1260" cy="755" r={10 + line * 20} fill={C.wine}/>
    </svg>
    <div style={{ position: "absolute", left: 255, top: 540, fontFamily: FONT.display, fontWeight: 700, fontSize: 44, color: C.text, opacity: p }}>DOJANG</div>
    <div style={{ position: "absolute", left: 1020, top: 235, opacity: line }}><Mono size={20} color={C.text} tracking="0.18em">POLICY 4 / DIRECT</Mono><div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 98, color: C.text }}>DAO</div><div style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 35, color: C.muted }}>Proposals + public votes</div></div>
    <div style={{ position: "absolute", left: 1020, top: 690, opacity: line }}><Mono size={20} color={C.wine} tracking="0.18em">POLICY 3 / BOJAGI PROOF</Mono><div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 98, color: C.text }}>LENDING V2</div><div style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 35, color: C.muted }}>Private eligibility for gated actions</div></div>
    <Vignette strength={0.4}/>
  </AbsoluteFill>;
}
