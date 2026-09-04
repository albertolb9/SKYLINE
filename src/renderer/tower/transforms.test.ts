import { describe, expect, it } from 'vitest';
import {
  BLOCK_HEIGHT_UNITS,
  BLOCK_WIDTH_UNITS,
  DEFAULT_TOWER_VIEWPORT_TUNING,
  computeBlockTransform,
  computeCameraOffsetY,
  computeTowerViewportConfig,
  ease,
  logicalYFromOrdinal,
  rotationMdToRadians,
  type TowerRenderConfig,
} from './transforms';
import type { LogicalBlock } from '../../tower/model';

describe('computeTowerViewportConfig', () => {
  it('derives blockWidthPx from viewport width for a mobile viewport, within the tuning clamp', () => {
    const config = computeTowerViewportConfig(390, 844);
    expect(config.blockWidthPx).toBeCloseTo(390 * DEFAULT_TOWER_VIEWPORT_TUNING.widthFraction);
    expect(config.blockWidthPx).toBeGreaterThanOrEqual(DEFAULT_TOWER_VIEWPORT_TUNING.minBlockWidthPx);
    expect(config.blockWidthPx).toBeLessThanOrEqual(DEFAULT_TOWER_VIEWPORT_TUNING.maxBlockWidthPx);
    expect(config.originX).toBe(195);
  });

  it('clamps blockWidthPx at maxBlockWidthPx for a wide desktop viewport, so wide screens show more tower, not bigger blocks', () => {
    const config = computeTowerViewportConfig(1280, 800);
    expect(config.blockWidthPx).toBe(DEFAULT_TOWER_VIEWPORT_TUNING.maxBlockWidthPx);
    expect(config.originX).toBe(640);
  });

  it('produces the exact empty margin below the first block bottom edge, matching bottomMarginBlocks', () => {
    const viewportHeight = 844;
    const config = computeTowerViewportConfig(390, viewportHeight);
    const firstBlockBottom = config.originY + config.blockHeightPx / 2;
    expect(viewportHeight - firstBlockBottom).toBeCloseTo(
      config.blockHeightPx * DEFAULT_TOWER_VIEWPORT_TUNING.bottomMarginBlocks,
    );
  });
});

describe('logicalYFromOrdinal', () => {
  it('stacks blocks with zero gaps starting at ordinal 1', () => {
    expect(logicalYFromOrdinal(1)).toBe(0);
    expect(logicalYFromOrdinal(2)).toBe(BLOCK_HEIGHT_UNITS);
    expect(logicalYFromOrdinal(5)).toBe(4 * BLOCK_HEIGHT_UNITS);
  });
});

describe('rotationMdToRadians', () => {
  it('matches TOWER_SYSTEM.md §4 worked examples', () => {
    expect(rotationMdToRadians(1000)).toBeCloseTo((1 * Math.PI) / 180);
    expect(rotationMdToRadians(-2500)).toBeCloseTo((-2.5 * Math.PI) / 180);
    expect(rotationMdToRadians(0)).toBe(0);
  });
});

describe('ease', () => {
  it('is 0 at t=0, 1 at t=1, and matches the closed-form easeOutQuad value at t=0.5', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.75);
  });

  it('is monotonically increasing across [0,1] and clamps outside it', () => {
    const samples = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1].map(ease);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
});

describe('computeBlockTransform', () => {
  const config: TowerRenderConfig = {
    originX: 200,
    originY: 800,
    blockWidthPx: 100,
    blockHeightPx: 40,
    dropDurationMs: 450,
    cameraSafeBandPx: 96,
  };

  it('places a zero-offset ordinal-1 block exactly at the origin', () => {
    const block: LogicalBlock = {
      ordinal: 1,
      offsetU: 0,
      rotationMd: 0,
      behavior: 'clean',
      intensity: 0,
      direction: 0,
    };
    expect(computeBlockTransform(block, config)).toEqual({ x: 200, y: 800, rotation: 0 });
  });

  it('places a nonzero-offset block at its exact authored offset, never pulled toward center', () => {
    const scale = config.blockWidthPx / BLOCK_WIDTH_UNITS;
    const block: LogicalBlock = {
      ordinal: 3,
      offsetU: -1500,
      rotationMd: 1000,
      behavior: 'offset',
      intensity: 1,
      direction: -1,
    };
    const transform = computeBlockTransform(block, config);
    expect(transform.x).toBeCloseTo(200 + -1500 * scale);
    expect(transform.y).toBeCloseTo(800 - logicalYFromOrdinal(3) * scale);
    expect(transform.rotation).toBeCloseTo(rotationMdToRadians(1000));
  });

  it('computes each block independently of every other block — no accumulation (D-036)', () => {
    const scale = config.blockWidthPx / BLOCK_WIDTH_UNITS;
    const blockA: LogicalBlock = {
      ordinal: 5,
      offsetU: 2000,
      rotationMd: 0,
      behavior: 'offset',
      intensity: 1,
      direction: 1,
    };
    const blockB: LogicalBlock = { ...blockA, ordinal: 6 };
    const transformA = computeBlockTransform(blockA, config);
    const transformB = computeBlockTransform(blockB, config);
    // Same offsetU at two different ordinals must land at the same X. If X accumulated from
    // prior blocks, two blocks sharing offsetU at different depths would NOT share x.
    expect(transformB.x).toBe(transformA.x);
    expect(transformA.x).toBeCloseTo(config.originX + 2000 * scale);
  });
});

describe('computeCameraOffsetY', () => {
  const config: TowerRenderConfig = {
    originX: 200,
    originY: 800,
    blockWidthPx: 100,
    blockHeightPx: 40,
    dropDurationMs: 450,
    cameraSafeBandPx: 96,
  };

  it('is zero while the topmost block stays below the safe band', () => {
    expect(computeCameraOffsetY(800, config)).toBe(0);
    expect(computeCameraOffsetY(120, config)).toBe(0); // topEdge = 100, still >= 96
  });

  it('is the exact positive deficit once the topmost block crosses the safe band', () => {
    // topEdge = 80 - 20 = 60, deficit = 96 - 60 = 36
    expect(computeCameraOffsetY(80, config)).toBe(36);
  });
});
