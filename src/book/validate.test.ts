import { describe, expect, it } from 'vitest';
import { BookBuilder } from '../test-fixtures/bookBuilder';
import { BookValidationError, validateBook } from './validate';
import type { Book } from './schema';

type Raw = { id: number; payoutMultiplier: number; events: Record<string, unknown>[] };

/** Deep clone through JSON so mutations for negative tests never touch the typed original. */
function clone(book: Book): Raw {
  return JSON.parse(JSON.stringify(book)) as Raw;
}

function survivingBook(payoutMultiplier: number): Book {
  return new BookBuilder()
    .towerStart('cleanSurvive', 'normal')
    .blocks(3)
    .survive(1)
    .setWin(payoutMultiplier)
    .setTotalWin(payoutMultiplier)
    .finalWin(payoutMultiplier)
    .build(1, payoutMultiplier);
}

function collapsingBook(): Book {
  return new BookBuilder()
    .towerStart('quickCollapse', 'quick')
    .blocks(3)
    .collapse('leanLeft')
    .setTotalWin(0)
    .finalWin(0)
    .build(2, 0);
}

function moonBook(): Book {
  return new BookBuilder()
    .towerStart('moonRun', 'exceptional')
    .blocks(3)
    .zoneChange('skyline')
    .blocks(3)
    .zoneChange('sky')
    .blocks(3)
    .zoneChange('atmosphere')
    .blocks(3)
    .zoneChange('space')
    .blocks(3)
    .moon(0)
    .wincap(1_000_000)
    .setTotalWin(1_000_000)
    .finalWin(1_000_000)
    .build(3, 1_000_000);
}

describe('validateBook — valid Books pass', () => {
  it('accepts a minimal survive Book', () => {
    expect(() => validateBook(survivingBook(500))).not.toThrow();
  });

  it('accepts a minimal collapse Book', () => {
    expect(() => validateBook(collapsingBook())).not.toThrow();
  });

  it('accepts a minimal Moon Book', () => {
    expect(() => validateBook(moonBook())).not.toThrow();
  });

  it('does not assert a relative order between setWin and setTotalWin', () => {
    const setWinFirst = new BookBuilder()
      .towerStart('cleanSurvive', 'normal')
      .blocks(3)
      .survive(1)
      .setWin(500)
      .setTotalWin(500)
      .finalWin(500)
      .build(1, 500);
    const setTotalWinFirst = new BookBuilder()
      .towerStart('cleanSurvive', 'normal')
      .blocks(3)
      .survive(1)
      .setTotalWin(500)
      .setWin(500)
      .finalWin(500)
      .build(1, 500);

    expect(() => validateBook(setWinFirst)).not.toThrow();
    expect(() => validateBook(setTotalWinFirst)).not.toThrow();
  });
});

describe('validateBook — envelope', () => {
  it('rejects non-object input', () => {
    expect(() => validateBook(null)).toThrow(BookValidationError);
    expect(() => validateBook('nope')).toThrow(BookValidationError);
    expect(() => validateBook([])).toThrow(BookValidationError);
  });

  it('rejects a missing id', () => {
    const raw = clone(collapsingBook());
    // @ts-expect-error deliberately malformed for the test
    delete raw.id;
    expect(() => validateBook(raw)).toThrow(BookValidationError);
  });

  it('rejects an empty events array', () => {
    const raw = clone(collapsingBook());
    raw.events = [];
    expect(() => validateBook(raw)).toThrow(BookValidationError);
  });

  it('rejects a payoutMultiplier not on Payout Ladder V1', () => {
    const raw = clone(collapsingBook());
    raw.payoutMultiplier = 151;
    expect(() => validateBook(raw)).toThrow(BookValidationError);
  });
});

describe('validateBook — event type / index', () => {
  it('rejects an unknown event type', () => {
    const raw = clone(collapsingBook());
    raw.events[1].type = 'somethingElse';
    expect(() => validateBook(raw)).toThrow(/unknown event type/);
  });

  it('rejects a non-zero starting index', () => {
    const raw = clone(collapsingBook());
    raw.events[0].index = 1;
    expect(() => validateBook(raw)).toThrow(BookValidationError);
  });

  it('rejects a gap in event indices', () => {
    const raw = clone(collapsingBook());
    raw.events[2].index = 5;
    expect(() => validateBook(raw)).toThrow(BookValidationError);
  });

  it('rejects a duplicate event index', () => {
    const raw = clone(collapsingBook());
    raw.events[2].index = raw.events[1].index;
    expect(() => validateBook(raw)).toThrow(BookValidationError);
  });
});

describe('validateBook — towerStart', () => {
  it('rejects towerStart not at index 0', () => {
    const b = new BookBuilder().blocks(1).towerStart('quickCollapse', 'quick').build(1, 0);
    expect(() => validateBook(b)).toThrow(/towerStart must be at index 0/);
  });

  it('rejects an unknown archetype', () => {
    const raw = clone(collapsingBook());
    raw.events[0].archetype = 'notAnArchetype';
    expect(() => validateBook(raw)).toThrow(/unknown archetype/);
  });

  it('rejects an unknown pace', () => {
    const raw = clone(collapsingBook());
    raw.events[0].pace = 'ludicrous';
    expect(() => validateBook(raw)).toThrow(/unknown pace/);
  });

  it('rejects a visualSeed outside uint32 range', () => {
    const raw = clone(collapsingBook());
    raw.events[0].visualSeed = -1;
    expect(() => validateBook(raw)).toThrow(BookValidationError);
  });
});

describe('validateBook — block', () => {
  it('rejects a skipped ordinal', () => {
    const raw = clone(collapsingBook());
    raw.events[2].ordinal = 9;
    expect(() => validateBook(raw)).toThrow(/ordinal/);
  });

  it('rejects offsetU out of range', () => {
    const raw = clone(collapsingBook());
    raw.events[1].offsetU = 9000;
    expect(() => validateBook(raw)).toThrow(/offsetU/);
  });

  it('rejects rotationMd out of range', () => {
    const raw = clone(collapsingBook());
    raw.events[1].rotationMd = -9000;
    expect(() => validateBook(raw)).toThrow(/rotationMd/);
  });

  it('rejects intensity out of range', () => {
    const raw = clone(collapsingBook());
    raw.events[1].intensity = 9;
    expect(() => validateBook(raw)).toThrow(/intensity/);
  });

  it('rejects an invalid direction value', () => {
    const raw = clone(collapsingBook());
    raw.events[1].direction = 2;
    expect(() => validateBook(raw)).toThrow(/direction/);
  });

  it('rejects an unknown behavior', () => {
    const raw = clone(collapsingBook());
    raw.events[1].behavior = 'explode';
    expect(() => validateBook(raw)).toThrow(/unknown behavior/);
  });
});

describe('validateBook — zone', () => {
  it('rejects skipping a zone', () => {
    const b = new BookBuilder()
      .towerStart('standardCollapse', 'normal')
      .blocks(3)
      .zoneChange('sky') // skips skyline
      .blocks(3)
      .collapse('leanLeft')
      .setTotalWin(0)
      .finalWin(0)
      .build(1, 0);
    expect(() => validateBook(b)).toThrow(/does not move exactly one zone forward/);
  });

  it('rejects a zone segment with fewer than 3 blocks', () => {
    const b = new BookBuilder()
      .towerStart('standardCollapse', 'normal')
      .blocks(2)
      .collapse('leanLeft')
      .setTotalWin(0)
      .finalWin(0)
      .build(1, 0);
    expect(() => validateBook(b)).toThrow(/expected 3-5/);
  });

  it('rejects a zone segment with more than 5 blocks', () => {
    const b = new BookBuilder()
      .towerStart('bigClimb', 'long')
      .blocks(6)
      .survive(1)
      .setWin(100)
      .setTotalWin(100)
      .finalWin(100)
      .build(1, 100);
    expect(() => validateBook(b)).toThrow(/expected 3-5/);
  });

  it('rejects a 0x Book reaching Atmosphere (GAME-008)', () => {
    const b = new BookBuilder()
      .towerStart('cruelCollapse', 'normal')
      .blocks(3)
      .zoneChange('skyline')
      .blocks(3)
      .zoneChange('sky')
      .blocks(3)
      .zoneChange('atmosphere')
      .blocks(3)
      .collapse('leanLeft')
      .setTotalWin(0)
      .finalWin(0)
      .build(1, 0);
    expect(() => validateBook(b)).toThrow(/GAME-008/);
  });
});

describe('validateBook — terminal events', () => {
  it('rejects collapse when payout > 0', () => {
    const raw = clone(survivingBook(500));
    raw.events[4] = { index: 4, type: 'collapse', profile: 'leanLeft', intensity: 4 };
    expect(() => validateBook(raw)).toThrow(/collapse only allowed/);
  });

  it('rejects survive when payout === 0', () => {
    const raw = clone(collapsingBook());
    raw.events[4] = { index: 4, type: 'survive', intensity: 1 };
    expect(() => validateBook(raw)).toThrow(/survive only allowed/);
  });

  it('rejects a narrative event after the terminal event', () => {
    const b = new BookBuilder()
      .towerStart('quickCollapse', 'quick')
      .blocks(3)
      .collapse('leanLeft')
      .block();
    expect(() => validateBook(b.build(1, 0))).toThrow(/after terminal event/);
  });
});

describe('validateBook — moon', () => {
  it('rejects moon in a non-Max-Win Book', () => {
    const b = new BookBuilder().towerStart('wobbleWin', 'normal').blocks(3).moon(0);
    expect(() => validateBook(b.build(1, 500))).toThrow(/moon only allowed when payoutMultiplier/);
  });

  it('rejects a 10,000x Book missing moon', () => {
    const b = new BookBuilder()
      .towerStart('moonRun', 'exceptional')
      .blocks(3)
      .zoneChange('skyline')
      .blocks(3)
      .zoneChange('sky')
      .blocks(3)
      .zoneChange('atmosphere')
      .blocks(3)
      .zoneChange('space')
      .blocks(3)
      .survive(2)
      .wincap(1_000_000)
      .setTotalWin(1_000_000)
      .finalWin(1_000_000)
      .build(1, 1_000_000);
    expect(() => validateBook(b)).toThrow(/missing moon/);
  });

  it('rejects moon before zoneChange:space', () => {
    const b = new BookBuilder()
      .towerStart('moonRun', 'exceptional')
      .blocks(3)
      .zoneChange('skyline')
      .blocks(3)
      .zoneChange('sky')
      .blocks(3)
      .zoneChange('atmosphere')
      .blocks(3)
      .moon(0);
    expect(() => validateBook(b.build(1, 1_000_000))).toThrow(/after zoneChange:space/);
  });
});

describe('validateBook — result events', () => {
  it('rejects setWin present on a 0x Book', () => {
    const b = new BookBuilder()
      .towerStart('quickCollapse', 'quick')
      .blocks(3)
      .collapse('leanLeft')
      .setWin(0)
      .setTotalWin(0)
      .finalWin(0)
      .build(1, 0);
    expect(() => validateBook(b)).toThrow(/setWin must be absent for a 0x Book/);
  });

  it('rejects a missing setTotalWin', () => {
    const b = new BookBuilder()
      .towerStart('quickCollapse', 'quick')
      .blocks(3)
      .collapse('leanLeft')
      .finalWin(0)
      .build(1, 0);
    expect(() => validateBook(b)).toThrow(/missing setTotalWin/);
  });

  it('rejects a missing finalWin', () => {
    const b = new BookBuilder()
      .towerStart('quickCollapse', 'quick')
      .blocks(3)
      .collapse('leanLeft')
      .setTotalWin(0)
      .build(1, 0);
    expect(() => validateBook(b)).toThrow(/missing finalWin/);
  });

  it('rejects setWin present alongside wincap', () => {
    const b = new BookBuilder()
      .towerStart('moonRun', 'exceptional')
      .blocks(3)
      .zoneChange('skyline')
      .blocks(3)
      .zoneChange('sky')
      .blocks(3)
      .zoneChange('atmosphere')
      .blocks(3)
      .zoneChange('space')
      .blocks(3)
      .moon(0)
      .setWin(1_000_000)
      .wincap(1_000_000)
      .setTotalWin(1_000_000)
      .finalWin(1_000_000)
      .build(1, 1_000_000);
    expect(() => validateBook(b)).toThrow(/setWin must be absent when wincap applies/);
  });

  it('rejects wincap outside the 10,000x case', () => {
    const b = new BookBuilder()
      .towerStart('cleanSurvive', 'normal')
      .blocks(3)
      .survive(1)
      .setWin(500)
      .wincap(500)
      .setTotalWin(500)
      .finalWin(500)
      .build(1, 500);
    expect(() => validateBook(b)).toThrow(/wincap only allowed when payoutMultiplier/);
  });

  it('rejects finalWin.amount !== payoutMultiplier', () => {
    const raw = clone(survivingBook(500));
    raw.events[raw.events.length - 1].amount = 999;
    expect(() => validateBook(raw)).toThrow(/finalWin.amount must equal payoutMultiplier/);
  });

  it('rejects finalWin when it is not the last event', () => {
    const b = new BookBuilder()
      .towerStart('cleanSurvive', 'normal')
      .blocks(3)
      .survive(1)
      .setWin(500)
      .finalWin(500)
      .setTotalWin(500)
      .build(1, 500);
    expect(() => validateBook(b)).toThrow(/finalWin must be the last event/);
  });

  it('rejects a 10,000x Book with moon present but wincap missing', () => {
    const b = new BookBuilder()
      .towerStart('moonRun', 'exceptional')
      .blocks(3)
      .zoneChange('skyline')
      .blocks(3)
      .zoneChange('sky')
      .blocks(3)
      .zoneChange('atmosphere')
      .blocks(3)
      .zoneChange('space')
      .blocks(3)
      .moon(0)
      .setTotalWin(1_000_000)
      .finalWin(1_000_000)
      .build(1, 1_000_000);
    expect(() => validateBook(b)).toThrow(/missing wincap/);
  });

  it('rejects setWin.amount !== payoutMultiplier', () => {
    const raw = clone(survivingBook(500));
    raw.events[5].amount = 999; // setWin
    expect(() => validateBook(raw)).toThrow(/setWin.amount must equal payoutMultiplier/);
  });

  it('rejects setTotalWin.amount !== payoutMultiplier', () => {
    const raw = clone(survivingBook(500));
    raw.events[6].amount = 999; // setTotalWin
    expect(() => validateBook(raw)).toThrow(/setTotalWin.amount must equal payoutMultiplier/);
  });

  it('rejects wincap.amount !== payoutMultiplier', () => {
    const raw = clone(moonBook());
    const wincapEvent = raw.events.find((event) => event.type === 'wincap');
    if (!wincapEvent) throw new Error('expected moonBook() to contain a wincap event');
    wincapEvent.amount = 999;
    expect(() => validateBook(raw)).toThrow(/wincap.amount must equal payoutMultiplier/);
  });

  it('rejects a duplicate setWin', () => {
    const b = new BookBuilder()
      .towerStart('cleanSurvive', 'normal')
      .blocks(3)
      .survive(1)
      .setWin(500)
      .setWin(500)
      .setTotalWin(500)
      .finalWin(500)
      .build(1, 500);
    expect(() => validateBook(b)).toThrow(/duplicate setWin/);
  });

  it('rejects a duplicate setTotalWin', () => {
    const b = new BookBuilder()
      .towerStart('cleanSurvive', 'normal')
      .blocks(3)
      .survive(1)
      .setWin(500)
      .setTotalWin(500)
      .setTotalWin(500)
      .finalWin(500)
      .build(1, 500);
    expect(() => validateBook(b)).toThrow(/duplicate setTotalWin/);
  });

  it('rejects a duplicate wincap', () => {
    const b = new BookBuilder()
      .towerStart('moonRun', 'exceptional')
      .blocks(3)
      .zoneChange('skyline')
      .blocks(3)
      .zoneChange('sky')
      .blocks(3)
      .zoneChange('atmosphere')
      .blocks(3)
      .zoneChange('space')
      .blocks(3)
      .moon(0)
      .wincap(1_000_000)
      .wincap(1_000_000)
      .setTotalWin(1_000_000)
      .finalWin(1_000_000)
      .build(1, 1_000_000);
    expect(() => validateBook(b)).toThrow(/duplicate wincap/);
  });

  it('rejects a duplicate finalWin', () => {
    const b = new BookBuilder()
      .towerStart('cleanSurvive', 'normal')
      .blocks(3)
      .survive(1)
      .setWin(500)
      .setTotalWin(500)
      .finalWin(500)
      .finalWin(500)
      .build(1, 500);
    expect(() => validateBook(b)).toThrow(/duplicate finalWin/);
  });
});
