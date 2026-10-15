#!/usr/bin/env python3
"""GYEVO Lending & Borrowing — 28s film soundtrack. Original synthesis, 120 BPM, stereo, 44.1 kHz.

First 5.0s are the approved proof, unchanged. Cue grid (seconds) must match CUE in index.html:
  0.0 hit  0.5 withIn  1.0 strike  1.5 slam  2.0 legend  3.0 lock  3.5 slab  4.0 click  4.5 ready
  5.5 collapse  6.0 tab  6.5 SUPPLY  9.0 attach  10.0 COLLATERAL  12.0 enable  13.0 link
  14.0 BORROW  17.0 reject  19.0 attach  20.0 PROOF TO ENTER  21.0 NEVER TO EXIT  22.75 repay
  23.5 montage x4  25.5 legend  26.0 brand  28.0 end
"""
import os
import wave
import numpy as np

SR = 44100
DUR = 28.0
N = int(SR * DUR)
rng = np.random.default_rng(11)

L = np.zeros(N)
R = np.zeros(N)
SEND_L = np.zeros(N)
SEND_R = np.zeros(N)
t = np.arange(N) / SR


def t_axis(length):
    return np.arange(int(length * SR)) / SR


def place(sig, t0, gain=1.0, pan=0.0, send=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N or i0 < 0:
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


def sine(f, length, phase=0.0):
    tt = t_axis(length)
    return np.sin(2 * np.pi * f * tt + phase)


# ------------------------------------------------------------------ sections --
# (start, end, root Hz, pentatonic notes)
SECTIONS = [
    (0.0, 6.0, 55.00, [220.00, 261.63, 329.63, 392.00, 440.00]),
    (6.0, 10.0, 43.65, [174.61, 220.00, 261.63, 293.66, 349.23]),
    (10.0, 14.0, 65.41, [261.63, 293.66, 329.63, 392.00, 440.00]),
    (14.0, 20.0, 49.00, [196.00, 246.94, 293.66, 329.63, 392.00]),
    (20.0, 26.0, 55.00, [220.00, 261.63, 329.63, 392.00, 440.00]),
]


def section_at(tm):
    for s in SECTIONS:
        if s[0] <= tm < s[1]:
            return s
    return SECTIONS[-1]


# ---------------------------------------------------------------- bed (pad) ---
bed = np.zeros(N)
for (s0, s1, root, _) in SECTIONS:
    i0, i1 = int(s0 * SR), min(N, int(s1 * SR))
    tt = t[i0:i1] - s0
    env = np.clip(tt / 0.6, 0, 1) * np.clip((s1 - t[i0:i1]) / 0.4, 0, 1)
    seg = (np.sin(2 * np.pi * root * tt) * 0.9
           + np.sin(2 * np.pi * root * 1.5 * tt) * 0.5
           + np.sin(2 * np.pi * root * 2.0 * tt + 0.6) * 0.35)
    seg *= (0.72 + 0.28 * np.sin(2 * np.pi * 0.5 * tt))
    bed[i0:i1] += seg * env
upper = np.zeros(N)
for (s0, s1, root, notes) in SECTIONS:
    if s0 < 1.5:
        s0 = 1.5
    i0, i1 = int(s0 * SR), min(N, int(s1 * SR))
    tt = t[i0:i1] - s0
    env = np.clip(tt / 0.7, 0, 1) * np.clip((s1 - t[i0:i1]) / 0.4, 0, 1)
    seg = (np.sin(2 * np.pi * notes[0] * tt) + 0.8 * np.sin(2 * np.pi * notes[2] * tt)) * 0.5
    upper[i0:i1] += seg * env
bed_full = bed * 0.075 + upper * 0.04

# silence the bed under the montage and let the brand chord own the end
bed_full *= np.clip((26.0 - t) / 0.25, 0, 1) * np.where(t > 23.4, 0.35, 1.0)

# ------------------------------------------------------------------ kicks -----
KICKS = {}
for k in np.arange(1.5, 23.0, 0.5):
    KICKS[round(float(k), 3)] = 0.5
for k in (1.5, 3.0, 6.5, 10.0, 14.0, 20.0, 21.0):
    KICKS[k] = 0.78
for k in np.arange(5.0, 6.5, 0.5):
    KICKS[round(float(k), 3)] = 0.34
for k in (3.5, 4.0, 4.5):
    KICKS[k] = 0.32
# breath before the montage, then four hits
for k in (23.0,):
    KICKS.pop(k, None)
for k in (23.5, 24.0, 24.5, 25.0):
    KICKS[k] = 0.7
KICKS[26.0] = 0.8
KICKS[0.0] = 0.0

duck = np.ones(N)
for k, g in KICKS.items():
    if g <= 0:
        continue
    d = np.clip((t - k) / 0.22, 0, 1)
    duck *= 1.0 - 0.42 * (1.0 - d) * (t >= k)
bed_full *= duck
L += bed_full
R += bed_full


def kick(t0, g=0.55):
    k = t_axis(0.4)
    f = 48.0 + 90.0 * np.exp(-k / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-k / 0.16)
    click = highpass(noise(0.01), 0.3) * np.exp(-t_axis(0.01) / 0.003)
    place(body, t0, g)
    place(click, t0, g * 0.3)


for k, g in KICKS.items():
    if g > 0:
        kick(k, g)


def clap(t0, g=0.26):
    c = highpass(noise(0.18), 0.12)
    env = np.exp(-t_axis(0.18) / 0.045)
    burst = np.zeros_like(c)
    for off in (0.0, 0.012, 0.024):
        o = int(off * SR)
        burst[o:] += c[:len(c) - o] * env[:len(c) - o] * 0.5
    place(burst, t0, g, pan=0.1, send=0.35)


def hat(t0, g):
    h = highpass(noise(0.05), 0.35) * np.exp(-t_axis(0.05) / 0.012)
    place(h, t0, g, pan=0.35)


# ------------------------------------------------------------- 0.00 hit -------
def big_hit(t0, g=0.62, shimmer=0.05):
    tt = t_axis(1.6)
    f = 42.0 + 70.0 * np.exp(-tt / 0.07)
    phase = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(phase) * np.exp(-tt / 0.55)
    crack = highpass(noise(0.05), 0.25) * np.exp(-t_axis(0.05) / 0.012)
    shim = (np.sin(2 * np.pi * 2093 * tt) + np.sin(2 * np.pi * 3136 * tt) * 0.7) * np.exp(-tt / 0.35)
    place(sub, t0, g)
    place(crack, t0, g * 0.8)
    place(shim, t0, shimmer, pan=0.3, send=0.6)


big_hit(0.0, 0.62)

# ------------------------------------------------------------ arp plucks ------
PATTERN = [0, 2, 4, 2, 3, 1, 4, 2]
step = 0.125
idx = 0
tcur = 0.5
MUTE = [(0.94, 1.24), (16.8, 17.3), (23.4, 26.1)]
while tcur < 23.4:
    in_mute = any(a <= tcur < b for a, b in MUTE)
    sec = section_at(tcur)
    # eighth-note arp in the calm resolve, sixteenths elsewhere
    slow = 20.0 <= tcur < 23.4
    on_grid = (not slow) or (abs((tcur / 0.25) - round(tcur / 0.25)) < 1e-6)
    if not in_mute and on_grid:
        f0 = sec[3][PATTERN[idx % len(PATTERN)]]
        pt = t_axis(0.3)
        pl = (np.sin(2 * np.pi * f0 * pt) + 0.3 * np.sin(2 * np.pi * 2 * f0 * pt)) * np.exp(-pt / 0.11)
        g = 0.05 + 0.04 * min(1.0, max(0.0, (tcur - 0.5) / 2.0))
        if tcur > 4.5:
            g = 0.075
        place(pl, tcur, g, pan=(-0.45 if idx % 2 == 0 else 0.45), send=0.45)
    idx += 1
    tcur = round(tcur + step, 6)

# ------------------------------------------------------ intro: strike + riser --
sw = highpass(noise(0.25), 0.3) * (t_axis(0.25) / 0.25) ** 2
place(sw, 0.75, 0.25, send=0.2)
strike = highpass(noise(0.06), 0.3) * np.exp(-t_axis(0.06) / 0.015)
thud = np.sin(2 * np.pi * 150 * t_axis(0.25)) * np.exp(-t_axis(0.25) / 0.06)
place(strike, 1.0, 0.55)
place(thud, 1.0, 0.4)


def riser(t0, length, g=0.5):
    rt = t_axis(length)
    rn = noise(length)
    a_curve = 0.01 + 0.5 * (rt / length) ** 2
    rise = one_pole_lp(rn, a_curve) * (rt / length) ** 1.6
    fsw = 180.0 * (2000.0 / 180.0) ** (rt / length)
    sweep = np.sin(2 * np.pi * np.cumsum(fsw) / SR) * (rt / length) ** 2
    place(rise, t0, g, send=0.25)
    place(sweep, t0, g * 0.14, send=0.3)


riser(1.5, 1.5, 0.55)
for rs in (5.75, 9.5, 13.5, 19.5, 25.5):
    riser(rs, 0.5 if rs != 25.5 else 0.5, 0.42)

# claps / hats
for c in (2.0, 3.0):
    clap(c)
for c in np.arange(6.5, 23.0, 1.0):
    clap(round(float(c), 3), 0.2)
for hx in (1.75, 2.25):
    hat(hx, 0.07)
for i in range(8):
    hat(2.5 + i * 0.0625, 0.03 + 0.012 * i)
hat(3.25, 0.05)
hat(3.75, 0.05)
for hx in np.arange(5.25, 23.0, 0.5):
    hat(round(float(hx), 3), 0.045)
for hx in np.arange(23.5, 25.5, 0.25):
    hat(round(float(hx), 3), 0.06)


# ---------------------------------------------------------------- bells -------
def bell(t0, base, g=0.14, send=0.75, tail=2.0):
    bt = t_axis(tail)
    s = (np.sin(2 * np.pi * base * bt) * 0.9 + np.sin(2 * np.pi * base * 1.5 * bt) * 0.6
         + np.sin(2 * np.pi * base * 2.0 * bt) * 0.5 + np.sin(2 * np.pi * base * 3.0 * bt) * 0.25) * np.exp(-bt / 0.55)
    place(s, t0, g, send=send)


bell(3.0, 880.0, 0.14)
place(sine(55, 0.8) * np.exp(-t_axis(0.8) / 0.25), 3.0, 0.5)

# whoosh 3.0–3.75 (flythrough)
w_len = 0.75
wt = t_axis(w_len)
wn = noise(w_len)
env = np.sin(np.pi * np.clip(wt / w_len, 0, 1)) ** 1.5
fast = one_pole_lp(wn, 0.05 + 0.5 * np.sin(np.pi * wt / w_len))
slow = one_pole_lp(wn, 0.02)
whoosh = (fast - slow) * env
ang = (np.linspace(-0.8, 0.8, len(whoosh)) + 1.0) * np.pi / 4.0
i0 = int(3.0 * SR)
L[i0:i0 + len(whoosh)] += whoosh * np.cos(ang) * 1.1
R[i0:i0 + len(whoosh)] += whoosh * np.sin(ang) * 1.1


def whoosh_at(t0, length=0.6, g=0.7, flip=False):
    n = int(length * SR)
    tt = np.arange(n) / SR
    nz = noise(length)
    e = np.sin(np.pi * np.clip(tt / length, 0, 1)) ** 1.5
    fa = one_pole_lp(nz, 0.05 + 0.5 * np.sin(np.pi * tt / length))
    sl = one_pole_lp(nz, 0.02)
    sig = (fa - sl) * e * g
    a = np.linspace(0.8, -0.8, n) if flip else np.linspace(-0.8, 0.8, n)
    a = (a + 1.0) * np.pi / 4.0
    j0 = int(t0 * SR)
    m = min(n, N - j0)
    L[j0:j0 + m] += sig[:m] * np.cos(a[:m])
    R[j0:j0 + m] += sig[:m] * np.sin(a[:m])


# page moves: collapse, supply, collateral, borrow, repay
whoosh_at(5.5, 0.6, 0.6)
whoosh_at(6.0, 0.6, 0.7, True)
whoosh_at(10.0, 0.6, 0.75)
whoosh_at(14.0, 0.7, 0.8, True)
whoosh_at(20.0, 0.7, 0.75)
whoosh_at(23.4, 0.35, 0.8, True)

# slab landing tick + soft thud
tick = np.sin(2 * np.pi * 1200 * t_axis(0.05)) * np.exp(-t_axis(0.05) / 0.012)
place(tick, 3.5, 0.18, send=0.3)
place(sine(90, 0.2) * np.exp(-t_axis(0.2) / 0.05), 3.5, 0.35)
cur = one_pole_lp(noise(0.45), 0.08) * np.sin(np.pi * t_axis(0.45) / 0.45)
place(cur, 3.55, 0.05, pan=0.2)


# ----------------------------------------------------------------- clicks -----
def click(t0, g=0.5):
    down = highpass(noise(0.012), 0.3) * np.exp(-t_axis(0.012) / 0.003)
    up = highpass(noise(0.01), 0.3) * np.exp(-t_axis(0.01) / 0.0025)
    place(down, t0, g)
    place(up, t0 + 0.07, g * 0.6)
    place(sine(180, 0.05) * np.exp(-t_axis(0.05) / 0.012), t0, g * 0.6)


def type_tick(t0, f0=1800.0):
    s = sine(f0, 0.035) * np.exp(-t_axis(0.035) / 0.008)
    place(s, t0, 0.07, pan=0.15)


for c in (4.0, 6.0, 9.0, 10.0, 11.0, 12.0, 19.0, 20.0, 22.0, 22.75):
    click(c, 0.42)

for tt_ in (7.25, 7.375, 7.5, 10.5, 10.625, 14.625, 15.5, 16.5, 16.625, 18.0):
    type_tick(tt_)

# review rows ticking in
for rr in (8.0, 8.125, 8.25, 14.75, 14.875, 22.25):
    place(sine(1100, 0.04) * np.exp(-t_axis(0.04) / 0.01), rr, 0.05, pan=-0.2)

# verifying blips 4.125 / 4.25 / 4.375 + ready chord 4.5
for i, f0 in enumerate((523.25, 659.25, 783.99)):
    bt2 = t_axis(0.16)
    blip = (np.sin(2 * np.pi * f0 * bt2) + 0.25 * np.sin(2 * np.pi * 2 * f0 * bt2)) * np.exp(-bt2 / 0.05)
    place(blip, 4.125 + i * 0.125, 0.1 + 0.02 * i, pan=-0.2 + 0.2 * i, send=0.35)
ct = t_axis(1.0)
chord = np.zeros_like(ct)
for f0, a in ((440.0, 1.0), (523.25, 0.8), (659.25, 0.7), (987.77, 0.45), (1760.0, 0.18)):
    chord += np.sin(2 * np.pi * f0 * ct) * a
chord *= np.minimum(1.0, ct / 0.006) * np.exp(-ct / 0.55)
place(chord, 4.5, 0.075, send=0.6)
place(sine(110, 0.5) * np.exp(-t_axis(0.5) / 0.2), 4.5, 0.3)

# ------------------------------------------------------ section slams (new) ----
for s_t in (6.5, 10.0, 14.0):
    big_hit(s_t, 0.55, 0.06)
big_hit(20.0, 0.5, 0.05)
big_hit(21.0, 0.58, 0.07)

# proof-attach bells (supply, borrow) and the ring link
bell(9.0, 659.25, 0.12, 0.7, 1.6)
bell(12.0, 783.99, 0.1, 0.7, 1.4)
bell(19.0, 587.33, 0.12, 0.7, 1.6)
# the link: a low magnetic thunk + metallic ring-up
lk = t_axis(1.2)
thunk = np.sin(2 * np.pi * (49 + 40 * np.exp(-lk / 0.05)) * lk) * np.exp(-lk / 0.3)
place(thunk, 13.0, 0.62)
place(np.sin(2 * np.pi * 1318.5 * lk) * np.exp(-lk / 0.5), 13.0, 0.07, send=0.7)
place(np.sin(2 * np.pi * 1976.0 * lk) * np.exp(-lk / 0.4), 13.0, 0.045, pan=0.4, send=0.7)


# characters assembling into numerals: short granular chirp
def chirp(t0, length=0.5, f_from=500.0, f_to=2400.0, g=0.07):
    ct_ = t_axis(length)
    f = f_from * (f_to / f_from) ** (ct_ / length)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * ct_ / length)
    gr = highpass(noise(length), 0.2) * np.sin(np.pi * ct_ / length) * 0.25
    place(s + gr, t0, g, pan=0.2, send=0.4)


for c in (14.75, 15.5, 16.5):
    chirp(c, 0.5)
chirp(18.0, 0.55, 2400.0, 520.0)

# the caution pulse at 16.0 and the dull reject at 17.0
for p in (16.0, 16.25):
    place(sine(311.1, 0.18) * np.exp(-t_axis(0.18) / 0.06), p, 0.1, send=0.3)
rj = t_axis(0.6)
rej = (np.sin(2 * np.pi * 70 * rj) * 0.9 + np.sin(2 * np.pi * 233.1 * rj) * 0.35
       + np.sin(2 * np.pi * 246.9 * rj) * 0.35) * np.exp(-rj / 0.18)
place(rej, 17.0, 0.55, send=0.2)
place(highpass(noise(0.04), 0.3) * np.exp(-t_axis(0.04) / 0.01), 17.0, 0.35)

# repay: debt numeral falls to zero, rings unlink — descending shimmer + release
rs_t = t_axis(1.2)
shimmer = np.zeros_like(rs_t)
for i, f0 in enumerate((1760.0, 1320.0, 987.77, 659.25, 440.0)):
    d = i * 0.08
    s = np.sin(2 * np.pi * f0 * np.clip(rs_t - d, 0, None)) * np.exp(-np.clip(rs_t - d, 0, None) / 0.35) * (rs_t >= d)
    shimmer += s * (0.9 - i * 0.12)
place(shimmer, 22.75, 0.09, send=0.7)
place(sine(55, 1.0) * np.exp(-t_axis(1.0) / 0.4), 22.75, 0.38)


# ---------------------------------------------------------------- montage -----
def mont_hit(t0, f0, g=0.7):
    snap = highpass(noise(0.08), 0.28) * np.exp(-t_axis(0.08) / 0.02)
    place(snap, t0, 0.38)
    bl = t_axis(0.2)
    s = (np.sin(2 * np.pi * f0 * bl) + 0.35 * np.sin(2 * np.pi * 2 * f0 * bl)) * np.exp(-bl / 0.07)
    place(s, t0, 0.13, pan=0.0, send=0.4)


for tm, f0 in ((23.5, 440.0), (24.0, 523.25), (24.5, 659.25), (25.0, 880.0)):
    mont_hit(tm, f0)

# legend flash 25.5–26.0: pad swell into the brand
sw_t = t_axis(0.5)
pad = (np.sin(2 * np.pi * 220 * sw_t) + np.sin(2 * np.pi * 329.63 * sw_t) + np.sin(2 * np.pi * 261.63 * sw_t)) * (sw_t / 0.5) ** 2
place(pad, 25.5, 0.09, send=0.5)

# -------------------------------------------------------------- brand ---------
big_hit(26.0, 0.65, 0.08)
bt3 = t_axis(2.0)
brand = np.zeros_like(bt3)
for f0, a in ((110.0, 1.0), (220.0, 0.8), (329.63, 0.7), (440.0, 0.6), (523.25, 0.45), (659.25, 0.4), (987.77, 0.3)):
    brand += np.sin(2 * np.pi * f0 * bt3) * a
brand *= np.minimum(1.0, bt3 / 0.01) * np.exp(-bt3 / 1.4)
place(brand, 26.0, 0.1, send=0.7)
place(sine(55, 2.0) * np.exp(-t_axis(2.0) / 0.9), 26.0, 0.32)

# ---------------------------------------------------------------- reverb ------
ir_len = 1.8
irt = t_axis(ir_len)
ir_l = one_pole_lp(rng.standard_normal(len(irt)) * np.exp(-irt / 0.45), 0.25)
ir_r = one_pole_lp(rng.standard_normal(len(irt)) * np.exp(-irt / 0.45), 0.25)
ir_l[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
ir_r[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
fft_n = 1 << int(np.ceil(np.log2(N + len(irt))))
wet_l = np.fft.irfft(np.fft.rfft(SEND_L, fft_n) * np.fft.rfft(ir_l, fft_n), fft_n)[:N]
wet_r = np.fft.irfft(np.fft.rfft(SEND_R, fft_n) * np.fft.rfft(ir_r, fft_n), fft_n)[:N]
L += wet_l * 0.035
R += wet_r * 0.035

# ---------------------------------------------------------------- master ------
fade_in = np.clip(t / 0.004, 0, 1)
fade_out = np.clip((DUR - t) / 0.3, 0, 1)
L *= fade_in * fade_out
R *= fade_in * fade_out
L = np.tanh(L * 1.9)
R = np.tanh(R * 1.9)
pk = max(np.max(np.abs(L)), np.max(np.abs(R)))
gain = 0.54 / pk
L *= gain
R *= gain

pcm = np.empty(N * 2, dtype=np.int16)
pcm[0::2] = (L * 32767).astype(np.int16)
pcm[1::2] = (R * 32767).astype(np.int16)

out = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'assets', 'film-audio.wav'))
with wave.open(out, 'wb') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
print(f'audio ok: {out}  dur={DUR}s')
