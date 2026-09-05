// Deterministic near-fall motion curve for the P6 greybox phase (docs/TOWER_SYSTEM.md §6/8/10,
// REQUIREMENTS.md TOWER-004; docs/work/TASK-P6-near-fall.md). Pure math only — zero Pixi
// dependency, zero mutation of TowerModel/BookEvent, directly unit-testable. Mirrors wobble.ts's
// style deliberately; values below are GREYBOX TUNING, NOT LOCKED PRODUCT VALUES.

import type { Direction, Intensity } from '../../book/schema';

/** The visual-intent directive the handler layer computes from a pure Book-data peek and passes
 * to the renderer (docs/work/TASK-P6-near-fall.md §G). Lives here, not in the handler module, so
 * the renderer never imports a type from the handler layer. */
export type NearFallResolution = 'recover' | 'holdForCollapse';

export interface NearFallMotionPreset {
  readonly peakLeanMd: number; // magnitude only; sign comes from block.direction
  readonly durationMs: number; // total duration of the full approach+hold+recovery curve
}

/** V1 greybox tuning — versioned per TOWER_SYSTEM.md §7's "centralized in versioned presets"
 * requirement. A real value change becomes NEAR_FALL_PRESETS_V2_BY_INTENSITY, a new export, never
 * an in-place edit once any Replay/visual capture depends on these exact numbers. */
export const NEAR_FALL_PRESETS_V1_BY_INTENSITY: Readonly<Record<Intensity, NearFallMotionPreset>> = {
  0: { peakLeanMd: 0, durationMs: 700 },
  1: { peakLeanMd: 2500, durationMs: 700 },
  2: { peakLeanMd: 5000, durationMs: 700 },
  3: { peakLeanMd: 7500, durationMs: 700 },
  4: { peakLeanMd: 10000, durationMs: 700 },
};

/** Single source of truth for the hold-freeze position — referenced directly inside the keyframe
 * table below, not duplicated as an independent literal, so the plateau-end keyframe and the hold
 * terminal point can never silently drift apart. */
export const NEAR_FALL_HOLD_FREEZE_T_V1 = 0.55;

/** Normalized piecewise-linear curve, keyed by fraction of peakLeanMd. Adopts the qualitative
 * shape TOWER_SYSTEM.md §8's conceptual phases and §10's recovery shape independently converge
 * on (approach -> critical-lean plateau ["a pause near critical lean... to sell danger"] ->
 * counter-swing -> overshoot -> settle); exact fractions are greybox tuning. The plateau
 * (t=0.35 -> NEAR_FALL_HOLD_FREEZE_T_V1, both fraction 1.0) is where a holdForCollapse resolution
 * freezes; a recover resolution continues sampling through the remaining keyframes to t=1. */
export const NEAR_FALL_CURVE_V1_KEYFRAMES: readonly (readonly [t: number, fraction: number])[] = [
  [0.0, 0],
  [0.15, 0.65],
  [0.35, 1.0],
  [NEAR_FALL_HOLD_FREEZE_T_V1, 1.0],
  [0.8, -0.55],
  [0.92, 0.2],
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
 * Near-fall lean at progress `t` (clamped to [0,1] internally — a caller may safely pass a raw,
 * unclamped `t` derived from elapsed time before/after the nominal phase window and get the
 * correct boundary value back). Output is in millidegrees, the same convention as
 * LogicalBlock.rotationMd elsewhere in the codebase. `direction: 0` deterministically yields 0 at
 * every `t` — a pure sign multiplier, not a special case.
 */
export function computeNearFallLeanMd(t: number, preset: NearFallMotionPreset, direction: Direction): number {
  const leanMd = direction * preset.peakLeanMd * sampleKeyframes(clamp(t, 0, 1), NEAR_FALL_CURVE_V1_KEYFRAMES);
  return leanMd + 0; // normalizes -0 (e.g. 0 * 10000 * -0.55) to 0 — direction/intensity 0 is always exactly 0
}
