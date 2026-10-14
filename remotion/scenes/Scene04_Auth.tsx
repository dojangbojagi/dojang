import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../lib/motion';

// Animated vote bar
function VoteBar({ label, count, total, frame, fps, delay, color }: {
  label:string; count:number; total:number; frame:number; fps:number; delay:number; color:string;
}) {
  const prog = interpolate(frame,[(delay+0.2)*fps,(delay+0.8)*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp', easing:(x)=>1-Math.pow(1-x,2)});
  const countNow = Math.floor(prog*count);
  const barWidth = (count/total)*100;
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.14em', color:C.textMuted, textTransform:'uppercase' }}>{label}</span>
        <span style={{ fontFamily:FONT.mono, fontSize:13, fontWeight:500, color }}>{countNow}</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${barWidth*prog}%`, background:color, borderRadius:2, boxShadow:`0 0 8px ${color}` }}/>
      </div>
    </div>
  );
}

// DAO Governance panel
function DAOPanel({ frame, fps }: { frame: number; fps: number }) {
  const spr = spring({ fps, frame:frame-0.2*fps, config:SPR_HERO, durationInFrames:24 });
  const x   = interpolate(spr,[0,1],[-60,0]);
  const op  = interpolate(spr,[0,0.12],[0,1]);
  const quorumProg = interpolate(frame,[2.2*fps,3.2*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

  return (
    <div style={{ width:480, opacity:op, transform:`translateX(${x}px)` }}>
      <div style={{ background:`linear-gradient(158deg,${C.ink700} 0%,${C.ink850} 100%)`, borderRadius:22, border:`1px solid rgba(255,255,255,0.12)`, boxShadow:`inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(184,26,52,0.2), 0 40px 80px -20px rgba(0,0,0,0.98)`, padding:'28px 32px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:20, right:20, height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)' }}/>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:C.celadon, boxShadow:`0 0 8px ${C.celadon}` }}/>
          <span style={{ fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.18em', color:C.celadon, textTransform:'uppercase' }}>POLICY 04 · DAO GOVERNANCE</span>
        </div>

        {/* Proposal */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:FONT.display, fontSize:17, fontWeight:700, color:'#fff', letterSpacing:'-0.01em', marginBottom:6 }}>Proposal #1 — Protocol Activation</div>
          <div style={{ fontFamily:FONT.mono, fontSize:11, color:C.textDim, lineHeight:1.6 }}>Authorizes protocol deployment on<br/>Robinhood Testnet · Chain 46630</div>
        </div>

        {/* Vote bars */}
        <VoteBar label="FOR"     count={2} total={3} frame={frame} fps={fps} delay={0.8} color={C.celadon}/>
        <VoteBar label="AGAINST" count={0} total={3} frame={frame} fps={fps} delay={1.1} color='rgba(255,92,92,0.7)'/>

        {/* Executed badge */}
        <div style={{ marginTop:18, display:'flex', alignItems:'center', gap:12, opacity:fadeIn(frame,fps,2.8,0.4) }}>
          <div style={{ padding:'5px 14px', borderRadius:999, background:'rgba(247,243,244,0.1)', border:`1px solid ${C.celadon}`, fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.14em', color:C.celadon, textTransform:'uppercase' }}>✓ EXECUTED</div>
          <span style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim }}>2 FOR · 0 AGAINST · Quorum met</span>
        </div>

        {/* Quorum arc */}
        <div style={{ marginTop:16 }}>
          <svg width="100%" height="6">
            <rect x="0" y="0" width="100%" height="6" rx="3" fill="rgba(255,255,255,0.05)"/>
            <rect x="0" y="0" width={`${quorumProg*100}%`} height="6" rx="3" fill={C.celadon} style={{ filter:`drop-shadow(0 0 4px ${C.celadon})` }}/>
          </svg>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
            <span style={{ fontFamily:FONT.mono, fontSize:9, color:C.textDim, letterSpacing:'0.1em', textTransform:'uppercase' }}>Quorum</span>
            <span style={{ fontFamily:FONT.mono, fontSize:9, color:C.celadon }}>{Math.floor(quorumProg*67)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Protected Lending panel
function LendingPanel({ frame, fps }: { frame: number; fps: number }) {
  const spr = spring({ fps, frame:frame-0.5*fps, config:SPR_HERO, durationInFrames:24 });
  const x   = interpolate(spr,[0,1],[60,0]);
  const op  = interpolate(spr,[0,0.12],[0,1]);
  const amtProg = interpolate(frame,[1.5*fps,2.8*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:(x)=>1-Math.pow(1-x,3)});
  const amount = (amtProg * 5000).toFixed(2);

  return (
    <div style={{ width:480, opacity:op, transform:`translateX(${x}px)` }}>
      <div style={{ background:`linear-gradient(158deg,${C.ink700} 0%,${C.ink850} 100%)`, borderRadius:22, border:`1px solid rgba(255,255,255,0.12)`, boxShadow:`inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(184,26,52,0.2), 0 40px 80px -20px rgba(0,0,0,0.98)`, padding:'28px 32px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:20, right:20, height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)' }}/>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:C.gold, boxShadow:`0 0 8px ${C.gold}` }}/>
          <span style={{ fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.18em', color:C.gold, textTransform:'uppercase' }}>POLICY 03 + BOJAGI · PROTECTED LENDING</span>
        </div>

        {/* Amount field */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.14em', color:C.textDim, textTransform:'uppercase', marginBottom:8 }}>Authorized Amount</div>
          <div style={{ padding:'14px 20px', background:'rgba(21,15,18,0.85)', border:`1px solid ${C.lineStrong}`, borderRadius:14 }}>
            <span style={{ fontFamily:FONT.mono, fontSize:28, fontWeight:500, color:'#fff', letterSpacing:'-0.01em' }}>{Number(amount).toLocaleString()}</span>
            <span style={{ fontFamily:FONT.mono, fontSize:14, color:C.textMuted, marginLeft:10 }}>USDC</span>
          </div>
        </div>

        {/* Policy + BOJAGI proof indicator */}
        <div style={{ display:'flex', gap:10, marginBottom:18, opacity:fadeIn(frame,fps,0.8,0.4) }}>
          <div style={{ padding:'5px 12px', borderRadius:999, background:'rgba(109,0,26,0.5)', border:`1px solid rgba(184,26,52,0.5)`, fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.12em', color:C.gold, textTransform:'uppercase' }}>Policy 03</div>
          <div style={{ padding:'5px 12px', borderRadius:999, background:'rgba(109,0,26,0.4)', border:`1px solid rgba(184,26,52,0.4)`, fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.12em', color:C.gold, textTransform:'uppercase' }}>BOJAGI ✓</div>
          <div style={{ padding:'5px 12px', borderRadius:999, background:'rgba(255,255,255,0.04)', border:`1px solid rgba(255,255,255,0.1)`, fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.12em', color:C.textMuted, textTransform:'uppercase' }}>Demo Mode</div>
        </div>

        {/* Auth status */}
        <div style={{ padding:'12px 16px', background:'rgba(109,0,26,0.2)', borderRadius:12, border:`1px solid rgba(184,26,52,0.3)`, opacity:fadeIn(frame,fps,2.5,0.4) }}>
          <div style={{ fontFamily:FONT.mono, fontSize:11, color:C.gold, letterSpacing:'0.12em', textTransform:'uppercase' }}>Authorization Confirmed</div>
          <div style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim, marginTop:4 }}>Proof-gated · identity concealed · synthetic demo token</div>
        </div>
      </div>
    </div>
  );
}

// Proof fork — the proof splits into two paths
function ProofFork({ frame, fps }: { frame: number; fps: number }) {
  const prog = interpolate(frame,[0,fps*0.6],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const W=200, H=120;
  return (
    <div style={{ display:'flex', justifyContent:'center', marginBottom:40, opacity:prog }}>
      <svg width={W} height={H} style={{ overflow:'visible' }}>
        {/* Center source */}
        <circle cx={W/2} cy={20} r="8" fill={C.burgundy} stroke={C.gold} strokeWidth="1.5"/>
        {/* Fork lines */}
        <line x1={W/2} y1={28} x2={40} y2={H} stroke={`rgba(184,26,52,${prog*0.7})`} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={W/2} y1={28} x2={W-40} y2={H} stroke={`rgba(184,26,52,${prog*0.7})`} strokeWidth="1.5" strokeDasharray="4,3"/>
        {/* Labels */}
        <text x={28} y={H+16} textAnchor="middle" fontFamily={FONT.mono} fontSize="9" fill={C.celadon} letterSpacing="0.12em">DAO</text>
        <text x={W-28} y={H+16} textAnchor="middle" fontFamily={FONT.mono} fontSize="9" fill={C.gold} letterSpacing="0.12em">LENDING</text>
      </svg>
    </div>
  );
}

export function Scene04_Auth() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame,[0,fps*1],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

  return (
    <div style={{ position:'absolute', inset:0, background:C.ink1000, overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:atmOp, pointerEvents:'none', background:`radial-gradient(50% 40% at 50% 108%, rgba(109,0,26,0.65) 0%, transparent 65%)` }}/>

      {/* Section label */}
      <div style={{ position:'absolute', top:60, left:0, right:0, display:'flex', flexDirection:'column', alignItems:'center', opacity:fadeIn(frame,fps,0,0.4) }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={{ width:18, height:1.5, background:C.gold }}/>
          <span style={{ fontFamily:FONT.mono, fontSize:10, fontWeight:500, letterSpacing:'0.22em', color:C.gold, textTransform:'uppercase' }}>03 · AUTHORIZATION · Proof Verified</span>
          <div style={{ width:18, height:1.5, background:C.gold }}/>
        </div>
        <ProofFork frame={frame} fps={fps}/>
      </div>

      {/* Two panels side by side */}
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:40, paddingTop:180 }}>
        <DAOPanel frame={frame} fps={fps}/>
        <LendingPanel frame={frame} fps={fps}/>
      </div>
    </div>
  );
}
