import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../lib/motion';

// GYEVO hex mark that unfolds petal by petal
function HexMark({ frame, fps }: { frame: number; fps: number }) {
  const SIZE = 180;
  const cx=SIZE/2, cy=SIZE/2, R=72, r=44;

  // outer hex points
  const hexPts = Array.from({length:6},(_,i)=>{
    const a = (i*60-90)*Math.PI/180;
    return { x: cx+R*Math.cos(a), y: cy+R*Math.sin(a) };
  });
  const outerPath = hexPts.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')+'Z';

  // inner hex
  const innerPts = Array.from({length:6},(_,i)=>{
    const a=(i*60-90)*Math.PI/180;
    return { x:cx+r*Math.cos(a), y:cy+r*Math.sin(a) };
  });
  const innerPath = innerPts.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')+'Z';

  // each spoke (outer to inner segment) appears sequentially
  const spokes = hexPts.map((op,i) => {
    const ip = innerPts[i];
    const delay = i * 0.08;
    const prog = spring({ fps, frame:frame-delay*fps, config:SPR_SNAP, durationInFrames:12 });
    return { op, ip, prog };
  });

  const outerSpr  = spring({ fps, frame:frame-0.5*fps, config:SPR_HERO, durationInFrames:18 });
  const innerSpr  = spring({ fps, frame:frame-0.7*fps, config:SPR_HERO, durationInFrames:18 });
  const glowPulse = 0.7 + 0.3*Math.sin(frame*0.12);

  return (
    <svg width={SIZE} height={SIZE} style={{ overflow:'visible', filter:`drop-shadow(0 0 ${30*glowPulse}px rgba(184,26,52,0.6))` }}>
      {/* outer ring */}
      <path d={outerPath} fill="none" stroke={C.gold} strokeWidth="2" opacity={outerSpr}/>
      {/* spokes */}
      {spokes.map(({op,ip,prog},i)=>(
        <line key={i} x1={cx} y1={cy} x2={interpolate(prog,[0,1],[cx,op.x])} y2={interpolate(prog,[0,1],[cy,op.y])} stroke={C.gold} strokeWidth="1" opacity={prog*0.5}/>
      ))}
      {/* inner fill */}
      <path d={innerPath} fill={C.burgundy} opacity={innerSpr}/>
      {/* center dot */}
      <circle cx={cx} cy={cy} r="5" fill={C.gold} opacity={spring({fps,frame:frame-0.9*fps,config:SPR_SNAP,durationInFrames:10})}/>
    </svg>
  );
}

// Brand name assembles letter by letter
function BrandName({ frame, fps }: { frame: number; fps: number }) {
  const LETTERS = 'GYEVO'.split('');
  return (
    <div style={{ display:'flex', gap:4 }}>
      {LETTERS.map((ch,i) => {
        const spr = spring({ fps, frame:frame-(0.4+i*0.07)*fps, config:SPR_HERO, durationInFrames:18 });
        return (
          <span key={i} style={{ fontFamily:FONT.display, fontSize:110, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1, color:'#fff', opacity:interpolate(spr,[0,0.15],[0,1]), transform:`translateY(${interpolate(spr,[0,1],[24,0])}px)`, display:'inline-block' }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
}

// Tagline: each word fades in
function Tagline({ frame, fps }: { frame: number; fps: number }) {
  const words = ['Private.','Authorized.','Onchain.'];
  return (
    <div style={{ display:'flex', gap:20, marginTop:28 }}>
      {words.map((w,i) => (
        <span key={w} style={{ fontFamily:FONT.display, fontSize:24, fontWeight:600, letterSpacing:'0.03em', color: i===2?C.gold:C.textMuted, opacity:fadeIn(frame,fps,0.9+i*0.15,0.5), textTransform:'uppercase' }}>{w}</span>
      ))}
    </div>
  );
}

// Concentric rings from the mark — the closing moment
function FinaleRings({ frame, fps }: { frame: number; fps: number }) {
  const startSec = 2.0;
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
      {[0,0.25,0.5,0.75].map((offset,i) => {
        const prog = interpolate(frame,[(startSec+offset)*fps,(startSec+offset+1.2)*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
        return (
          <div key={i} style={{
            position:'absolute', borderRadius:'50%',
            border:`1px solid rgba(184,26,52,${(1-prog)*0.35})`,
            width: 200+prog*600, height: 200+prog*600,
            pointerEvents:'none',
          }}/>
        );
      })}
    </div>
  );
}

export function Scene06_Finale() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bgOp = interpolate(frame,[0,fps*0.6],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

  return (
    <div style={{ position:'absolute', inset:0, background:C.ink1000, overflow:'hidden' }}>
      {/* deep glow center */}
      <div style={{ position:'absolute', inset:0, opacity:bgOp, background:`radial-gradient(50% 50% at 50% 50%, rgba(109,0,26,0.55) 0%, transparent 65%)` }}/>

      <FinaleRings frame={frame} fps={fps}/>

      {/* Centered brand lockup */}
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:0 }}>
        <div style={{ marginBottom:32, opacity:fadeIn(frame,fps,0.05,0.5) }}>
          <HexMark frame={frame} fps={fps}/>
        </div>
        <BrandName frame={frame} fps={fps}/>
        <Tagline frame={frame} fps={fps}/>

        {/* Final protocol line */}
        <div style={{ marginTop:40, opacity:fadeIn(frame,fps,1.8,0.6) }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:1, background:`linear-gradient(90deg, transparent, ${C.gold})` }}/>
            <span style={{ fontFamily:FONT.mono, fontSize:11, color:C.textDim, letterSpacing:'0.16em', textTransform:'uppercase' }}>Private Verifiable State Protocol</span>
            <div style={{ width:40, height:1, background:`linear-gradient(90deg, ${C.gold}, transparent)` }}/>
          </div>
        </div>
      </div>
    </div>
  );
}
