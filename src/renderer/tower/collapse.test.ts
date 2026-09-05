import { describe, expect, it } from 'vitest';
import {
  COLLAPSE_PRESETS_V1_BY_INTENSITY,
  COLLAPSE_ROOT_CURVE_V1_KEYFRAMES,
  computeCollapseFraction,
  computeCollapseTargetLeanMd,
} from './collapse';
import { NEAR_FALL_PRESETS_V1_BY_INTENSITY } from './nearFall';

describe('COLLAPSE_PRESETS_V1_BY_INTENSITY — exact V1 values', () => {
  it('matches the approved greybox table exactly', () => {
    expect(COLLAPSE_PRESETS_V1_BY_INTENSITY[1]).toEqual({ terminalLeanMd: 12000, durationMs: 800 });
    expect(COLLAPSE_PRESETS_V1_BY_INTENSITY[2]).toEqual({ terminalLeanMd: 16000, durationMs: 800 });
    expect(COLLAPSE_PRESETS_V1_BY_INTENSITY[3]).toEqual({ terminalLeanMd: 20000, durationMs: 800 });
    expect(COLLAPSE_PRESETS_V1_BY_INTENSITY[4]).toEqual({ terminalLeanMd: 25000, durationMs: 800 });
  });

  it('has no intensity-0 entry (CollapseIntensity excludes 0 -- no collapse has no zero-effect case)', () => {
    expect((COLLAPSE_PRESETS_V1_BY_INTENSITY as Record<number, unknown>)[0]).toBeUndefined();
  });

  it('duration is constant across every intensity (intensity scales magnitude only)', () => {
    for (const intensity of [1, 2, 3, 4] as const) {
      expect(COLLAPSE_PRESETS_V1_BY_INTENSITY[intensity].durationMs).toBe(800);
    }
  });

  it('terminal lean magnitude strictly increases across intensities 1 through 4', () => {
    const magnitudes = ([1, 2, 3, 4] as const).map((i) => COLLAPSE_PRESETS_V1_BY_INTENSITY[i].terminalLeanMd);
    for (let i = 1; i < magnitudes.length; i += 1) {
      expect(magnitudes[i]).toBeGreaterThan(magnitudes[i - 1]);
    }
  });

  it('every collapse intensity exceeds nearFall V1 intensity 4 (the most dramatic terminal state)', () => {
    const nearFallMax = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4].peakLeanMd;
    for (const intensity of [1, 2, 3, 4] as const) {
      expect(COLLAPSE_PRESETS_V1_BY_INTENSITY[intensity].terminalLeanMd).toBeGreaterThan(nearFallMax);
    }
  });
});

describe('COLLAPSE_ROOT_CURVE_V1_KEYFRAMES — exact keyframe table', () => {
  it('matches the approved curve exactly, including the overshoot point', () => {
    expect(COLLAPSE_ROOT_CURVE_V1_KEYFRAMES).toEqual([
      [0.0, 0],
      [0.55, 0.75],
      [0.8, 1.08],
      [1.0, 1.0],
    ]);
  });
});

describe('computeCollapseTargetLeanMd — profile sign authority', () => {
  it('leanRight yields a positive target equal to exactly terminalLeanMd', () => {
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    expect(computeCollapseTargetLeanMd('leanRight', preset)).toBe(preset.terminalLeanMd);
  });

  it('leanLeft yields a negative target equal to exactly -terminalLeanMd', () => {
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    expect(computeCollapseTargetLeanMd('leanLeft', preset)).toBe(-preset.terminalLeanMd);
  });

  it('target magnitude matches the preset exactly for every intensity', () => {
    for (const intensity of [1, 2, 3, 4] as const) {
      const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[intensity];
      expect(Math.abs(computeCollapseTargetLeanMd('leanRight', preset))).toBe(preset.terminalLeanMd);
      expect(Math.abs(computeCollapseTargetLeanMd('leanLeft', preset))).toBe(preset.terminalLeanMd);
    }
  });

  it('is deterministic -- repeated calls with the same input produce the same output', () => {
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[3];
    const first = computeCollapseTargetLeanMd('leanRight', preset);
    const second = computeCollapseTargetLeanMd('leanRight', preset);
    expect(second).toBe(first);
  });
});

describe('computeCollapseFraction — exact keyframe values', () => {
  it('matches every exact V1 keyframe fraction', () => {
    expect(computeCollapseFraction(0)).toBe(0);
    expect(computeCollapseFraction(0.55)).toBeCloseTo(0.75);
    expect(computeCollapseFraction(0.8)).toBeCloseTo(1.08);
    expect(computeCollapseFraction(1)).toBe(1);
  });

  it('is exactly 0 at t=0 and exactly 1 at t=1', () => {
    expect(computeCollapseFraction(0)).toBe(0);
    expect(computeCollapseFraction(1)).toBe(1);
  });
});

describe('computeCollapseFraction — interpolation', () => {
  it('interpolates linearly at an exact midpoint between two keyframes', () => {
    // Midpoint between the t=0.55 (fraction 0.75) and t=0.8 (fraction 1.08) keyframes.
    const midpointT = (0.55 + 0.8) / 2;
    const expectedFraction = (0.75 + 1.08) / 2;
    expect(computeCollapseFraction(midpointT)).toBeCloseTo(expectedFraction);
  });

  it('is piecewise-linear across the whole [0,1] domain (spot-check several points)', () => {
    // Between t=0 (0) and t=0.55 (0.75): linear.
    const quarterT = 0.55 / 2;
    expect(computeCollapseFraction(quarterT)).toBeCloseTo(0.75 / 2);
    // Between t=0.8 (1.08) and t=1.0 (1.0): linear.
    const nearEndT = 0.9;
    const expected = 1.08 + (1.0 - 1.08) * ((0.9 - 0.8) / (1.0 - 0.8));
    expect(computeCollapseFraction(nearEndT)).toBeCloseTo(expected);
  });
});

describe('computeCollapseFraction — clamping', () => {
  it('clamps t below 0 to the t=0 boundary value', () => {
    expect(computeCollapseFraction(-1)).toBe(computeCollapseFraction(0));
  });

  it('clamps t above 1 to the t=1 boundary value', () => {
    expect(computeCollapseFraction(2)).toBe(computeCollapseFraction(1));
  });
});

describe('computeCollapseFraction — determinism / no instability', () => {
  it('is deterministic -- repeated calls with the same t produce the same output', () => {
    expect(computeCollapseFraction(0.37)).toBe(computeCollapseFraction(0.37));
  });

  it('never returns negative zero at t=0', () => {
    expect(Object.is(computeCollapseFraction(0), -0)).toBe(false);
  });
});
