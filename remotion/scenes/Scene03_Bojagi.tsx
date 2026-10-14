import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../lib/motion';

// ZK circuit node positions — form a Noir/Barretenberg-style gate graph
const NODES: { x:number; y:number; label:string; type:'input'|'gate'|'output' }[] = [
  // inputs (left column)
  { x:120, y:200, label:'IN₁', type:'input' },
  { x:120, y:340, label:'IN₂', type:'input' },
  { x:120, y:480, label:'IN₃', type:'input' },
  // middle gates
  { x:340, y:160, label:'MUL', type:'gate' },
  { x:340, y:300, label:'ADD', type:'gate' },
  { x:340, y:440, label:'MUL', type:'gate' },
  { x:340, y:560, label:'ADD', type:'gate' },
  // aggregation
  { x:560, y:240, label:'AND', type:'gate' },
  { x:560, y:420, label:'XOR', type:'gate' },
  // output
  { x:760, y:330, label:'π', type:'output' },
];

const EDGES: [number,number][] = [
  [0,3],[0,4],[1,3],[1,4],[1,5],[2,5],[2,6],
  [3,7],[4,7],[4,8],[5,8],[6,8],
  [7,9],[8,9],
];

function zkProgress(frame: number, fps: number, edgeIdx: number, totalEdges: number): number {
  const staggerSec = 0.22 * edgeIdx;
  return interpolate(frame, [(2+staggerSec)*fps, (2+staggerSec+0.6)*fps], [0,1], {
    extrapolateLeft:'clamp', extrapolateRight:'clamp',
    easing: (x) => 1-Math.pow(1-x,2),
  });
}

function nodeProgress(frame: number, fps: number, nodeIdx: number): number {
  const delay = nodeIdx < 3 ? 0.8 : nodeIdx < 7 ? 1.8 : nodeIdx < 9 ? 3.6 : 5.0;
  return spring({ fps, frame:frame-delay*fps, config:SPR_SNAP, durationInFrames:14 });
}

// Animated ZK circuit SVG
function ZkCircuit({ frame, fps }: { frame: number; fps: number }) {
  const W=900, H=680;
  const verifiedAt = 5.5; // seconds into this scene
  const verified = frame >= verifiedAt * fps;
  const verifyPulse = interpolate(frame, [verifiedAt*fps, verifiedAt*fps+24], [0,1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });

  return (
    <svg width={W} height={H} style={{ overflow:'visible' }}>
      {/* Edges */}
      {EDGES.map(([a,b], i) => {
        const na=NODES[a], nb=NODES[b];
        const prog = zkProgress(frame, fps, i, EDGES.length);
        const midx=(na.x+nb.x)/2, midy=(na.y+nb.y)/2;
        const len = Math.hypot(nb.x-na.x, nb.y-na.y);
        const phase = verified ? 1 : prog;
        const glowOp = verified ? 0.8 : prog*0.5;

        return (
          <g key={i}>
            {/* Base edge */}
            <line x1={na.x} y1={na.y} x2={interpolate(phase,[0,1],[na.x,nb.x])} y2={interpolate(phase,[0,1],[na.y,nb.y])}
              stroke={`rgba(184,26,52,${glowOp*0.9})`} strokeWidth={verified?1.8:1.2}/>
            {/* Traveling particle */}
            {prog > 0 && prog < 1 && (
              <circle cx={interpolate(prog,[0,1],[na.x,nb.x])} cy={interpolate(prog,[0,1],[na.y,nb.y])} r="3" fill={C.gold} style={{ filter:`blur(1px)` }}/>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {NODES.map((n, i) => {
        const prog = nodeProgress(frame, fps, i);
        const isOutput = n.type==='output';
        const isInput  = n.type==='input';
        const r = isOutput ? 28 : isInput ? 20 : 18;
        const glow = verified ? `0 0 ${28+Math.sin(frame*0.15)*6}px rgba(184,26,52,0.9)` : `0 0 ${12*prog}px rgba(184,26,52,0.6)`;
        const fill = verified ? C.gold : isInput ? C.ink600 : isOutput ? C.burgundy : C.ink700;
        const stroke = verified ? '#fff' : C.gold;

        return (
          <g key={i} transform={`scale(${prog}) translate(${n.x*(1-prog)/prog||0},${n.y*(1-prog)/prog||0})`} style={{ transformOrigin:`${n.x}px ${n.y}px` }}>
            <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={stroke} strokeWidth={isOutput?2:1.2} style={{ filter:`drop-shadow(${glow})` }}/>
            <text x={n.x} y={n.y+5} textAnchor="middle" fontFamily={FONT.mono} fontSize={isOutput?16:10} fontWeight="500" fill={verified?'#fff':C.textMuted} letterSpacing="0.05em">{n.label}</text>
          </g>
        );
      })}

      {/* Verification pulse rings from output node */}
      {verified && [0.6,1.0,1.4].map((scale,i) => {
        const ringProg = Math.max(0, verifyPulse - i*0.12);
        return (
          <circle key={i} cx={NODES[9].x} cy={NODES[9].y} r={28+ringProg*120*scale} fill="none"
            stroke={C.gold} strokeWidth={2-ringProg*1.5} opacity={Math.max(0,(1-ringProg)*0.7)}/>
        );
      })}
    </svg>
  );
}

// Private input field — data appears then immediately masks to blocks
function PrivateInput({ frame, fps }: { frame: number; fps: number }) {
  const spr = spring({ fps, frame:frame-0.1*fps, config:SPR_HERO, durationInFrames:22 });
  const revealProg = interpolate(frame,[0.3*fps,1.0*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const maskProg   = interpolate(frame,[1.0*fps,1.8*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const DATA = '28a4f91b7c3e...';
  const masked = Math.floor(maskProg * DATA.length);
  const display = '█'.repeat(masked) + DATA.slice(masked);

  return (
    <div style={{ opacity:interpolate(spr,[0,0.15],[0,1]), transform:`translateY(${interpolate(spr,[0,1],[20,0])}px)` }}>
      <div style={{ fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.16em', color:C.textDim, textTransform:'uppercase', marginBottom:8 }}>Private Witness</div>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', background:'rgba(21,15,18,0.9)', border:`1px solid rgba(184,26,52,0.4)`, borderRadius:12, boxShadow:'0 0 24px rgba(109,0,26,0.25)' }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:C.gold, boxShadow:`0 0 8px ${C.gold}` }}/>
        <span style={{ fontFamily:FONT.mono, fontSize:13, color: masked>0?'rgba(184,26,52,0.7)':C.textMuted, letterSpacing:'0.06em', opacity: revealProg }}>{display.slice(0,16)}</span>
        <span style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim, marginLeft:'auto', letterSpacing:'0.1em' }}>CONCEALED</span>
      </div>
    </div>
  );
}

// Proof hash streaming out
function ProofHash({ frame, fps }: { frame: number; fps: number }) {
  const HASH = 'a7f3b9c2e84d1a6f3b92c7e84d1a6f3b92c7e84d1a6f3b92c7e8a7f3b9';
  const startSec = 3.5;
  const chars = Math.floor(Math.max(0, frame - startSec*fps) / fps * 22);
  const shown = HASH.slice(0, Math.min(chars, HASH.length));
  if (!shown) return null;

  return (
    <div style={{ marginTop:16, opacity: fadeIn(frame,fps,startSec,0.3) }}>
      <div style={{ fontFamily:FONT.mono, fontSize:10, letterSpacing:'0.14em', color:C.textDim, textTransform:'uppercase', marginBottom:6 }}>ZK Proof Output</div>
      <div style={{ padding:'10px 16px', background:'rgba(109,0,26,0.15)', border:`1px solid rgba(184,26,52,0.3)`, borderRadius:10 }}>
        <span style={{ fontFamily:FONT.mono, fontSize:11, color:'rgba(184,26,52,0.9)', letterSpacing:'0.08em', wordBreak:'break-all' }}>0x{shown}</span>
      </div>
    </div>
  );
}

// Final "PROOF VERIFIED" state
function VerifiedBadge({ frame, fps }: { frame: number; fps: number }) {
  const startSec = 5.5;
  const spr = spring({ fps, frame:frame-startSec*fps, config:SPR_SNAP, durationInFrames:16 });
  if (spr < 0.01) return null;
  return (
    <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:14, transform:`scale(${interpolate(spr,[0,1],[0.8,1])})`, opacity:interpolate(spr,[0,0.2],[0,1]) }}>
      <div style={{ padding:'8px 20px', borderRadius:999, background:`rgba(109,0,26,0.7)`, border:`1px solid ${C.gold}`, boxShadow:`0 0 24px rgba(184,26,52,0.5), inset 0 1px 0 rgba(255,255,255,0.12)`, fontFamily:FONT.mono, fontSize:12, fontWeight:500, letterSpacing:'0.16em', color:C.gold, textTransform:'uppercase' }}>
        ✓ PROOF VERIFIED
      </div>
      <span style={{ fontFamily:FONT.mono, fontSize:10, color:C.textDim, letterSpacing:'0.1em' }}>Noir · Barretenberg · HonkVerifier</span>
    </div>
  );
}

export function Scene03_Bojagi() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame,[0,fps*1.5],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

  return (
    <div style={{ position:'absolute', inset:0, background:C.ink1000, overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:atmOp, pointerEvents:'none', background:`radial-gradient(65% 50% at 60% 50%, rgba(109,0,26,0.5) 0%, transparent 65%), radial-gradient(40% 40% at 20% 50%, rgba(109,0,26,0.25) 0%, transparent 60%)` }}/>

      {/* Section label top-left */}
      <div style={{ position:'absolute', left:72, top:96, opacity:fadeIn(frame,fps,0.05,0.4) }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ width:20, height:1.5, background:C.gold }}/>
          <span style={{ fontFamily:FONT.mono, fontSize:10, fontWeight:500, letterSpacing:'0.22em', color:C.gold, textTransform:'uppercase' }}>02 · BOJAGI · Zero-Knowledge Proof</span>
        </div>
        <div style={{
          fontFamily:FONT.display, fontSize:52, fontWeight:700, letterSpacing:'-0.03em', lineHeight:0.96, textTransform:'uppercase',
          opacity:fadeIn(frame,fps,0.08,0.4),
        }}>
          <span style={{ color:C.text }}>PRIVATE<br/></span>
          <span style={{ color:C.gold }}>PROOF</span>
        </div>
      </div>

      {/* Left panel: input + proof output */}
      <div style={{ position:'absolute', left:72, top:'50%', transform:'translateY(-30%)', width:380 }}>
        <PrivateInput frame={frame} fps={fps}/>
        <ProofHash frame={frame} fps={fps}/>
        <VerifiedBadge frame={frame} fps={fps}/>
      </div>

      {/* Center-right: ZK circuit */}
      <div style={{ position:'absolute', right:40, top:'50%', transform:'translateY(-50%)', opacity:fadeIn(frame,fps,0.3,0.5) }}>
        <ZkCircuit frame={frame} fps={fps}/>
      </div>
    </div>
  );
}
