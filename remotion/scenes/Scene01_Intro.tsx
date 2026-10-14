import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../lib/motion';

const ADDR = '0x7f3aB9c4E1d82a5F3e0c9D4b6A2f1E8c3D7e4c2e';

function useTyped(text: string, frame: number, fps: number, startSec: number, cps = 28) {
  const chars = Math.floor(Math.max(0, frame - startSec * fps) / fps * cps);
  return text.slice(0, Math.min(chars, text.length));
}

function Cursor({ frame }: { frame: number }) {
  const vis = Math.floor(frame / 18) % 2 === 0;
  return <span style={{ display:'inline-block', width:2, height:'1.1em', background: vis ? C.gold : 'transparent', marginLeft:2, verticalAlign:'text-bottom' }} />;
}

function NavBar({ frame, fps }: { frame: number; fps: number }) {
  const op = fadeIn(frame, fps, 0, 0.3);
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, height:68, display:'flex', alignItems:'center', padding:'0 40px', gap:16, background:'rgba(6,4,5,0.94)', borderBottom:`1px solid ${C.lineFaint}`, opacity:op }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flex:'0 0 auto' }}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <polygon points="11,2 19,6.5 19,15.5 11,20 3,15.5 3,6.5" fill="none" stroke={C.gold} strokeWidth="1.3"/>
          <polygon points="11,6.5 16,9.5 16,13.5 11,16 6,13.5 6,9.5" fill={C.burgundy}/>
        </svg>
        <span style={{ fontFamily:FONT.display, fontSize:13, fontWeight:700, letterSpacing:'0.04em', color:'#fff', textTransform:'uppercase' }}>GYEVO</span>
      </div>
      <div style={{ flex:1, display:'flex', justifyContent:'center', gap:4 }}>
        {['Dojang','Bojagi','DAO','Lending','Contracts'].map((l,i) => (
          <div key={l} style={{ padding:'6px 14px', borderRadius:999, background: i===0?'rgba(109,0,26,0.5)':'transparent', border:`1px solid ${i===0?'rgba(184,26,52,0.5)':'transparent'}`, fontFamily:FONT.display, fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color: i===0?'#fff':C.textMuted }}>{l}</div>
        ))}
      </div>
      <div style={{ padding:'8px 18px', borderRadius:999, background:`linear-gradient(180deg,#7E0F2B 0%,${C.burgundy} 55%,#470010 100%)`, border:'1px solid rgba(255,255,255,0.16)', fontFamily:FONT.display, fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'#fff' }}>Connect Wallet</div>
    </div>
  );
}

function AddressField({ frame, fps }: { frame: number; fps: number }) {
  const typed    = useTyped(ADDR, frame, fps, 0.25, 32);
  const done     = typed.length >= ADDR.length;
  const fieldSpr = spring({ fps, frame: frame-0.15*fps, config:SPR_HERO, durationInFrames:20 });
  const badgeSpr = spring({ fps, frame: frame-1.55*fps, config:SPR_SNAP, durationInFrames:16 });
  const dotPulse = 0.6 + 0.4*Math.sin(frame*0.18);

  return (
    <div style={{ opacity:interpolate(fieldSpr,[0,0.15],[0,1]), transform:`translateY(${interpolate(fieldSpr,[0,1],[30,0])}px)`, width:'100%', maxWidth:860 }}>
      <div style={{ fontFamily:FONT.mono, fontSize:10, fontWeight:500, letterSpacing:'0.18em', color:C.textDim, textTransform:'uppercase', marginBottom:8, opacity:fadeIn(frame,fps,0.2,0.3) }}>Wallet Address</div>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'15px 22px', background:'rgba(21,15,18,0.85)', border:`1px solid ${done?'rgba(184,26,52,0.5)':C.lineStrong}`, borderRadius:16, boxShadow: done?`0 0 0 1px rgba(184,26,52,0.18), inset 0 1px 0 rgba(255,255,255,0.07)`:'inset 0 1px 0 rgba(255,255,255,0.05)', position:'relative', overflow:'hidden', transition:'border-color 0.5s, box-shadow 0.5s' }}>
        {!done && <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:`linear-gradient(90deg, transparent, rgba(184,26,52,0.05), transparent)`, transform:`translateX(${interpolate(frame%50,[0,50],[-100,200])}%)` }}/>}
        <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: done?C.gold:C.textDim, boxShadow: done?`0 0 ${dotPulse*8}px ${C.gold}`:'none', transition:'background 0.4s' }}/>
        <span style={{ fontFamily:FONT.mono, fontSize:14, fontWeight:400, letterSpacing:'0.04em', color: done?C.text:C.textMuted, flex:1, overflow:'hidden', whiteSpace:'nowrap' }}>
          {typed}{!done && <Cursor frame={frame}/>}
        </span>
        <div style={{ transform:`scale(${interpolate(badgeSpr,[0,1],[0.4,1])})`, opacity:interpolate(badgeSpr,[0,0.2],[0,1]), flexShrink:0 }}>
          <div style={{ padding:'5px 14px', borderRadius:999, background:'rgba(109,0,26,0.65)', border:'1px solid rgba(184,26,52,0.65)', boxShadow:'0 0 14px rgba(109,0,26,0.45)', fontFamily:FONT.mono, fontSize:10, fontWeight:500, letterSpacing:'0.14em', color:C.gold, textTransform:'uppercase', whiteSpace:'nowrap' }}>POLICY 04 · DOJANG</div>
        </div>
      </div>
      <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, opacity:fadeIn(frame,fps,1.65,0.4) }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:C.celadon, boxShadow:`0 0 7px ${C.celadon}` }}/>
        <span style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim, letterSpacing:'0.1em', textTransform:'uppercase' }}>Robinhood Chain · 46630 · Private Protocol</span>
      </div>
    </div>
  );
}

function Statement({ frame, fps }: { frame: number; fps: number }) {
  const s1 = spring({ fps, frame:frame-1.85*fps, config:SPR_HERO, durationInFrames:22 });
  const s2 = spring({ fps, frame:frame-2.05*fps, config:SPR_HERO, durationInFrames:22 });
  return (
    <div style={{ marginTop:56, textAlign:'center' }}>
      <div style={{ fontFamily:FONT.display, fontSize:56, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1, textTransform:'uppercase', color:'#fff', opacity:interpolate(s1,[0,0.15],[0,1]), transform:`translateY(${interpolate(s1,[0,1],[28,0])}px)` }}>PROVE ELIGIBILITY.</div>
      <div style={{ fontFamily:FONT.display, fontSize:28, fontWeight:600, letterSpacing:'0.06em', color:C.textMuted, marginTop:14, textTransform:'uppercase', opacity:interpolate(s2,[0,0.15],[0,1]), transform:`translateY(${interpolate(s2,[0,1],[28,0])}px)` }}>NOT IDENTITY.</div>
    </div>
  );
}

export function Scene01_Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame, [0,fps*1.5], [0,1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });
  return (
    <div style={{ position:'absolute', inset:0, background:C.ink1000, overflow:'hidden' }}>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.11 }}><defs><pattern id="g1" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill={C.textDim}/></pattern></defs><rect width="100%" height="100%" fill="url(#g1)"/></svg>
      <div style={{ position:'absolute', inset:0, opacity:atmOp, pointerEvents:'none', background:`radial-gradient(60% 50% at 50% 108%, rgba(109,0,26,0.72) 0%, transparent 65%)` }}/>
      <NavBar frame={frame} fps={fps}/>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingTop:68 }}>
        <AddressField frame={frame} fps={fps}/>
        <Statement frame={frame} fps={fps}/>
      </div>
    </div>
  );
}
