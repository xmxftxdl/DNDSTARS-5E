#!/usr/bin/env python3
"""Remove the isolated loud accent from the supplied cave-water recording."""

from __future__ import annotations

import argparse
import hashlib
import math
import wave
from pathlib import Path

import miniaudio
import numpy as np


def equal_power_mix(start: float, end: float, count: int) -> tuple[np.ndarray, np.ndarray]:
    phase = np.linspace(start, end, count, endpoint=False, dtype=np.float64)
    return np.cos(phase), np.sin(phase)


def clean_accent(
    audio: np.ndarray,
    sample_rate: int,
    replace_start: float,
    replace_end: float,
    donor_start: float,
    fade_seconds: float,
) -> np.ndarray:
    start_frame = round(replace_start * sample_rate)
    end_frame = round(replace_end * sample_rate)
    donor_frame = round(donor_start * sample_rate)
    replacement_frames = end_frame - start_frame
    fade_frames = min(round(fade_seconds * sample_rate), replacement_frames // 2)
    if start_frame < 0 or end_frame > len(audio) or replacement_frames <= 0:
        raise ValueError('Replacement range is outside the decoded recording')
    if donor_frame < 0 or donor_frame + replacement_frames > len(audio):
        raise ValueError('Donor range is outside the decoded recording')

    cleaned = audio.copy()
    donor = audio[donor_frame:donor_frame + replacement_frames].copy()
    cleaned[start_frame:end_frame] = donor

    if fade_frames > 0:
        old_gain, new_gain = equal_power_mix(0.0, math.pi / 2, fade_frames)
        old_gain = old_gain[:, None]
        new_gain = new_gain[:, None]
        cleaned[start_frame:start_frame + fade_frames] = (
            audio[start_frame:start_frame + fade_frames] * old_gain
            + donor[:fade_frames] * new_gain
        )
        cleaned[end_frame - fade_frames:end_frame] = (
            donor[-fade_frames:] * old_gain
            + audio[end_frame - fade_frames:end_frame] * new_gain
        )
    return cleaned


def write_pcm16(path: Path, audio: np.ndarray, sample_rate: int) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = float(np.max(np.abs(audio)))
    if peak > 0:
        # Match the weather system's other authored assets without compression.
        audio = audio * (0.5 / peak)
    pcm = np.round(np.clip(audio, -1.0, 1.0) * 32767.0).astype('<i2')
    with wave.open(str(path), 'wb') as destination:
        destination.setnchannels(audio.shape[1])
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(pcm.tobytes())
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--replace-start', type=float, default=21.58)
    parser.add_argument('--replace-end', type=float, default=21.86)
    parser.add_argument('--donor-start', type=float, default=20.52)
    parser.add_argument('--fade', type=float, default=0.065)
    args = parser.parse_args()

    decoded = miniaudio.decode_file(
        str(args.source),
        output_format=miniaudio.SampleFormat.FLOAT32,
        nchannels=2,
        sample_rate=48_000,
    )
    audio = np.frombuffer(decoded.samples, dtype=np.float32).reshape(-1, decoded.nchannels)
    cleaned = clean_accent(
        audio,
        decoded.sample_rate,
        args.replace_start,
        args.replace_end,
        args.donor_start,
        args.fade,
    )
    digest = write_pcm16(args.output, cleaned, decoded.sample_rate)
    print(f'Generated {args.output}')
    print(f'{len(cleaned) / decoded.sample_rate:.3f}s, {decoded.sample_rate} Hz, stereo PCM16')
    print(f'Replaced {args.replace_start:.2f}-{args.replace_end:.2f}s using {args.donor_start:.2f}s ambience')
    print(f'SHA-256 {digest}')


if __name__ == '__main__':
    main()
