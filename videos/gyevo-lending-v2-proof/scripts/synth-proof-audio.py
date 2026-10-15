#!/usr/bin/env python3
"""GYEVO Lending v2 — 5s design-proof soundtrack. Original synthesis, 120 BPM, stereo, 44.1 kHz.

Cue grid (seconds) — keep identical to CUE in index.html:
  0.00 hit      0.50 withIn   1.00 strike   1.50 slam/seal start   2.00 legend
  3.00 lock+dolly   3.50 slab   4.00 click   4.50 ready   5.00 end
"""
import os
import numpy as np
import wave

SR = 44100
DUR = 5.0
N = int(SR * DUR)
rng = np.random.default_rng(7)  # seeded: deterministic

L = np.zeros(N)
R = np.zeros(N)
SEND_L = np.zeros(N)
SEND_R = np.zeros(N)


def t_axis(length):
    return np.arange(int(length * SR)) / SR


def place(sig, t0, gain=1.0, pan=0.0, send=0.0):
    """Mix mono `sig` at t0 with equal-power pan (-1..1) and reverb send."""
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    n = min(len(sig), N - i0)
    ang = (pan + 1.0) * np.pi / 4.0
    gl, gr = np.cos(ang), np.sin(ang)
    seg = sig[:n] * gain
    L[i0:i0 + n] += seg * gl
    R[i0:i0 + n] += seg * gr
    if send:
        SEND_L[i0:i0 + n] += seg * gl * send
        SEND_R[i0:i0 + n] += seg * gr * send


def one_pole_lp(x, a):
    """Time-varying one-pole low-pass; `a` scalar or array in 0..1."""
    y = np.empty_like(x)
    acc = 0.0
    if np.isscalar(a):
        a = np.full(len(x), a)
    for n in range(len(x)):
        acc += a[n] * (x[n] - acc)
        y[n] = acc
    return y


def highpass(x, a=0.2):
    return x - one_pole_lp(x, a)


def noise(length):
    return rng.standard_normal(int(length * SR))


# ---------------------------------------------------------------- bed (pad) --
t = t_axis(DUR)
bed = (np.sin(2 * np.pi * 55.0 * t) * 0.9
       + np.sin(2 * np.pi * 82.41 * t) * 0.5
       + np.sin(2 * np.pi * 110.0 * t + 0.6) * 0.35)
bed *= (0.7 + 0.3 * np.sin(2 * np.pi * 0.5 * t))
bed *= np.clip(t / 0.4, 0, 1)
upper = (np.sin(2 * np.pi * 130.81 * t) + np.sin(2 * np.pi * 164.81 * t) * 0.8) * 0.5
upper *= np.clip((t - 1.5) / 0.6, 0, 1)
bed_full = bed * 0.075 + upper * 0.045

# sidechain duck on every kick + the lock
KICKS = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
duck = np.ones(N)
for k in KICKS + [0.0]:
    d = np.clip((t - k) / 0.22, 0, 1)
    duck *= 1.0 - 0.45 * (1.0 - d) * (t >= k)
bed_full *= duck
L += bed_full
R += bed_full

# --------------------------------------------------------------- 0.00 hit ----
tt = t_axis(1.6)
f = 42.0 + 70.0 * np.exp(-tt / 0.07)
phase = 2 * np.pi * np.cumsum(f) / SR
sub = np.sin(phase) * np.exp(-tt / 0.55)
crack = highpass(noise(0.05), 0.25) * np.exp(-t_axis(0.05) / 0.012)
shim = (np.sin(2 * np.pi * 2093 * tt) + np.sin(2 * np.pi * 3136 * tt) * 0.7) * np.exp(-tt / 0.35)
place(sub, 0.0, 0.62)
place(crack, 0.0, 0.5)
place(shim, 0.0, 0.05, pan=0.3, send=0.6)

# ---------------------------------------------------------- arp plucks -------
SCALE = [220.00, 261.63, 329.63, 392.00, 440.00]
PATTERN = [0, 2, 4, 2, 3, 1, 4, 2]
step = 0.125
idx = 0
tcur = 0.5
while tcur < 3.0 - 1e-6:
    if not (0.94 <= tcur < 1.24):           # breath around the strike
        f0 = SCALE[PATTERN[idx % len(PATTERN)]]
        pt = t_axis(0.3)
        pl = (np.sin(2 * np.pi * f0 * pt) + 0.3 * np.sin(2 * np.pi * 2 * f0 * pt)) * np.exp(-pt / 0.11)
        g = 0.05 + 0.04 * min(1.0, max(0.0, (tcur - 0.5) / 2.0))
        place(pl, tcur, g, pan=(-0.45 if idx % 2 == 0 else 0.45), send=0.45)
    idx += 1
    tcur += step

# ---------------------------------------------------------- 0.75 swell + 1.00 strike
sw_len = 0.25
sw = highpass(noise(sw_len), 0.3) * (t_axis(sw_len) / sw_len) ** 2
place(sw, 0.75, 0.25, send=0.2)
strike = highpass(noise(0.06), 0.3) * np.exp(-t_axis(0.06) / 0.015)
thud = np.sin(2 * np.pi * 150 * t_axis(0.25)) * np.exp(-t_axis(0.25) / 0.06)
place(strike, 1.0, 0.55)
place(thud, 1.0, 0.4)


# ------------------------------------------------------------------ kicks ----
def kick(t0, g=0.55):
    k = t_axis(0.4)
    f = 48.0 + 90.0 * np.exp(-k / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-k / 0.16)
    click = highpass(noise(0.01), 0.3) * np.exp(-t_axis(0.01) / 0.003)
    place(body, t0, g)
    place(click, t0, g * 0.3)


for k, g in zip(KICKS, [0.62, 0.5, 0.5, 0.75, 0.38, 0.3]):
    kick(k, g)


def clap(t0, g=0.28):
    c = highpass(noise(0.18), 0.12)
    env = np.exp(-t_axis(0.18) / 0.045)
    # three micro-bursts = clap
    burst = np.zeros_like(c)
    for off in (0.0, 0.012, 0.024):
        o = int(off * SR)
        burst[o:] += c[:len(c) - o] * env[:len(c) - o] * 0.5
    place(burst, t0, g, pan=0.1, send=0.35)


for c in (2.0, 3.0):
    clap(c)

# hats: off-beat 8ths + 16th crescendo into the lock
def hat(t0, g):
    h = highpass(noise(0.05), 0.35) * np.exp(-t_axis(0.05) / 0.012)
    place(h, t0, g, pan=0.35)


for hx in (1.75, 2.25):
    hat(hx, 0.07)
for i in range(8):
    hat(2.5 + i * 0.0625 + 0.0, 0.03 + 0.012 * i)   # 2.5 -> 2.94 roll
hat(3.25, 0.05)
hat(3.75, 0.05)

# ----------------------------------------------------------------- riser -----
r_len = 1.5
rt = t_axis(r_len)
rn = noise(r_len)
a_curve = 0.01 + 0.5 * (rt / r_len) ** 2
rise = one_pole_lp(rn, a_curve) * (rt / r_len) ** 1.6
fsw = 180.0 * (2000.0 / 180.0) ** (rt / r_len)
sweep = np.sin(2 * np.pi * np.cumsum(fsw) / SR) * (rt / r_len) ** 2
place(rise, 1.5, 0.55, send=0.25)
place(sweep, 1.5, 0.07, send=0.3)

# ------------------------------------------------------------- 3.00 lock -----
bt = t_axis(2.0)
bell = (np.sin(2 * np.pi * 880 * bt) * 0.9 + np.sin(2 * np.pi * 1320 * bt) * 0.6
        + np.sin(2 * np.pi * 1760 * bt) * 0.5 + np.sin(2 * np.pi * 2640 * bt) * 0.25) * np.exp(-bt / 0.55)
place(bell, 3.0, 0.14, send=0.75)
place(np.sin(2 * np.pi * 55 * t_axis(0.8)) * np.exp(-t_axis(0.8) / 0.25), 3.0, 0.5)

# --------------------------------------------------------- 3.00-3.75 whoosh --
w_len = 0.75
wt = t_axis(w_len)
wn = noise(w_len)
env = np.sin(np.pi * np.clip(wt / w_len, 0, 1)) ** 1.5
fast = one_pole_lp(wn, 0.05 + 0.5 * np.sin(np.pi * wt / w_len))
slow = one_pole_lp(wn, 0.02)
whoosh = (fast - slow) * env
# pan sweep L->R by splitting manually
ang = (np.linspace(-0.8, 0.8, len(whoosh)) + 1.0) * np.pi / 4.0
i0 = int(3.0 * SR)
L[i0:i0 + len(whoosh)] += whoosh * np.cos(ang) * 1.1
R[i0:i0 + len(whoosh)] += whoosh * np.sin(ang) * 1.1

# ----------------------------------------------------------- 3.50 slab tick --
tick = np.sin(2 * np.pi * 1200 * t_axis(0.05)) * np.exp(-t_axis(0.05) / 0.012)
place(tick, 3.5, 0.18, send=0.3)
place(np.sin(2 * np.pi * 90 * t_axis(0.2)) * np.exp(-t_axis(0.2) / 0.05), 3.5, 0.35)

# cursor travel: faint air
cur = one_pole_lp(noise(0.45), 0.08) * np.sin(np.pi * t_axis(0.45) / 0.45)
place(cur, 3.55, 0.05, pan=0.2)

# -------------------------------------------------------------- 4.00 click ---
down = highpass(noise(0.012), 0.3) * np.exp(-t_axis(0.012) / 0.003)
up = highpass(noise(0.01), 0.3) * np.exp(-t_axis(0.01) / 0.0025)
place(down, 4.0, 0.5)
place(up, 4.07, 0.3)
place(np.sin(2 * np.pi * 180 * t_axis(0.05)) * np.exp(-t_axis(0.05) / 0.012), 4.0, 0.3)

# verifying blips 4.125 / 4.25 / 4.375
for i, f0 in enumerate((523.25, 659.25, 783.99)):
    bt2 = t_axis(0.16)
    blip = (np.sin(2 * np.pi * f0 * bt2) + 0.25 * np.sin(2 * np.pi * 2 * f0 * bt2)) * np.exp(-bt2 / 0.05)
    place(blip, 4.125 + i * 0.125, 0.1 + 0.02 * i, pan=-0.2 + 0.2 * i, send=0.35)

# ---------------------------------------------------------- 4.50 ready -------
ct = t_axis(1.0)
chord = np.zeros_like(ct)
for f0, a in ((440.0, 1.0), (523.25, 0.8), (659.25, 0.7), (987.77, 0.45), (1760.0, 0.18)):
    chord += np.sin(2 * np.pi * f0 * ct) * a
chord *= np.minimum(1.0, ct / 0.006) * np.exp(-ct / 0.55)
place(chord, 4.5, 0.075, send=0.6)
place(np.sin(2 * np.pi * 110 * t_axis(0.5)) * np.exp(-t_axis(0.5) / 0.2), 4.5, 0.3)

# ---------------------------------------------------------------- reverb -----
ir_len = 1.6
irt = t_axis(ir_len)
ir_l = rng.standard_normal(len(irt)) * np.exp(-irt / 0.42)
ir_r = rng.standard_normal(len(irt)) * np.exp(-irt / 0.42)
ir_l = one_pole_lp(ir_l, 0.25)
ir_r = one_pole_lp(ir_r, 0.25)
ir_l[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
ir_r[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
fft_n = 1 << int(np.ceil(np.log2(N + len(irt))))
wet_l = np.fft.irfft(np.fft.rfft(SEND_L, fft_n) * np.fft.rfft(ir_l, fft_n), fft_n)[:N]
wet_r = np.fft.irfft(np.fft.rfft(SEND_R, fft_n) * np.fft.rfft(ir_r, fft_n), fft_n)[:N]
wn_norm = 0.035
L += wet_l * wn_norm
R += wet_r * wn_norm

# ---------------------------------------------------------------- master -----
fade_in = np.clip(t / 0.004, 0, 1)
fade_out = np.clip((DUR - t) / 0.25, 0, 1)
L *= fade_in * fade_out
R *= fade_in * fade_out
L = np.tanh(L * 1.15)
R = np.tanh(R * 1.15)
pk = max(np.max(np.abs(L)), np.max(np.abs(R)))
gain = 0.62 / pk
L *= gain
R *= gain

pcm = np.empty(N * 2, dtype=np.int16)
pcm[0::2] = (L * 32767).astype(np.int16)
pcm[1::2] = (R * 32767).astype(np.int16)

out = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'assets', 'proof-audio.wav'))
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, 'wb') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
print(f'audio ok: {out}  peak={0.62:.2f}  dur={DUR}s')
