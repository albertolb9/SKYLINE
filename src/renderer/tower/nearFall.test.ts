import { describe, expect, it } from 'vitest';
import {
  NEAR_FALL_CURVE_V1_KEYFRAMES,
  NEAR_FALL_HOLD_FREEZE_T_V1,
  NEAR_FALL_PRESETS_V1_BY_INTENSITY,
  computeNearFallLeanMd,
} from './nearFall';
import { WOBBLE_PRESETS_V1_BY_INTENSITY } from './wobble';

describe('computeNearFallLeanMd — keyframe values', () => {
  it('matches every exact V1 keyframe fraction, for intensity 4 direction 1', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    expect(computeNearFallLeanMd(0, preset, 1)).toBe(0);
    expect(computeNearFallLeanMd(0.15, preset, 1)).toBeCloseTo(preset.peakLeanMd * 0.65);
    expect(computeNearFallLeanMd(0.35, preset, 1)).toBeCloseTo(preset.peakLeanMd * 1.0);
    expect(computeNearFallLeanMd(NEAR_FALL_HOLD_FREEZE_T_V1, preset, 1)).toBeCloseTo(preset.peakLeanMd * 1.0);
    expect(computeNearFallLeanMd(0.8, preset, 1)).toBeCloseTo(preset.peakLeanMd * -0.55);
    expect(computeNearFallLeanMd(0.92, preset, 1)).toBeCloseTo(preset.peakLeanMd * 0.2);
    expect(computeNearFallLeanMd(1, preset, 1)).toBe(0);
  });

  it('the plateau start (t=0.35) and end (NEAR_FALL_HOLD_FREEZE_T_V1) both equal the exact peak', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[3];
    const plateauStart = computeNearFallLeanMd(0.35, preset, 1);
    const plateauEnd = computeNearFallLeanMd(NEAR_FALL_HOLD_FREEZE_T_V1, preset, 1);
    expect(plateauStart).toBeCloseTo(preset.peakLeanMd);
    expect(plateauEnd).toBeCloseTo(preset.peakLeanMd);
    expect(plateauEnd).toBeCloseTo(plateauStart);
  });

  it('NEAR_FALL_HOLD_FREEZE_T_V1 is the literal plateau-end keyframe, not an independently drifted number', () => {
    const keyframeAtFreeze = NEAR_FALL_CURVE_V1_KEYFRAMES.find(([t]) => t === NEAR_FALL_HOLD_FREEZE_T_V1);
    expect(keyframeAtFreeze).toEqual([NEAR_FALL_HOLD_FREEZE_T_V1, 1.0]);
  });
});

describe('computeNearFallLeanMd — direction', () => {
  it('direction -1 mirrors direction 1 at the peak', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    expect(computeNearFallLeanMd(0.35, preset, -1)).toBeCloseTo(-computeNearFallLeanMd(0.35, preset, 1));
  });

  it('direction 0 yields exactly 0 at every sampled t, including the peak and plateau', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    for (const t of [0, 0.15, 0.35, NEAR_FALL_HOLD_FREEZE_T_V1, 0.8, 0.92, 1]) {
      expect(computeNearFallLeanMd(t, preset, 0)).toBe(0);
    }
  });
});

describe('computeNearFallLeanMd — intensity', () => {
  it('intensity 0 yields exactly 0 at every sampled t regardless of direction', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[0];
    for (const direction of [-1, 0, 1] as const) {
      for (const t of [0, 0.15, 0.35, NEAR_FALL_HOLD_FREEZE_T_V1, 0.8, 0.92, 1]) {
        expect(computeNearFallLeanMd(t, preset, direction)).toBe(0);
      }
    }
  });

  it('peak magnitude strictly increases across intensities 1 through 4', () => {
    const peaks = ([1, 2, 3, 4] as const).map((intensity) =>
      Math.abs(computeNearFallLeanMd(0.35, NEAR_FALL_PRESETS_V1_BY_INTENSITY[intensity], 1)),
    );
    for (let i = 1; i < peaks.length; i += 1) {
      expect(peaks[i]).toBeGreaterThan(peaks[i - 1]);
    }
  });

  it('nearFall intensities 3 and 4 (the only ones any real fixture uses) exceed wobble V1 intensity 4, maximum vs maximum via the raw versioned peakLeanMd values', () => {
    // NearFall peaks at t=0.35, wobble at t=0.45 -- different normalized times on independently
    // authored curves, so comparing at a shared t would not compare each curve's real maximum.
    // Both curves' own peak keyframe fraction is exactly 1.0, so the raw peakLeanMd values ARE
    // each curve's true maximum -- the valid, curve-shape-independent comparison.
    const wobbleMax = WOBBLE_PRESETS_V1_BY_INTENSITY[4].peakLeanMd;
    expect(NEAR_FALL_PRESETS_V1_BY_INTENSITY[3].peakLeanMd).toBeGreaterThan(wobbleMax);
    expect(NEAR_FALL_PRESETS_V1_BY_INTENSITY[4].peakLeanMd).toBeGreaterThan(wobbleMax);
    // Explicitly not asserted: intensity 1/2 exceeding wobble's max -- they don't, and nothing
    // requires them to (2500/5000 vs wobble's 6000).
  });
});

describe('computeNearFallLeanMd — rest-to-rest', () => {
  it('is exactly 0 at t=0 and t=1 for every intensity/direction', () => {
    for (const intensity of [0, 1, 2, 3, 4] as const) {
      for (const direction of [-1, 0, 1] as const) {
        const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[intensity];
        expect(computeNearFallLeanMd(0, preset, direction)).toBe(0);
        expect(computeNearFallLeanMd(1, preset, direction)).toBe(0);
      }
    }
  });
});

describe('computeNearFallLeanMd — interpolation', () => {
  it('interpolates linearly at an exact midpoint between two keyframes', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    // Midpoint between the t=0.15 (fraction 0.65) and t=0.35 (fraction 1.0) keyframes.
    const midpointT = (0.15 + 0.35) / 2;
    const expectedFraction = (0.65 + 1.0) / 2;
    expect(computeNearFallLeanMd(midpointT, preset, 1)).toBeCloseTo(preset.peakLeanMd * expectedFraction);
  });
});

describe('computeNearFallLeanMd — clamping', () => {
  it('clamps t below 0 to the t=0 boundary value', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[3];
    expect(computeNearFallLeanMd(-1, preset, 1)).toBe(computeNearFallLeanMd(0, preset, 1));
  });

  it('clamps t above 1 to the t=1 boundary value', () => {
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[3];
    expect(computeNearFallLeanMd(2, preset, 1)).toBe(computeNearFallLeanMd(1, preset, 1));
  });
});

describe('computeNearFallLeanMd — no -0 instability', () => {
  it('never returns negative zero for any zero-effect combination', () => {
    for (const direction of [-1, 0, 1] as const) {
      for (const t of [0, 0.15, 0.35, NEAR_FALL_HOLD_FREEZE_T_V1, 0.8, 0.92, 1]) {
        expect(Object.is(computeNearFallLeanMd(t, NEAR_FALL_PRESETS_V1_BY_INTENSITY[0], direction), -0)).toBe(false);
      }
      expect(Object.is(computeNearFallLeanMd(0.8, NEAR_FALL_PRESETS_V1_BY_INTENSITY[4], 0), -0)).toBe(false);
    }
  });
});
