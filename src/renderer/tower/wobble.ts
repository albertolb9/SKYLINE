// Deterministic wobble/recovery motion curve for the P5 greybox phase (docs/TOWER_SYSTEM.md
// §6-10, D-024; docs/work/TASK-P5-wobble-recovery.md). Pure math only — zero Pixi dependency,
// zero mutation of TowerModel/BookEvent, directly unit-testable. Values below are GREYBOX TUNING,
// NOT LOCKED PRODUCT VALUES.

import type { Direction, Intensity } from '../../book/schema';

export interface WobbleMotionPreset {
  readonly peakLeanMd: number; // magnitude only; sign comes from block.direction
  readonly durationMs: number; // total duration of the full lean+recovery curve
}

/** V1 greybox tuning — versioned per TOWER_SYSTEM.md §7's "centralized in versioned presets"
 * requirement. A real value change becomes WOBBLE_PRESETS_V2_BY_INTENSITY, a new export, never
 * an in-place edit once any Replay/visual capture depends on these exact numbers. */
export const WOBBLE_PRESETS_V1_BY_INTENSITY: Readonly<Record<Intensity, WobbleMotionPreset>> = {
  0: { peakLeanMd: 0, durationMs: 550 },
  1: { peakLeanMd: 1500, durationMs: 550 },
  2: { peakLeanMd: 3000, durationMs: 550 },
  3: { peakLeanMd: 4500, durationMs: 550 },
  4: { peakLeanMd: 6000, durationMs: 550 },
};

/** Normalized piecewise-linear curve, keyed by fraction of peakLeanMd. Adopts the qualitative
 * shape TOWER_SYSTEM.md §8's conceptual phases and §10's recovery shape independently converge
 * on (lean -> peak -> counter-swing -> overshoot -> settle); exact fractions are greybox tuning. */
export const WOBBLE_CURVE_V1_KEYFRAMES: readonly (readonly [t: number, fraction: number])[] = [
  [0.0, 0],
  [0.2, 0.5],
  [0.45, 1.0],
  [0.7, -0.45],
  [0.9, 0.18],
  [1.0, 0],
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sampleKeyframes(t: number, keyframes: readonly (readonly [number, number])[]): number {
  let i = 1;
  while (i < keyframes.length - 1 && t > keyframes[i][0]) i += 1;
  const [t0, v0] = keyframes[i - 1];
  const [t1, v1] = keyframes[i];
  const span = t1 - t0;
  const localT = span === 0 ? 0 : (t - t0) / span;
  return v0 + (v1 - v0) * localT;
}

/**
 * Wobble/recovery lean at progress `t` (clamped to [0,1] internally — a caller may safely pass a
 * raw, unclamped `t` derived from elapsed time before/after the nominal phase window and get the
 * correct boundary value back). Output is in millidegrees, the same convention as
 * LogicalBlock.rotationMd elsewhere in the codebase. `direction: 0` deterministically yields 0 at
 * every `t` — a pure sign multiplier, not a special case.
 */
export function computeWobbleLeanMd(t: number, preset: WobbleMotionPreset, direction: Direction): number {
  const leanMd = direction * preset.peakLeanMd * sampleKeyframes(clamp(t, 0, 1), WOBBLE_CURVE_V1_KEYFRAMES);
  return leanMd + 0; // normalizes -0 (e.g. 0 * 6000 * -0.45) to 0 — direction/intensity 0 is always exactly 0
}
