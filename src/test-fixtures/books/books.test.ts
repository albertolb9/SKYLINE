import { describe, expect, it } from 'vitest';
import { validateBook } from '../../book/validate';
import { WINCAP_X100 } from '../../book/payout';
import { FIXTURE_BOOKS } from './index';
import * as fixtures from './index';

describe('fixture Books — P1 exit criterion', () => {
  it('all 11 target fixtures are present', () => {
    expect(FIXTURE_BOOKS).toHaveLength(11);
  });

  it.each(FIXTURE_BOOKS.map((book) => [book.name ?? String(book.id), book] as const))(
    '%s validates',
    (_name, book) => {
      expect(() => validateBook(book)).not.toThrow();
    },
  );

  it('every fixture id is unique', () => {
    const ids = FIXTURE_BOOKS.map((book) => book.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('fixture Books — product-level constraints (PROTOTYPE_V1.md §6)', () => {
  it('0x fixtures collapse; positive fixtures survive or reach Moon', () => {
    for (const book of FIXTURE_BOOKS) {
      const terminal = book.events.find((event) =>
        event.type === 'collapse' || event.type === 'survive' || event.type === 'moon',
      );
      if (book.payoutMultiplier === 0) {
        expect(terminal?.type).toBe('collapse');
      } else {
        expect(['survive', 'moon']).toContain(terminal?.type);
      }
    }
  });

  it('only moonRun10000x contains a moon event', () => {
    for (const book of FIXTURE_BOOKS) {
      const hasMoon = book.events.some((event) => event.type === 'moon');
      expect(hasMoon).toBe(book === fixtures.moonRun10000x);
    }
  });

  it('spaceRun5000x reaches Space without a moon event', () => {
    const zones = fixtures.spaceRun5000x.events
      .filter((event) => event.type === 'zoneChange')
      .map((event) => (event as { zone: string }).zone);
    expect(zones.at(-1)).toBe('space');
    expect(fixtures.spaceRun5000x.events.some((event) => event.type === 'moon')).toBe(false);
  });

  it('cruelCollapseSky0x reaches exactly Sky (GAME-008 boundary)', () => {
    const zones = fixtures.cruelCollapseSky0x.events
      .filter((event) => event.type === 'zoneChange')
      .map((event) => (event as { zone: string }).zone);
    expect(zones).toEqual(['skyline', 'sky']);
  });

  it('each traversed normal zone has 3-5 block events', () => {
    for (const book of FIXTURE_BOOKS) {
      let count = 0;
      for (const event of book.events) {
        if (event.type === 'block') {
          count += 1;
        } else if (event.type === 'zoneChange' || event.type === 'collapse' || event.type === 'survive' || event.type === 'moon') {
          if (count > 0 || event.type === 'zoneChange') {
            expect(count).toBeGreaterThanOrEqual(3);
            expect(count).toBeLessThanOrEqual(5);
          }
          count = 0;
        }
      }
    }
  });

  it('collapse profiles demonstrate both left and right danger', () => {
    const profiles = FIXTURE_BOOKS.flatMap((book) =>
      book.events.filter((event) => event.type === 'collapse').map((event) => (event as { profile: string }).profile),
    );
    expect(profiles).toContain('leanLeft');
    expect(profiles).toContain('leanRight');
  });

  it('bigClimb100x has a quiet stretch immediately before its major danger beat', () => {
    const blocks = fixtures.bigClimb100x.events.filter((event) => event.type === 'block') as {
      behavior: string;
    }[];
    const lastIndex = blocks.length - 1;
    expect(blocks[lastIndex].behavior).toBe('nearFall');
    expect(blocks[lastIndex - 1].behavior).toBe('clean');
    expect(blocks[lastIndex - 2].behavior).toBe('clean');
    expect(blocks[lastIndex - 3].behavior).toBe('clean');
  });
});

describe('fixture Books — result events match their payout class', () => {
  it('0x fixtures carry setTotalWin(0)/finalWin(0) and no setWin/wincap', () => {
    for (const book of FIXTURE_BOOKS.filter((b) => b.payoutMultiplier === 0)) {
      const types = book.events.map((event) => event.type);
      expect(types).not.toContain('setWin');
      expect(types).not.toContain('wincap');
      expect(types).toContain('setTotalWin');
      expect(types).toContain('finalWin');
    }
  });

  it('the 10,000x fixture carries wincap and no setWin', () => {
    const types = fixtures.moonRun10000x.events.map((event) => event.type);
    expect(types).toContain('wincap');
    expect(types).not.toContain('setWin');
  });

  it('positive non-cap fixtures carry setWin and no wincap', () => {
    for (const book of FIXTURE_BOOKS.filter(
      (b) => b.payoutMultiplier > 0 && b.payoutMultiplier !== WINCAP_X100,
    )) {
      const types = book.events.map((event) => event.type);
      expect(types).toContain('setWin');
      expect(types).not.toContain('wincap');
    }
  });
});

// Determinism coverage (stand-in for DET-T001 ahead of the P2 Book Player) lives in
// src/test-fixtures/bookBuilder.test.ts — the two tests previously here compared an ES
// module import to itself (same cached object reference) and JSON.stringify(book) to
// itself, neither of which could ever fail. Removed during the post-P1 audit.
