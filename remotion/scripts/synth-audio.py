#!/usr/bin/env python3
"""GYEVO promo soundtrack synthesizer — v3.

Every sound is generated from sine waves, harmonics, noise and FFT filtering: no samples, no third-party
music, no AI-generated audio. Three genuinely distinct musical identities, one per film:

  protocol    Dark cinematic score: sub-bass rumble, sparse industrial heartbeat, dramatic reverb space.
              Harmonic movement based on D minor. Long sustained pads, minimal percussion until the
              proposition builds. Climaxes with one large impact over deep silence.

  governance  Upbeat editorial motion graphics groove: bright Am/F/C/G chord palette (A natural minor,
              lighter than D minor), short staccato pad chords placed rhythmically, paper-snap percussion,
              shuffle hi-hat feel, minimal reverb — dry, punchy, feels like an outstanding design-agency
              kinetic-typography video. Completely different timbre to Protocol.

  lending     Technical rhythm film: tight 4-on-the-floor kick, crisp snare on 2&4, synth stabs on
              offbeats, building drum density across the film. No cursor taps (cursor removed). The groove
              accelerates from sparse to dense as each lending mechanism is explained. Anchored in Dm but
              with a tighter, more aggressive character than Protocol.

Scene boundaries and hit times come from remotion/lib/cues.json.
Each track has one deliberate pocket of near-silence before its final impact.

Usage:  python3 remotion/scripts/synth-audio.py [protocol|governance|lending]
Output: remotion/public/audio/<name>.wav  (44.1 kHz, 16-bit stereo)
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parents[1]
CUES = json.loads((ROOT / "lib" / "cues.json").read_text())
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(46630)


def hz(note: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    key = note[:-1]
    octave = int(note[-1])
    return 440.0 * 2 ** ((names[key] + 12 * (octave + 1) - 69) / 12)


class Bus:
    def __init__(self, n: int):
        self.l = np.zeros(n, dtype=np.float64)
        self.r = np.zeros(n, dtype=np.float64)
        self.n = n

    def add(self, sig, t0: float, gain=1.0, pan=0.0):
        i = int(round(t0 * SR))
        if i >= self.n or i + len(sig) <= 0:
            return
        s = sig
        if i < 0:
            s = s[-i:]
            i = 0
        m = min(len(s), self.n - i)
        a = (pan + 1) * np.pi / 4
        self.l[i : i + m] += s[:m] * gain * np.cos(a)
        self.r[i : i + m] += s[:m] * gain * np.sin(a)


def tt(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def smooth_env(n: int, a: float, r: float) -> np.ndarray:
    t = np.arange(n) / SR
    e = np.ones(n)
    if a > 0:
        e = np.minimum(e, 0.5 - 0.5 * np.cos(np.clip(t / a, 0, 1) * np.pi))
    if r > 0:
        tail = (n / SR) - t
        e = np.minimum(e, 0.5 - 0.5 * np.cos(np.clip(tail / r, 0, 1) * np.pi))
    return e


def one_pole_lp(x: np.ndarray, cutoff: float) -> np.ndarray:
    n = len(x)
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= 1.0 / (1.0 + (f / cutoff) ** 4)
    return np.fft.irfft(spec, n)


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - one_pole_lp(x, cutoff)


def band_sweep_noise(dur: float, f0: float, f1: float, width_oct=0.9, amp_shape="rise") -> np.ndarray:
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    block = 2048
    hop = block // 2
    win = np.hanning(block)
    out = np.zeros(n + block)
    freqs = np.fft.rfftfreq(block, 1 / SR)
    for start in range(0, n, hop):
        seg = noise[start : start + block]
        if len(seg) < block:
            seg = np.pad(seg, (0, block - len(seg)))
        p = start / max(1, n)
        fc = f0 * (f1 / f0) ** p
        g = np.exp(-0.5 * ((np.log2(np.maximum(freqs, 1) / fc)) / width_oct) ** 2)
        spec = np.fft.rfft(seg * win) * g
        out[start : start + block] += np.fft.irfft(spec, block) * win
    out = out[:n]
    p = np.linspace(0, 1, n)
    if amp_shape == "rise":
        env = p ** 2.2
    elif amp_shape == "fall":
        env = (1 - p) ** 1.6
    else:
        env = np.sin(np.pi * p) ** 1.5
    out *= env
    peak = np.max(np.abs(out)) or 1
    return out / peak


def reverb_ir(rt60: float, seed: int, dark=6) -> np.ndarray:
    r = np.random.default_rng(seed)
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-6.9 * t / rt60)
    k = np.ones(dark) / dark
    ir = np.convolve(ir, k, mode="same")
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))


def fft_conv(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = 1
    while n < len(x) + len(ir):
        n *= 2
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]


# ============================================================================== instruments

def sub_hit(f_end=44.0, dur=1.9, drop=0.22) -> np.ndarray:
    t = tt(dur)
    f = f_end + (110.0 - f_end) * np.exp(-t / (drop / 4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.65)
    click = highpass(rng.standard_normal(len(t)), 1800) * np.exp(-t / 0.012) * 0.25
    return body + click


def kick(punch=1.0, tight=False) -> np.ndarray:
    """Standard kick drum. tight=True for a shorter, more clicky version used in Lending."""
    dur = 0.28 if tight else 0.42
    t = tt(dur)
    f = 48 + 120 * np.exp(-t / (0.018 if tight else 0.028))
    ph = 2 * np.pi * np.cumsum(f) / SR
    decay = 0.08 if tight else 0.13
    return np.sin(ph) * np.exp(-t / decay) + 0.18 * punch * highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.006)


def hat(open_=False, bright=1.0) -> np.ndarray:
    d = 0.32 if open_ else 0.07
    t = tt(d)
    fc = 7500 * (0.7 + 0.3 * bright)
    n = highpass(rng.standard_normal(len(t)), fc)
    return n * np.exp(-t / (0.09 if open_ else 0.018)) * 0.5


def clap(crisp=False) -> np.ndarray:
    t = tt(0.22 if crisp else 0.28)
    n = highpass(one_pole_lp(rng.standard_normal(len(t)), 5200), 900)
    env = np.exp(-t / (0.04 if crisp else 0.06))
    for o in (0.0, 0.009, 0.018):
        env += 0.6 * np.exp(-np.clip(t - o, 0, None) / 0.010) * (t >= o)
    return n * env * (0.7 if crisp else 0.6)


def click_low() -> np.ndarray:
    t = tt(0.045)
    n = one_pole_lp(highpass(rng.standard_normal(len(t)), 1100), 2600)
    return n * np.exp(-t / 0.009) * 0.55


def paper_snap() -> np.ndarray:
    """A bright dry snap — like a page being pulled taut. Governance only.
    Higher frequency than click_low, very short, no tonal content."""
    t = tt(0.032)
    n = one_pole_lp(highpass(rng.standard_normal(len(t)), 4500), 11000)
    return n * np.exp(-t / 0.005) * 0.9


def impact(dur=1.3, bright=1.0) -> np.ndarray:
    t = tt(dur)
    ratios = (1.0, 1.41, 1.9, 2.37)
    body = sum(np.sin(2 * np.pi * 55 * r * t + r) * np.exp(-t * (2.0 + 1.3 * i)) for i, r in enumerate(ratios)) / len(ratios)
    burst = highpass(rng.standard_normal(len(t)), 1500) * np.exp(-t / 0.02) * 0.4 * bright
    return body * 0.85 + burst


def synth_stab(freq: float, dur=0.14) -> np.ndarray:
    """A short rhythmic synth stab for Lending offbeats — not melodic, just percussive.
    Square-ish waveform, fast decay, low-passed to prevent brightness."""
    t = tt(dur)
    sig = np.sign(np.sin(2 * np.pi * freq * t)) * 0.6 + np.sin(2 * np.pi * freq * t) * 0.4
    env = smooth_env(len(t), 0.003, 0.06)
    return one_pole_lp(sig * env, freq * 2.2) * 0.55


def bass_pluck(freq: float, dur=1.6) -> np.ndarray:
    t = tt(dur)
    saw = np.zeros(len(t))
    for k in range(1, 6):
        saw += np.sin(2 * np.pi * freq * k * t) / k
    sig = saw * np.exp(-t * 3.0)
    return one_pole_lp(sig, freq * 3.4) * 0.85


def staccato_chord(freqs: list, dur=0.38) -> tuple:
    """Short, articulated pad chord for Governance — replaces the long sustained pads.
    Fast attack, medium-fast release. Returns (L, R)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    L, R = np.zeros(n), np.zeros(n)
    for fi, f in enumerate(freqs):
        for d, side in ((-0.004, 0), (0.0, 2), (0.004, 1)):
            ff = f * (1 + d)
            ph = 2 * np.pi * ff * t + fi * 0.6
            for k in range(1, 5):
                g = (1.0 / k) * (1.0 / (1 + 0.5 * k))
                s = np.sin(k * ph) * g
                if side in (0, 2):
                    L += s
                if side in (1, 2):
                    R += s
    env = smooth_env(n, 0.010, 0.12)
    return L * env, R * env


def pad_voice(freqs, dur: float, bright_env: np.ndarray, detune=0.0035) -> tuple:
    n = int(dur * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)
    for fi, f in enumerate(freqs):
        for d, side in ((-detune, 0), (0.0, 2), (detune, 1)):
            ff = f * (1 + d)
            ph = 2 * np.pi * ff * t + fi * 0.7 + d * 900
            for k in range(1, 9):
                g = (1.0 / k) * np.exp(-k * (1.15 - bright_env) * 1.35)
                s = np.sin(k * ph) * g
                if side in (0, 2):
                    L += s
                if side in (1, 2):
                    R += s
    return L, R


def silence_pocket(l: np.ndarray, r: np.ndarray, t0: float, pre: float, floor: float) -> None:
    i0, i1 = int((t0 - pre) * SR), int(t0 * SR)
    if i0 < 0 or i1 > len(l) or i1 <= i0:
        return
    ramp = np.linspace(1.0, floor, i1 - i0) ** 1.5
    l[i0:i1] *= ramp
    r[i0:i1] *= ramp


# ============================================================================== chord palettes

# Protocol & Lending: D minor (dark)
CHORDS_DM = {
    "Dm": ["D2", "A2", "D3", "F3", "A3"],
    "Bb": ["A#1", "F2", "A#2", "D3", "F3"],
    "Gm": ["G1", "D2", "G2", "A#2", "D3"],
    "A":  ["A1",  "E2", "A2", "C#3", "E3"],
    "F":  ["F1",  "C2", "F2", "A2",  "C3"],
}
ROOT_DM = {"Dm": "D1", "Bb": "A#0", "Gm": "G1", "A": "A0", "F": "F1"}

# Governance: A natural minor (brighter, editorial)
CHORDS_AM = {
    "Am": ["A1", "E2", "A2", "C3", "E3"],
    "F":  ["F1", "C2", "F2", "A2", "C3"],
    "C":  ["C2", "G2", "C3", "E3", "G3"],
    "G":  ["G1", "D2", "G2", "B2", "D3"],
    "Em": ["E1", "B1", "E2", "G2", "B2"],
}
ROOT_AM = {"Am": "A1", "F": "F1", "C": "C2", "G": "G1", "Em": "E1"}


# ============================================================================== arrangement

def build(name: str):
    cfg = CUES[name]
    dur = float(cfg["duration"]) + 1.6
    n = int(dur * SR)
    bpm = cfg["bpm"]
    beat = 60.0 / bpm
    scenes = cfg["scenes"]
    total = float(cfg["duration"])

    pad_bus = Bus(n)
    drum_bus = Bus(n)
    fx_bus = Bus(n)
    verb_send = Bus(n)
    bass_bus = Bus(n)

    kick_times: list[float] = []

    # ============================================================ PROTOCOL — dark cinematic
    if name == "protocol":
        harmony = [("Dm", 0.0, 9.0), ("Bb", 9.0, 17.0), ("Gm", 17.0, 22.4), ("A", 22.4, 27.0), ("Dm", 27.0, total + 1.6)]
        pad_gain, bright_peak = 0.32, 1.0

        # long sustained pads — the cinematic wash
        for chord, a, b in harmony:
            d = (b - a) + 2.2
            bn = int(d * SR)
            x = np.linspace(0, 1, bn)
            bright = np.clip(0.2 + (bright_peak - 0.2) * np.sin(np.pi * x * 0.9) ** 1.2, 0, 1)
            L, R = pad_voice([hz(nt) for nt in CHORDS_DM[chord]], d, bright)
            env = smooth_env(bn, 2.2, 2.0)
            i0 = int(max(0, a - 1.2) * SR)
            end = min(n, i0 + bn)
            sl = min(bn, end - i0)
            pad_bus.l[i0:i0 + sl] += (L * env)[:sl] * pad_gain / 9
            pad_bus.r[i0:i0 + sl] += (R * env)[:sl] * pad_gain / 9

        # sub drone — D1, slightly detuned second voice for width
        t_full = np.arange(n) / SR
        drone = np.sin(2 * np.pi * hz("D1") * t_full) * 0.55 + np.sin(2 * np.pi * hz("D1") * 2.005 * t_full) * 0.14
        # slow LFO breathe, deeper and slower than in v2
        drone *= smooth_env(n, 2.5, 3.0) * (0.45 + 0.55 * np.sin(2 * np.pi * t_full / 14.0) ** 2)
        drone = np.tanh(drone * 1.3)
        bass_bus.l += drone * 0.55
        bass_bus.r += drone * 0.55

        # slow moving bassline — starts after the logo scene, moves gently
        bl_step = 2.0 * beat
        t0 = 10.0
        while t0 < 22.4:
            ch = next(c for c, a, b in harmony if a <= t0 < b)
            p = bass_pluck(hz(ROOT_DM[ch]) * 2, bl_step * 1.1)
            bass_bus.add(p, t0, 0.18)
            t0 += bl_step

        # impacts and risers — all hits in cues.json
        hit_sub = sub_hit()
        for i, t0 in enumerate(cfg["hits"]):
            big = i in (0, len(cfg["hits"]) - 1) or t0 in scenes
            fx_bus.add(hit_sub, t0, 0.80 if big else 0.44)
            im = impact(1.4 if big else 0.8, bright=1.0 if big else 0.55)
            fx_bus.add(im, t0 + 0.01, 0.32 if big else 0.16, pan=0.0 if big else (0.18 if i % 2 else -0.18))
            verb_send.add(im, t0 + 0.01, 0.50 if big else 0.25)  # more reverb for cinematic space

        for a, b in cfg["risers"]:
            d = b - a
            w = band_sweep_noise(d, 160, 9000, 0.8, "rise")  # wider sweep for drama
            fx_bus.add(w, a, 0.35)
            verb_send.add(w, a, 0.30)
        for t0 in scenes[1:-1]:
            w = band_sweep_noise(1.1, 6000, 200, 0.9, "whoosh")  # longer whoosh
            fx_bus.add(w, t0 - 0.05, 0.20)

        for i, t0 in enumerate(cfg["accents"]):
            a = impact(0.7, bright=0.4)
            fx_bus.add(a, t0, 0.12, pan=(-0.38 if i % 2 else 0.38))
            verb_send.add(a, t0, 0.30)

        def beats(start, stop, step=1.0, offset=0.0):
            t = start + offset * beat
            while t < stop - 1e-6:
                yield t
                t += step * beat

        # heartbeat: NOT 4-on-the-floor. A single kick, twice per bar, more industrial than groovy.
        for t0 in beats(9.0, 17.0, 2.0):
            kick_times.append(t0)
        for t0 in beats(17.0, 22.4, 1.0):
            kick_times.append(t0)
        for t0 in beats(27.0, 30.0, 2.0):
            kick_times.append(t0)
        # hat: sparse, only from the proposition scene onward
        for t0 in beats(11.0, 22.4, 0.5, 0.25):
            drum_bus.add(hat(bright=0.7), t0, 0.20, pan=0.25)
        for t0 in beats(13.4, 22.4, 2.0, 1.0):
            drum_bus.add(clap(), t0, 0.22)

        kd = kick()
        for t0 in kick_times:
            drum_bus.add(kd, t0, 0.50)

        # sidechain
        duck = np.ones(n)
        for t0 in kick_times:
            i = int(t0 * SR)
            m = min(int(0.36 * SR), n - i)
            if m > 0:
                duck[i : i + m] = np.minimum(duck[i : i + m], 1 - 0.55 * np.exp(-np.arange(m) / SR / 0.12))
        pad_bus.l *= duck; pad_bus.r *= duck
        bass_bus.l *= duck; bass_bus.r *= duck

        # large reverb for cinematic depth
        irl, irr = reverb_ir(3.4, 11), reverb_ir(3.4, 29)

    # ============================================================ GOVERNANCE — upbeat editorial
    elif name == "governance":
        harmony_am = [
            ("Am", 0.0, 9.6), ("F", 9.6, 16.8), ("C", 16.8, 23.2), ("G", 23.2, 28.6), ("Am", 28.6, total + 1.6),
        ]

        # staccato pad chords placed on structural beats — NOT sustained washes
        staccato_times = []
        for chord, a, b in harmony_am:
            # place a staccato chord every 2 beats throughout the span
            t0 = a
            while t0 < b - 0.5:
                staccato_times.append((chord, t0))
                t0 += 2.0 * beat
        for chord, t0 in staccato_times:
            L, R = staccato_chord([hz(nt) for nt in CHORDS_AM[chord]])
            pad_bus.add(L, t0, 0.28, pan=-0.1)
            pad_bus.add(R, t0, 0.28, pan=0.1)

        # a very light, bright sustained pad underneath — much quieter than Protocol
        for chord, a, b in harmony_am:
            d = (b - a) + 1.8
            bn = int(d * SR)
            x = np.linspace(0, 1, bn)
            bright = np.clip(0.55 + 0.35 * np.sin(np.pi * x), 0, 1)
            L, R = pad_voice([hz(nt) for nt in CHORDS_AM[chord]], d, bright, detune=0.002)
            env = smooth_env(bn, 1.4, 1.4)
            i0 = int(max(0, a - 0.8) * SR)
            end = min(n, i0 + bn)
            sl = min(bn, end - i0)
            pad_bus.l[i0:i0 + sl] += (L * env)[:sl] * 0.10 / 9
            pad_bus.r[i0:i0 + sl] += (R * env)[:sl] * 0.10 / 9

        # NO dark D1 drone — a lighter A1 tonic with less LFO wobble
        t_full = np.arange(n) / SR
        light_root = np.sin(2 * np.pi * hz("A1") * t_full) * 0.4 + np.sin(2 * np.pi * hz("A1") * 2.004 * t_full) * 0.08
        light_root *= smooth_env(n, 1.8, 2.0) * (0.6 + 0.4 * np.sin(2 * np.pi * t_full / 8.0) ** 2)
        light_root = np.tanh(light_root * 1.0)
        bass_bus.l += light_root * 0.30
        bass_bus.r += light_root * 0.30

        # moving bassline — more frequent, brighter
        bl_step = beat
        t0 = 3.2
        while t0 < 28.6:
            ch = next(c for c, a, b in harmony_am if a <= t0 < b)
            p = bass_pluck(hz(ROOT_AM[ch]) * 2, bl_step * 1.2)
            bass_bus.add(p, t0, 0.20)
            t0 += bl_step

        # impact hits — brighter, shorter reverb for editorial punch
        hit_sub = sub_hit(f_end=55.0, dur=1.4)
        for i, t0 in enumerate(cfg["hits"]):
            big = i in (0, len(cfg["hits"]) - 1) or t0 in scenes
            fx_bus.add(hit_sub, t0, 0.60 if big else 0.35)
            im = impact(0.9 if big else 0.5, bright=1.2 if big else 0.7)
            fx_bus.add(im, t0 + 0.01, 0.24 if big else 0.12, pan=0.0 if big else (0.20 if i % 2 else -0.20))
            verb_send.add(im, t0 + 0.01, 0.25 if big else 0.12)

        for a, b in cfg["risers"]:
            d = b - a
            w = band_sweep_noise(d, 400, 8000, 0.7, "rise")
            fx_bus.add(w, a, 0.22)
            verb_send.add(w, a, 0.12)
        for t0 in scenes[1:-1]:
            w = band_sweep_noise(0.6, 5000, 350, 0.8, "whoosh")
            fx_bus.add(w, t0 - 0.04, 0.14)

        for i, t0 in enumerate(cfg["accents"]):
            a = impact(0.4, bright=0.6)
            fx_bus.add(a, t0, 0.10, pan=(-0.30 if i % 2 else 0.30))
            verb_send.add(a, t0, 0.14)

        def beats(start, stop, step=1.0, offset=0.0):
            t = start + offset * beat
            while t < stop - 1e-6:
                yield t
                t += step * beat

        # shuffle groove: kick on 1 and 3, snare on 2 and 4, hi-hat with swing feel
        shuffle_offset = 0.06  # swing 8th note offset (seconds)
        for t0 in beats(3.2, 28.6, 2.0):          # kick on beats 1 and 3
            kick_times.append(t0)
        for t0 in beats(3.2, 28.6, 2.0, 1.0):     # snare on beats 2 and 4
            drum_bus.add(clap(crisp=True), t0, 0.28)
        # shuffle 8th hi-hats — alternating on-beat and swung off-beat
        for t0 in beats(3.2, 28.6, 1.0):          # on the beat
            drum_bus.add(hat(bright=1.2), t0, 0.24, pan=0.22)
        for t0 in beats(3.2, 28.6, 1.0, 0.5):     # swung off-beat (pushed slightly late)
            drum_bus.add(hat(bright=0.9), t0 + shuffle_offset, 0.16, pan=0.28)
        # paper snaps — the distinctive Governance sound — landing on every 2nd off-beat
        for t0 in beats(9.6, 28.6, 2.0, 0.5):
            drum_bus.add(paper_snap(), t0 + shuffle_offset * 0.8, 0.45, pan=-0.20)
        for t0 in beats(16.8, 28.6, 2.0, 1.5):
            drum_bus.add(paper_snap(), t0 + shuffle_offset * 0.5, 0.35, pan=0.18)

        kd = kick(tight=False)
        for t0 in kick_times:
            drum_bus.add(kd, t0, 0.58)

        # lighter sidechain for editorial feel — just enough pump to feel rhythmic
        duck = np.ones(n)
        for t0 in kick_times:
            i = int(t0 * SR)
            m = min(int(0.22 * SR), n - i)
            if m > 0:
                duck[i : i + m] = np.minimum(duck[i : i + m], 1 - 0.35 * np.exp(-np.arange(m) / SR / 0.07))
        pad_bus.l *= duck; pad_bus.r *= duck
        bass_bus.l *= duck; bass_bus.r *= duck

        # medium reverb — dryer and punchier than Protocol
        irl, irr = reverb_ir(1.6, 17), reverb_ir(1.6, 41)

    # ============================================================ LENDING — technical rhythm
    else:
        harmony = [("Dm", 0.0, 8.4), ("Bb", 8.4, 14.0), ("Gm", 14.0, 19.0), ("A", 19.0, 26.2), ("Dm", 26.2, total + 1.6)]
        pad_gain, bright_peak = 0.16, 0.88

        # pads are quieter — the groove is the focus
        for chord, a, b in harmony:
            d = (b - a) + 1.8
            bn = int(d * SR)
            x = np.linspace(0, 1, bn)
            bright = np.clip(0.25 + (bright_peak - 0.25) * np.sin(np.pi * x * 0.9) ** 1.2, 0, 1)
            L, R = pad_voice([hz(nt) for nt in CHORDS_DM[chord]], d, bright, detune=0.003)
            env = smooth_env(bn, 1.4, 1.6)
            i0 = int(max(0, a - 0.8) * SR)
            end = min(n, i0 + bn)
            sl = min(bn, end - i0)
            pad_bus.l[i0:i0 + sl] += (L * env)[:sl] * pad_gain / 9
            pad_bus.r[i0:i0 + sl] += (R * env)[:sl] * pad_gain / 9

        t_full = np.arange(n) / SR
        drone = np.sin(2 * np.pi * hz("D1") * t_full) * 0.5 + np.sin(2 * np.pi * hz("D1") * 2.004 * t_full) * 0.10
        drone *= smooth_env(n, 2.0, 2.5) * (0.50 + 0.50 * np.sin(2 * np.pi * t_full / 10.0) ** 2)
        drone = np.tanh(drone * 1.2)
        bass_bus.l += drone * 0.45
        bass_bus.r += drone * 0.45

        # tight bass groove — off-beats, more rhythmic than cinematic
        bl_step = beat
        t0 = 3.0
        while t0 < 26.2:
            ch = next(c for c, a, b in harmony if a <= t0 < b)
            f = hz(ROOT_DM[ch]) * 2
            tn = tt(beat * 0.45)
            s = np.sin(2 * np.pi * f * tn) * smooth_env(len(tn), 0.004, 0.10)
            bass_bus.add(s, t0, 0.46)
            t0 += bl_step
        # longer bass plucks for the opening and end
        for t0 in [0.5, 26.5, 29.0]:
            ch = next((c for c, a, b in harmony if a <= t0 < b), "Dm")
            bass_bus.add(bass_pluck(hz(ROOT_DM[ch]) * 2, 1.4), t0, 0.14)

        # impact hits
        hit_sub = sub_hit()
        for i, t0 in enumerate(cfg["hits"]):
            big = i in (0, len(cfg["hits"]) - 1) or t0 in scenes
            fx_bus.add(hit_sub, t0, 0.75 if big else 0.40)
            im = impact(1.1 if big else 0.65, bright=1.0 if big else 0.55)
            fx_bus.add(im, t0 + 0.01, 0.28 if big else 0.14, pan=0.0 if big else (0.15 if i % 2 else -0.15))
            verb_send.add(im, t0 + 0.01, 0.30 if big else 0.18)

        for a, b in cfg["risers"]:
            d = b - a
            w = band_sweep_noise(d, 220, 7800, 0.8, "rise")
            fx_bus.add(w, a, 0.28)
            verb_send.add(w, a, 0.18)
        for t0 in scenes[1:-1]:
            w = band_sweep_noise(0.8, 5200, 260, 0.9, "whoosh")
            fx_bus.add(w, t0 - 0.04, 0.16)

        for i, t0 in enumerate(cfg["accents"]):
            a = impact(0.55, bright=0.45)
            fx_bus.add(a, t0, 0.11, pan=(-0.32 if i % 2 else 0.32))
            verb_send.add(a, t0, 0.22)

        def beats(start, stop, step=1.0, offset=0.0):
            t = start + offset * beat
            while t < stop - 1e-6:
                yield t
                t += step * beat

        # 4-on-the-floor — strong from scene 2 onward, sparse at the opening
        for t0 in beats(3.0, 8.4, 2.0):           # sparse double-time at the opening
            kick_times.append(t0)
        for t0 in beats(8.4, 26.2, 1.0):          # full 4-on-the-floor from credential scene
            kick_times.append(t0)
        # snare 2 & 4 — crisp
        for t0 in beats(8.4, 26.2, 2.0, 1.0):
            drum_bus.add(clap(crisp=True), t0, 0.24)
        # hi-hat density builds scene by scene
        for t0 in beats(8.4, 14.0, 0.5, 0.5):     # off-beat 8ths — Scene 2
            drum_bus.add(hat(bright=1.0), t0, 0.18, pan=0.24)
        for t0 in beats(14.0, 19.0, 0.5):          # on-beat 8ths added — Scene 3
            drum_bus.add(hat(bright=1.0), t0, 0.20, pan=0.26)
        for t0 in beats(19.0, 26.2, 0.25, 0.0):   # 16th hats — Scene 4, max density
            drum_bus.add(hat(bright=0.9), t0, 0.15, pan=0.28)
        # synth stabs on offbeats — the distinct Lending rhythmic element (NOT cursor taps)
        for t0 in beats(8.4, 26.2, 2.0, 0.5):
            ch = next(c for c, a, b in harmony if a <= t0 < b)
            fx_bus.add(synth_stab(hz(ROOT_DM[ch]) * 4), t0, 0.22, pan=-0.18)
        for t0 in beats(14.0, 26.2, 2.0, 1.5):
            ch = next(c for c, a, b in harmony if a <= t0 < b)
            fx_bus.add(synth_stab(hz(ROOT_DM[ch]) * 6), t0, 0.16, pan=0.20)
        # opening click pattern (before full kick)
        for t0 in beats(3.0, 8.4, 0.5):
            drum_bus.add(click_low(), t0, 0.12, pan=-0.12)

        kd = kick(tight=True)
        for t0 in kick_times:
            drum_bus.add(kd, t0, 0.65)

        # off-beat bass sub pulse — tight, rhythmic
        for t0 in beats(8.4, 26.2, 1.0, 0.5):
            ch = next(c for c, a, b in harmony if a <= t0 < b)
            f = hz(ROOT_DM[ch]) * 2
            tn = tt(beat * 0.40)
            s = np.sin(2 * np.pi * f * tn) * smooth_env(len(tn), 0.003, 0.07)
            bass_bus.add(s, t0, 0.44)

        # sidechain
        duck = np.ones(n)
        for t0 in kick_times:
            i = int(t0 * SR)
            m = min(int(0.28 * SR), n - i)
            if m > 0:
                duck[i : i + m] = np.minimum(duck[i : i + m], 1 - 0.50 * np.exp(-np.arange(m) / SR / 0.09))
        pad_bus.l *= duck; pad_bus.r *= duck
        bass_bus.l *= duck; bass_bus.r *= duck

        # medium-tight reverb — enough space but not cinematic
        irl, irr = reverb_ir(2.0, 23), reverb_ir(2.0, 37)

    # ============================================================ mix + silence pocket + master
    wet_l = fft_conv(verb_send.l + 0.35 * pad_bus.l + 0.20 * fx_bus.l, irl)
    wet_r = fft_conv(verb_send.r + 0.35 * pad_bus.r + 0.20 * fx_bus.r, irr)

    verb_mix = {"protocol": 0.65, "governance": 0.35, "lending": 0.50}[name]
    L = pad_bus.l + drum_bus.l + fx_bus.l + bass_bus.l + wet_l * verb_mix
    R = pad_bus.r + drum_bus.r + fx_bus.r + bass_bus.r + wet_r * verb_mix

    # one deliberate pocket of near-silence before the final impact
    final_hit = {"protocol": 27.0, "governance": 28.6, "lending": 26.2}[name]
    silence_pocket(L, R, final_hit, pre=0.28, floor=0.04)

    # master: low cut, soft saturation, trim, fades, -1 dBFS peak
    L = highpass(L, 24.0)
    R = highpass(R, 24.0)
    L = np.tanh(L * 1.25)
    R = np.tanh(R * 1.25)
    keep = int(total * SR)
    L, R = L[:keep], R[:keep]
    fade_in = np.clip(np.arange(keep) / (0.25 * SR), 0, 1)
    tail = np.clip((keep - np.arange(keep)) / (2.4 * SR), 0, 1)
    fade = fade_in * (0.5 - 0.5 * np.cos(np.pi * tail))
    L *= fade
    R *= fade
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
    gain = 0.89 / peak
    L *= gain
    R *= gain

    data = np.empty(keep * 2, dtype="<i2")
    data[0::2] = np.round(L * 32767).astype("<i2")
    data[1::2] = np.round(R * 32767).astype("<i2")
    path = OUT / f"gyevo-{name}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    rms = float(np.sqrt(np.mean((L ** 2 + R ** 2) / 2)))
    print(f"{path.name}: {keep / SR:.2f}s  peak {20 * np.log10(0.89):.1f} dBFS  rms {20 * np.log10(rms):.1f} dBFS  clipped {int(np.sum(np.abs(data) >= 32767))}")


if __name__ == "__main__":
    which = sys.argv[1:] or ["protocol", "governance", "lending"]
    for nm in which:
        build(nm)
