import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_HERO, SPR_SNAP, SPR_STAMP, fadeIn } from '../lib/motion';

// Scramble-then-redact effect for the holder field
function RedactedValue({ frame, fps, revealAt }: { frame: number; fps: number; revealAt: number }) {
  const progress = interpolate(frame, [revealAt*fps, revealAt*fps+22], [0,1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });
  const CHARS = '0123456789ABCDEF';
  const full  = '0x7f3aB9c4E1d82a5F3e0c9D4';
  // chars resolve from right to left, then the first half scrambles to dots
  const resolved = full.split('').map((ch, i) => {
    const charProg = progress - i * 0.03;
    if (charProg >= 1) return ch;
    if (charProg <= 0) return CHARS[Math.floor(Math.abs(Math.sin(frame*0.3+i))*16)];
    return charProg > 0.5 ? ch : CHARS[Math.floor(Math.abs(Math.sin(frame*0.4+i))*16)];
  }).join('');

  // After resolved, first 18 chars fade to dots
  const redactProg = interpolate(frame, [(revealAt+0.6)*fps, (revealAt+1.2)*fps], [0,1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });
  const dotCount = Math.floor(redactProg * 18);

  return (
    <span style={{ fontFamily:FONT.mono, fontSize:13, letterSpacing:'0.04em', color:C.textMuted }}>
      <span style={{ color:C.textDim }}>
        {'·'.repeat(dotCount)}
        <span style={{ color:C.textMuted }}>{resolved.slice(dotCount, 18)}</span>
      </span>
      <span style={{ color:C.textMuted }}>{resolved.slice(18)}</span>
    </span>
  );
}

// A single credential row that slides in
function CredRow({ label, value, frame, fps, delay, highlight=false, redact=false }: {
  label:string; value:string; frame:number; fps:number; delay:number; highlight?:boolean; redact?:boolean;
}) {
  const spr = spring({ fps, frame:frame-delay*fps, config:SPR_HERO, durationInFrames:20 });
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'14px 0',
      borderBottom:`1px solid rgba(255,255,255,0.05)`,
      opacity:interpolate(spr,[0,0.2],[0,1]),
      transform:`translateX(${interpolate(spr,[0,1],[-20,0])}px)`,
    }}>
      <span style={{ fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.16em', color:C.textDim, textTransform:'uppercase', width:110, flexShrink:0 }}>{label}</span>
      {redact
        ? <RedactedValue frame={frame} fps={fps} revealAt={delay}/>
        : <span style={{ fontFamily: highlight?FONT.display:FONT.mono, fontSize: highlight?15:13, fontWeight: highlight?700:400, color: highlight?C.gold:C.text, letterSpacing: highlight?'-0.01em':'0.03em' }}>{value}</span>
      }
    </div>
  );
}

// Credential seal — burns outward from center
function CredentialSeal({ frame, fps, delay }: { frame: number; fps: number; delay: number }) {
  const spr  = spring({ fps, frame:frame-delay*fps, config:SPR_STAMP, durationInFrames:20 });
  const scl  = interpolate(spr,[0,1],[0.2,1]);
  const op   = interpolate(spr,[0,0.15],[0,1]);
  const ripple = interpolate(frame,[delay*fps+8, delay*fps+32],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  return (
    <div style={{ position:'relative', width:60, height:60, transform:`scale(${scl})`, opacity:op, flexShrink:0 }}>
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`1.5px solid ${C.gold}`, transform:`scale(${1+ripple*1.8})`, opacity:(1-ripple)*0.45 }}/>
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle,#9B1230 0%,${C.burgundy} 55%,#3A0010 100%)`, border:`1.5px solid ${C.gold}`, boxShadow:`0 0 28px rgba(184,26,52,0.7),inset 0 1px 0 rgba(255,255,255,0.18)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 11 L9.5 15.5 L17 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </div>
  );
}

// The dojang credential panel — expands to fill left-center of frame
function DojangPanel({ frame, fps }: { frame: number; fps: number }) {
  const panelSpr = spring({ fps, frame, config:SPR_HERO, durationInFrames:22 });
  const width    = interpolate(panelSpr,[0,1],[0,820]);

  return (
    <div style={{ position:'relative', width:'100%', maxWidth:820, overflow:'hidden' }}>
      {/* expanding width reveal */}
      <div style={{ width, overflow:'hidden' }}>
        <div style={{ width:820, background:`linear-gradient(155deg,${C.ink700} 0%,${C.ink850} 100%)`, borderRadius:22, border:`1px solid rgba(255,255,255,0.12)`, boxShadow:`inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(184,26,52,0.22), 0 48px 96px -24px rgba(0,0,0,0.98), 0 0 80px -10px rgba(109,0,26,0.42)`, padding:'32px 40px 28px', position:'relative' }}>
          {/* Top highlight */}
          <div style={{ position:'absolute', top:0, left:24, right:24, height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)' }}/>

          {/* Card header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, opacity:fadeIn(frame,fps,0.08,0.3) }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,1.5 16,5.5 16,12.5 9,16.5 2,12.5 2,5.5" fill="none" stroke={C.gold} strokeWidth="1.2"/><polygon points="9,5.5 13,8 13,11 9,13.5 5,11 5,8" fill={C.burgundy}/></svg>
              <span style={{ fontFamily:FONT.mono, fontSize:11, fontWeight:500, letterSpacing:'0.18em', color:C.gold, textTransform:'uppercase' }}>DOJANG · Credential Record</span>
            </div>
            <span style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim, letterSpacing:'0.1em' }}>chain:46630</span>
          </div>

          {/* Credential fields */}
          <CredRow label="Policy"  value="POLICY 04 — GOVERNANCE"   frame={frame} fps={fps} delay={0.18} highlight/>
          <CredRow label="Holder"  value=""                          frame={frame} fps={fps} delay={0.36} redact/>
          <CredRow label="Issued"  value="Active session"            frame={frame} fps={fps} delay={0.54}/>
          <CredRow label="Network" value="Robinhood Chain · 46630"   frame={frame} fps={fps} delay={0.70}/>
          <CredRow label="Status"  value="ACTIVE"                    frame={frame} fps={fps} delay={0.86} highlight/>

          {/* Seal + confirm */}
          <div style={{ marginTop:28, display:'flex', alignItems:'center', gap:20, opacity:fadeIn(frame,fps,3.5,0.3) }}>
            <CredentialSeal frame={frame} fps={fps} delay={3.5}/>
            <div>
              <div style={{ fontFamily:FONT.mono, fontSize:11, fontWeight:500, letterSpacing:'0.14em', color:'#fff', textTransform:'uppercase' }}>Credential Valid</div>
              <div style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim, marginTop:4, letterSpacing:'0.08em' }}>testnet · identity concealed · policy-bound</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Scene02_Credential() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame,[0,fps*1],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

  return (
    <div style={{ position:'absolute', inset:0, background:C.ink1000, overflow:'hidden' }}>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.1 }}><defs><pattern id="g2" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill={C.textDim}/></pattern></defs><rect width="100%" height="100%" fill="url(#g2)"/></svg>

      {/* hex grid overlay */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.9 }}>
        {Array.from({length:6},(_,row)=>Array.from({length:10},(_,col)=>{
          const x=col*92+(row%2===0?0:46), y=row*80;
          return <polygon key={`${row}-${col}`} points={`${x+26},${y} ${x+52},${y+14} ${x+52},${y+40} ${x+26},${y+54} ${x},${y+40} ${x},${y+14}`} fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1"/>
        })).flat()}
      </svg>

      <div style={{ position:'absolute', inset:0, opacity:atmOp, pointerEvents:'none', background:`radial-gradient(55% 45% at 50% 108%, rgba(109,0,26,0.68) 0%, transparent 65%)` }}/>

      {/* Left: section label */}
      <div style={{ position:'absolute', left:72, top:'50%', transform:'translateY(-50%)', width:260, opacity:fadeIn(frame,fps,0.05,0.4) }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:22, height:1.5, background:C.gold, borderRadius:1 }}/>
          <span style={{ fontFamily:FONT.mono, fontSize:10, fontWeight:500, letterSpacing:'0.22em', color:C.gold, textTransform:'uppercase' }}>01 · DOJANG</span>
        </div>
        <div style={{
          fontFamily:FONT.display, fontSize:66, fontWeight:700, letterSpacing:'-0.035em', lineHeight:0.94, textTransform:'uppercase',
          transform:`translateY(${interpolate(spring({fps,frame:frame-0.08*fps,config:SPR_HERO,durationInFrames:22}),[0,1],[30,0])}px)`,
          opacity:fadeIn(frame,fps,0.08,0.45),
        }}>
          <span style={{ color:C.text }}>CRED-<br/>ENTIAL</span><br/>
          <span style={{ color:C.gold }}>ISSUED</span>
        </div>
        <div style={{ marginTop:24, fontFamily:FONT.mono, fontSize:11, color:C.textDim, textTransform:'uppercase', lineHeight:1.7, letterSpacing:'0.1em', opacity:fadeIn(frame,fps,0.55,0.45) }}>
          Policy-bound access<br/>Identity stays private
        </div>
      </div>

      {/* Right: credential panel */}
      <div style={{ position:'absolute', right:72, top:'50%', transform:`translateY(-50%)` }}>
        <DojangPanel frame={frame} fps={fps}/>
      </div>
    </div>
  );
}
