// Deterministic collapse motion curve for the P7 greybox phase (docs/TOWER_SYSTEM.md §11,
// REQUIREMENTS.md TOWER-004; docs/work/TASK-P7-collapse.md). Pure math only — zero Pixi
// dependency, zero mutation of TowerModel/BookEvent, directly unit-testable. Mirrors wobble.ts/
// nearFall.ts's style, with one deliberate difference: collapse has no fixed zero baseline to
// scale from (it must continue smoothly from whatever rotation the renderer already holds — a
// direct 0 or a P6 holdForCollapse pose), so this module exports a target-lean calculation and a
// unit-agnostic progress fraction rather than a single combined "lean at t" function. The actual
// start->target lerp is computed by the renderer, directly in radians (createTowerRenderer.ts),
// so this module never performs a rotation-unit conversion. Values below are GREYBOX TUNING, NOT
// LOCKED PRODUCT VALUES.

import type { CollapseIntensity, CollapseProfile } from '../../book/schema';

export interface CollapseMotionPreset {
  readonly terminalLeanMd: number; // magnitude only; sign comes from profile
  readonly durationMs: number;
}

/** V1 greybox tuning — versioned per TOWER_SYSTEM.md §7's "centralized in versioned presets"
 * requirement. No intensity-0 entry: CollapseIntensity is 1|2|3|4 — a "no collapse" isn't
 * representable as an event, so there is no zero-effect case to short-circuit. Every value here
 * deliberately exceeds nearFall's own max (10,000md at intensity 4), since collapse is the most
 * dramatic terminal state. A real value change becomes COLLAPSE_PRESETS_V2_BY_INTENSITY, a new
 * export, never an in-place edit once any Replay/visual capture depends on these exact numbers. */
export const COLLAPSE_PRESETS_V1_BY_INTENSITY: Readonly<Record<CollapseIntensity, CollapseMotionPreset>> = {
  1: { terminalLeanMd: 12000, durationMs: 800 },
  2: { terminalLeanMd: 16000, durationMs: 800 },
  3: { terminalLeanMd: 20000, durationMs: 800 },
  4: { terminalLeanMd: 25000, durationMs: 800 },
};

/** Fraction of the START->TARGET distance covered at t — NOT a fraction of a fixed peak like
 * wobble/nearFall's curves, since collapse's start is whatever rotation already exists, not a
 * known zero. A small deliberate overshoot past 1.0 then settle back to exactly 1.0 reads as a
 * physical "topple and thud" rather than a mechanical linear glide. */
export const COLLAPSE_ROOT_CURVE_V1_KEYFRAMES: readonly (readonly [t: number, fraction: number])[] = [
  [0.0, 0],
  [0.55, 0.75],
  [0.8, 1.08],
  [1.0, 1.0],
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
 * Authoritative terminal lean in millidegrees: sign from `profile` ONLY, magnitude from `preset`
 * ONLY. Never derived from a preceding block's direction, offsetU, rotationMd, intensity, tower
 * geometry, or the renderer's current rotation — `profile` is the sole source of collapse
 * direction (docs/BOOK_SPEC.md §8; `CollapseEvent` carries no directional field of its own).
 */
export function computeCollapseTargetLeanMd(profile: CollapseProfile, preset: CollapseMotionPreset): number {
  const sign = profile === 'leanRight' ? 1 : -1;
  return sign * preset.terminalLeanMd;
}

/**
 * Progress fraction at `t` (clamped to [0,1] internally — a caller may safely pass a raw,
 * unclamped `t` derived from elapsed time before/after the nominal duration and get the correct
 * boundary value back). Deliberately unit-agnostic: the renderer applies this fraction to
 * whatever start/target rotation (in radians) it actually holds — this function never needs to
 * know about, or convert, rotation units.
 */
export function computeCollapseFraction(t: number): number {
  return sampleKeyframes(clamp(t, 0, 1), COLLAPSE_ROOT_CURVE_V1_KEYFRAMES);
}
