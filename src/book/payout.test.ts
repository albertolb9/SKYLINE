import { describe, expect, it } from 'vitest';
import {
  fromMultiplier,
  isOnPayoutLadder,
  PAYOUT_LADDER_X100,
  toMultiplier,
  WINCAP_X100,
} from './payout';

describe('payout conversion', () => {
  it('converts ×100 fixed-point values to actual multipliers', () => {
    expect(toMultiplier(0)).toBe(0);
    expect(toMultiplier(100)).toBe(1);
    expect(toMultiplier(250)).toBe(2.5);
    expect(toMultiplier(1_000_000)).toBe(10_000);
  });

  it('converts actual multipliers to ×100 fixed-point values', () => {
    expect(fromMultiplier(0)).toBe(0);
    expect(fromMultiplier(1)).toBe(100);
    expect(fromMultiplier(2.5)).toBe(250);
    expect(fromMultiplier(10_000)).toBe(1_000_000);
  });

  it('round-trips every Payout Ladder V1 value', () => {
    for (const x100 of PAYOUT_LADDER_X100) {
      expect(fromMultiplier(toMultiplier(x100))).toBe(x100);
    }
  });

  it('recognizes ladder membership', () => {
    expect(isOnPayoutLadder(0)).toBe(true);
    expect(isOnPayoutLadder(1_000_000)).toBe(true);
    expect(isOnPayoutLadder(150)).toBe(true);
    expect(isOnPayoutLadder(151)).toBe(false);
    expect(isOnPayoutLadder(-1)).toBe(false);
  });

  it('wincap constant matches the top of the ladder', () => {
    expect(WINCAP_X100).toBe(PAYOUT_LADDER_X100[PAYOUT_LADDER_X100.length - 1]);
  });
});
