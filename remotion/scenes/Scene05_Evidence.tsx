import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../lib/motion';

function CountUp({ target, frame, fps, startSec }: { target:number; frame:number; fps:number; startSec:number }) {
  const prog = interpolate(frame,[startSec*fps,(startSec+1.2)*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:(x)=>1-Math.pow(1-x,2)});
  return <span>{Math.floor(prog*target)}</span>;
}

function ContractRow({ chain, chainId, count, badge, badgeColor, frame, fps, delay }: {
  chain:string; chainId:string; count:number; badge:string; badgeColor:string;
  frame:number; fps:number; delay:number;
}) {
  const spr = spring({ fps, frame:frame-delay*fps, config:SPR_HERO, durationInFrames:20 });
  const x   = interpolate(spr,[0,1],[-30,0]);
  const op  = interpolate(spr,[0,0.15],[0,1]);
  const barProg = interpolate(frame,[(delay+0.3)*fps,(delay+1.4)*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:(x)=>1-Math.pow(1-x,2)});
  const badgeSpr = spring({ fps, frame:frame-(delay+1.6)*fps, config:SPR_SNAP, durationInFrames:14 });

  return (
    <div style={{ opacity:op, transform:`translateX(${x}px)`, padding:'24px 0', borderBottom:`1px solid rgba(255,255,255,0.06)` }}>
      {/* Chain header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:C.celadon, boxShadow:`0 0 8px ${C.celadon}` }}/>
          <span style={{ fontFamily:FONT.display, fontSize:18, fontWeight:700, color:'#fff', letterSpacing:'-0.01em' }}>{chain}</span>
          <span style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim, letterSpacing:'0.1em' }}>Chain {chainId}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:FONT.mono, fontSize:28, fontWeight:500, color:C.gold }}>
            <CountUp target={count} frame={frame} fps={fps} startSec={delay+0.3}/>/10
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:3, background:'rgba(255,255,255,0.05)', borderRadius:2, marginBottom:12, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${barProg*100}%`, background:`linear-gradient(90deg,${C.burgundy},${C.gold})`, borderRadius:2, boxShadow:`0 0 8px rgba(184,26,52,0.6)` }}/>
      </div>

      {/* Contract addresses stream */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
        {Array.from({length:10},(_,i)=>{
          const addrProg = interpolate(frame,[(delay+0.2+i*0.12)*fps,(delay+0.5+i*0.12)*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
          return (
            <div key={i} style={{ padding:'3px 10px', borderRadius:6, background:'rgba(21,15,18,0.9)', border:`1px solid rgba(255,255,255,${0.04+addrProg*0.08})`, fontFamily:FONT.mono, fontSize:9, color:`rgba(168,157,161,${addrProg})`, letterSpacing:'0.06em', transition:'border-color 0.3s' }}>
              0x{(i+1).toString().padStart(2,'0')}···{String.fromCharCode(65+i)}{String.fromCharCode(66+i)}
            </div>
          );
        })}
      </div>

      {/* Badge */}
      <div style={{ transform:`scale(${interpolate(badgeSpr,[0,1],[0.7,1])})`, opacity:interpolate(badgeSpr,[0,0.2],[0,1]), display:'inline-block', transformOrigin:'left center' }}>
        <div style={{ padding:'5px 16px', borderRadius:999, background:`rgba(109,0,26,0.4)`, border:`1px solid ${badgeColor}`, boxShadow:`0 0 12px rgba(184,26,52,0.3)`, fontFamily:FONT.mono, fontSize:10, fontWeight:500, letterSpacing:'0.14em', color:badgeColor, textTransform:'uppercase', display:'inline-block' }}>
          {badge}
        </div>
      </div>
    </div>
  );
}

export function Scene05_Evidence() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame,[0,fps*0.8],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

  return (
    <div style={{ position:'absolute', inset:0, background:C.ink1000, overflow:'hidden' }}>
      {/* faint scanline grid */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.06 }}><defs><pattern id="g5" x="0" y="0" width="1" height="32" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="1" stroke={C.textDim} strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g5)"/></svg>
      <div style={{ position:'absolute', inset:0, opacity:atmOp, pointerEvents:'none', background:`radial-gradient(55% 45% at 50% 108%, rgba(109,0,26,0.6) 0%, transparent 65%)` }}/>

      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 80px' }}>
        {/* Header */}
        <div style={{ width:'100%', maxWidth:1100, marginBottom:8, opacity:fadeIn(frame,fps,0,0.4) }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ width:18, height:1.5, background:C.gold }}/>
            <span style={{ fontFamily:FONT.mono, fontSize:10, fontWeight:500, letterSpacing:'0.22em', color:C.gold, textTransform:'uppercase' }}>04 · Deployment Evidence</span>
          </div>
          <div style={{ fontFamily:FONT.display, fontSize:42, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1, textTransform:'uppercase', color:'#fff' }}>
            Onchain.<br/><span style={{ color:C.gold }}>Verified.</span>
          </div>
        </div>

        {/* Contract rows */}
        <div style={{ width:'100%', maxWidth:1100 }}>
          <ContractRow chain="Robinhood Testnet" chainId="46630" count={10} badge="10/10 Source Verified" badgeColor={C.celadon} frame={frame} fps={fps} delay={0.5}/>
          <ContractRow chain="Robinhood Mainnet" chainId="4663"  count={10} badge="10/10 Bytecode Confirmed" badgeColor={C.gold} frame={frame} fps={fps} delay={1.8}/>
        </div>

        {/* Disclaimer */}
        <div style={{ width:'100%', maxWidth:1100, marginTop:18, opacity:fadeIn(frame,fps,3.2,0.5) }}>
          <div style={{ padding:'10px 16px', borderRadius:10, background:'rgba(224,169,90,0.08)', borderLeft:`2px solid rgba(224,169,90,0.5)` }}>
            <span style={{ fontFamily:FONT.mono, fontSize:10, color:'rgba(224,169,90,0.7)', letterSpacing:'0.08em' }}>Mainnet source verification pending · Lending and Governance paused · Demo tokens have no redemption value</span>
          </div>
        </div>
      </div>
    </div>
  );
}
