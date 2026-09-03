import { describe, expect, it } from 'vitest';
import { BookBuilder } from './bookBuilder';

/**
 * Real determinism coverage for the builder every P1 fixture relies on (replaces the
 * meaningless ES-module-re-import "determinism" tests removed from books.test.ts during
 * the post-P1 audit — module re-import returns the same cached object, so it could never
 * fail). This exercises the actual risk surface: two independent instances built from
 * identical explicit calls must not diverge via any hidden/leaking counter state.
 */
describe('BookBuilder determinism', () => {
  function buildSample() {
    return new BookBuilder()
      .towerStart('cleanSurvive', 'normal', 42)
      .block({ behavior: 'clean' })
      .block({ behavior: 'offset', offsetU: -600, rotationMd: -500, direction: -1 })
      .block({ behavior: 'clean' })
      .zoneChange('skyline')
      .block({ behavior: 'wobble', offsetU: 750, rotationMd: 700, direction: 1, intensity: 2 })
      .block({ behavior: 'clean' })
      .block({ behavior: 'clean' })
      .survive(1)
      .setWin(150)
      .setTotalWin(150)
      .finalWin(150)
      .build(999, 150, 'determinism-sample');
  }

  it('produces byte-identical output across independent instances given identical calls', () => {
    const a = buildSample();
    const b = buildSample();

    expect(a).not.toBe(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not leak index/ordinal counter state between instances', () => {
    const first = new BookBuilder().towerStart('quickCollapse', 'quick').blocks(5).build(1, 0);
    const second = new BookBuilder().towerStart('quickCollapse', 'quick').blocks(5).build(2, 0);

    expect(first.events.map((event) => event.index)).toEqual(
      second.events.map((event) => event.index),
    );
  });
});
