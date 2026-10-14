#!/usr/bin/env python3
"""Create three short, original motion cues for the GYEVO proof composition."""

from math import exp, pi, sin
from pathlib import Path
import random
import struct
import wave


RATE = 48_000
OUT = Path(__file__).resolve().parents[1] / "public" / "audio"


def write_wav(filename: str, seconds: float, sample_fn) -> None:
    count = round(RATE * seconds)
    samples = [sample_fn(i / RATE, seconds, i) for i in range(count)]
    peak = max(abs(value) for value in samples) or 1.0
    scale = min(1.0, 0.7 / peak)
    payload = b"".join(struct.pack("<h", round(max(-1, min(1, value * scale)) * 32767)) for value in samples)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / filename), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(payload)


def impact(t: float, duration: float, index: int) -> float:
    phase = 2 * pi * (78 * t - 17 * t * t / duration)
    body = sin(phase) * exp(-5.4 * t)
    overtone = sin(phase * 2.02) * 0.19 * exp(-8 * t)
    click = sin(2 * pi * 780 * t) * 0.11 * exp(-100 * t)
    return (0.42 * body + 0.13 * overtone + click) * min(1, t / 0.006)


def fold(t: float, duration: float, index: int) -> float:
    rng = random.Random(index + 803)
    # A low-passed noise bed supplies paper friction without a harsh white-noise burst.
    if index == 0:
        fold.noise = [rng.uniform(-1, 1) for _ in range(round(RATE * duration))]
        fold.filtered = [0.0] * len(fold.noise)
        for i, value in enumerate(fold.noise):
            previous = fold.filtered[i - 1] if i else 0.0
            fold.filtered[i] = previous + 0.10 * (value - previous)
    noise = fold.filtered[index]
    fade = sin(pi * t / duration) ** 0.7
    airy = noise * 0.22 * fade
    low_sweep = sin(2 * pi * (118 * t - 24 * t * t)) * 0.15 * fade
    ticks = 0.0
    for onset, pitch in ((0.13, 640), (0.48, 520), (0.84, 720), (1.18, 460)):
        local = t - onset
        if local >= 0:
            ticks += sin(2 * pi * pitch * local) * 0.13 * exp(-42 * local)
    return airy + low_sweep + ticks


def seal(t: float, duration: float, index: int) -> float:
    attack = min(1.0, t / 0.004)
    fade = exp(-4.8 * t)
    bell = sin(2 * pi * 392 * t) * 0.34 + sin(2 * pi * 588 * t) * 0.16 + sin(2 * pi * 784 * t) * 0.055
    transient = sin(2 * pi * 1450 * t) * 0.1 * exp(-70 * t)
    return (bell * fade + transient) * attack


write_wav("proof-impact-v1.wav", 0.55, impact)
write_wav("proof-fold-v1.wav", 1.65, fold)
write_wav("proof-seal-v1.wav", 0.8, seal)
print(f"Wrote proof cues under {OUT}")
