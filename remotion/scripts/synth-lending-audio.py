#!/usr/bin/env python3
"""Synthesize GYEVO 23-second Private Lending promo soundtrack.
Beats match LendingPromo.tsx CUT boundaries (30fps):
  0.00s cold open impact    1.33s connect wallet
  5.00s dojang seal         9.67s bojagi fold begins
  13.30s proof tension      15.00s verification release (hex crack)
  15.67s protected lending  18.20s borrow confirm stamp
  20.67s outro stat         21.40s brand chord
"""
import numpy as np, wave, struct, subprocess, os

SR = 44100
DUR = 23.0
N = int(SR * DUR)
t = np.linspace(0, DUR, N, endpoint=False)

def gate(s, e, att=0.02, rel=0.08):
    a, r = int(att * SR), int(rel * SR)
    out = np.zeros(N)
    s, e = int(s * SR), int(e * SR)
    seg = np.ones(e - s)
    seg[:min(a, len(seg))] = np.linspace(0, 1, min(a, len(seg)))
    seg[max(len(seg) - r, 0):] = np.linspace(1, 0, min(r, len(seg) - max(len(seg) - r, 0)))
    out[s:e] = seg
    return out

def sine(f): return np.sin(2 * np.pi * f * t)
def osc(f_arr):
    phase = np.cumsum(2 * np.pi * np.array(f_arr) / SR)
    return np.sin(phase)

mix = np.zeros(N)

# ── COLD OPEN IMPACT t=0 — sub hit + hex-crack shimmer
mix += sine(62) * np.exp(-t * 3.2) * gate(0, 1.4, 0.001, 0.4) * 0.6
mix += sine(880) * np.exp(-t * 9) * gate(0, 0.4, 0.001, 0.2) * 0.18

# ── DARK DRONE throughout
mix += sine(55) * gate(0, 23, 0.4, 0.4) * 0.07
mix += sine(110) * gate(0, 23, 0.4, 0.4) * 0.045

# ── CONNECT WALLET pulse 1.33→5.0s
pulse = sine(220) * gate(1.33, 5.0, 0.12, 0.4) * 0.11
pulse *= 0.65 + 0.35 * np.sin(2 * np.pi * 4 * t)
mix += pulse

# ── WALLET CONNECTED click t=2.4s
cc = np.random.randn(N) * 0.4
cd = np.exp(-np.clip(t - 2.4, 0, 1) * 150)
mix += np.where(t >= 2.4, cc * cd, 0) * gate(2.4, 2.6, 0.001, 0.08) * 0.4

# ── DOJANG STAMP t=5.6s (credential seal)
cc2 = np.random.randn(N) * 0.5
cd2 = np.exp(-np.clip(t - 5.6, 0, 1) * 140)
mix += np.where(t >= 5.6, cc2 * cd2, 0) * gate(5.6, 5.85, 0.001, 0.1) * 0.5
mix += sine(440) * gate(5.6, 6.2, 0.005, 0.4) * 0.1

# ── BOJAGI FOLD hum rises 9.67→13.3s (cloth wrapping)
fold_hum = sine(165) * gate(9.67, 13.3, 0.4, 0.3) * 0.09
fold_hum += sine(330) * gate(9.67, 13.3, 0.4, 0.3) * 0.05
hum_env = np.clip((t - 9.67) / 3.6, 0, 1)
mix += fold_hum * (0.5 + 0.5 * hum_env)

# ── PROOF TENSION BUILD 13.3→15.0s (seal tightening before crack)
tp = np.clip((t - 13.3) / 1.7, 0, 1)
for h in [760, 1140, 1710]:
    mix += sine(h) * tp * gate(13.3, 15.0, 0.08, 0.15) * 0.045

# ── VERIFICATION RELEASE t=15.0s — the hex iris cracks open (climax)
ver_sweep = osc(np.where(t >= 15.0, 440 + np.clip((t - 15.0) / 0.4, 0, 1) * 520, 440))
mix += ver_sweep * gate(15.0, 15.7, 0.004, 0.18) * 0.32
mix += sine(880) * gate(15.0, 16.3, 0.004, 0.3) * 0.13
for i, f in enumerate([220, 440, 880, 1760]):
    d = i * 0.05
    mix += sine(f) * gate(15.0 + d, 15.7 + d, 0.004, 0.22) * 0.085 * (1 - i * 0.2)

# ── PROTECTED LENDING build 15.67→20.67s (health-factor count-up + confidence)
mix += sine(294) * gate(15.67, 20.67, 0.3, 0.5) * 0.085 * (0.7 + 0.3 * np.sin(2 * np.pi * 2.2 * t))
mix += sine(370) * gate(15.67, 20.67, 0.3, 0.5) * 0.06 * (0.7 + 0.3 * np.sin(2 * np.pi * 2.7 * t))

# ── BORROW CONFIRM stamp t=17.97s
cc3 = np.random.randn(N) * 0.45
cd3 = np.exp(-np.clip(t - 17.97, 0, 1) * 130)
mix += np.where(t >= 17.97, cc3 * cd3, 0) * gate(17.97, 18.2, 0.001, 0.1) * 0.42
mix += sine(523) * gate(17.97, 18.6, 0.004, 0.35) * 0.1

# ── DATA STAT FLASH 20.67→21.4s ("10/10")
ds_noise = np.random.randn(N) * 0.025
alpha = np.exp(-2 * np.pi * 6500 / SR)
ds_lp = np.zeros(N)
for i in range(1, N): ds_lp[i] = alpha * ds_lp[i - 1] + (1 - alpha) * ds_noise[i]
mix += ds_lp * gate(20.67, 21.45, 0.08, 0.3) * 0.3

# ── BRAND CHORD 21.4→23.0s
for i, (f, d) in enumerate([(110, 0), (220, 0.04), (440, 0.08), (660, 0.12)]):
    mix += sine(f) * gate(21.45 + d, 23.0, 0.01, 0.5) * 0.13 * (1 - i * 0.18)
mix += sine(55) * gate(21.45, 23.0, 0.01, 0.6) * 0.11

# ── NORMALIZE
pk = np.max(np.abs(mix))
if pk > 0.92: mix = mix * (0.92 / pk)
pcm = (mix * 32767).astype(np.int16)

out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
wav = os.path.normpath(os.path.join(out_dir, 'lending.wav'))
mp3 = wav.replace('.wav', '.mp3')
with wave.open(wav, 'w') as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
subprocess.run(['ffmpeg', '-y', '-i', wav, '-ac', '2', '-ar', '44100', '-ab', '192k', mp3], check=True, capture_output=True)
os.remove(wav)
print(f'Audio OK: {mp3}')
