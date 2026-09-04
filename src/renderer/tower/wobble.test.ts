import { describe, expect, it } from 'vitest';
import { WOBBLE_PRESETS_V1_BY_INTENSITY, computeWobbleLeanMd } from './wobble';

describe('computeWobbleLeanMd — keyframe values', () => {
  it('matches the exact keyframe fractions at each authored t, for intensity 3 direction 1', () => {
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[3];
    expect(computeWobbleLeanMd(0, preset, 1)).toBe(0);
    expect(computeWobbleLeanMd(0.2, preset, 1)).toBeCloseTo(preset.peakLeanMd * 0.5);
    expect(computeWobbleLeanMd(0.45, preset, 1)).toBeCloseTo(preset.peakLeanMd * 1.0);
    expect(computeWobbleLeanMd(0.7, preset, 1)).toBeCloseTo(preset.peakLeanMd * -0.45);
    expect(computeWobbleLeanMd(0.9, preset, 1)).toBeCloseTo(preset.peakLeanMd * 0.18);
    expect(computeWobbleLeanMd(1, preset, 1)).toBe(0);
  });
});

describe('computeWobbleLeanMd — direction', () => {
  it('direction -1 mirrors direction 1 at the peak', () => {
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[2];
    expect(computeWobbleLeanMd(0.45, preset, -1)).toBeCloseTo(-computeWobbleLeanMd(0.45, preset, 1));
  });

  it('direction 0 yields exactly 0 at every sampled t, including the peak', () => {
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[4];
    for (const t of [0, 0.2, 0.45, 0.7, 0.9, 1]) {
      expect(computeWobbleLeanMd(t, preset, 0)).toBe(0);
    }
  });
});

describe('computeWobbleLeanMd — intensity', () => {
  it('intensity 0 yields exactly 0 at every sampled t regardless of direction', () => {
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[0];
    for (const direction of [-1, 0, 1] as const) {
      for (const t of [0, 0.2, 0.45, 0.7, 0.9, 1]) {
        expect(computeWobbleLeanMd(t, preset, direction)).toBe(0);
      }
    }
  });

  it('peak magnitude strictly increases across intensities 1 through 4', () => {
    const peaks = ([1, 2, 3, 4] as const).map((intensity) =>
      Math.abs(computeWobbleLeanMd(0.45, WOBBLE_PRESETS_V1_BY_INTENSITY[intensity], 1)),
    );
    for (let i = 1; i < peaks.length; i += 1) {
      expect(peaks[i]).toBeGreaterThan(peaks[i - 1]);
    }
  });
});

describe('computeWobbleLeanMd — rest-to-rest', () => {
  it('is exactly 0 at t=0 and t=1 for every intensity/direction', () => {
    for (const intensity of [0, 1, 2, 3, 4] as const) {
      for (const direction of [-1, 0, 1] as const) {
        const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[intensity];
        expect(computeWobbleLeanMd(0, preset, direction)).toBe(0);
        expect(computeWobbleLeanMd(1, preset, direction)).toBe(0);
      }
    }
  });
});

describe('computeWobbleLeanMd — interpolation', () => {
  it('interpolates linearly at an exact midpoint between two keyframes', () => {
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[4];
    // Midpoint between the t=0.20 (fraction 0.5) and t=0.45 (fraction 1.0) keyframes.
    const midpointT = (0.2 + 0.45) / 2;
    const expectedFraction = (0.5 + 1.0) / 2;
    expect(computeWobbleLeanMd(midpointT, preset, 1)).toBeCloseTo(preset.peakLeanMd * expectedFraction);
  });
});

describe('computeWobbleLeanMd — clamping', () => {
  it('clamps t outside [0,1] to the boundary keyframe value', () => {
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[2];
    expect(computeWobbleLeanMd(-1, preset, 1)).toBe(computeWobbleLeanMd(0, preset, 1));
    expect(computeWobbleLeanMd(2, preset, 1)).toBe(computeWobbleLeanMd(1, preset, 1));
  });
});
