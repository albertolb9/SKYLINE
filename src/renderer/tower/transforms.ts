// Logical -> pixel transform layer for the P4 greybox renderer (docs/TOWER_SYSTEM.md §3-5, §17;
// docs/work/TASK-P4-basic-renderer.md). Pure math only — zero Pixi dependency, zero mutation of
// TowerModel/BookEvent, directly unit-testable.

import type { LogicalBlock } from '../../tower/model';

/** Locked Book-contract constants (TOWER_SYSTEM.md §3) — not renderer tuning. */
export const BLOCK_WIDTH_UNITS = 10_000;
export const BLOCK_HEIGHT_UNITS = 4_000;

/** Viewport-independent prototype tuning, kept separate from the viewport-DERIVED
 * TowerRenderConfig below so the two concerns can't be confused with each other. */
export interface TowerViewportTuning {
  readonly widthFraction: number; // fraction of viewport width one block should occupy
  readonly minBlockWidthPx: number;
  readonly maxBlockWidthPx: number;
  readonly bottomMarginBlocks: number; // empty margin below the FIRST block's BOTTOM EDGE, in block-heights
  readonly dropDurationMs: number;
  readonly cameraSafeBandPx: number;
}

export const DEFAULT_TOWER_VIEWPORT_TUNING: TowerViewportTuning = {
  widthFraction: 0.28,
  minBlockWidthPx: 64,
  maxBlockWidthPx: 140,
  bottomMarginBlocks: 1,
  dropDurationMs: 450,
  cameraSafeBandPx: 96,
};

/** Derived, viewport-specific render geometry for one renderer session. */
export interface TowerRenderConfig {
  readonly originX: number;
  readonly originY: number;
  readonly blockWidthPx: number;
  readonly blockHeightPx: number;
  readonly dropDurationMs: number;
  readonly cameraSafeBandPx: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeTowerViewportConfig(
  viewportWidth: number,
  viewportHeight: number,
  tuning: TowerViewportTuning = DEFAULT_TOWER_VIEWPORT_TUNING,
): TowerRenderConfig {
  const blockWidthPx = clamp(viewportWidth * tuning.widthFraction, tuning.minBlockWidthPx, tuning.maxBlockWidthPx);
  const blockHeightPx = blockWidthPx * (BLOCK_HEIGHT_UNITS / BLOCK_WIDTH_UNITS);
  return {
    originX: viewportWidth / 2,
    // originY is the CENTER of the ordinal-1 block (see computeBlockTransform), so the
    // half-block-height gap between center and bottom edge must be subtracted too — otherwise
    // the actual empty margin below the first block's bottom edge is
    // (bottomMarginBlocks - 0.5) block-heights, not bottomMarginBlocks as the name promises.
    originY: viewportHeight - blockHeightPx * tuning.bottomMarginBlocks - blockHeightPx / 2,
    blockWidthPx,
    blockHeightPx,
    dropDurationMs: tuning.dropDurationMs,
    cameraSafeBandPx: tuning.cameraSafeBandPx,
  };
}

/** Deterministic logical Y from ordinal (TOWER_SYSTEM.md §5: "assign deterministic logical Y
 * from ordinal/block height") — blocks stack with zero gaps, ordinal 1 at Y=0. */
export function logicalYFromOrdinal(ordinal: number): number {
  return (ordinal - 1) * BLOCK_HEIGHT_UNITS;
}

/** rotationMd (integer millidegrees, TOWER_SYSTEM.md §4) -> radians. */
export function rotationMdToRadians(rotationMd: number): number {
  return (rotationMd / 1000) * (Math.PI / 180);
}

export interface BlockPixelTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

/**
 * block.offsetU is the block center's ABSOLUTE horizontal displacement from the fixed tower
 * origin U=0 — not accumulated from the previous block (TOWER_SYSTEM.md §3, DECISIONS.md D-036).
 * Each block's transform is therefore computed independently of every other block.
 */
export function computeBlockTransform(block: LogicalBlock, config: TowerRenderConfig): BlockPixelTransform {
  const scale = config.blockWidthPx / BLOCK_WIDTH_UNITS;
  return {
    x: config.originX + block.offsetU * scale,
    y: config.originY - logicalYFromOrdinal(block.ordinal) * scale,
    rotation: rotationMdToRadians(block.rotationMd),
  };
}

/** Deterministic easeOutQuad, t clamped to [0,1]. No overshoot, no randomness. */
export function ease(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) ** 2;
}

/**
 * Minimal P4 tower-top follow: translates the whole tower container by a non-negative pixel
 * offset once the topmost committed block's local top edge would cross the fixed safe band —
 * never before. Pure function of already-placed geometry; never touches TowerModel. Deliberately
 * NOT the P8 camera system (no easing, no zone-driven behavior) — see
 * docs/work/TASK-P4-basic-renderer.md.
 */
export function computeCameraOffsetY(topmostBlockLocalY: number, config: TowerRenderConfig): number {
  const topEdge = topmostBlockLocalY - config.blockHeightPx / 2;
  const deficit = config.cameraSafeBandPx - topEdge;
  return Math.max(0, deficit);
}
