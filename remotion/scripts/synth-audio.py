#!/usr/bin/env python3
"""Synthesize GYEVO motion-test soundtrack (7s) using numpy + wave + ffmpeg."""

import numpy as np
import wave
import struct
import subprocess
import os

SR = 44100
DURATION = 7.0
N = int(SR * DURATION)
t = np.linspace(0, DURATION, N, endpoint=False)

def env(start, end, attack=0.01, release=0.05, sr=SR, total=N):
    s, e = int(start * sr), int(end * sr)
    a, r = int(attack * sr), int(release * sr)
    out = np.zeros(total)
    length = e - s
    if length <= 0:
        return out
    seg = np.ones(length)
    seg[:min(a, length)] *= np.linspace(0, 1, min(a, length))
    seg[max(length - r, 0):] *= np.linspace(1, 0, min(r, length - max(length - r, 0)))
    out[s:e] = seg
    return out

mix = np.zeros(N)

# ── Layer 1: deep sub-bass impact at t=0 (100Hz decaying tone)
sub_freq = 80.0
sub_decay = np.exp(-t * 3.5)
sub = np.sin(2 * np.pi * sub_freq * t) * sub_decay * env(0, 1.5, 0.002, 0.4) * 0.55

# ── Layer 2: cinematic riser pad (60–900Hz sweep, 0–2s)
riser_t = np.clip(t / 2.0, 0, 1)
riser_freq = 60 + (riser_t ** 2) * 840
riser_phase = np.cumsum(2 * np.pi * riser_freq / SR)
riser = np.sin(riser_phase) * env(0, 2.1, 0.01, 0.3) * 0.18

# ── Layer 3: shimmering high-frequency texture (sustained noise filtered)
noise = np.random.randn(N) * 0.04
# simple one-pole lowpass at 8kHz
alpha = np.exp(-2 * np.pi * 8000 / SR)
lp = np.zeros(N)
for i in range(1, N):
    lp[i] = alpha * lp[i-1] + (1 - alpha) * noise[i]
texture = lp * env(0.3, 7.0, 0.4, 0.5) * 0.3

# ── Layer 4: pulsing mid tone for the credential card (2–5s, 220Hz)
pulse_freq = 220.0
pulse = np.sin(2 * np.pi * pulse_freq * t) * env(2.0, 5.0, 0.08, 0.5) * 0.12
# amplitude modulate at 4 Hz
pulse *= 0.7 + 0.3 * np.sin(2 * np.pi * 4 * t)

# ── Layer 5: credential STAMP click at t=4.6 (short broadband burst)
click_t = 4.6
click_decay = np.exp(-(t - click_t) * 120)
click_noise = np.random.randn(N) * 0.6
stamp = np.where(t >= click_t, click_noise * click_decay, 0.0) * env(4.6, 4.85, 0.001, 0.1) * 0.55

# ── Layer 6: low drone sustain (55Hz, 2–7s) — dark authority
drone = np.sin(2 * np.pi * 55 * t) * env(2.0, 7.0, 0.5, 0.3) * 0.10
drone += np.sin(2 * np.pi * 110 * t) * env(2.0, 7.0, 0.5, 0.3) * 0.06

# ── Layer 7: verification tone at t=5.5 (ascending 440→880Hz over 0.4s)
ver_start = 5.5
ver_len = 0.4
ver_mask = (t >= ver_start) & (t < ver_start + ver_len)
ver_progress = np.where(ver_mask, (t - ver_start) / ver_len, 0.0)
ver_freq = np.where(ver_mask, 440 + ver_progress * 440, 440)
ver_phase = np.cumsum(2 * np.pi * ver_freq / SR)
ver = np.sin(ver_phase) * env(5.5, 5.95, 0.005, 0.15) * 0.22

mix = sub + riser + texture + pulse + stamp + drone + ver

# Normalize
peak = np.max(np.abs(mix))
if peak > 0.92:
    mix = mix * (0.92 / peak)

# Convert to 16-bit PCM
pcm = (mix * 32767).astype(np.int16)

# Write WAV
wav_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'motion-test.wav')
wav_path = os.path.normpath(wav_path)
with wave.open(wav_path, 'w') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())

# Convert to stereo AAC MP3 via ffmpeg
aac_path = wav_path.replace('.wav', '.mp3')
subprocess.run([
    'ffmpeg', '-y', '-i', wav_path,
    '-ac', '2', '-ar', '44100', '-ab', '192k',
    aac_path
], check=True, capture_output=True)
os.remove(wav_path)
print(f'Audio synthesized: {aac_path}')
