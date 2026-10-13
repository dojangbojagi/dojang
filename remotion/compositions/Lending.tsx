import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { C, DISCLOSURE, FONT, H, W } from "../lib/theme";
import { Grain } from "../lib/Brand";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const lin = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], clamp);
const move = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(.16, 1, .3, 1) });
const span = (t: number, a: number, b: number, c: number, d: number) => move(t, a, b) * (1 - lin(t, c, d));
const hexPts = (r: number) => Array.from({ length: 6 }, (_, i) => `${Math.cos(i * Math.PI / 3) * r},${Math.sin(i * Math.PI / 3) * r}`).join(" ");

function Chapter({ children, n, t, a, b, c, d, light = false }: { children: React.ReactNode; n: string; t: number; a: number; b: number; c: number; d: number; light?: boolean }) {
  const o = span(t, a, b, c, d);
  return <div style={{ position: "absolute", left: 105, top: 72, opacity: o, color: light ? "#171416" : "#F4EEE6", fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".2em", textTransform: "uppercase" }}>{n} / {children}</div>;
}

function ProofGate({ t }: { t: number }) {
  const o = span(t, 0, .45, 3.45, 4.0);
  const resolve = move(t, .25, 2.4);
  const pass = move(t, 2.1, 3.4);
  const pulse = .5 + .5 * Math.sin(t * 5);
  return <AbsoluteFill style={{ opacity: o, background: "radial-gradient(ellipse at 64% 48%,#172735 0,#0B111A 47%,#07090D 100%)", color: "#F3EEE6" }}>
    <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)", backgroundSize: "120px 120px", transform: `translate(${(t * 9) % 120}px,${(t * 7) % 120}px)` }} />
    <div style={{ position: "absolute", right: 70, top: 187, fontFamily: FONT.display, fontSize: 300, lineHeight: .8, fontWeight: 700, letterSpacing: "-.08em", color: "rgba(244,238,230,.07)", transform: `translateX(${(1 - resolve) * 200}px)` }}>PROOF</div>
    <Chapter t={t} a={0} b={.4} c={3.4} d={4} n="01">private eligibility</Chapter>
    <div style={{ position: "absolute", left: 102, top: 237, fontFamily: FONT.display, fontSize: 108, fontWeight: 700, lineHeight: .92, letterSpacing: "-.065em", transform: `translateY(${(1 - resolve) * 90}px)`, opacity: o }}>
      Access with<br/><span style={{ color: "#D73150" }}>a proof.</span>
    </div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="l-gate"><stop stopColor="#E9D9D0"/><stop offset="1" stopColor="#D73150"/></linearGradient><filter id="l-glow"><feGaussianBlur stdDeviation="16"/></filter></defs>
      <path d="M 600 510 H 1600" stroke="#D73150" strokeWidth="30" opacity=".18" filter="url(#l-glow)" />
      <path d={`M 610 510 H ${610 + pass * 1010}`} stroke="url(#l-gate)" strokeWidth="6" />
      <g transform={`translate(1100 510) translate(0 ${Math.sin(t * 3) * 15})`}>
        <rect x="-247" y="-284" width="494" height="568" rx="16" fill="#101821" stroke="#9EADB7" strokeWidth="3" transform={`translate(${-115 * resolve} 0)`} />
        <rect x="-210" y="-249" width="420" height="498" fill="#080D13" stroke="#314453" strokeWidth="2" transform={`translate(${-80 * resolve} 0)`} />
        <text x="-162" y="-172" fill="#95A8B2" fontFamily={FONT.mono} fontSize="20" letterSpacing="4">BOJAGI / WITNESS</text>
        <text x="-162" y="-82" fill="#F4EEE6" fontFamily={FONT.display} fontSize="55" fontWeight="700">VALUE</text>
        <rect x="-164" y="-53" width="290" height="108" fill="#05070A" stroke="#D73150" strokeWidth="2" />
        {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M ${-143 + i * 24} -40 V 37`} stroke="#D73150" strokeWidth="5" opacity={.5 + .3 * pulse} />)}
        <text x="-162" y="117" fill="#B8C2C5" fontFamily={FONT.mono} fontSize="18" letterSpacing="3">EXACT VALUE / PRIVATE</text>
        <circle cx="162" cy="0" r="56" fill="#111D25" stroke="#F3EEE6" strokeWidth="3" />
        <path d="m135 1 18 20 39-45" fill="none" stroke="#E4D8D3" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <polygon points={`${610 + pass * 1010},478 ${642 + pass * 1010},510 ${610 + pass * 1010},542 ${578 + pass * 1010},510`} fill="#D73150" stroke="#F7ECE9" strokeWidth="3" />
    </svg>
    <div style={{ position: "absolute", left: 104, bottom: 111, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".16em", color: "#A9B7BE" }}>ELIGIBILITY PRIVATE / AUTHORIZATION PUBLICLY VERIFIABLE</div>
  </AbsoluteFill>;
}

function Supply({ t }: { t: number }) {
  const o = span(t, 3.45, 4.1, 7.15, 7.8);
  const flow = move(t, 3.9, 6.75);
  const lift = move(t, 4.9, 6.5);
  const fill = move(t, 5.25, 7.0);
  return <AbsoluteFill style={{ opacity: o, background: "#EDE7DD", color: "#171416" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg,#EDE7DD 0 50%,#D9D0C6 50% 100%)" }} />
    <Chapter t={t} a={3.45} b={4.1} c={7.15} d={7.8} n="02" light>SUPPLY / LIQUIDITY</Chapter>
    <div style={{ position: "absolute", left: 104, top: 195, fontFamily: FONT.display, fontSize: 126, fontWeight: 700, lineHeight: .88, letterSpacing: "-.07em" }}>ASSETS<br/>IN MOTION</div>
    <div style={{ position: "absolute", left: 106, top: 507, fontFamily: FONT.mono, fontSize: 21, letterSpacing: ".15em", color: "#65575B" }}>SUPPLY ADDS LIQUIDITY TO THE RESERVE</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="s-channel"><stop stopColor="#171416"/><stop offset=".7" stopColor="#731026"/><stop offset="1" stopColor="#C71635"/></linearGradient><linearGradient id="s-reserve" x2="0" y2="1"><stop stopColor="#C71635" stopOpacity=".8"/><stop offset="1" stopColor="#711026"/></linearGradient></defs>
      <path d="M 95 817 C 420 817 538 747 737 747 H 1340" fill="none" stroke="#AAA099" strokeWidth="10" />
      <path d={`M 95 817 C 420 817 538 747 737 747 H ${770 + flow * 620}`} fill="none" stroke="url(#s-channel)" strokeWidth="18" />
      {/* Distinct asset ingots travel into a deep reserve chamber. */}
      {Array.from({ length: 5 }, (_, i) => {
        const local = Math.max(0, Math.min(1, flow * 1.26 - i * .17));
        const x = 152 + i * 125 + local * 420;
        const y = 690 - i * 7 - local * 46;
        return <g key={i} transform={`translate(${x} ${y}) rotate(${(1 - local) * (i % 2 ? -17 : 14)})`}>
          <polygon points="-52,-36 28,-36 54,0 28,36 -52,36 -75,0" fill={i % 2 ? "#C71635" : "#171416"} stroke="#F4EEE6" strokeWidth="3" />
          <path d="M -35 0 H 22" stroke="#EDE7DD" strokeWidth="3" opacity=".72" />
        </g>;
      })}
      <g transform="translate(1450 582)">
        <path d="M -225 -205 L 225 -205 L 180 214 L -180 214 Z" fill="#171416" stroke="#BCAFA6" strokeWidth="6" />
        <path d={`M -177 ${186 - lift * 330} L 177 ${186 - lift * 330} L 208 -168 L -208 -168 Z`} fill="url(#s-reserve)" opacity=".86" />
        <path d="M -224 -147 H 224 M -215 159 H 215" stroke="#F1EAE2" strokeWidth="3" opacity=".5" />
        <text y="-240" textAnchor="middle" fill="#171416" fontFamily={FONT.mono} fontSize="22" letterSpacing="5">RESERVE / LIQUIDITY</text>
        {Array.from({ length: 4 }, (_, i) => <path key={i} d={`M ${-115 + i * 75} 45 v ${-85 - fill * 50}`} stroke="#F3D5DB" strokeWidth="3" opacity={.8 - i * .1} />)}
      </g>
    </svg>
  </AbsoluteFill>;
}

function Collateral({ t }: { t: number }) {
  const o = span(t, 7.1, 7.8, 11.2, 11.85);
  const inP = move(t, 7.35, 9.0);
  const orbit = t * 48;
  return <AbsoluteFill style={{ opacity: o, background: "#111319", color: "#F4EEE6" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 57%,rgba(128,63,24,.32),transparent 48%),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "100% 100%,92px 100%" }} />
    <Chapter t={t} a={7.1} b={7.8} c={11.2} d={11.85} n="03">COLLATERAL / RISK BOUNDARY</Chapter>
    <div style={{ position: "absolute", left: 102, top: 221, fontFamily: FONT.display, fontSize: 137, fontWeight: 700, lineHeight: .87, letterSpacing: "-.07em" }}>VALUE<br/><span style={{ color: "#E7A552" }}>SECURED.</span></div>
    <div style={{ position: "absolute", left: 106, top: 577, fontFamily: FONT.mono, fontSize: 21, letterSpacing: ".16em", color: "#C7B8B6" }}>COLLATERAL SETS THE BORROWING BOUND</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs><radialGradient id="c-core"><stop stopColor="#E7A552"/><stop offset=".65" stopColor="#8C481B"/><stop offset="1" stopColor="#211913"/></radialGradient><filter id="c-shadow"><feGaussianBlur stdDeviation="22"/></filter></defs>
      <ellipse cx="1292" cy="853" rx="432" ry="48" fill="#000" opacity=".8" filter="url(#c-shadow)" />
      <g transform={`translate(1290 550) scale(${.83 + .17 * inP})`}>
        <polygon points={hexPts(308)} fill="#1D1C20" stroke="#E7A552" strokeWidth="9" transform={`rotate(${orbit * .12})`} />
        <polygon points={hexPts(266)} fill="none" stroke="#F3E3D0" strokeWidth="3" strokeDasharray="8 12" transform={`rotate(${-orbit * .18})`} />
        <polygon points={hexPts(207)} fill="#111319" stroke="#B77837" strokeWidth="3" />
        <path d="M -290 0 H 290" stroke="#F2BC72" strokeWidth="5" opacity=".8" />
        <path d="M 0 -282 V 282" stroke="#F2BC72" strokeWidth="3" opacity=".6" />
        <circle r="131" fill="url(#c-core)" stroke="#F6E3CB" strokeWidth="5" />
        <circle r="103" fill="none" stroke="#3A2517" strokeWidth="3" strokeDasharray="10 8" />
        <text y="-3" textAnchor="middle" fill="#171416" fontFamily={FONT.mono} fontSize="24" letterSpacing="5">ASSET</text>
        <text y="45" textAnchor="middle" fill="#171416" fontFamily={FONT.display} fontSize="39" fontWeight="700">LOCKED</text>
        {Array.from({ length: 3 }, (_, i) => <g key={i} transform={`rotate(${orbit + i * 120}) translate(0 -310)`}>
          <polygon points={hexPts(36)} fill="#E7A552" stroke="#F5E5D0" strokeWidth="3" />
          <circle r="8" fill="#171416" />
        </g>)}
      </g>
      <path d="M 808 830 H 1220" stroke="#E7A552" strokeWidth="2" strokeDasharray="7 10" opacity=".75" />
    </svg>
  </AbsoluteFill>;
}

function Borrow({ t }: { t: number }) {
  const o = span(t, 10.95, 11.65, 15.45, 16.0);
  const release = move(t, 11.25, 15.44);
  const gate = move(t, 12.3, 15.44);
  return <AbsoluteFill style={{ opacity: o, background: "linear-gradient(112deg,#091D1D 0 48%,#0C1114 48% 100%)", color: "#F4EEE6" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 71% 49%,rgba(20,133,118,.26),transparent 42%)" }} />
    <Chapter t={t} a={10.95} b={11.65} c={15.15} d={15.85} n="04">BORROW / WITHIN RISK LIMITS</Chapter>
    <div style={{ position: "absolute", left: 100, top: 214, fontFamily: FONT.display, fontSize: 125, fontWeight: 700, lineHeight: .88, letterSpacing: "-.07em" }}>LIQUIDITY<br/><span style={{ color: "#58D2B8" }}>RELEASED.</span></div>
    <div style={{ position: "absolute", left: 105, top: 570, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".15em", color: "#B8CBC7" }}>BORROW WITHIN THE COLLATERAL BOUND</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="b-flow"><stop stopColor="#56D1B6" stopOpacity=".2"/><stop offset=".5" stopColor="#9BE7D6"/><stop offset="1" stopColor="#F4EEE6"/></linearGradient><filter id="b-glow"><feGaussianBlur stdDeviation="15"/></filter></defs>
      <g transform="translate(920 600)">
        <path d="M -175 -212 H 120 L 180 -142 V 178 L 105 232 H -175 Z" fill="#142522" stroke="#53C5AE" strokeWidth="4" />
        <path d="M -142 119 H 116 M -142 78 H 116 M -142 37 H 116" stroke="#53C5AE" strokeOpacity=".65" strokeWidth="7" />
        <text x="-133" y="-139" fill="#D8EEE8" fontFamily={FONT.mono} fontSize="20" letterSpacing="3">AVAILABLE</text>
        <text x="-133" y="-65" fill="#F4EEE6" fontFamily={FONT.display} fontSize="44" fontWeight="700">RESERVE</text>
      </g>
      <path d="M 1098 600 C 1190 600 1190 415 1280 415 H 1630" stroke="#1C5E55" strokeWidth="56" fill="none" opacity=".64" />
      {[0, 1, 2].map((i) => <path key={i} d={`M 1098 ${555 + i * 45} C 1190 ${555 + i * 45} 1190 ${370 + i * 45} 1280 ${370 + i * 45} H 1640`} stroke="url(#b-flow)" strokeWidth={i === 1 ? 13 : 5} fill="none" opacity={.4 + .6 * release} strokeDasharray="34 25" strokeDashoffset={-release * 430 - i * 22} />)}
      <g transform={`translate(1435 415) scale(${.93 + gate * .07})`}>
        <polygon points={hexPts(264)} fill="#101819" stroke="#58D2B8" strokeWidth="8" />
        <polygon points={hexPts(211)} fill="none" stroke="#DDF3EE" strokeWidth="3" strokeDasharray="5 9" />
        <path d="M -165 -1 H 165" stroke="#58D2B8" strokeWidth="4" />
        <text y="-27" textAnchor="middle" fill="#F2EEE8" fontFamily={FONT.display} fontSize="50" fontWeight="700">LIMIT</text>
        <text y="43" textAnchor="middle" fill="#AFC7C1" fontFamily={FONT.mono} fontSize="17" letterSpacing="4">RISK BOUND</text>
      </g>
      {Array.from({ length: 5 }, (_, i) => {
        const x = 1110 + ((t * 125 + i * 179) % 360);
        const y = 600 - (x - 590) * .39;
        return <g key={i} transform={`translate(${x} ${y}) rotate(${t * 17 + i * 32})`} opacity={.35 + .6 * release}>
          <polygon points={hexPts(19)} fill={i % 2 ? "#F4EEE6" : "#58D2B8"} stroke="#07201D" strokeWidth="2" />
        </g>;
      })}
    </svg>
  </AbsoluteFill>;
}

function Repay({ t }: { t: number }) {
  const o = span(t, 14.85, 15.5, 18.55, 19.2);
  const returnP = move(t, 15.1, 17.8);
  const equalize = move(t, 17.25, 18.6);
  return <AbsoluteFill style={{ opacity: o, background: "#DFE9E3", color: "#15221D" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(130deg,#DFE9E3 0 55%,#B5C8BE 55% 55.2%,#DFE9E3 55.2%)" }} />
    <Chapter t={t} a={14.85} b={15.5} c={18.55} d={19.2} n="05" light>REPAY / RESTORE THE BALANCE</Chapter>
    <div style={{ position: "absolute", left: 103, top: 215, fontFamily: FONT.display, fontSize: 128, lineHeight: .9, fontWeight: 700, letterSpacing: "-.075em" }}>RETURN<br/><span style={{ color: "#177E66" }}>THE FLOW.</span></div>
    <div style={{ position: "absolute", left: 107, top: 565, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".15em", color: "#52655C" }}>REPAYMENT REVERSES THE BORROW PATH</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="r-ribbon"><stop stopColor="#177E66"/><stop offset="1" stopColor="#6DC3A5"/></linearGradient></defs>
      <g transform="translate(1410 579)">
        <path d="M -210 -211 H 207 L 154 210 H -155 Z" fill="#17211E" stroke="#177E66" strokeWidth="5" />
        <path d={`M -156 ${152 - equalize * 172} H 156`} stroke="#8CE2C0" strokeWidth="7" />
        <path d="M -145 188 V -160 M 0 188 V -160 M 145 188 V -160" stroke="#86AA9C" strokeOpacity=".45" strokeWidth="2" />
        <text y="-95" textAnchor="middle" fill="#E2EAE4" fontFamily={FONT.mono} fontSize="21" letterSpacing="4">BALANCE</text>
        <circle cy="18" r="68" fill="#177E66" stroke="#E1EAE3" strokeWidth="4" />
        <path d="m-31 18 23 25 49-55" fill="none" stroke="#EFF4EE" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M 1330 635 C 1100 635 1040 760 810 760 H 500" stroke="#6C887B" strokeWidth="44" fill="none" opacity=".65" />
      <path d={`M 1325 635 C ${1100 - returnP * 100} 635 1030 760 ${820 - returnP * 390} 760 H ${810 - returnP * 280}`} stroke="url(#r-ribbon)" strokeWidth="13" fill="none" strokeDasharray="32 22" strokeDashoffset={returnP * -360} />
      {Array.from({ length: 6 }, (_, i) => {
        const local = Math.max(0, Math.min(1, returnP * 1.2 - i * .15));
        const x = 1290 - local * 640 - i * 23;
        const y = 635 + (x - 1290) * -.22;
        return <g key={i} transform={`translate(${x} ${y}) rotate(${local * 50})`}>
          <polygon points={hexPts(25)} fill="#177E66" stroke="#ECF3EC" strokeWidth="3" />
          <path d="M -8 0 H 8" stroke="#ECF3EC" strokeWidth="3" />
        </g>;
      })}
      <path d="M 700 845 H 1310" stroke="#177E66" strokeWidth="3" strokeDasharray="9 13" opacity=".5" />
    </svg>
  </AbsoluteFill>;
}

function Withdraw({ t }: { t: number }) {
  const o = span(t, 18.25, 18.9, 21.2, 21.85);
  const open = move(t, 18.5, 20.0);
  const leave = move(t, 19.1, 21.0);
  return <AbsoluteFill style={{ opacity: o, background: "#14141C", color: "#F4EEE6" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 67% 44%,rgba(143,36,59,.26),transparent 47%),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)", backgroundSize: "100% 100%,118px 100%" }} />
    <Chapter t={t} a={18.25} b={18.9} c={21.2} d={21.85} n="06">WITHDRAW / RELEASE</Chapter>
    <div style={{ position: "absolute", left: 104, top: 225, fontFamily: FONT.display, fontSize: 130, lineHeight: .88, fontWeight: 700, letterSpacing: "-.075em" }}>COLLATERAL<br/><span style={{ color: "#EB7890" }}>RELEASED.</span></div>
    <div style={{ position: "absolute", left: 107, top: 584, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".15em", color: "#C9BBC0" }}>AFTER REPAYMENT / THE LOCK OPENS</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g transform="translate(1420 618)">
        <path d={`M -298 145 L -298 ${-220 - open * 95} L -26 ${-220 - open * 95} L -26 145 Z`} fill="#20171B" stroke="#EBC4CB" strokeWidth="5" transform={`translate(${-open * 86} 0)`} />
        <path d={`M 298 145 L 298 ${-220 - open * 95} L 26 ${-220 - open * 95} L 26 145 Z`} fill="#2A171D" stroke="#B81A34" strokeWidth="5" transform={`translate(${open * 86} 0)`} />
        <rect x="-44" y="-130" width="88" height="275" fill="#08090D" stroke="#8A5C66" strokeWidth="3" />
        <path d="M -270 145 H 270 M -220 194 H 220" stroke="#EBC4CB" strokeWidth="3" />
        <text y="240" textAnchor="middle" fill="#D2C0C5" fontFamily={FONT.mono} fontSize="18" letterSpacing="4">RELEASE GATE</text>
      </g>
      {Array.from({ length: 4 }, (_, i) => {
        const y = 510 - leave * (270 + i * 53);
        const x = 1325 + (i % 2 ? 135 : -135);
        return <g key={i} transform={`translate(${x} ${y}) rotate(${leave * 24 + i * 21})`} opacity={.2 + leave * .8}>
          <polygon points={hexPts(38)} fill={i % 2 ? "#B81A34" : "#EBC4CB"} stroke="#F9EFF0" strokeWidth="3" />
          <circle r="9" fill="#14141C" />
        </g>;
      })}
      <path d={`M 1420 535 V ${350 - leave * 210}`} stroke="#EBC4CB" strokeWidth="3" strokeDasharray="9 12" opacity={leave} />
      <path d="M 1320 352 l 100-92 100 92" fill="none" stroke="#EBC4CB" strokeWidth="4" opacity={leave} />
    </svg>
  </AbsoluteFill>;
}

function PublicState({ t }: { t: number }) {
  const o = span(t, 20.8, 21.5, 23.2, 23.75);
  const reveal = move(t, 21.0, 22.2);
  return <AbsoluteFill style={{ opacity: o, background: "#E9E3DB", color: "#171416" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg,#E9E3DB 0 69%,#171416 69% 100%)" }} />
    <Chapter t={t} a={20.8} b={21.5} c={23.2} d={23.75} n="07" light>PUBLIC RECORD / PRIVATE VALUE</Chapter>
    <div style={{ position: "absolute", left: 102, top: 220, fontFamily: FONT.display, fontSize: 117, lineHeight: .92, fontWeight: 700, letterSpacing: "-.075em" }}>PROOF STAYS<br/><span style={{ color: "#B81A34" }}>PRIVATE.</span></div>
    <div style={{ position: "absolute", left: 105, top: 568, fontFamily: FONT.mono, fontSize: 20, letterSpacing: ".17em", color: "#5F5356" }}>TX + POSITIONS / PUBLIC ON-CHAIN</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(1250 550) scale(${.9 + reveal * .1})`}>
        <rect x="-242" y="-260" width="484" height="520" fill="#171416" stroke="#B81A34" strokeWidth="4" />
        <text x="-194" y="-175" fill="#B7A8AA" fontFamily={FONT.mono} fontSize="19" letterSpacing="4">ELIGIBILITY VALUE</text>
        <rect x="-192" y="-143" width="380" height="116" fill="#08080B" stroke="#C71635" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M ${-175 + i * 31} -131 V -38`} stroke="#C71635" strokeWidth="5" opacity={.55 + .25 * Math.sin(t * 3 + i)} />)}
        <text x="-194" y="31" fill="#E7D9DB" fontFamily={FONT.mono} fontSize="21" letterSpacing="4">HIDDEN / PRIVATE</text>
        <path d="M -190 84 H 190" stroke="#695C60" strokeWidth="2" />
        <text x="-194" y="141" fill="#B7A8AA" fontFamily={FONT.mono} fontSize="17" letterSpacing="3">PROOF AUTHORIZED</text>
      </g>
      {[0, 1].map((r) => <g key={r} transform={`translate(270 ${745 + r * 69})`}>
        <rect width="720" height="51" fill={r ? "#D5CDC5" : "#DAD1C9"} stroke="#8D7C7D" strokeWidth="1" />
        <text x="22" y="34" fill="#171416" fontFamily={FONT.mono} fontSize="18" letterSpacing="3">{r ? "POSITION" : "TRANSACTION"}</text>
        <path d="M 260 25 H 680" stroke="#A59496" strokeWidth="3" strokeDasharray="6 8" />
        <circle cx={284 + reveal * 370} cy="25" r="8" fill="#B81A34" />
      </g>)}
      <path d="M 1015 196 V 901" stroke="#B81A34" strokeWidth="4" strokeDasharray="7 10" />
    </svg>
  </AbsoluteFill>;
}

function EndCard({ t }: { t: number }) {
  const o = move(t, 22.9, 23.7) * (1 - lin(t, 25.55, 26));
  return <AbsoluteFill style={{ opacity: o, background: "#090B0F", color: "#F4EEE6", justifyContent: "center", alignItems: "center" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 52%,rgba(183,26,52,.3),transparent 52%)" }} />
    <Img src={staticFile("logo.svg")} style={{ width: 132, height: 132, marginBottom: 27 }} />
    <div style={{ fontFamily: FONT.display, fontSize: 82, fontWeight: 700, letterSpacing: "-.055em", textAlign: "center" }}>Capital moves.<br/>Private facts stay private.</div>
    <div style={{ marginTop: 27, fontFamily: FONT.mono, fontSize: 24, letterSpacing: ".26em", color: "#EBC4CB" }}>GYEVO.TECH</div>
    <div style={{ position: "absolute", left: 190, right: 190, bottom: 69, textAlign: "center", fontFamily: FONT.mono, fontSize: 15, lineHeight: 1.8, letterSpacing: ".08em", color: "rgba(230,215,219,.66)" }}>{DISCLOSURE}</div>
  </AbsoluteFill>;
}

export const Lending: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const volume = (f: number) => Math.min(lin(f / fps, 0, .55), 1 - lin(f / fps, 25.25, 26)) * .66;
  return <AbsoluteFill style={{ background: C.ink, overflow: "hidden", fontFamily: FONT.display }}>
    <Audio src={staticFile("audio/mixkit-deep-urban-eugenio-mininni.mp3")} volume={volume} />
    <ProofGate t={t} />
    <Supply t={t} />
    <Collateral t={t} />
    <Borrow t={t} />
    <Repay t={t} />
    <Withdraw t={t} />
    <PublicState t={t} />
    <EndCard t={t} />
    <Grain opacity={.05} />
  </AbsoluteFill>;
};
