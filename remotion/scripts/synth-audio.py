#!/usr/bin/env python3
"""Synthesize GYEVO 29-second launch film soundtrack."""
import numpy as np, wave, struct, subprocess, os

SR = 44100
DUR = 29.0
N   = int(SR * DUR)
t   = np.linspace(0, DUR, N, endpoint=False)

def gate(s, e, att=0.02, rel=0.08):
    a, r = int(att*SR), int(rel*SR)
    out  = np.zeros(N)
    s, e = int(s*SR), int(e*SR)
    seg  = np.ones(e - s)
    seg[:min(a,len(seg))] = np.linspace(0,1,min(a,len(seg)))
    seg[max(len(seg)-r,0):] = np.linspace(1,0,min(r,len(seg)-max(len(seg)-r,0)))
    out[s:e] = seg
    return out

def sine(f): return np.sin(2*np.pi*f*t)
def osc(f_arr):  # frequency array, already same length as t
    phase = np.cumsum(2*np.pi*np.array(f_arr)/SR)
    return np.sin(phase)

mix = np.zeros(N)

# ── SUB BASS IMPACT t=0
sub = sine(70)*np.exp(-t*2.8)*gate(0,2,0.002,0.5)*0.55
mix += sub

# ── RISER  0→3s
rp = np.clip(t/3,0,1)
rfq = 55 + rp**2*900
mix += osc(rfq)*gate(0,3.1,0.01,0.4)*0.14

# ── DARK DRONE throughout
mix += sine(55)*gate(0,29,0.5,0.5)*0.08
mix += sine(110)*gate(0,29,0.5,0.5)*0.05

# ── PULSE PAD 3→9s (credential build)
pulse_carrier = sine(220)*gate(3,9,0.15,0.6)*0.12
pulse_carrier *= 0.65+0.35*np.sin(2*np.pi*3.5*t)
mix += pulse_carrier

# ── CREDENTIAL STAMP CLICK t=7.8s
cc  = np.random.randn(N)*0.5
tt  = t - 7.8
cd  = np.exp(-np.clip(tt,0,1)*140)
mix += np.where(t>=7.8, cc*cd,0)*gate(7.8,8.05,0.001,0.1)*0.5

# ── CIRCUIT HUM rises 9→15s (BOJAGI scene)
c_hum = sine(180)*gate(9,15.5,0.4,0.3)*0.10
c_hum += sine(360)*gate(9,15.5,0.4,0.3)*0.06
hum_env = np.clip((t-9)/6,0,1)
mix += c_hum*(0.5+0.5*hum_env)

# ── PROOF TENSION BUILD 12→15s
tp = np.clip((t-12)/3,0,1)
noise_filt = np.zeros(N)
for h in [800,1200,1800]:
    noise_filt += sine(h)*tp*gate(12,15,0.1,0.2)*0.04

mix += noise_filt

# ── VERIFICATION RELEASE t=15s (climax)
ver_sweep = osc(np.where(t>=15, 440+np.clip((t-15)/0.5,0,1)*440, 440))
mix += ver_sweep*gate(15,15.8,0.005,0.2)*0.3
mix += sine(880)*gate(15,16.5,0.005,0.3)*0.12
# ripple harmonics
for i,f in enumerate([220,440,880,1760]):
    d = i*0.06
    mix += sine(f)*gate(15+d,15.8+d,0.005,0.25)*0.08*(1-i*0.2)

# ── AUTHORIZATION DUAL CHANNEL 17→22s
mix += sine(280)*gate(17,22,0.1,0.5)*0.09*(0.7+0.3*np.sin(2*np.pi*2*t))
mix += sine(350)*gate(17,22,0.1,0.5)*0.07*(0.7+0.3*np.sin(2*np.pi*2.5*t))

# ── DATA STREAM 22→26s
ds_noise = np.random.randn(N)*0.03
alpha = np.exp(-2*np.pi*6000/SR)
ds_lp = np.zeros(N)
for i in range(1,N): ds_lp[i]=alpha*ds_lp[i-1]+(1-alpha)*ds_noise[i]
mix += ds_lp*gate(22,26,0.1,0.4)*0.35

# ── BRAND IDENT 26→29s
for i,(f,d) in enumerate([(110,0),(220,0.05),(440,0.1),(880,0.15)]):
    mix += sine(f)*gate(26+d,29,0.01,0.6)*0.14*(1-i*0.18)
mix += sine(55)*gate(26,29,0.01,0.8)*0.12
# final resonant chord
for f in [330,440,660]:
    mix += sine(f)*gate(27.2,29,0.005,0.7)*0.06

# ── NORMALIZE
pk = np.max(np.abs(mix))
if pk>0.92: mix = mix*(0.92/pk)
pcm = (mix*32767).astype(np.int16)

out_dir = os.path.join(os.path.dirname(__file__),'..','public','audio')
wav = os.path.normpath(os.path.join(out_dir,'launch.wav'))
mp3 = wav.replace('.wav','.mp3')
with wave.open(wav,'w') as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
subprocess.run(['ffmpeg','-y','-i',wav,'-ac','2','-ar','44100','-ab','192k',mp3],check=True,capture_output=True)
os.remove(wav)
print(f'Audio OK: {mp3}')
